// server/routes/purchaseOrders.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { query, get, run, transaction } = require('../db');
const { logAction } = require('../services/auditService');
const { pushReverseUpdateToOrdersPortal } = require('./integration');

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
    if (explicitStatus === 'Accepted') return 'Accepted';
    if (explicitStatus === 'In Progress') return 'In Progress';
    if (explicitStatus === 'Dispatched') return 'Dispatched';
    if (explicitStatus === 'Completed') return 'Completed';

    const po = get('SELECT ordered_quantity, status FROM purchase_orders WHERE id = ?', [poId]);
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

    // Preserve Accepted or In Progress status if no loading/allocation yet
    if (po.status === 'Accepted' || po.status === 'In Progress') {
        return po.status;
    }
    return explicitStatus || po.status || 'New';
}

// GET all purchase orders with calculated quantities, customer rates, and derived statuses
router.get('/', (req, res) => {
    try {
        const { buyerId, productId, status, startDate, endDate, search, sortOrder, sort } = req.query;

        // Auto-seed from authentic App A orders if DB is completely empty (e.g. serverless cold boot)
        const poCount = get('SELECT COUNT(*) as c FROM purchase_orders');
        if (!poCount || poCount.c === 0) {
            try {
                const { syncFromLocalAppAOrders } = require('../services/appAListener');
                syncFromLocalAppAOrders();
            } catch (err) {
                console.warn('[PO Route] Auto-seed check notice:', err.message);
            }
        }

        let sql = `
            SELECT 
                po.*,
                COALESCE(c.name, po.customer_name_text, 'Designated Buyer') as customer_name,
                COALESCE(c.whatsapp_number, po.customer_contact_text, '+91 98800 12345') as customer_whatsapp,
                COALESCE(p.name, 'Keshar Kali') as product_name,
                COALESCE(p.code, 'PROD-KK') as product_code,
                COALESCE(p.variety, 'Standard Steamed Rice') as product_variety,
                COALESCE(p.unit, 'QTL') as product_unit,
                COALESCE(alloc_stats.total_allocated, 0) as allocated_quantity,
                COALESCE(load_stats.total_loaded, 0) as loaded_quantity,
                COALESCE(dsp_stats.total_dispatched, 0) as dispatched_quantity,
                MAX(0, po.ordered_quantity - COALESCE(load_stats.total_loaded, 0)) as remaining_quantity,
                (po.ordered_quantity * po.customer_selling_rate) as order_value,
                COALESCE(alloc_stats.weighted_purchase_rate, 0) as weighted_purchase_rate
            FROM purchase_orders po
            LEFT JOIN customers c ON po.customer_id = c.id
            LEFT JOIN products p ON po.product_id = p.id
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
        if (req.user && req.user.role === 'Supplier') {
            const allowedSupplierId = req.user.supplierId || 5;
            sql += ' AND (po.supplier_id = ? OR po.supplier_id IS NULL OR po.supplier_id = 0 OR po.supplier_id = 5)';
            params.push(allowedSupplierId);
        }
        if (buyerId) {
            sql += ` AND (
                po.customer_id = ? 
                OR po.id IN (
                    SELECT po_id FROM po_sub_orders 
                    WHERE buyer_name = (SELECT name FROM customers WHERE id = ?)
                )
            )`;
            params.push(buyerId, buyerId);
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
            sql += ` AND (
                po.po_number LIKE ? 
                OR c.name LIKE ? 
                OR p.name LIKE ?
                OR po.sub_order_no LIKE ?
                OR po.sub_orders_json LIKE ?
                OR po.customer_name_text LIKE ?
                OR po.original_order_id LIKE ?
                OR po.id IN (
                    SELECT po_id FROM po_sub_orders 
                    WHERE sub_order_no LIKE ? OR buyer_name LIKE ? OR bill_no LIKE ?
                )
            )`;
            const q = `%${search}%`;
            params.push(q, q, q, q, q, q, q, q, q, q);
        }

        const orderPref = (sortOrder || sort || 'new-to-old').toLowerCase();
        if (orderPref === 'oldest' || orderPref === 'asc' || orderPref === 'old-to-new' || orderPref === 'old_to_new') {
            sql += ' ORDER BY po.po_date ASC, po.sub_order_no ASC, po.id ASC';
        } else {
            // Default: New to Old (Newest first)
            sql += ' ORDER BY po.po_date DESC, po.sub_order_no DESC, po.id DESC';
        }

        const pos = query(sql, params);
        for (const p of pos) {
            if (p.sub_orders_json) {
                try {
                    const rawList = JSON.parse(p.sub_orders_json);
                    p.sub_orders = rawList.map(s => ({
                        id: s.id,
                        sub_order_no: s.sub_order_no || s.subOrderNo,
                        subOrderNo: s.sub_order_no || s.subOrderNo,
                        buyer_name: s.buyer_name || s.buyerName,
                        buyerName: s.buyer_name || s.buyerName,
                        product_name: s.product_name || s.productName,
                        productName: s.product_name || s.productName,
                        ordered_quantity: s.ordered_quantity ?? s.orderedQuantity,
                        orderedQuantity: s.ordered_quantity ?? s.orderedQuantity,
                        rate: s.rate,
                        amount: s.amount,
                        bill_no: s.bill_no ?? s.billNo,
                        billNo: s.bill_no ?? s.billNo,
                        bill_url: s.bill_url || s.billUrl || null,
                        billUrl: s.bill_url || s.billUrl || null,
                        bill_file_name: s.bill_file_name || s.billFileName || null,
                        billFileName: s.bill_file_name || s.billFileName || null,
                        bill_uploaded_at: s.bill_uploaded_at || s.billUploadedAt || null,
                        billUploadedAt: s.bill_uploaded_at || s.billUploadedAt || null,
                        delivery_location: s.delivery_location || s.deliveryLocation,
                        deliveryLocation: s.delivery_location || s.deliveryLocation,
                        status: s.status
                    }));
                } catch (_) {
                    p.sub_orders = [];
                }
            } else {
                p.sub_orders = [];
            }
        }
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

        // Constituent Sub-Orders
        const rawSubOrders = query(`
            SELECT * FROM po_sub_orders WHERE po_id = ? ORDER BY id ASC
        `, [po.id]);
        let subOrders = (rawSubOrders || []).map(s => ({
            ...s,
            subOrderNo: s.sub_order_no,
            buyerName: s.buyer_name,
            productName: s.product_name,
            orderedQuantity: s.ordered_quantity,
            billNo: s.bill_no,
            bill_url: s.bill_url || null,
            billUrl: s.bill_url || null,
            bill_file_name: s.bill_file_name || null,
            billFileName: s.bill_file_name || null,
            bill_uploaded_at: s.bill_uploaded_at || null,
            billUploadedAt: s.bill_uploaded_at || null,
            deliveryLocation: s.delivery_location
        }));

        if (subOrders.length === 0 && po.sub_orders_json) {
            try {
                const parsed = JSON.parse(po.sub_orders_json);
                subOrders = parsed.map(s => ({
                    id: s.id,
                    sub_order_no: s.sub_order_no || s.subOrderNo,
                    subOrderNo: s.sub_order_no || s.subOrderNo,
                    buyer_name: s.buyer_name || s.buyerName,
                    buyerName: s.buyer_name || s.buyerName,
                    product_name: s.product_name || s.productName,
                    productName: s.product_name || s.productName,
                    ordered_quantity: s.ordered_quantity ?? s.orderedQuantity,
                    orderedQuantity: s.ordered_quantity ?? s.orderedQuantity,
                    rate: s.rate,
                    amount: s.amount,
                    bill_no: s.bill_no ?? s.billNo,
                    billNo: s.bill_no ?? s.billNo,
                    bill_url: s.bill_url || s.billUrl || null,
                    billUrl: s.bill_url || s.billUrl || null,
                    bill_file_name: s.bill_file_name || s.billFileName || null,
                    billFileName: s.bill_file_name || s.billFileName || null,
                    bill_uploaded_at: s.bill_uploaded_at || s.billUploadedAt || null,
                    billUploadedAt: s.bill_uploaded_at || s.billUploadedAt || null,
                    delivery_location: s.delivery_location || s.deliveryLocation,
                    deliveryLocation: s.delivery_location || s.deliveryLocation,
                    status: s.status
                }));
            } catch (_) {}
        }

        // Fulfillment Calculations
        const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.allocated_quantity) || 0), 0);
        const totalLoaded = loadings.reduce((sum, l) => sum + (Number(l.loading_quantity) || 0), 0);
        const totalDispatched = dispatches.reduce((sum, d) => sum + (Number(d.dispatch_quantity) || 0), 0);
        const remainingQty = Math.max(0, po.ordered_quantity - totalLoaded);

        // Weighted average procurement cost
        const totalProcurementCost = allocations.reduce((sum, a) => sum + (Number(a.purchase_amount) || 0), 0);
        const weightedAvgPurchaseRate = totalAllocated > 0 ? Number((totalProcurementCost / totalAllocated).toFixed(2)) : 0;
        const totalRevenue = po.ordered_quantity * po.customer_selling_rate;
        const estimatedGrossMargin = totalAllocated > 0 ? Number((totalRevenue - (totalAllocated * weightedAvgPurchaseRate)).toFixed(2)) : 0;

        res.json({
            purchaseOrder: po,
            subOrders,
            allocations,
            loadings,
            dispatches,
            reservations,
            stats: {
                totalAllocated,
                totalLoaded,
                totalDispatched,
                remainingQuantity: remainingQty,
                fulfillmentPercentage: Number(((totalLoaded / (po.ordered_quantity || 1)) * 100).toFixed(1)),
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

// Record Received Customer Purchase Order
router.post('/', (req, res) => {
    try {
        const {
            po_number,
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

        let assignedPoNumber = po_number ? String(po_number).trim() : '';
        if (assignedPoNumber) {
            const existing = get('SELECT id FROM purchase_orders WHERE po_number = ?', [assignedPoNumber]);
            if (existing) {
                return res.status(400).json({ error: `A purchase order with number ${assignedPoNumber} already exists in the system` });
            }
        } else {
            assignedPoNumber = generatePONumber();
        }

        const date = po_date || new Date().toISOString().split('T')[0];

        const stmt = run(`
            INSERT INTO purchase_orders (
                po_number, customer_id, product_id, po_date,
                ordered_quantity, customer_selling_rate, delivery_location,
                expected_delivery_date, notes, status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?)
        `, [
            assignedPoNumber,
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

        logAction('PurchaseOrder', stmt.lastInsertRowid, 'RECEIVE_PO', req.user?.username || 'Staff', { poNumber: assignedPoNumber, customer_id, ordered_quantity });
        res.status(201).json({ id: stmt.lastInsertRowid, poNumber: assignedPoNumber, message: 'Customer Purchase Order recorded successfully' });
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

// -------------------------------------------------------------
// Supplier Operational Actions & PO Chronological Ledger
// -------------------------------------------------------------

// 0. Supplier accepts ALL pending POs in bulk
router.post('/supplier-accept-all', async (req, res) => {
    try {
        const { supplier_id } = req.body || {};
        let targetSupplierId = supplier_id;
        if (req.user && req.user.role === 'Supplier' && req.user.supplierId) {
            targetSupplierId = req.user.supplierId;
        }

        let sql = "SELECT * FROM purchase_orders WHERE status IN ('New', 'Pending', 'Pending Acceptance', 'Awaiting Settlement')";
        const params = [];

        if (targetSupplierId && Number(targetSupplierId) !== 5) {
            sql += " AND (supplier_id = ? OR supplier_id IS NULL OR supplier_id = 0 OR supplier_id = 5)";
            params.push(targetSupplierId);
        }

        const pendingPOs = query(sql, params);
        if (pendingPOs.length === 0) {
            return res.json({ success: true, count: 0, message: 'No pending purchase orders to accept.' });
        }

        const actor = req.user?.fullName || 'Bhagwathi Rice and Agro Industries';

        transaction(() => {
            for (const po of pendingPOs) {
                let updatedSubJson = po.sub_orders_json;
                if (po.sub_orders_json) {
                    try {
                        const parsed = JSON.parse(po.sub_orders_json);
                        updatedSubJson = JSON.stringify(parsed.map(s => ({ ...s, status: 'Accepted' })));
                    } catch (_) {}
                }

                run("UPDATE purchase_orders SET status = 'Accepted', sub_orders_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [updatedSubJson, po.id]);
                run("UPDATE po_sub_orders SET status = 'Accepted' WHERE po_id = ?", [po.id]);

                run(`
                    INSERT INTO po_ledger (po_id, po_number, event_type, title, description, actor)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    po.id,
                    po.po_number,
                    'PO_ACCEPTED',
                    'Order Confirmed & Accepted by Mill',
                    `Supplier ${actor} accepted PO ${po.po_number} (Bulk Accept). Loading schedule initiated.`,
                    actor
                ]);

                if (po.original_order_id) {
                    pushReverseUpdateToOrdersPortal({
                        orderId: po.original_order_id,
                        poNumber: po.po_number,
                        eventType: 'PO_ACCEPTED',
                        eventPayload: { status: 'Accepted' },
                        actor
                    }).catch(() => {});
                }
            }
        });

        // Persist accepted status to Cloud Firestore (awaited for serverless permanence)
        try {
            const { savePOToFirebase } = require('../services/appAListener');
            if (typeof savePOToFirebase === 'function') {
                await Promise.all(
                    pendingPOs.map(po => 
                        savePOToFirebase({ id: po.po_number, po_number: po.po_number, status: 'Accepted' }, po.po_number)
                    )
                );
            }
        } catch (fbErr) {
            console.warn('[Supplier Accept All] Firebase replication note:', fbErr.message);
        }

        // Also update local bundled JSON so future boots preserve accepted state
        try {
            const jsonPath = path.resolve(__dirname, '../db/appA_bhagwathi_orders.json');
            if (fs.existsSync(jsonPath)) {
                const orders = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                const acceptedNumbers = new Set(pendingPOs.map(p => p.po_number));
                const updatedOrders = orders.map(o => {
                    if (acceptedNumbers.has(o.poNumber)) {
                        return { ...o, status: 'Accepted' };
                    }
                    return o;
                });
                fs.writeFileSync(jsonPath, JSON.stringify(updatedOrders, null, 2), 'utf8');
            }
        } catch (_) {}

        logAction('PurchaseOrder', 'BULK', 'SUPPLIER_ACCEPT_ALL', actor);

        res.json({
            success: true,
            count: pendingPOs.length,
            message: `Successfully accepted all ${pendingPOs.length} pending purchase orders.`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. Supplier accepts PO
router.post('/:id/supplier-accept', async (req, res) => {
    try {
        const po = get('SELECT * FROM purchase_orders WHERE id = ? OR po_number = ?', [req.params.id, req.params.id]);
        if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

        if (req.user && req.user.role === 'Supplier' && req.user.supplierId) {
            if (po.supplier_id && po.supplier_id !== 0 && po.supplier_id !== 5 && String(po.supplier_id) !== String(req.user.supplierId)) {
                return res.status(403).json({ error: 'Unauthorized: You can only accept orders assigned to your milling unit.' });
            }
        }

        let updatedSubJson = po.sub_orders_json;
        if (po.sub_orders_json) {
            try {
                const parsed = JSON.parse(po.sub_orders_json);
                updatedSubJson = JSON.stringify(parsed.map(s => ({ ...s, status: 'Accepted' })));
            } catch (_) {}
        }

        run("UPDATE purchase_orders SET status = 'Accepted', sub_orders_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [updatedSubJson, po.id]);
        run("UPDATE po_sub_orders SET status = 'Accepted' WHERE po_id = ?", [po.id]);

        // Persist accepted status to Cloud Firestore (awaited for serverless permanence)
        try {
            const { savePOToFirebase } = require('../services/appAListener');
            if (typeof savePOToFirebase === 'function') {
                await savePOToFirebase({ id: po.po_number, po_number: po.po_number, status: 'Accepted' }, po.po_number);
            }
        } catch (fbErr) {
            console.warn('[Supplier Accept] Firebase replication note:', fbErr.message);
        }

        // Also update local bundled JSON so future boots preserve accepted state
        try {
            const jsonPath = path.resolve(__dirname, '../db/appA_bhagwathi_orders.json');
            if (fs.existsSync(jsonPath)) {
                const orders = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                const updatedOrders = orders.map(o => {
                    if (o.poNumber === po.po_number) {
                        return { ...o, status: 'Accepted' };
                    }
                    return o;
                });
                fs.writeFileSync(jsonPath, JSON.stringify(updatedOrders, null, 2), 'utf8');
            }
        } catch (_) {}

        const actor = req.user?.fullName || 'Bhagwathi Rice and Agro Industries';
        run(`
            INSERT INTO po_ledger (po_id, po_number, event_type, title, description, actor)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            po.id,
            po.po_number,
            'PO_ACCEPTED',
            'Order Confirmed & Accepted by Mill',
            `Supplier ${actor} accepted PO ${po.po_number}. Loading schedule initiated.`,
            actor
        ]);

        if (po.original_order_id) {
            pushReverseUpdateToOrdersPortal({
                orderId: po.original_order_id,
                poNumber: po.po_number,
                eventType: 'PO_ACCEPTED',
                eventPayload: { status: 'Accepted' },
                actor
            }).catch(() => {});
        }

        res.json({ success: true, message: 'PO accepted successfully by supplier', status: 'Accepted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Supplier raises clarification query
router.post('/:id/supplier-query', (req, res) => {
    try {
        const { queryText } = req.body;
        if (!queryText) return res.status(400).json({ error: 'Query text is required' });

        const po = get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
        if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

        run("UPDATE purchase_orders SET status = 'Query Raised', query_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [queryText, req.params.id]);

        const actor = req.user?.fullName || 'Supplier';
        run(`
            INSERT INTO po_ledger (po_id, po_number, event_type, title, description, actor)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            po.id,
            po.po_number,
            'QUERY_RAISED',
            'Clarification Query Raised',
            `Query: "${queryText}"`,
            actor
        ]);

        if (po.original_order_id) {
            pushReverseUpdateToOrdersPortal({
                orderId: po.original_order_id,
                poNumber: po.po_number,
                eventType: 'QUERY_RAISED',
                eventPayload: { queryText },
                actor
            }).catch(() => {});
        }

        res.json({ success: true, message: 'Clarification query registered and synced', status: 'Query Raised' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Supplier requests revised loading date
router.post('/:id/supplier-reschedule', (req, res) => {
    try {
        const { revisedDate, reason } = req.body;
        if (!revisedDate) return res.status(400).json({ error: 'Revised date is required' });

        const po = get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
        if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

        run("UPDATE purchase_orders SET revised_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [revisedDate, req.params.id]);

        const actor = req.user?.fullName || 'Supplier';
        run(`
            INSERT INTO po_ledger (po_id, po_number, event_type, title, description, actor)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            po.id,
            po.po_number,
            'DATE_REVISED',
            'Revised Loading Date Requested',
            `Supplier requested revised loading date: ${revisedDate}. Reason: ${reason || 'Operational adjustment'}`,
            actor
        ]);

        res.json({ success: true, message: 'Reschedule request recorded' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Chronological PO Ledger
router.get('/:id/ledger', (req, res) => {
    try {
        const entries = query('SELECT * FROM po_ledger WHERE po_id = ? ORDER BY id ASC', [req.params.id]);
        res.json({ success: true, ledger: entries });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Upload Bill (PDF or Image) for a specific Sub PO order
router.post('/:id/sub-orders/:subOrderNo/bill', async (req, res) => {
    try {
        const { id, subOrderNo } = req.params;
        const { billNo, fileName, fileData, mimeType } = req.body;

        const po = get('SELECT * FROM purchase_orders WHERE id = ? OR po_number = ?', [id, id]);
        if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

        if (!fileData) {
            return res.status(400).json({ error: 'File data is required to upload a bill' });
        }

        const cleanSubNo = decodeURIComponent(subOrderNo).trim();
        const uploadsDir = path.resolve(__dirname, '../../uploads/bills');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Determine file extension
        let ext = '.pdf';
        if (fileName && fileName.includes('.')) {
            ext = path.extname(fileName).toLowerCase();
        } else if (mimeType && mimeType.includes('png')) {
            ext = '.png';
        } else if (mimeType && (mimeType.includes('jpeg') || mimeType.includes('jpg'))) {
            ext = '.jpg';
        } else if (mimeType && mimeType.includes('webp')) {
            ext = '.webp';
        }

        // Clean base64 data and write file
        const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const safePoNum = po.po_number.replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeSubNo = cleanSubNo.replace(/[^a-zA-Z0-9_-]/g, '_');
        const savedFileName = `bill_${safePoNum}_${safeSubNo}_${Date.now()}${ext}`;
        const filePath = path.join(uploadsDir, savedFileName);

        fs.writeFileSync(filePath, buffer);
        const fileUrl = `/uploads/bills/${savedFileName}`;

        // 1. Update po_sub_orders table
        const existingSub = get(
            'SELECT * FROM po_sub_orders WHERE (po_id = ? OR po_number = ?) AND (sub_order_no = ? OR id = ?)',
            [po.id, po.po_number, cleanSubNo, cleanSubNo]
        );

        if (existingSub) {
            run(`
                UPDATE po_sub_orders SET
                    bill_no = COALESCE(?, bill_no),
                    bill_url = ?,
                    bill_file_name = ?,
                    bill_uploaded_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [billNo || null, fileUrl, fileName || savedFileName, existingSub.id]);
        } else {
            run(`
                INSERT INTO po_sub_orders (
                    po_id, po_number, sub_order_no, buyer_name, product_name,
                    ordered_quantity, rate, amount, bill_no, bill_url, bill_file_name, bill_uploaded_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                po.id, po.po_number, cleanSubNo, po.customer_name_text || 'Buyer',
                po.product_name || 'Rice', 0, 0, 0,
                billNo || null, fileUrl, fileName || savedFileName
            ]);
        }

        // 2. Update in purchase_orders.sub_orders_json
        let updatedSubList = [];
        if (po.sub_orders_json) {
            try {
                const parsed = JSON.parse(po.sub_orders_json);
                updatedSubList = parsed.map(s => {
                    const match = (s.sub_order_no && s.sub_order_no.toLowerCase() === cleanSubNo.toLowerCase()) ||
                                  (s.subOrderNo && s.subOrderNo.toLowerCase() === cleanSubNo.toLowerCase()) ||
                                  (s.id && String(s.id) === String(cleanSubNo));
                    if (match) {
                        return {
                            ...s,
                            bill_no: billNo || s.bill_no || s.billNo,
                            billNo: billNo || s.billNo || s.bill_no,
                            bill_url: fileUrl,
                            billUrl: fileUrl,
                            bill_file_name: fileName || savedFileName,
                            billFileName: fileName || savedFileName,
                            bill_uploaded_at: new Date().toISOString(),
                            billUploadedAt: new Date().toISOString()
                        };
                    }
                    return s;
                });
                run('UPDATE purchase_orders SET sub_orders_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
                    JSON.stringify(updatedSubList),
                    po.id
                ]);
            } catch (_) {}
        }

        // 3. Record in PO Ledger
        const actor = req.user?.fullName || 'Supplier Operations';
        run(`
            INSERT INTO po_ledger (po_id, po_number, event_type, title, description, actor)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            po.id,
            po.po_number,
            'SUB_ORDER_BILL_UPLOADED',
            `Bill Uploaded for Sub PO ${cleanSubNo}`,
            `Bill ${billNo ? '#' + billNo : ''} (${fileName || savedFileName}) uploaded for Sub PO ${cleanSubNo}.`,
            actor
        ]);

        res.json({
            success: true,
            message: `Bill document uploaded successfully for ${cleanSubNo}`,
            subOrderNo: cleanSubNo,
            billNo: billNo || null,
            billUrl: fileUrl,
            fileName: fileName || savedFileName,
            uploadedAt: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Delete/Clear bill document for a specific sub-order
router.delete('/:id/sub-orders/:subOrderNo/bill', (req, res) => {
    try {
        const { id, subOrderNo } = req.params;
        const po = get('SELECT * FROM purchase_orders WHERE id = ? OR po_number = ?', [id, id]);
        if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

        const cleanSubNo = decodeURIComponent(subOrderNo).trim();

        // 1. Update po_sub_orders
        run(`
            UPDATE po_sub_orders SET
                bill_url = NULL,
                bill_file_name = NULL,
                bill_uploaded_at = NULL
            WHERE (po_id = ? OR po_number = ?) AND (sub_order_no = ? OR id = ?)
        `, [po.id, po.po_number, cleanSubNo, cleanSubNo]);

        // 2. Update sub_orders_json
        if (po.sub_orders_json) {
            try {
                const parsed = JSON.parse(po.sub_orders_json);
                const updated = parsed.map(s => {
                    const match = (s.sub_order_no && s.sub_order_no.toLowerCase() === cleanSubNo.toLowerCase()) ||
                                  (s.subOrderNo && s.subOrderNo.toLowerCase() === cleanSubNo.toLowerCase()) ||
                                  (s.id && String(s.id) === String(cleanSubNo));
                    if (match) {
                        return {
                            ...s,
                            bill_url: null,
                            billUrl: null,
                            bill_file_name: null,
                            billFileName: null,
                            bill_uploaded_at: null,
                            billUploadedAt: null
                        };
                    }
                    return s;
                });
                run('UPDATE purchase_orders SET sub_orders_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
                    JSON.stringify(updated),
                    po.id
                ]);
            } catch (_) {}
        }

        res.json({ success: true, message: `Bill removed for sub-order ${cleanSubNo}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = {
    router,
    derivePOStatus
};

