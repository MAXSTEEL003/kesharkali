// scripts/reseed_from_appA.cjs
const fs = require('fs');
const path = require('path');
const db = require('../server/db');

function toIsoDate(dStr) {
    if (!dStr) return '2026-11-09';
    const months = { 'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12' };
    const parts = dStr.split('-');
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const mon = months[parts[1]] || '11';
        const year = parts[2];
        return `${year}-${mon}-${day}`;
    }
    return dStr;
}

function runReseed() {
    db.initDb();
    console.log('[Reseed] Starting reseed with authentic deployed App A POs...');

    // 1. Get Bhagwathi Supplier ID
    let supplier = db.get("SELECT id FROM industries WHERE name LIKE '%Bhagwath%' OR name LIKE '%Bhagwati%'");
    if (!supplier) {
        console.error('Bhagwathi supplier not found!');
        return;
    }
    const supplierId = supplier.id;

    // 2. Ensure Products: Keshar Kali & Madhuram
    let prodKK = db.get("SELECT id FROM products WHERE name LIKE '%Keshar Kali%'");
    let prodMadhuram = db.get("SELECT id FROM products WHERE name LIKE '%Madhuram%'");

    // 3. Clean up test and synthetic POs
    const oldPos = db.query(`
        SELECT id, po_number FROM purchase_orders 
        WHERE po_number LIKE 'PO-%' 
           OR po_number IN ('TC-5M0201', 'TC-6J0201', 'TC-6J0202', 'TC-7J0601', 'TC-7J1101')
           OR original_order_id IN ('TC-5M0201', 'TC-6J0201', 'TC-6J0202', 'TC-7J0601', 'TC-7J1101')
    `);
    console.log(`[Reseed] Removing ${oldPos.length} test/synthetic POs...`);
    for (const p of oldPos) {
        db.run('DELETE FROM dispatches WHERE po_id = ?', [p.id]);
        db.run('DELETE FROM supplier_documents WHERE po_id = ?', [p.id]);
        db.run('DELETE FROM loading_entries WHERE po_id = ?', [p.id]);
        db.run('DELETE FROM industry_allocations WHERE po_id = ?', [p.id]);
        db.run('DELETE FROM stock_reservations WHERE po_id = ?', [p.id]);
        db.run('DELETE FROM po_ledger WHERE po_id = ?', [p.id]);
        db.run('DELETE FROM po_sub_orders WHERE po_id = ?', [p.id]);
        db.run('DELETE FROM purchase_orders WHERE id = ?', [p.id]);
    }

    // 4. Load App A Deployed Orders
    const jsonPath = path.resolve(__dirname, '../server/db/appA_bhagwathi_orders.json');
    const orders = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`[Reseed] Loaded ${orders.length} orders from appA_bhagwathi_orders.json`);

    let ingestedCount = 0;
    let totalSubsCount = 0;

    for (const ord of orders) {
        const isoDate = toIsoDate(ord.date);
        const isMadhuram = (ord.productName || '').toUpperCase().includes('MADURAM') || (ord.productName || '').toUpperCase().includes('MADHURAM');
        const productId = isMadhuram ? prodMadhuram.id : prodKK.id;

        // Sub numbers assignment for TC-3411
        if (ord.poNumber === 'TC-3411') {
            if (ord.subOrders[0]) ord.subOrders[0].subOrderNo = 'BRI-0001';
            if (ord.subOrders[1]) ord.subOrders[1].subOrderNo = 'BRI-0002';
            ord.subOrderNo = 'BRI-0001, BRI-0002';
        }

        // Map status: 'Approved' -> 'Accepted', 'Awaiting Settlement' -> 'Pending Acceptance'
        const appBStatus = ord.status === 'Approved' ? 'Accepted' : 'Pending Acceptance';

        // Extract individual constituent buyers and ensure their customer records exist
        for (const sub of ord.subOrders) {
            const indBuyer = (sub.buyerName || ord.buyerName).replace(/\s*&\s*\d+\s+others?/gi, '').trim();
            let c = db.get('SELECT id FROM customers WHERE name = ?', [indBuyer]);
            if (!c) {
                db.run(`
                    INSERT INTO customers (name, contact_person, phone, whatsapp_number, address, city, active, notes)
                    VALUES (?, 'Purchasing Desk', '+91 98800 12345', '+91 98800 12345', ?, 'Bangalore', 1, 'Extracted from App A authentic sub-orders')
                `, [indBuyer, `${sub.deliveryLocation || 'Commercial Market'}, Bangalore`]);
                c = db.get('SELECT id FROM customers WHERE name = ?', [indBuyer]);
            }
            sub.customerId = c.id;
            sub.buyerName = indBuyer;
        }

        const leadSub = ord.subOrders[0];
        const customerId = leadSub ? leadSub.customerId : null;
        const leadBuyerName = leadSub ? leadSub.buyerName : ord.buyerName;

        // Check if PO exists
        const exists = db.get('SELECT id FROM purchase_orders WHERE po_number = ?', [ord.poNumber]);
        let poId;
        const subJson = JSON.stringify(ord.subOrders);

        if (!exists) {
            const res = db.run(`
                INSERT INTO purchase_orders (
                    po_number, customer_id, product_id, po_date, ordered_quantity, customer_selling_rate,
                    delivery_location, notes, status, created_by, original_order_id, supplier_id,
                    supplier_rate, sync_status, customer_name_text, customer_contact_text,
                    sub_order_no, bill_no, sub_orders_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'App A Deployed Sync', ?, ?, ?, 'Synced', ?, '+91 98800 12345', ?, ?, ?)
            `, [
                ord.poNumber, customerId, productId, isoDate, ord.totalQuantity, ord.rate,
                ord.destination || 'Multiple Unloading Points, Bangalore',
                ord.notes || `App A Order ${ord.poNumber}`,
                appBStatus,
                ord.originalOrderId, supplierId, ord.rate,
                leadBuyerName,
                ord.subOrderNo, ord.billNo, subJson
            ]);
            poId = res.lastInsertRowid;
            ingestedCount++;
        } else {
            poId = exists.id;
            db.run(`
                UPDATE purchase_orders SET
                    customer_id = ?,
                    product_id = ?,
                    po_date = ?,
                    ordered_quantity = ?,
                    customer_selling_rate = ?,
                    supplier_rate = ?,
                    delivery_location = ?,
                    notes = ?,
                    status = ?,
                    original_order_id = ?,
                    customer_name_text = ?,
                    sub_order_no = ?,
                    bill_no = ?,
                    sub_orders_json = ?
                WHERE id = ?
            `, [
                customerId, productId, isoDate, ord.totalQuantity, ord.rate, ord.rate,
                ord.destination || 'Multiple Unloading Points, Bangalore',
                ord.notes, appBStatus, ord.originalOrderId,
                leadBuyerName, ord.subOrderNo, ord.billNo, subJson, poId
            ]);
        }

        // Sub orders
        db.run('DELETE FROM po_sub_orders WHERE po_id = ?', [poId]);
        for (const sub of ord.subOrders) {
            db.run(`
                INSERT INTO po_sub_orders (
                    po_id, po_number, sub_order_no, customer_id, buyer_name, product_name,
                    ordered_quantity, rate, amount, bill_no, delivery_location, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                poId, ord.poNumber, sub.subOrderNo, sub.customerId, sub.buyerName, sub.productName,
                sub.orderedQuantity, sub.rate, sub.amount, sub.billNo, sub.deliveryLocation, appBStatus
            ]);
            totalSubsCount++;
        }

        // Ledger
        const hasLedger = db.get("SELECT id FROM po_ledger WHERE po_id = ? AND event_type = 'PO_CREATED'", [poId]);
        if (!hasLedger) {
            db.run(`
                INSERT INTO po_ledger (po_id, po_number, event_type, title, description, actor, created_at)
                VALUES (?, ?, 'PO_CREATED', 'Purchase Order Synchronized from App A', ?, 'App A Sync Gateway', ?)
            `, [
                poId, ord.poNumber, `PO ${ord.poNumber} for ${ord.buyerName} with ${ord.subOrders.length} sub-order(s) (${ord.subOrderNo}) for ${ord.totalQuantity} QTL.`, `${isoDate} 10:00:00`
            ]);
        }
    }

    console.log(`[Reseed] Ingested ${orders.length} authentic POs with ${totalSubsCount} sub-orders from deployed App A!`);
}

runReseed();
