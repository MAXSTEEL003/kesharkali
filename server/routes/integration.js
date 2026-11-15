// server/routes/integration.js
// Cross-Project Integration Router for Supplier Portal (App B) <-> Orders Webapp (App A)
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { query, get, run, transaction } = require('../db');

const INTEGRATION_SECRET = process.env.INTEGRATION_SHARED_SECRET || "keshar_kali_tejas_cross_portal_sync_secret_2026";
const APP_A_WEBHOOK_URL = process.env.APP_A_WEBHOOK_URL || "http://localhost:3000/api/integration/supplier-update-webhook";

// Helper: HMAC Signature verification with 5-minute replay window
function verifyHmacSignature(req, res, next) {
    const signature = req.headers['x-integration-signature'];
    const timestamp = req.headers['x-integration-timestamp'];

    if (!signature || !timestamp) {
        return res.status(401).json({ error: 'Unauthorized: Missing integration signature or timestamp headers' });
    }

    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > 300000) {
        return res.status(401).json({ error: 'Unauthorized: Integration timestamp expired or invalid' });
    }

    const rawPayload = JSON.stringify(req.body);
    const expected = crypto
        .createHmac('sha256', INTEGRATION_SECRET)
        .update(`${timestamp}.${rawPayload}`)
        .digest('hex');

    try {
        const isMatch = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
        if (!isMatch) {
            return res.status(401).json({ error: 'Unauthorized: Invalid HMAC signature' });
        }
    } catch {
        return res.status(401).json({ error: 'Unauthorized: Signature verification mismatch' });
    }

    next();
}

/**
 * 1. POST /api/integration/receive-po
 * Inbound endpoint receiving supplier-facing POs generated from customer order acceptance in App A
 */
