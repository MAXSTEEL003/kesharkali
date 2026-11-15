// server/db/seedBhagwathi.js
// Seeds Bhagwathi Rice and Agro Industries with authentic POs cross-checked directly from App A
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./index');

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

function seedBhagwathi() {
    db.initDb();
    console.log('[Seed] Starting Bhagwathi Rice and Agro Industries setup with authentic App A POs...');

    // 1. Ensure Industry Record exists
    let industry = db.get("SELECT * FROM industries WHERE name LIKE '%Bhagwath%' OR name LIKE '%Bhagwati%'");
    if (!industry) {
        db.run(`
            INSERT INTO industries (name, location, contact_person, phone, available_products, default_purchase_rate, notes, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `, [
            'Bhagwathi Rice and Agro Industries',
            'APMC Industrial Area, Gadchiroli',
            'Operations Desk',
            '+91 94401 88941',
            'Keshar Kali, Madhuram, HMT, RNR Rice',
            7800.00,
            'Authoritative milling and procurement partner for Keshar Kali & Madhuram (App A Code: BRI / SUP-06)'
        ]);
        industry = db.get("SELECT * FROM industries WHERE name LIKE '%Bhagwath%' OR name LIKE '%Bhagwati%'");
        console.log(`[Seed] Created industry: ${industry.name} (ID: ${industry.id})`);
    } else {
        console.log(`[Seed] Found existing industry: ${industry.name} (ID: ${industry.id})`);
    }
    const supplierId = industry.id;

    // 2. Ensure Supplier User
    const existingUser = db.get("SELECT * FROM users WHERE email = ? OR username = ?", ['bhagwatirice@gmail.com', 'bhagwathi_supplier']);
    const passwordHash = bcrypt.hashSync('Bhagwathi@2026', 10);
    if (!existingUser) {
        db.run(`
            INSERT INTO users (username, password_hash, full_name, role, email, phone, supplier_id, active)
            VALUES (?, ?, ?, 'Supplier', ?, ?, ?, 1)
        `, [
            'bhagwathi_supplier',
            passwordHash,
            'Bhagwathi Rice and Agro Industries (Operations)',
            'bhagwatirice@gmail.com',
            '+91 94401 88941',
            supplierId
        ]);
        console.log('[Seed] Created supplier user credentials: bhagwatirice@gmail.com / Bhagwathi@2026');
    } else {
        db.run(`
            UPDATE users SET 
                supplier_id = ?, 
                role = 'Supplier', 
                password_hash = ?, 
                phone = '+91 94401 88941',
                full_name = 'Bhagwathi Rice and Agro Industries (Operations)'
            WHERE id = ?
        `, [supplierId, passwordHash, existingUser.id]);
    }

    // 3. Ensure Products: Keshar Kali & Madhuram
    let prodKK = db.get("SELECT * FROM products WHERE name LIKE '%Keshar Kali%'");
    if (!prodKK) {
        db.run(`
            INSERT INTO products (code, name, brand, variety, unit, min_stock_threshold, standard_selling_rate, active)
            VALUES ('PROD-KK', 'Keshar Kali', 'Keshar Kali', 'Standard Steamed Rice (Bulk)', 'QTL', 100, 9999, 1)
        `);
        prodKK = db.get("SELECT * FROM products WHERE name LIKE '%Keshar Kali%'");
    }

    let prodMadhuram = db.get("SELECT * FROM products WHERE name LIKE '%Madhuram%'");
    if (!prodMadhuram) {
        db.run(`
            INSERT INTO products (code, name, brand, variety, unit, min_stock_threshold, standard_selling_rate, active)
            VALUES ('PROD-MADHURAM', 'Madhuram Rice', 'Madhuram', 'Aged Sona Masoori Raw Rice', 'QTL', 50, 12000, 1)
        `);
        prodMadhuram = db.get("SELECT * FROM products WHERE name LIKE '%Madhuram%'");
    }

    // 4. Remove old test/synthetic POs
    const oldPos = db.query(`
        SELECT id, po_number FROM purchase_orders 
        WHERE po_number LIKE 'PO-%' 
           OR po_number IN ('TC-5M0201', 'TC-6J0201', 'TC-6J0202', 'TC-7J0601', 'TC-7J1101')
           OR original_order_id IN ('TC-5M0201', 'TC-6J0201', 'TC-6J0202', 'TC-7J0601', 'TC-7J1101')
    `);
    if (oldPos.length > 0) {
        console.log(`[Seed] Removing ${oldPos.length} test/synthetic POs...`);
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
    }

    // 5. Ingest Authentic POs from appA_bhagwathi_orders.json
    const jsonPath = path.resolve(__dirname, 'appA_bhagwathi_orders.json');
    if (!fs.existsSync(jsonPath)) {
        console.error('appA_bhagwathi_orders.json not found!');
        return;
    }
    const orders = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    let totalSubsCount = 0;
    for (const ord of orders) {
        const isoDate = toIsoDate(ord.date);
        const isMadhuram = (ord.productName || '').toUpperCase().includes('MADURAM') || (ord.productName || '').toUpperCase().includes('MADHURAM');
        const productId = isMadhuram ? prodMadhuram.id : prodKK.id;

        if (ord.poNumber === 'TC-3411') {
            if (ord.subOrders[0]) ord.subOrders[0].subOrderNo = 'BRI-0001';
            if (ord.subOrders[1]) ord.subOrders[1].subOrderNo = 'BRI-0002';
            ord.subOrderNo = 'BRI-0001, BRI-0002';
        }

        const appBStatus = ord.status === 'Approved' ? 'Accepted' : 'Pending Acceptance';

        let cust = db.get('SELECT id FROM customers WHERE name = ?', [ord.buyerName]);
        if (!cust) {
            db.run(`
                INSERT INTO customers (name, contact_person, phone, whatsapp_number, address, city, active)
                VALUES (?, 'Purchasing Desk', '+91 98800 12345', '+91 98800 12345', ?, 'Bangalore', 1)
            `, [ord.buyerName, ord.destination || 'Commercial Market, Bangalore']);
            cust = db.get('SELECT id FROM customers WHERE name = ?', [ord.buyerName]);
        }
        const customerId = cust.id;

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
                ord.buyerName,
                ord.subOrderNo, ord.billNo, subJson
            ]);
            poId = res.lastInsertRowid;
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
                ord.buyerName, ord.subOrderNo, ord.billNo, subJson, poId
            ]);
        }

        db.run('DELETE FROM po_sub_orders WHERE po_id = ?', [poId]);
        for (const sub of ord.subOrders) {
            db.run(`
                INSERT INTO po_sub_orders (
                    po_id, po_number, sub_order_no, buyer_name, product_name,
                    ordered_quantity, rate, amount, bill_no, delivery_location, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                poId, ord.poNumber, sub.subOrderNo, sub.buyerName, sub.productName,
                sub.orderedQuantity, sub.rate, sub.amount, sub.billNo, sub.deliveryLocation, appBStatus
            ]);
            totalSubsCount++;
        }

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

    // 6. Ensure Warehouse
    let warehouse = db.get("SELECT * FROM warehouses WHERE name LIKE '%Bhagwathi%' OR name LIKE '%Gadchiroli%'");
    if (!warehouse) {
        db.run(`
            INSERT INTO warehouses (name, location, capacity_qtl, manager_name, contact_phone, active)
            VALUES ('Bhagwathi Mill Godown', 'APMC Industrial Area, Gadchiroli', 20000, 'Operations Desk', '+91 94401 88941', 1)
        `);
    }

    console.log(`[Seed] Ingested ${orders.length} authentic POs with ${totalSubsCount} sub-orders from deployed App A!`);
}

if (require.main === module) {
    seedBhagwathi();
}

module.exports = { seedBhagwathi };
