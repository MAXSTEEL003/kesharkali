// server/routes/dispatches.js
const express = require('express');
const router = express.Router();
const { query, get, run, transaction } = require('../db');
const { recordOutward, getAvailableStock } = require('../services/stockService');
const { sendDispatchNotification } = require('../services/whatsappService');
const { derivePOStatus } = require('./purchaseOrders');
const { logAction } = require('../services/auditService');
const { pushReverseUpdateToOrdersPortal } = require('./integration');

function generateDispatchNumber() {
    const year = new Date().getFullYear();
    const last = get(`
        SELECT dispatch_number FROM dispatches 
        WHERE dispatch_number LIKE ? 
        ORDER BY id DESC LIMIT 1
    `, [`DSP-${year}-%`]);

    if (!last || !last.dispatch_number) {
        return `DSP-${year}-001`;
    }
    const parts = last.dispatch_number.split('-');
    const seq = parseInt(parts[2], 10) + 1;
    return `DSP-${year}-${String(seq).padStart(3, '0')}`;
}

// GET all dispatches with customer, PO, product, and vehicle info
router.get('/', (req, res) => {
    try {
        const { poId, customerId, startDate, endDate } = req.query;
        let sql = `
            SELECT 
                d.*,
                po.po_number,
                po.ordered_quantity,
                po.customer_selling_rate,
                c.id as customer_id,
                c.name as customer_name,
                c.whatsapp_number,
                p.id as product_id,
                p.name as product_name,
                p.variety as product_variety,
                p.unit as product_unit,
                le.loading_number,
                le.loading_quantity,
                le.fulfillment_type,
                w.name as warehouse_name,
                wn.wa_message_id,
                wn.message_body as whatsapp_message_body,
                wn.status as wa_status
            FROM dispatches d
            JOIN purchase_orders po ON d.po_id = po.id
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON po.product_id = p.id
            JOIN loading_entries le ON d.loading_id = le.id
            LEFT JOIN warehouses w ON d.warehouse_id = w.id
            LEFT JOIN whatsapp_notifications wn ON d.id = wn.dispatch_id
            WHERE 1=1
        `;

        const params = [];
        if (req.user && req.user.role === 'Supplier' && req.user.supplierId) {
            sql += ' AND (le.industry_id = ? OR po.supplier_id = ?)';
            params.push(req.user.supplierId, req.user.supplierId);
        }
        if (poId) {
            sql += ' AND d.po_id = ?';
            params.push(poId);
        }
        if (customerId) {
            sql += ' AND po.customer_id = ?';
            params.push(customerId);
        }
        if (startDate) {
            sql += ' AND d.dispatch_date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            sql += ' AND d.dispatch_date <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY d.dispatch_date DESC, d.id DESC';

        const dispatches = query(sql, params);
        res.json({ dispatches });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET pending loadings ready for dispatch
router.get('/pending-loadings', (req, res) => {
    try {
        let sql = `
            SELECT 
                le.*,
                po.po_number,
                po.customer_selling_rate,
                po.ordered_quantity,
                po.delivery_location,
                c.id as customer_id,
                c.name as customer_name,
                c.whatsapp_number as customer_whatsapp,
                p.id as product_id,
                p.name as product_name,
                p.unit as product_unit,
                w.name as warehouse_name,
                COALESCE(dsp_stats.total_dispatched, 0) as dispatched_quantity,
                MAX(0, le.loading_quantity - COALESCE(dsp_stats.total_dispatched, 0)) as available_to_dispatch
            FROM loading_entries le
            JOIN purchase_orders po ON le.po_id = po.id
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON le.product_id = p.id
            LEFT JOIN warehouses w ON le.warehouse_id = w.id
            LEFT JOIN (
                SELECT loading_id, SUM(dispatch_quantity) as total_dispatched
                FROM dispatches
                GROUP BY loading_id
            ) dsp_stats ON le.id = dsp_stats.loading_id
            WHERE le.loading_status = 'Loaded' AND (le.loading_quantity - COALESCE(dsp_stats.total_dispatched, 0)) > 0
        `;

        const params = [];
        if (req.user && req.user.role === 'Supplier' && req.user.supplierId) {
            sql += ' AND (le.industry_id = ? OR po.supplier_id = ?)';
            params.push(req.user.supplierId, req.user.supplierId);
        }

        sql += ' ORDER BY le.loading_date ASC';

        const loadings = query(sql, params);
        res.json({ pendingLoadings: loadings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Confirm Dispatch (Supports Partial Dispatch, Warehouse Inventory Deduction, & WhatsApp Trigger)
router.post('/', async (req, res) => {
    try {
        const {
            loading_id,
            dispatch_date,
            dispatch_quantity,
            vehicle_number,
            driver_phone,
            remarks
        } = req.body;

        if (!loading_id || !dispatch_quantity) {
            return res.status(400).json({ error: 'Loading ID and dispatch quantity are required' });
        }

        const dspQty = Number(dispatch_quantity);
        if (dspQty <= 0) {
            return res.status(400).json({ error: 'Dispatch quantity must be greater than zero' });
        }

        // Fetch loading entry details
        const loading = get(`
            SELECT 
                le.*,
                po.id as po_id,
                po.po_number,
                po.ordered_quantity,
                po.original_order_id,
                c.name as customer_name,
                p.name as product_name,
                p.unit as product_unit
            FROM loading_entries le
            JOIN purchase_orders po ON le.po_id = po.id
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON le.product_id = p.id
            WHERE le.id = ?
        `, [loading_id]);

        if (!loading) return res.status(404).json({ error: 'Loading entry not found' });
        if (loading.loading_status === 'Cancelled') {
            return res.status(400).json({ error: 'Cannot dispatch from a cancelled loading entry' });
        }

        // Calculate already dispatched quantity for this loading entry
        const prevDspRow = get(`SELECT COALESCE(SUM(dispatch_quantity), 0) as total FROM dispatches WHERE loading_id = ?`, [loading.id]);
        const alreadyDispatched = Number(prevDspRow?.total || 0);
        const availableToDispatch = loading.loading_quantity - alreadyDispatched;

        if (dspQty > availableToDispatch) {
            return res.status(400).json({
                error: `Over-dispatch blocked! Attempted: ${dspQty} QTL. Only ${availableToDispatch} QTL remaining for Loading ${loading.loading_number}.`
            });
        }

        // Calculate remaining PO quantity
        const totalPoDspRow = get(`SELECT COALESCE(SUM(dispatch_quantity), 0) as total FROM dispatches WHERE po_id = ?`, [loading.po_id]);
        const totalPoDispatched = Number(totalPoDspRow?.total || 0);
        const poRemaining = loading.ordered_quantity - totalPoDispatched;

        if (dspQty > poRemaining) {
            return res.status(400).json({
                error: `Over-dispatch blocked! Order ${loading.po_number} only has ${poRemaining} QTL remaining.`
            });
        }

        const dispatchNumber = generateDispatchNumber();
        const date = dispatch_date || new Date().toISOString().split('T')[0];
        const vehicle = vehicle_number || loading.vehicle_number;
        const phone = driver_phone || loading.driver_phone || null;

        let newDispatchId;

        // Perform transactional dispatch and inventory update
        transaction((db) => {
            const stmt = db.prepare(`
                INSERT INTO dispatches (
                    dispatch_number, loading_id, po_id, dispatch_date,
                    dispatch_quantity, vehicle_number, driver_phone, source_type,
                    warehouse_id, remarks, notification_status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
            `);

            const result = stmt.run(
                dispatchNumber,
                loading.id,
                loading.po_id,
                date,
                dspQty,
                vehicle,
                phone,
                loading.fulfillment_type,
                loading.fulfillment_type === 'Warehouse' ? loading.warehouse_id : null,
                remarks || '',
                req.user?.fullName || 'Staff'
            );
            newDispatchId = result.lastInsertRowid;

            // Update Loading Entry dispatch status
            const newTotalDispatched = alreadyDispatched + dspQty;
            const loadingDspStatus = newTotalDispatched >= loading.loading_quantity ? 'Dispatched' : 'Partially Dispatched';
            db.prepare('UPDATE loading_entries SET dispatch_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(loadingDspStatus, loading.id);

            // Inventory Accounting: Deduct physical stock ONLY if dispatched from supplier's warehouse
            if (loading.fulfillment_type === 'Warehouse') {
                const wh = db.prepare('SELECT name FROM warehouses WHERE id = ?').get(loading.warehouse_id);

                recordOutward({
                    date,
                    productId: loading.product_id,
                    warehouseId: loading.warehouse_id,
                    transactionType: 'Customer Dispatch',
                    referenceNumber: dispatchNumber,
                    source: wh?.name || 'Warehouse',
                    destination: `${loading.customer_name} (PO: ${loading.po_number})`,
                    quantity: dspQty,
                    rate: loading.purchase_rate,
                    remarks: `Customer dispatch ${dispatchNumber} via vehicle ${vehicle} for PO ${loading.po_number}`
                }, db);
            }
            // If Direct dispatch, rice goes directly from mill to customer -> NO warehouse inventory deduction!

            // Update PO Status
            const newPOStatus = derivePOStatus(loading.po_id);
            db.prepare('UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newPOStatus, loading.po_id);

            // Record in PO Ledger
            db.prepare(`
                INSERT INTO po_ledger (po_id, po_number, event_type, title, description, actor, metadata)
                VALUES (?, ?, 'DISPATCH', ?, ?, ?, ?)
            `).run(
                loading.po_id,
                loading.po_number,
                'Transport Dispatched',
                `Vehicle ${vehicle} dispatched with ${dspQty} QTL. Driver: ${phone || '—'}. Ref: ${dispatchNumber}.`,
                req.user?.fullName || 'Supplier Staff',
                JSON.stringify({ dispatchId: newDispatchId, dispatchNumber, quantity: dspQty, vehicle, phone })
            );
        });

        logAction('Dispatch', newDispatchId, 'CREATE', req.user?.username || 'Staff', { dispatchNumber, dspQty, vehicle, fulfillment_type: loading.fulfillment_type });

        // Push reverse update to Orders Webapp (App A)
        if (loading.original_order_id) {
            pushReverseUpdateToOrdersPortal({
                orderId: loading.original_order_id,
                poNumber: loading.po_number,
                eventType: 'DISPATCH_CREATED',
                eventPayload: {
                    dispatchId: `dsp_${newDispatchId}`,
                    dispatchNumber,
                    poNumber: loading.po_number,
                    vehicleNumber: vehicle,
                    driverPhone: phone,
                    quantityDispatched: dspQty,
                    dispatchDate: date,
                    deliveryStatus: 'Dispatched',
                    remarks
                },
                status: 'Dispatched',
                loadedQuantity: dspQty,
                remainingQuantity: Math.max(0, poRemaining - dspQty)
            }).catch(e => console.error('[ReverseSync Dispatch] Error:', e.message));
        }

        // Trigger WhatsApp Notification
        let notificationResult = null;
        try {
            notificationResult = await sendDispatchNotification(newDispatchId);
        } catch (notifErr) {
            console.error('WhatsApp notification dispatch trigger error:', notifErr.message);
            notificationResult = { status: 'Failed', error: notifErr.message };
        }

        res.status(201).json({
            id: newDispatchId,
            dispatchNumber,
            message: 'Dispatch confirmed successfully and inventory reconciled.',
            notification: notificationResult
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