router.post('/receive-po', verifyHmacSignature, (req, res) => {
    const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey;
    const poData = req.body;

    if (!poData || !poData.poNumber || !poData.originalOrderId) {
        return res.status(400).json({ error: 'Missing required PO payload fields (poNumber, originalOrderId)' });
    }

    // Idempotency check: prevent duplicate PO generation
    if (idempotencyKey) {
        const existingSync = get('SELECT * FROM integration_sync_logs WHERE idempotency_key = ?', [idempotencyKey]);
        if (existingSync) {
            console.log(`[Integration B] Idempotent hit: ${idempotencyKey} already processed. Returning existing PO.`);
            const poRow = get('SELECT id FROM purchase_orders WHERE po_number = ?', [existingSync.supplier_po_number]);
            return res.json({
                success: true,
                duplicate: true,
                message: 'Duplicate request ignored (idempotent)',
                poId: poRow ? poRow.id : null,
                poNumber: existingSync.supplier_po_number,
                status: existingSync.status
            });
        }
    }

    try {
        let createdPoId = null;

        transaction((db) => {
            // 1. Resolve or create customer placeholder
            let customer = db.prepare('SELECT id FROM customers WHERE name = ?').get(poData.customerName);
            if (!customer) {
                const insertCust = db.prepare(`
                    INSERT INTO customers (name, contact_person, phone, whatsapp_number, address, city, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                const custResult = insertCust.run(
                    poData.customerName,
                    poData.customerName,
                    poData.customerContact || '',
                    poData.customerContact ? poData.customerContact.replace(/\D/g, '') : '919823011223',
                    poData.deliveryLocation || 'Direct Delivery',
                    'Nagpur/Regional',
                    `Auto-created via Orders Portal integration for Order ${poData.originalOrderId}`
                );
                customer = { id: custResult.lastInsertRowid };
            }

            // 2. Resolve product
            const firstItemName = poData.products && poData.products[0] ? poData.products[0].name : 'Keshar Kali';
            let product = db.prepare('SELECT id FROM products WHERE name LIKE ? OR code LIKE ?').get(`%${firstItemName}%`, `%${firstItemName}%`);
            if (!product) {
                product = db.prepare('SELECT id FROM products ORDER BY id ASC LIMIT 1').get();
            }
            const productId = product ? product.id : 1;

            // 3. Resolve supplier / industry
            let supplierId = parseInt(poData.supplierId, 10);
            if (isNaN(supplierId) || supplierId <= 0) {
                const ind = db.prepare('SELECT id FROM industries WHERE name LIKE ? LIMIT 1').get(`%${poData.supplierName || ''}%`);
                supplierId = ind ? ind.id : 1;
            }

            // 4. Check if PO with same po_number already exists
            const existingPo = db.prepare('SELECT id FROM purchase_orders WHERE po_number = ?').get(poData.poNumber);
            if (existingPo) {
                createdPoId = existingPo.id;
            } else {
                // Insert Purchase Order
                const poDate = poData.orderAcceptanceDate ? poData.orderAcceptanceDate.split('T')[0] : new Date().toISOString().split('T')[0];
                const insertPo = db.prepare(`
                    INSERT INTO purchase_orders (
                        po_number, customer_id, product_id, po_date, ordered_quantity, customer_selling_rate,
                        delivery_location, expected_delivery_date, notes, status, created_by,
                        original_order_id, supplier_id, supplier_rate, supplier_notes,
                        customer_name_text, customer_contact_text, sync_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                const poResult = insertPo.run(
                    poData.poNumber,
                    customer.id,
                    productId,
                    poDate,
                    poData.totalOrderedQuantity,
                    poData.agreedRate || 0, // Clean supplier agreed rate (no internal margin exposed)
                    poData.deliveryLocation || '',
                    poData.expectedLoadingDate || null,
                    poData.deliveryRequirements || '',
                    'New',
                    'Orders Portal Sync',
                    poData.originalOrderId,
                    supplierId,
                    poData.agreedRate || 0,
                    poData.specialInstructions || '',
                    poData.customerName,
                    poData.customerContact || '',
                    'Synced'
                );
                createdPoId = poResult.lastInsertRowid;
            }

            // 5. Record initial event in PO Ledger
            const insertLedger = db.prepare(`
                INSERT INTO po_ledger (po_id, po_number, event_type, title, description, actor, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            insertLedger.run(
                createdPoId,
                poData.poNumber,
                'PO_CREATED',
                'Supplier Purchase Order Received',
                `Allocated from Customer Order ${poData.originalOrderId} for ${poData.customerName}. Quantity: ${poData.totalOrderedQuantity} QTL @ ₹${poData.agreedRate}/QTL.`,
                'Orders Portal',
                JSON.stringify({ originalOrderId: poData.originalOrderId, supplierId, products: poData.products })
            );

            // 6. Record in integration_sync_logs
            if (idempotencyKey) {
                const insertSync = db.prepare(`
                    INSERT INTO integration_sync_logs (idempotency_key, direction, source_order_id, supplier_po_number, supplier_id, status, payload)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                insertSync.run(
                    idempotencyKey,
                    'INBOUND_PO',
                    poData.originalOrderId,
                    poData.poNumber,
                    supplierId,
                    'Success',
                    JSON.stringify(poData)
                );
            }
        });

        console.log(`[Integration B] Successfully created supplier PO ${poData.poNumber} for order ${poData.originalOrderId}`);
        res.json({
            success: true,
            message: 'Supplier Purchase Order successfully integrated',
            poNumber: poData.poNumber,
            poId: createdPoId
        });
    } catch (err) {
        console.error('[Integration B] Error saving inbound PO:', err);
        if (idempotencyKey) {
            try {
                run(`
                    INSERT INTO integration_sync_logs (idempotency_key, direction, source_order_id, supplier_po_number, status, payload, error_message)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [idempotencyKey, 'INBOUND_PO', poData.originalOrderId, poData.poNumber, 'Failed', JSON.stringify(poData), err.message]);
            } catch (_) {}
        }
        res.status(500).json({ error: 'Failed to process supplier PO', details: err.message });
    }
});

/**
 * 2. Helper: Push reverse update event to Application A (Orders Portal)
 */
async function pushReverseUpdateToOrdersPortal(event) {
    const timestamp = Date.now().toString();
    const payloadStr = JSON.stringify(event);
    const signature = crypto
        .createHmac('sha256', INTEGRATION_SECRET)
        .update(`${timestamp}.${payloadStr}`)
        .digest('hex');

    try {
        const response = await fetch(APP_A_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-integration-signature': signature,
                'x-integration-timestamp': timestamp
            },
            body: payloadStr
        });

        const success = response.ok;
        const respText = await response.text().catch(() => '');
        
        try {
            run(`
                INSERT INTO integration_sync_logs (idempotency_key, direction, source_order_id, supplier_po_number, status, payload, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                `REV_${event.eventType}_${Date.now()}`,
                'OUTBOUND_REVERSE',
                event.orderId,
                event.poNumber,
                success ? 'Success' : 'Failed',
                payloadStr,
                success ? null : respText.slice(0, 200)
            ]);
        } catch (_) {}

        return success;
    } catch (err) {
        console.warn(`[Reverse Sync] Failed to deliver ${event.eventType} to App A:`, err.message);
        try {
            run(`
                INSERT INTO integration_sync_logs (idempotency_key, direction, source_order_id, supplier_po_number, status, payload, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                `REV_${event.eventType}_${Date.now()}`,
                'OUTBOUND_REVERSE',
                event.orderId,
                event.poNumber,
                'Failed',
                payloadStr,
                err.message
            ]);
        } catch (_) {}
        return false;
    }
}

/**
 * 3. GET /api/integration/sync-logs
 * Audit history of cross-project synchronization events
 */
router.get('/sync-logs', (req, res) => {
    try {
        const logs = query('SELECT * FROM integration_sync_logs ORDER BY id DESC LIMIT 50');
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 4. POST /api/integration/sync-app-a
 * Trigger on-demand sync from App A deployed Firestore (tejascanavssingstore/placed_orders)
 */
router.post('/sync-app-a', async (req, res) => {
    try {
        const { syncAllAppAOrders } = require('../services/appAListener');
        const result = await syncAllAppAOrders();
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 5. GET /api/integration/health
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'UP',
        service: 'Two-Portal Supplier Procurement Integration Bus',
        appB: 'Supplier Portal (kesharkaliportal)',
        timestamp: new Date().toISOString()
    });
});

module.exports = {
    router,
    pushReverseUpdateToOrdersPortal
};
