// server/routes/purchaseOrders.js
const express = require('express');
const router = express.Router();
const { query, get, run, transaction } = require('../db');
const { logAction } = require('../services/auditService');

function generatePONumber() {
    const year = new Date().getFullYear();
    const last = get(`
        SELECT po_number FROM purchase_orders 
        WHERE po_number LIKE ? 
        ORDER BY id DESC LIMIT 1
    `, [`PO-${year}-%`]);

    if (!last || !last.po_number) {
        return `PO-${year}-001`;
    }
    const parts = last.po_number.split('-');
    const seq = parseInt(parts[2], 10) + 1;
    return `PO-${year}-${String(seq).padStart(3, '0')}`;
}

/**
 * Derive accurate operational status for a PO based on real transactions
 */
function derivePOStatus(poId, explicitStatus = null) {
    if (explicitStatus === 'Cancelled') return 'Cancelled';

    const po = get('SELECT ordered_quantity FROM purchase_orders WHERE id = ?', [poId]);
    if (!po) return explicitStatus || 'New';

    const ord = Number(po.ordered_quantity);

    const allocRow = get(`SELECT COALESCE(SUM(allocated_quantity), 0) as total FROM industry_allocations WHERE po_id = ? AND status != 'Cancelled'`, [poId]);
    const alloc = Number(allocRow?.total || 0);

    const loadRow = get(`SELECT COALESCE(SUM(loading_quantity), 0) as total FROM loading_entries WHERE po_id = ? AND loading_status != 'Cancelled'`, [poId]);
    const load = Number(loadRow?.total || 0);

    const dspRow = get(`SELECT COALESCE(SUM(dispatch_quantity), 0) as total FROM dispatches WHERE po_id = ?`, [poId]);
    const dsp = Number(dspRow?.total || 0);

    if (dsp >= ord && ord > 0) return 'Completed';
    if (dsp > 0) return 'Partially Dispatched';
    if (load >= ord && ord > 0) return 'Loaded';
    if (load > 0) return 'Partially Loaded';
    if (alloc >= ord && ord > 0) return 'Allocated';
    if (alloc > 0) return 'Partially Allocated';
    return 'New';
}

