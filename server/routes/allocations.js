// server/routes/allocations.js
const express = require('express');
const router = express.Router();
const { query, get, run, transaction } = require('../db');
const { derivePOStatus } = require('./purchaseOrders');
const { logAction } = require('../services/auditService');

// GET allocations for a PO or all active allocations
router.get('/', (req, res) => {
    try {
        const { poId } = req.query;
        let sql = `
            SELECT 
                ia.*,
                po.po_number,
                po.ordered_quantity,
                po.customer_selling_rate,
                c.name as customer_name,
                i.name as industry_name,
                i.location as industry_location,
                p.name as product_name,
                p.unit as product_unit,
                COALESCE(load_stats.total_loaded, 0) as loaded_quantity,
                MAX(0, ia.allocated_quantity - COALESCE(load_stats.total_loaded, 0)) as pending_loading_quantity
            FROM industry_allocations ia
            JOIN purchase_orders po ON ia.po_id = po.id
            JOIN customers c ON po.customer_id = c.id
            JOIN industries i ON ia.industry_id = i.id
            JOIN products p ON ia.product_id = p.id
            LEFT JOIN (
                SELECT 
                    allocation_id,
                    SUM(loading_quantity) as total_loaded
                FROM loading_entries
                WHERE loading_status != 'Cancelled'
                GROUP BY allocation_id
            ) load_stats ON ia.id = load_stats.allocation_id
            WHERE ia.status != 'Cancelled'
        `;
        const params = [];
        if (poId) {
            sql += ' AND ia.po_id = ?';
            params.push(poId);
        }
        sql += ' ORDER BY ia.created_at DESC';

        const allocations = query(sql, params);
        res.json({ allocations });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Sourcing Allocation for a PO
router.post('/', (req, res) => {
    try {
        const {
            po_id,
            industry_id,
            product_id,
            allocated_quantity,
            purchase_rate,
            expected_loading_date,
            notes,
            override_allowed = false
        } = req.body;

        if (!po_id || !industry_id || !allocated_quantity || !purchase_rate) {
            return res.status(400).json({ error: 'PO, industry, allocated quantity, and purchase rate are required' });
        }

        const po = get('SELECT * FROM purchase_orders WHERE id = ?', [po_id]);
        if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

        const prodId = product_id || po.product_id;
        const allocQty = Number(allocated_quantity);
        const rate = Number(purchase_rate);
        const amount = Number((allocQty * rate).toFixed(2));

        // Over-allocation check
        const currentAllocRow = get(`
            SELECT COALESCE(SUM(allocated_quantity), 0) as total
            FROM industry_allocations
            WHERE po_id = ? AND status != 'Cancelled'
        `, [po_id]);

        const currentAllocTotal = Number(currentAllocRow?.total || 0);
        const projectedTotal = currentAllocTotal + allocQty;

        if (projectedTotal > po.ordered_quantity && !override_allowed) {
            return res.status(400).json({
                error: `Over-allocation blocked! Order quantity: ${po.ordered_quantity} QTL. Currently allocated: ${currentAllocTotal} QTL. Attempted new total: ${projectedTotal} QTL. Authorized override required.`,
                requiresOverride: true,
                currentAllocated: currentAllocTotal,
                orderedQuantity: po.ordered_quantity,
                exceededBy: projectedTotal - po.ordered_quantity
            });
        }

        let newAllocId;
        transaction((db) => {
            const stmt = db.prepare(`
                INSERT INTO industry_allocations (
                    po_id, industry_id, product_id, allocated_quantity,
                    purchase_rate, purchase_amount, expected_loading_date,
                    notes, override_allowed, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
            `);
            const result = stmt.run(
                po_id,
                industry_id,
                prodId,
                allocQty,
                rate,
                amount,
                expected_loading_date || null,
                notes || '',
                override_allowed ? 1 : 0
            );
            newAllocId = result.lastInsertRowid;

            // Update derived PO status
            const newStatus = derivePOStatus(po_id);
            db.prepare('UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, po_id);
        });

        logAction('IndustryAllocation', newAllocId, 'CREATE', req.user?.username || 'Staff', { po_id, industry_id, allocQty, rate });

        res.status(201).json({
            id: newAllocId,
            message: 'Industry allocation created successfully'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Sourcing Allocation
router.put('/:id', (req, res) => {
    try {
        const { allocated_quantity, purchase_rate, expected_loading_date, notes, override_allowed } = req.body;
        const alloc = get('SELECT * FROM industry_allocations WHERE id = ?', [req.params.id]);
        if (!alloc) return res.status(404).json({ error: 'Allocation not found' });

        const newQty = Number(allocated_quantity || alloc.allocated_quantity);
        const newRate = Number(purchase_rate || alloc.purchase_rate);
        const newAmount = Number((newQty * newRate).toFixed(2));

        // Validate over-allocation against PO
        const po = get('SELECT * FROM purchase_orders WHERE id = ?', [alloc.po_id]);
        const otherAllocRow = get(`
            SELECT COALESCE(SUM(allocated_quantity), 0) as total
            FROM industry_allocations
            WHERE po_id = ? AND id != ? AND status != 'Cancelled'
        `, [alloc.po_id, alloc.id]);
        const otherTotal = Number(otherAllocRow?.total || 0);

        if (otherTotal + newQty > po.ordered_quantity && !override_allowed && !alloc.override_allowed) {
            return res.status(400).json({
                error: `Over-allocation blocked! Order quantity: ${po.ordered_quantity} QTL. Other allocations: ${otherTotal} QTL. New requested total: ${otherTotal + newQty} QTL.`,
                requiresOverride: true
            });
        }

        transaction((db) => {
            db.prepare(`
                UPDATE industry_allocations
                SET allocated_quantity = ?, purchase_rate = ?, purchase_amount = ?,
                    expected_loading_date = ?, notes = ?, override_allowed = COALESCE(?, override_allowed),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(newQty, newRate, newAmount, expected_loading_date, notes, override_allowed ? 1 : 0, req.params.id);

            const newStatus = derivePOStatus(alloc.po_id);
            db.prepare('UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, alloc.po_id);
        });

        logAction('IndustryAllocation', req.params.id, 'UPDATE', req.user?.username || 'Staff', req.body);
        res.json({ message: 'Allocation updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Allocation with validation
router.delete('/:id', (req, res) => {
    try {
        const alloc = get('SELECT * FROM industry_allocations WHERE id = ?', [req.params.id]);
        if (!alloc) return res.status(404).json({ error: 'Allocation not found' });

        const loadCheck = get("SELECT COUNT(*) as count FROM loading_entries WHERE allocation_id = ? AND loading_status != 'Cancelled'", [req.params.id]);
        if (loadCheck.count > 0) {
            return res.status(400).json({ error: `Cannot remove allocation with ${loadCheck.count} existing loading entries.` });
        }

        transaction((db) => {
            db.prepare('DELETE FROM industry_allocations WHERE id = ?').run(req.params.id);
            const newStatus = derivePOStatus(alloc.po_id);
            db.prepare('UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, alloc.po_id);
        });

        logAction('IndustryAllocation', req.params.id, 'DELETE', req.user?.username || 'Staff');
        res.json({ message: 'Allocation removed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

