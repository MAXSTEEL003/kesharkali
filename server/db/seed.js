// server/db/seed.js
const bcrypt = require('bcryptjs');
const { initDb, transaction, query } = require('./index');

function seed() {
    console.log('Seeding Keshar Kali Operations database...');
    initDb();

    // Check if users already exist
    const existingUsers = query('SELECT COUNT(*) as count FROM users');
    if (existingUsers[0].count > 0) {
        console.log('Database already contains data, resetting/reseeding...');
    }

    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin123', salt);
    const operatorHash = bcrypt.hashSync('operator123', salt);

    transaction((db) => {
        // Clear existing operational data and reset sequences
        db.exec('PRAGMA foreign_keys = OFF;');
        db.exec('DELETE FROM audit_logs;');
        db.exec('DELETE FROM whatsapp_notifications;');
        db.exec('DELETE FROM stock_adjustments;');
        db.exec('DELETE FROM stock_transfers;');
        db.exec('DELETE FROM stock_reservations;');
        db.exec('DELETE FROM stock_ledger;');
        db.exec('DELETE FROM dispatches;');
        db.exec('DELETE FROM loading_entries;');
        db.exec('DELETE FROM industry_allocations;');
        db.exec('DELETE FROM purchase_orders;');
        db.exec('DELETE FROM warehouses;');
        db.exec('DELETE FROM products;');
        db.exec('DELETE FROM industries;');
        db.exec('DELETE FROM customers;');
        db.exec('DELETE FROM users;');
        db.exec('DELETE FROM sqlite_sequence;');
        db.exec('PRAGMA foreign_keys = ON;');

        // 1. Users
        const insertUser = db.prepare(`
            INSERT INTO users (username, password_hash, full_name, role, email, phone)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        insertUser.run('admin', adminHash, 'Rajendra Deshmukh (Admin)', 'Admin', 'admin@kesharkali.com', '+91 98220 12345');
        insertUser.run('operator', operatorHash, 'Vikram Shinde (Operator)', 'Operator', 'operator@kesharkali.com', '+91 98220 54321');

        // 2. Customers
        const insertCust = db.prepare(`
            INSERT INTO customers (name, contact_person, phone, whatsapp_number, address, city, gstin, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertCust.run('ABC Traders', 'Anand Agrawal', '+91 98230 11223', '919823011223', 'G-12, Kalamna Grain Market', 'Nagpur', '27AABCT1234F1Z8', 'Prime wholesale buyer, priority delivery');
        insertCust.run('Mahavir Provisions', 'Bhavin Shah', '+91 94221 44556', '919422144556', 'Main Bazaar, Near Clock Tower', 'Gondia', '27AABCM5678M1Z2', 'Regular monthly off-taker of HMT and Kolam');
        insertCust.run('Shree Ganesh Agro', 'Ganesh Patel', '+91 97130 99887', '919713099887', 'Wholesale Yard, Pandri', 'Raipur', '22AABCS9988R1Z1', 'Direct mill deliveries preferred');
        insertCust.run('Royal Grains Mart', 'Maheshwari Brothers', '+91 99750 33445', '919975033445', 'Shop 44, APMC Yard', 'Bhandara', '27AABCR3344P1Z5', 'Payment terms 15 days');
        insertCust.run('Keshar Wholesale Depot', 'Sunil Jaiswal', '+91 98900 77665', '919890077665', 'Plot 88, Outer Ring Road Godown Hub', 'Nagpur', '27AABCK7766K1Z9', 'Bulk receiver with 50-ton weighbridge');

        // 3. Industries (Rice Mills / Sourcing Partners)
        const insertInd = db.prepare(`
            INSERT INTO industries (name, location, contact_person, phone, available_products, default_purchase_rate, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        insertInd.run('Industry A (Balaji Modern Rice Mill)', 'Bhandara Industrial Area', 'Rameshji Balaji', '+91 94231 10001', 'Keshar Kali, Keshar Kali 5 kgs, Keshar Kali 10 kg', 2850, 'High quality sorting, reliable dispatch');
        insertInd.run('Industry B (Vaishnavi Agro Industries)', 'Gondia Road, Tiroda', 'Suresh Vaishnav', '+91 94231 20002', 'Keshar Kali, Keshar Kali 5 kgs, Keshar Kali 10 kg', 2900, 'Equipped with Sortex 5-chute machines');
        insertInd.run('Industry C (Kisan Rice Industries)', 'Tumsar Mandi Gate', 'Dinesh Kisan', '+91 94231 30003', 'Keshar Kali, Keshar Kali 10 kg', 2820, 'Direct rail siding connectivity');
        insertInd.run('Industry D (Shree Ram Milling Corp)', 'Waraseoni Highway, Balaghat', 'Harishchand Sharma', '+91 94231 40004', 'Keshar Kali, Keshar Kali 5 kgs', 2950, 'Aged paddy stocks available');

        // 4. Products (Authorized Keshar Kali Brand Catalog: Exactly 3 Products)
        const insertProd = db.prepare(`
            INSERT INTO products (code, name, brand, variety, unit, min_stock_threshold, standard_selling_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        insertProd.run('PROD-KK', 'Keshar Kali', 'Keshar Kali', 'Standard Loose Steamed Rice (Bulk)', 'QTL', 100, 3200);
        insertProd.run('PROD-KK-5KG', 'Keshar Kali 5 kgs', 'Keshar Kali', '5 kg Consumer Bag Packaging', 'QTL', 80, 3600);
        insertProd.run('PROD-KK-10KG', 'Keshar Kali 10 kg', 'Keshar Kali', '10 kg Consumer Bag Packaging', 'QTL', 60, 3500);

        // 5. Warehouses
        const insertWh = db.prepare(`
            INSERT INTO warehouses (name, location, capacity_qtl, manager_name, contact_phone)
            VALUES (?, ?, ?, ?, ?)
        `);
        insertWh.run('Central Godown - Yard 1', 'Wardha Road, MIDC Butibori, Nagpur', 15000, 'Prakash Jadhav', '+91 98223 33111');
        insertWh.run('Railway Siding Godown', 'Kalamna Mandi Complex, Nagpur', 25000, 'Sunil Meshram', '+91 98223 33222');
        insertWh.run('Hingna Storage Depot', 'Electronic Zone, Hingna MIDC, Nagpur', 10000, 'Devendra Raut', '+91 98223 33333');

        // 6. Initial Stock Setup with authorative Stock Ledger entries
        const insertLedger = db.prepare(`
            INSERT INTO stock_ledger (transaction_number, date, product_id, warehouse_id, transaction_type, reference_number, source, destination, inward_quantity, outward_quantity, rate, amount, running_balance, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Keshar Kali Opening Stock (500 QTL)
        insertLedger.run('TXN-2026-0001', '2026-11-01', 1, 1, 'Opening Stock', 'INIT-2026-01', 'Beginning Inventory', 'Central Godown - Yard 1', 500, 0, 2800, 1400000, 500, 'FY2026 Opening physical stock balance verified');
        // Keshar Kali 5 kgs Opening Stock (300 QTL)
        insertLedger.run('TXN-2026-0002', '2026-11-01', 2, 2, 'Opening Stock', 'INIT-2026-02', 'Beginning Inventory', 'Railway Siding Godown', 300, 0, 3100, 930000, 300, 'FY2026 Opening physical stock balance verified');
        // Keshar Kali 10 kg Opening Stock (200 QTL)
        insertLedger.run('TXN-2026-0003', '2026-11-01', 3, 1, 'Opening Stock', 'INIT-2026-03', 'Beginning Inventory', 'Central Godown - Yard 1', 200, 0, 3000, 600000, 200, 'FY2026 Opening physical stock balance verified');

        // Replenishment for Keshar Kali (150 QTL) from Balaji Modern
        insertLedger.run('TXN-2026-0004', '2026-11-03', 1, 1, 'Purchase Inward', 'PUR-BLJ-108', 'Industry A (Balaji Modern Rice Mill)', 'Central Godown - Yard 1', 150, 0, 2840, 426000, 650, 'Bulk replenishment for winter season');

        // 7. Purchase Orders (Customer Orders Received by Keshar Kali)
        const insertPO = db.prepare(`
            INSERT INTO purchase_orders (po_number, customer_id, product_id, po_date, ordered_quantity, customer_selling_rate, delivery_location, expected_delivery_date, notes, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // PO-2026-001: The textbook scenario from prompt (Customer: ABC Traders, 100 QTL Keshar Kali @ ₹3,200/QTL)
        insertPO.run('PO-2026-001', 1, 1, '2026-11-04', 100, 3200, 'Customer Godown, Kalamna, Nagpur', '2026-11-10', 'Primary contract order for Diwali trade distribution', 'Allocated', 'Rajendra Deshmukh');

        // Sourcing Allocations for PO-2026-001:
        // Industry A: 40 QTL @ ₹2,850
        // Industry B: 35 QTL @ ₹2,900
        // Industry C: 25 QTL @ ₹2,820
        const insertAlloc = db.prepare(`
            INSERT INTO industry_allocations (po_id, industry_id, product_id, allocated_quantity, purchase_rate, purchase_amount, expected_loading_date, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertAlloc.run(1, 1, 1, 40, 2850, 40 * 2850, '2026-11-08', 'Lot #A-401 from Balaji mill', 'Pending');
        insertAlloc.run(1, 2, 1, 35, 2900, 35 * 2900, '2026-11-08', 'Lot #B-205 Tiroda unit', 'Pending');
        insertAlloc.run(1, 3, 1, 25, 2820, 25 * 2820, '2026-11-09', 'Lot #C-112 Tumsar mill', 'Pending');

        // PO-2026-002: Mahavir Provisions (75 QTL Keshar Kali 5 kgs @ ₹3,600/QTL) - Partially Loaded & Dispatched
        insertPO.run('PO-2026-002', 2, 2, '2026-11-02', 75, 3600, 'Mahavir Godown, Gondia Market', '2026-11-07', 'Regular monthly requirement for consumer packs', 'Partially Dispatched', 'Vikram Shinde');
        insertAlloc.run(2, 1, 2, 45, 3100, 45 * 3100, '2026-11-04', 'Allocated to Balaji Mill', 'Partially Loaded');
        insertAlloc.run(2, 2, 2, 30, 3150, 30 * 3150, '2026-11-05', 'Allocated to Vaishnavi Mill', 'Loaded');

        // Loading entry for PO-2026-002
        const insertLoading = db.prepare(`
            INSERT INTO loading_entries (loading_number, loading_date, po_id, allocation_id, industry_id, product_id, fulfillment_type, warehouse_id, loading_location, vehicle_number, driver_phone, loading_quantity, purchase_rate, loading_amount, loading_status, dispatch_status, remarks, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertLoading.run('LD-2026-001', '2026-11-05', 2, 5, 2, 2, 'Direct', null, 'Vaishnavi Agro Gondia Gate 1', 'MH-31-CB-9022', '+91 98220 12345', 30, 3150, 30 * 3150, 'Loaded', 'Dispatched', 'Direct dispatch from mill to buyer godown', 'Vikram Shinde');
        insertLoading.run('LD-2026-002', '2026-11-06', 2, 4, 1, 2, 'Warehouse', 2, 'Balaji Modern Bhandara', 'MH-36-AA-4412', '+91 94228 67890', 25, 3100, 25 * 3100, 'Loaded', 'Pending', 'Inwarded to Railway Siding Godown', 'Vikram Shinde');

        // Also create inward stock transaction for the warehouse loading LD-2026-002
        insertLedger.run('TXN-2026-0005', '2026-11-06', 2, 2, 'Purchase Inward', 'LD-2026-002', 'Industry A (Balaji Modern Rice Mill)', 'Railway Siding Godown', 25, 0, 3100, 77500, 325, 'Inwarded from LD-2026-002 for PO-2026-002 fulfillment');

        // Dispatch for LD-2026-001 (Direct dispatch 30 QTL)
        const insertDispatch = db.prepare(`
            INSERT INTO dispatches (dispatch_number, loading_id, po_id, dispatch_date, dispatch_quantity, vehicle_number, driver_phone, source_type, warehouse_id, remarks, notification_status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertDispatch.run('DSP-2026-001', 1, 2, '2026-11-05', 30, 'MH-31-CB-9022', '+91 98220 12345', 'Direct', null, 'Dispatched direct from mill to Mahavir Provisions Gondia', 'Sent', 'Vikram Shinde');

        // WhatsApp notification record for DSP-2026-001
        const insertWA = db.prepare(`
            INSERT INTO whatsapp_notifications (idempotency_key, dispatch_id, po_id, customer_id, recipient_phone, template_name, message_body, wa_message_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const waMsgBody = `Hello Bhavin Shah,\n\nYour order has been dispatched.\n\nProduct: Keshar Kali 5 kgs\nVehicle: MH-31-CB-9022\nDriver Phone: +91 98220 12345\nQuantity Dispatched: 30 QTL\nRemaining Quantity: 45 QTL\n\nThank you for your business.\nKeshar Kali — Precision in Every Grain`;
        insertWA.run('dsp_1', 1, 2, 2, '919422144556', 'order_dispatched', waMsgBody, 'wam_live_001928374', 'Delivered');

        // Audit Log entry
        const insertAudit = db.prepare(`
            INSERT INTO audit_logs (entity_type, entity_id, action, actor, details)
            VALUES (?, ?, ?, ?, ?)
        `);
        insertAudit.run('System', 'INITIALIZE', 'SEED', 'System Admin', 'System initialized with master catalogs, warehouses, baseline stocks and sample contracts');
    });

    console.log('Seeding completed successfully!');
}

if (require.main === module) {
    seed();
}

module.exports = { seed };
