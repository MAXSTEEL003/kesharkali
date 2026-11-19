// server/routes/integration.js
// Cross-Project Integration Router for Supplier Portal (App B) <-> Orders Webapp (App A)
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { query, get, run, transaction } = require('../db');

const APP_A_WEBHOOK_URL = process.env.APP_A_WEBHOOK_URL || "http://localhost:3000/api/integration/supplier-update-webhook";

// Helper: HMAC Signature verification with 5-minute replay window & secure secret validation
function verifyHmacSignature(req, res, next) {
    const secret = (process.env.INTEGRATION_SHARED_SECRET || '').trim();
    if (!secret) {
        console.error('[Integration B] INTEGRATION_SHARED_SECRET is not configured on server. Rejecting request.');
        return res.status(500).json({ error: 'Server configuration error: INTEGRATION_SHARED_SECRET is not configured' });
    }

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
        .createHmac('sha256', secret)
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
 * Full feature parity with appAListener: decomposes and persists all constituent sub-orders in po_sub_orders
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
        let isNewPo = false;
        let parsedSubOrders = [];
        let leadCustomerId = null;
        let leadBuyerName = '';
        let subOrderNoString = '';
        let productNameClean = 'Keshar Kali';
        let supplierId = 1;
        let totalOrderedQty = 0;
        let agreedRate = 0;

        transaction((db) => {
            // 1. Resolve Product
            const firstItemName = (poData.products && poData.products[0] && poData.products[0].name) ? poData.products[0].name : 'Keshar Kali';
            let product = db.prepare('SELECT id, name FROM products WHERE name LIKE ? OR code LIKE ?').get(`%${firstItemName}%`, `%${firstItemName}%`);
            if (!product) {
                product = db.prepare('SELECT id, name FROM products ORDER BY id ASC LIMIT 1').get();
            }
            const productId = product ? product.id : 1;
            productNameClean = product ? product.name : 'Keshar Kali';

            // 2. Resolve Supplier / Industry
            let parsedSupId = parseInt(poData.supplierId, 10);
            let ind = (!isNaN(parsedSupId) && parsedSupId > 0)
                ? db.prepare('SELECT id FROM industries WHERE id = ?').get(parsedSupId)
                : null;

            if (!ind) {
                const sName = (poData.supplierName || '').trim();
                ind = db.prepare('SELECT id FROM industries WHERE name LIKE ? LIMIT 1').get(`%${sName}%`);
            }
            if (!ind) {
                ind = db.prepare("SELECT id FROM industries WHERE is_default = 1 OR name LIKE '%Bhagwat%' LIMIT 1").get();
            }
            if (!ind) {
                ind = db.prepare('SELECT id FROM industries ORDER BY id ASC LIMIT 1').get();
            }
            supplierId = ind ? ind.id : 5;

            // 3. Extract and map constituent sub-orders (Preserve individual sub-orders)
            const rawSubOrders = (Array.isArray(poData.subOrders) && poData.subOrders.length > 0)
                ? poData.subOrders
                : ((Array.isArray(poData.originalOrders) && poData.originalOrders.length > 0) ? poData.originalOrders : []);

            totalOrderedQty = Number(poData.totalOrderedQuantity ?? 0);
            agreedRate = Number(poData.agreedRate ?? 0);
            const destination = String(poData.deliveryLocation || 'Consolidated Hub').trim();

            if (rawSubOrders.length > 0) {
                for (let idx = 0; idx < rawSubOrders.length; idx++) {
                    const so = rawSubOrders[idx];
                    const subQty = Number(so.orderedQuantity ?? so.ordered_quantity ?? so.qty ?? 0);
                    const subRate = Number(so.rate ?? agreedRate);
                    const subAmount = Number(so.amount ?? Math.round(subQty * subRate));
                    let subNo = String(so.subOrderNo || so.sub_order_no || so.supplierSubOrderNo || so.id || '').trim();
                    if (!subNo) {
                        subNo = `SO-${String(idx + 1).padStart(3, '0')}`;
                    }

                    const individualBuyer = String(so.buyerName || so.buyer_name || so.buyer || poData.customerName || 'Consolidated Buyer')
                        .replace(/\s*&\s*\d+\s+others?/gi, '')
                        .trim();

                    // Ensure individual customer record exists in App B SQLite
                    let subCust = db.prepare('SELECT id FROM customers WHERE name = ?').get(individualBuyer);
                    if (!subCust) {
                        const insertCust = db.prepare(`
                            INSERT INTO customers (name, contact_person, phone, whatsapp_number, address, city, active, notes)
                            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
                        `);
                        const custResult = insertCust.run(
                            individualBuyer,
                            'Purchasing Manager',
                            poData.customerContact || '+91 98800 12345',
                            poData.customerContact ? poData.customerContact.replace(/\D/g, '') : '919880012345',
                            String(so.deliveryLocation || so.delivery_location || so.unloadingPoint || destination).trim(),
                            'Bangalore/Regional',
                            `Auto-created via Orders Portal integration for PO ${poData.poNumber}`
                        );
                        subCust = { id: custResult.lastInsertRowid };
                    }

                    parsedSubOrders.push({
                        subOrderNo: subNo,
                        customerId: subCust ? subCust.id : null,
                        buyerName: individualBuyer,
                        productName: String(so.productName || so.product_name || so.product || productNameClean).trim(),
                        orderedQuantity: subQty,
                        rate: subRate,
                        amount: subAmount,
                        billNo: so.billNo || so.bill_no || null,
                        deliveryLocation: String(so.deliveryLocation || so.delivery_location || so.unloadingPoint || destination || 'shop').trim(),
                        status: so.status || 'Approved'
                    });
                }
            } else {
                // Single consolidated sub-order fallback
                const individualBuyer = String(poData.customerName || 'Consolidated Buyer').replace(/\s*&\s*\d+\s+others?/gi, '').trim();
                let subCust = db.prepare('SELECT id FROM customers WHERE name = ?').get(individualBuyer);
                if (!subCust) {
                    const insertCust = db.prepare(`
                        INSERT INTO customers (name, contact_person, phone, whatsapp_number, address, city, active, notes)
                        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
                    `);
                    const custResult = insertCust.run(
                        individualBuyer,
                        individualBuyer,
                        poData.customerContact || '',
                        poData.customerContact ? poData.customerContact.replace(/\D/g, '') : '919823011223',
                        destination,
                        'Nagpur/Regional',
                        `Auto-created via Orders Portal integration for PO ${poData.poNumber}`
                    );
                    subCust = { id: custResult.lastInsertRowid };
                }

                parsedSubOrders.push({
                    subOrderNo: poData.subOrderNo || 'SO-001',
                    customerId: subCust ? subCust.id : null,
                    buyerName: individualBuyer,
                    productName: productNameClean,
                    orderedQuantity: totalOrderedQty,
                    rate: agreedRate,
                    amount: Number(poData.totalOrderValue || Math.round(totalOrderedQty * agreedRate)),
                    billNo: null,
                    deliveryLocation: destination,
                    status: 'Approved'
                });
            }

            // Reconcile total quantity if header was omitted or 0
            const calculatedTotalQty = parsedSubOrders.reduce((sum, s) => sum + s.orderedQuantity, 0);
            if (totalOrderedQty <= 0 && calculatedTotalQty > 0) {
                totalOrderedQty = calculatedTotalQty;
            }
            if (agreedRate <= 0 && parsedSubOrders.length > 0) {
                agreedRate = parsedSubOrders[0].rate;
            }

            subOrderNoString = parsedSubOrders.map(s => s.subOrderNo).filter(Boolean).join(', ');
            leadCustomerId = parsedSubOrders[0]?.customerId || null;
            leadBuyerName = parsedSubOrders[0]?.buyerName || String(poData.customerName || 'Designated Buyer').trim();

            const poDate = poData.orderAcceptanceDate ? poData.orderAcceptanceDate.split('T')[0] : new Date().toISOString().split('T')[0];
            const subOrdersJsonStr = JSON.stringify(parsedSubOrders);

            // 4. Upsert Grouped Purchase Order (Prevent Duplicate POs)
            const existingPo = db.prepare('SELECT id, status FROM purchase_orders WHERE po_number = ?').get(poData.poNumber);
            if (existingPo) {
                createdPoId = existingPo.id;
                isNewPo = false;

                // Update PO header details while preserving existing status and allocations
                db.prepare(`
                    UPDATE purchase_orders SET
                        customer_id = ?,
                        product_id = ?,
                        po_date = ?,
                        ordered_quantity = ?,
                        customer_selling_rate = ?,
                        delivery_location = ?,
                        expected_delivery_date = COALESCE(?, expected_delivery_date),
                        notes = COALESCE(?, notes),
                        original_order_id = ?,
                        supplier_id = ?,
                        supplier_rate = ?,
                        supplier_notes = COALESCE(?, supplier_notes),
                        customer_name_text = ?,
                        customer_contact_text = ?,
                        sub_order_no = ?,
                        sub_orders_json = ?,
                        sync_status = 'Synced',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(
                    leadCustomerId,
                    productId,
                    poDate,
                    totalOrderedQty,
                    agreedRate,
                    destination,
                    poData.expectedLoadingDate || null,
                    poData.deliveryRequirements || null,
                    poData.originalOrderId,
                    supplierId,
                    agreedRate,
                    poData.specialInstructions || null,
                    leadBuyerName,
                    poData.customerContact || '+91 98800 12345',
                    subOrderNoString,
                    subOrdersJsonStr,
                    createdPoId
                );
            } else {
                isNewPo = true;
                const insertPo = db.prepare(`
                    INSERT INTO purchase_orders (
                        po_number, customer_id, product_id, po_date, ordered_quantity, customer_selling_rate,
                        delivery_location, expected_delivery_date, notes, status, created_by,
                        original_order_id, supplier_id, supplier_rate, supplier_notes,
                        customer_name_text, customer_contact_text, sub_order_no, bill_no,
                        sub_orders_json, sync_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                const poResult = insertPo.run(
                    poData.poNumber,
                    leadCustomerId,
                    productId,
                    poDate,
                    totalOrderedQty,
                    agreedRate,
                    destination,
                    poData.expectedLoadingDate || null,
                    poData.deliveryRequirements || `Imported via Orders Portal API. Order ${poData.originalOrderId}`,
                    'New',
                    'Orders Portal Sync',
                    poData.originalOrderId,
                    supplierId,
                    agreedRate,
                    poData.specialInstructions || '',
                    leadBuyerName,
                    poData.customerContact || '+91 98800 12345',
                    subOrderNoString,
                    null,
                    subOrdersJsonStr,
                    'Synced'
                );
                createdPoId = poResult.lastInsertRowid;
            }

            // 5. Upsert constituent sub-orders into po_sub_orders (prevent duplicates, preserve existing IDs and loadings)
            for (const s of parsedSubOrders) {
                const existingSub = db.prepare('SELECT id, loaded_quantity, bill_no, bill_url FROM po_sub_orders WHERE po_id = ? AND sub_order_no = ?').get(createdPoId, s.subOrderNo);
                if (existingSub) {
                    db.prepare(`
                        UPDATE po_sub_orders SET
                            customer_id = ?, buyer_name = ?, product_name = ?,
                            ordered_quantity = ?, rate = ?, amount = ?, bill_no = COALESCE(?, bill_no),
                            delivery_location = ?
                        WHERE id = ?
                    `).run(
                        s.customerId || leadCustomerId, s.buyerName, s.productName,
                        s.orderedQuantity, s.rate, s.amount, s.billNo,
                        s.deliveryLocation, existingSub.id
                    );
                } else {
                    db.prepare(`
                        INSERT INTO po_sub_orders (
                            po_id, po_number, sub_order_no, customer_id, buyer_name, product_name,
                            ordered_quantity, rate, amount, bill_no, delivery_location, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        createdPoId, poData.poNumber, s.subOrderNo, s.customerId || leadCustomerId, s.buyerName, s.productName,
                        s.orderedQuantity, s.rate, s.amount, s.billNo, s.deliveryLocation, s.status
                    );
                }
            }

            // 6. Record Initial Event in PO Ledger ONLY IF NEW PO (Strictly prevents duplicate ledger entries)
            if (isNewPo) {
                const insertLedger = db.prepare(`
                    INSERT INTO po_ledger (po_id, po_number, event_type, title, description, actor, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                insertLedger.run(
                    createdPoId,
                    poData.poNumber,
                    'PO_CREATED',
                    'Supplier Purchase Order Received',
                    `Allocated from Customer Order ${poData.originalOrderId} for ${leadBuyerName}. Total: ${totalOrderedQty} QTL @ ₹${agreedRate}/QTL with ${parsedSubOrders.length} constituent sub-order(s).`,
                    'Orders Portal',
                    JSON.stringify({ originalOrderId: poData.originalOrderId, supplierId, subOrdersCount: parsedSubOrders.length })
                );
            }

            // 7. Record in integration_sync_logs
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

        // 8. Replicate to App B Cloud Firestore (Asynchronously, fail-safe)
        try {
            const { savePOToFirebase, saveCustomerToFirebase, sanitizeDocId } = require('../services/appAListener');
            if (typeof savePOToFirebase === 'function') {
                const poFirebaseData = {
                    id: poData.poNumber,
                    po_number: poData.poNumber,
                    poNumber: poData.poNumber,
                    customer_name: leadBuyerName,
                    buyer: leadBuyerName,
                    buyer_name: leadBuyerName,
                    product_name: productNameClean,
                    product: productNameClean,
                    po_date: poData.orderAcceptanceDate ? poData.orderAcceptanceDate.split('T')[0] : new Date().toISOString().split('T')[0],
                    ordered_quantity: totalOrderedQty,
                    qty: totalOrderedQty,
                    customer_selling_rate: agreedRate,
                    rate: agreedRate,
                    delivery_location: poData.deliveryLocation || 'Consolidated Hub',
                    destination: poData.deliveryLocation || 'Consolidated Hub',
                    ...(isNewPo ? { status: 'New' } : {}),
                    original_order_id: poData.originalOrderId,
                    supplier_id: supplierId,
                    supplier_name: poData.supplierName || 'Bhagwathi Rice and Agro Industries',
                    supplier_rate: agreedRate,
                    sync_status: 'Synced',
                    customer_name_text: leadBuyerName,
                    customer_contact_text: poData.customerContact || '+91 98800 12345',
                    sub_order_no: subOrderNoString,
                    sub_orders: parsedSubOrders,
                    subOrders: parsedSubOrders,
                    updated_at: new Date().toISOString()
                };
                savePOToFirebase(poFirebaseData, poData.poNumber).catch(() => {});

                if (typeof saveCustomerToFirebase === 'function' && typeof sanitizeDocId === 'function') {
                    for (const s of parsedSubOrders) {
                        const custDocId = 'cust_' + sanitizeDocId(s.buyerName);
                        saveCustomerToFirebase({
                            id: custDocId,
                            name: s.buyerName,
                            contact_person: 'Purchasing Manager',
                            phone: poData.customerContact || '+91 98800 12345',
                            whatsapp_number: (poData.customerContact ? poData.customerContact.replace(/\D/g, '') : '919880012345'),
                            address: `${s.deliveryLocation}, Bangalore`,
                            city: 'Bangalore',
                            active: true,
                            notes: `Auto-synced from App A PO ${poData.poNumber}`,
                            created_at: new Date().toISOString()
                        }, custDocId).catch(() => {});
                    }
                }
            }
        } catch (fbErr) {
            console.warn('[Integration B] Cloud Firestore async sync notice:', fbErr.message);
        }

        console.log(`[Integration B] Successfully ${isNewPo ? 'created' : 'updated'} supplier PO ${poData.poNumber} with ${parsedSubOrders.length} sub-orders`);
        res.json({
            success: true,
            message: `Supplier Purchase Order successfully integrated with ${parsedSubOrders.length} constituent sub-order(s)`,
            poNumber: poData.poNumber,
            poId: createdPoId,
            subOrdersCount: parsedSubOrders.length
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
    const secret = (process.env.INTEGRATION_SHARED_SECRET || '').trim();
    if (!secret) {
        console.warn('[Reverse Sync] INTEGRATION_SHARED_SECRET not configured. Cannot sign outbound update.');
        return false;
    }

    const timestamp = Date.now().toString();
    const payloadStr = JSON.stringify(event);
    const signature = crypto
        .createHmac('sha256', secret)
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
