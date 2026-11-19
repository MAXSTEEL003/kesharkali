// server/db/seed.js
// Production seed: Initializes user credentials, master catalogs, and authentic App A POs & customers.
// NO fake/synthetic dummy orders or fake loading records are generated.

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDb, transaction, getDb } = require('./index');

function seed() {
    console.log('[Seed] Initializing master catalogs and authentic App A records...');

    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin123', salt);
    const operatorHash = bcrypt.hashSync('operator123', salt);
    const supplierHash = bcrypt.hashSync('Bhagwathi@2026', salt);
    let totalOrders = 0;
    let totalCustomers = 0;

    const rawDb = getDb();
    try { rawDb.exec('PRAGMA foreign_keys = OFF;'); } catch (_) {}

    try {
        transaction((db) => {
            // Clear any old operational tables cleanly
            db.exec('DELETE FROM audit_logs;');
            db.exec('DELETE FROM whatsapp_notifications;');
            db.exec('DELETE FROM stock_adjustments;');
            db.exec('DELETE FROM stock_transfers;');
            db.exec('DELETE FROM stock_reservations;');
            db.exec('DELETE FROM stock_ledger;');
            db.exec('DELETE FROM supplier_documents;');
            db.exec('DELETE FROM po_ledger;');
            db.exec('DELETE FROM dispatches;');
            db.exec('DELETE FROM loading_entries;');
            db.exec('DELETE FROM industry_allocations;');
            db.exec('DELETE FROM po_sub_orders;');
            db.exec('DELETE FROM purchase_orders;');

        // 1. Default Milling Industry (Bhagwathi Rice and Agro Industries)
        let existingInd = db.prepare("SELECT id FROM industries WHERE name LIKE '%Bhagwath%' OR name LIKE '%Bhagwati%'").get();
        if (!existingInd) {
            db.prepare(`
                INSERT INTO industries (
                    name, location, contact_person, phone, available_products, 
                    default_purchase_rate, notes, active, is_default, facility_type, capacity_qtl
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 'Rice Mill & Godown', 25000)
            `).run(
                'Bhagwathi Rice and Agro Industries',
                'APMC Industrial Area, Gadchiroli',
                'Operations Desk',
                '+91 94401 88941',
                'Keshar Kali, Keshar Kali 5 kgs, Keshar Kali 10 kg',
                7800.00,
                'Authoritative milling and procurement partner for Keshar Kali (App A Code: BRI / SUP-06)'
            );
            existingInd = db.prepare("SELECT id FROM industries WHERE name LIKE '%Bhagwath%' OR name LIKE '%Bhagwati%'").get();
        }
        const supplierId = existingInd ? existingInd.id : 5;

        // 2. Default Authorized Users
        const insertUser = db.prepare(`
            INSERT OR IGNORE INTO users (username, password_hash, full_name, role, email, phone, supplier_id, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `);
        insertUser.run('admin', adminHash, 'Rajendra Deshmukh (Admin)', 'Admin', 'admin@kesharkali.com', '+91 98220 12345', null);
        insertUser.run('operator', operatorHash, 'Vikram Shinde (Operator)', 'Operator', 'operator@kesharkali.com', '+91 98220 54321', null);
        insertUser.run('bhagwathi_supplier', supplierHash, 'Bhagwathi Rice and Agro Industries', 'Supplier', 'bhagwatirice@gmail.com', '+91 94401 88941', supplierId);
        db.prepare("UPDATE users SET supplier_id = ? WHERE username = 'bhagwathi_supplier'").run(supplierId);

        // 3. Authorized Products (Only 3 official brand products)
        const insertProd = db.prepare(`
            INSERT OR IGNORE INTO products (code, name, brand, variety, unit, min_stock_threshold, standard_selling_rate, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `);
        insertProd.run('PROD-KK', 'Keshar Kali', 'Keshar Kali', 'Standard Loose Steamed Rice (Bulk)', 'QTL', 100, 3200);
        insertProd.run('PROD-KK-5KG', 'Keshar Kali 5 kgs', 'Keshar Kali', '5 kg Consumer Bag Packaging', 'QTL', 80, 3600);
        insertProd.run('PROD-KK-10KG', 'Keshar Kali 10 kg', 'Keshar Kali', '10 kg Consumer Bag Packaging', 'QTL', 60, 3500);

        // Delete dummy placeholder industries if any exist
        db.exec(`
            DELETE FROM industries 
            WHERE name LIKE 'Industry A%' 
               OR name LIKE 'Industry B%' 
               OR name LIKE 'Industry C%' 
               OR name LIKE 'Industry D%';
        `);

        // Delete dummy seed customers if any exist
        db.exec(`
            DELETE FROM customers 
            WHERE name IN (
                'ABC Traders', 
                'Mahavir Provisions', 
                'Shree Ganesh Agro', 
                'Royal Grains Mart', 
                'Keshar Wholesale Depot'
            );
        `);

        // 4. Synchronously Seed Authentic App A Customers and Purchase Orders
        const ordersPath = path.resolve(__dirname, 'appA_bhagwathi_orders.json');
        if (fs.existsSync(ordersPath)) {
            const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
            totalOrders = orders.length;
            const prodKK = db.prepare("SELECT id FROM products WHERE name LIKE '%Keshar Kali%' AND name NOT LIKE '%10 kg%' AND name NOT LIKE '%5 kg%'").get();
            const prodMadhuram = db.prepare("SELECT id FROM products WHERE name LIKE '%Madhuram%'").get();
            const prod10KG = db.prepare("SELECT id FROM products WHERE name LIKE '%10 kg%' OR code LIKE '%10KG%'").get();
            const defaultProdId = prodKK ? prodKK.id : 1;

            const insertCust = db.prepare(`
                INSERT OR IGNORE INTO customers (name, contact_person, phone, whatsapp_number, address, city, active, notes)
                VALUES (?, 'Purchasing Manager', '+91 98800 12345', '919880012345', ?, 'Bangalore', 1, 'Auto-synced from App A')
            `);

            const insertPO = db.prepare(`
                INSERT OR REPLACE INTO purchase_orders (
                    po_number, customer_id, product_id, po_date, ordered_quantity, customer_selling_rate,
                    delivery_location, notes, status, created_by, original_order_id, supplier_id,
                    supplier_rate, sync_status, customer_name_text, customer_contact_text,
                    sub_order_no, bill_no, sub_orders_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New', 'App A Sync', ?, ?, ?, 'Synced', ?, '+91 98800 12345', ?, ?, ?)
            `);

            const insertSub = db.prepare(`
                INSERT OR REPLACE INTO po_sub_orders (
                    po_id, po_number, sub_order_no, customer_id, buyer_name, product_name,
                    ordered_quantity, rate, amount, bill_no, delivery_location, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            // Pre-collect unique customers to guarantee exactly 1 record per authentic buyer
            const uniqueCustomers = new Map();
            for (const ord of orders) {
                for (const sub of (ord.subOrders || [])) {
                    const bName = (sub.buyerName || ord.buyerName || '').replace(/\s*&\s*\d+\s+others?/gi, '').trim();
                    if (bName && !uniqueCustomers.has(bName)) {
                        uniqueCustomers.set(bName, `${sub.deliveryLocation || 'Commercial Market'}, Bangalore`);
                    }
                }
                const leadBuyer = (ord.subOrders?.[0]?.buyerName || ord.buyerName || '').replace(/\s*&\s*\d+\s+others?/gi, '').trim();
                if (leadBuyer && !uniqueCustomers.has(leadBuyer)) {
                    uniqueCustomers.set(leadBuyer, `${ord.destination || 'Commercial Market'}, Bangalore`);
                }
            }

            totalCustomers = uniqueCustomers.size;
            for (const [custName, custAddr] of uniqueCustomers.entries()) {
                insertCust.run(custName, custAddr);
            }

            for (const ord of orders) {
                const leadBuyer = (ord.subOrders?.[0]?.buyerName || ord.buyerName || '').replace(/\s*&\s*\d+\s+others?/gi, '').trim();
                const custRow = db.prepare("SELECT id FROM customers WHERE name = ?").get(leadBuyer);
                const leadCustId = custRow ? custRow.id : null;
                const subOrderNoString = (ord.subOrders || []).map(s => s.subOrderNo).filter(Boolean).join(', ');

                // Convert date to YYYY-MM-DD
                let isoDate = ord.date;
                const parts = (ord.date || '').split('-');
                if (parts.length === 3) {
                    const months = { 'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12' };
                    isoDate = `${parts[2]}-${months[parts[1]] || '11'}-${parts[0].padStart(2, '0')}`;
                }

                const prodUpper = (ord.productName || '').toUpperCase();
                let pId = defaultProdId;
                if (prodUpper.includes('MAD') && prodMadhuram) {
                    pId = prodMadhuram.id;
                } else if ((prodUpper.includes('10KG') || prodUpper.includes('10 KG')) && prod10KG) {
                    pId = prod10KG.id;
                }

                const poRes = insertPO.run(
                    ord.poNumber, leadCustId, pId, isoDate, ord.totalQuantity, ord.rate,
                    ord.destination || 'Consolidated Hub', ord.notes || `App A Order ${ord.poNumber}`,
                    ord.originalOrderId || ord.poNumber, supplierId, ord.rate,
                    leadBuyer, subOrderNoString, ord.billNo, JSON.stringify(ord.subOrders || [])
                );
                const poId = poRes.lastInsertRowid;

                for (const sub of (ord.subOrders || [])) {
                    const bName = (sub.buyerName || ord.buyerName || '').replace(/\s*&\s*\d+\s+others?/gi, '').trim();
                    const sCust = db.prepare("SELECT id FROM customers WHERE name = ?").get(bName);
                    insertSub.run(
                        poId, ord.poNumber, sub.subOrderNo || 'N/A', sCust ? sCust.id : leadCustId,
                        bName, sub.productName || 'Keshar Kali', sub.orderedQuantity, sub.rate,
                        sub.amount || Math.round(sub.orderedQuantity * sub.rate),
                        sub.billNo || null, sub.deliveryLocation || 'shop', sub.status || 'Approved'
                    );
                }
            }
        }
    });
} finally {
        try { rawDb.exec('PRAGMA foreign_keys = ON;'); } catch (_) {}
    }

    console.log(`[Seed] Master setup completed: ${totalOrders} authentic POs & ${totalCustomers} customers ready.`);
}

if (require.main === module) {
    seed();
}

module.exports = { seed };