// GET all purchase orders with calculated quantities, customer rates, and derived statuses
router.get('/', (req, res) => {
    try {
        const { buyerId, productId, status, startDate, endDate, search } = req.query;

        let sql = `
            SELECT 
                po.*,
                c.name as customer_name,
                c.whatsapp_number as customer_whatsapp,
                p.name as product_name,
                p.code as product_code,
                p.variety as product_variety,
                p.unit as product_unit,
                COALESCE(alloc_stats.total_allocated, 0) as allocated_quantity,
                COALESCE(load_stats.total_loaded, 0) as loaded_quantity,
                COALESCE(dsp_stats.total_dispatched, 0) as dispatched_quantity,
                MAX(0, po.ordered_quantity - COALESCE(dsp_stats.total_dispatched, 0)) as remaining_quantity,
                (po.ordered_quantity * po.customer_selling_rate) as order_value,
                COALESCE(alloc_stats.weighted_purchase_rate, 0) as weighted_purchase_rate
            FROM purchase_orders po
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON po.product_id = p.id
            LEFT JOIN (
                SELECT 
                    po_id,
                    SUM(allocated_quantity) as total_allocated,
                    CASE WHEN SUM(allocated_quantity) > 0 
                         THEN ROUND(SUM(purchase_amount) / SUM(allocated_quantity), 2)
                         ELSE 0 END as weighted_purchase_rate
                FROM industry_allocations
                WHERE status != 'Cancelled'
                GROUP BY po_id
            ) alloc_stats ON po.id = alloc_stats.po_id
            LEFT JOIN (
                SELECT 
                    po_id,
                    SUM(loading_quantity) as total_loaded
                FROM loading_entries
                WHERE loading_status != 'Cancelled'
                GROUP BY po_id
            ) load_stats ON po.id = load_stats.po_id
            LEFT JOIN (
                SELECT 
                    po_id,
                    SUM(dispatch_quantity) as total_dispatched
                FROM dispatches
                GROUP BY po_id
            ) dsp_stats ON po.id = dsp_stats.po_id
            WHERE 1=1
        `;

        const params = [];
        if (buyerId) {
            sql += ' AND po.customer_id = ?';
            params.push(buyerId);
        }
        if (productId) {
            sql += ' AND po.product_id = ?';
            params.push(productId);
        }
        if (status) {
            sql += ' AND po.status = ?';
            params.push(status);
        }
        if (startDate) {
            sql += ' AND po.po_date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            sql += ' AND po.po_date <= ?';
            params.push(endDate);
        }
        if (search) {
            sql += ' AND (po.po_number LIKE ? OR c.name LIKE ? OR p.name LIKE ?)';
            const q = `%${search}%`;
            params.push(q, q, q);
        }

        sql += ' ORDER BY po.po_date DESC, po.id DESC';

        const pos = query(sql, params);
        res.json({ purchaseOrders: pos });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single PO detail with allocations, loadings, dispatches, reservations
router.get('/:id', (req, res) => {
    try {
        const po = get(`
            SELECT 
                po.*,
                c.name as customer_name,
                c.contact_person,
                c.phone as customer_phone,
                c.whatsapp_number as customer_whatsapp,
                c.gstin as customer_gstin,
                p.name as product_name,
                p.code as product_code,
                p.variety as product_variety,
                p.unit as product_unit
            FROM purchase_orders po
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON po.product_id = p.id
            WHERE po.id = ?
        `, [req.params.id]);

        if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

        // Internal Sourcing Allocations
        const allocations = query(`
            SELECT 
                ia.*,
                i.name as industry_name,
                i.location as industry_location,
                COALESCE(SUM(le.loading_quantity), 0) as loaded_quantity,
                MAX(0, ia.allocated_quantity - COALESCE(SUM(le.loading_quantity), 0)) as pending_loading_quantity
            FROM industry_allocations ia
            JOIN industries i ON ia.industry_id = i.id
            LEFT JOIN loading_entries le ON ia.id = le.allocation_id AND le.loading_status != 'Cancelled'
            WHERE ia.po_id = ?
            GROUP BY ia.id
            ORDER BY ia.id ASC
        `, [po.id]);

        // Loading entries
        const loadings = query(`
            SELECT 
                le.*,
                i.name as industry_name,
                w.name as warehouse_name
            FROM loading_entries le
            JOIN industries i ON le.industry_id = i.id
            LEFT JOIN warehouses w ON le.warehouse_id = w.id
            WHERE le.po_id = ?
            ORDER BY le.loading_date DESC
        `, [po.id]);

        // Dispatches
        const dispatches = query(`
            SELECT 
                d.*,
                le.loading_number,
                w.name as warehouse_name
            FROM dispatches d
            JOIN loading_entries le ON d.loading_id = le.id
            LEFT JOIN warehouses w ON d.warehouse_id = w.id
            WHERE d.po_id = ?
            ORDER BY d.dispatch_date DESC
        `, [po.id]);

        // Active Stock Reservations for this PO
        const reservations = query(`
            SELECT 
                r.*,
                w.name as warehouse_name
            FROM stock_reservations r
            LEFT JOIN warehouses w ON r.warehouse_id = w.id
            WHERE r.po_id = ?
            ORDER BY r.id ASC
        `, [po.id]);

        // Fulfillment Calculations
        const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.allocated_quantity) || 0), 0);
        const totalLoaded = loadings.reduce((sum, l) => sum + (Number(l.loading_quantity) || 0), 0);
        const totalDispatched = dispatches.reduce((sum, d) => sum + (Number(d.dispatch_quantity) || 0), 0);
        const remainingQty = Math.max(0, po.ordered_quantity - totalDispatched);

        // Weighted average procurement cost
        const totalProcurementCost = allocations.reduce((sum, a) => sum + (Number(a.purchase_amount) || 0), 0);
        const weightedAvgPurchaseRate = totalAllocated > 0 ? Number((totalProcurementCost / totalAllocated).toFixed(2)) : 0;
        const totalRevenue = po.ordered_quantity * po.customer_selling_rate;
        const estimatedGrossMargin = totalAllocated > 0 ? Number((totalRevenue - (totalAllocated * weightedAvgPurchaseRate)).toFixed(2)) : 0;

        res.json({
            purchaseOrder: po,
            allocations,
            loadings,
            dispatches,
            reservations,
            stats: {
                totalAllocated,
                totalLoaded,
                totalDispatched,
                remainingQuantity: remainingQty,
                fulfillmentPercentage: Number(((totalDispatched / po.ordered_quantity) * 100).toFixed(1)),
                weightedAvgPurchaseRate,
                totalProcurementCost,
                totalRevenue,
                estimatedGrossMargin
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Purchase Order
router.post('/', (req, res) => {
    try {
        const {
            customer_id,
            product_id,
            po_date,
            ordered_quantity,
            customer_selling_rate,
            delivery_location,
            expected_delivery_date,
            notes
        } = req.body;

        if (!customer_id || !product_id || !ordered_quantity || !customer_selling_rate || !delivery_location) {
            return res.status(400).json({ error: 'Customer, product, quantity, selling rate, and delivery location are required' });
        }

        const poNumber = generatePONumber();
        const date = po_date || new Date().toISOString().split('T')[0];

        const stmt = run(`
            INSERT INTO purchase_orders (
                po_number, customer_id, product_id, po_date,
                ordered_quantity, customer_selling_rate, delivery_location,
                expected_delivery_date, notes, status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?)
        `, [
            poNumber,
            customer_id,
            product_id,
            date,
            Number(ordered_quantity),
            Number(customer_selling_rate),
            delivery_location,
            expected_delivery_date || null,
            notes || '',
            req.user?.fullName || 'Staff'
        ]);

        logAction('PurchaseOrder', stmt.lastInsertRowid, 'CREATE', req.user?.username || 'Staff', { poNumber, customer_id, ordered_quantity });
        res.status(201).json({ id: stmt.lastInsertRowid, poNumber, message: 'Purchase Order created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Purchase Order
router.put('/:id', (req, res) => {
    try {
        const {
            customer_id,
            product_id,
            po_date,
            ordered_quantity,
            customer_selling_rate,
            delivery_location,
            expected_delivery_date,
            notes
        } = req.body;

        run(`
            UPDATE purchase_orders
            SET customer_id = ?, product_id = ?, po_date = ?, ordered_quantity = ?,
                customer_selling_rate = ?, delivery_location = ?, expected_delivery_date = ?,
                notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            customer_id,
            product_id,
            po_date,
            Number(ordered_quantity),
            Number(customer_selling_rate),
            delivery_location,
            expected_delivery_date,
            notes,
            req.params.id
        ]);

        // Recalculate derived status
        const derivedStatus = derivePOStatus(req.params.id);
        run('UPDATE purchase_orders SET status = ? WHERE id = ?', [derivedStatus, req.params.id]);

        logAction('PurchaseOrder', req.params.id, 'UPDATE', req.user?.username || 'Staff', req.body);
        res.json({ message: 'Purchase Order updated successfully', status: derivedStatus });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cancel Purchase Order with validation
router.post('/:id/cancel', (req, res) => {
    try {
        const dsp = get('SELECT COUNT(*) as count FROM dispatches WHERE po_id = ?', [req.params.id]);
        if (dsp.count > 0) {
            return res.status(400).json({ error: 'Cannot cancel a purchase order that already has dispatched quantities!' });
        }

        run("UPDATE purchase_orders SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);
        run("UPDATE industry_allocations SET status = 'Cancelled' WHERE po_id = ?", [req.params.id]);
        run("UPDATE stock_reservations SET status = 'Released' WHERE po_id = ?", [req.params.id]);

        logAction('PurchaseOrder', req.params.id, 'CANCEL', req.user?.username || 'Staff');
        res.json({ message: 'Purchase Order cancelled successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = {
    router,
    derivePOStatus
};
