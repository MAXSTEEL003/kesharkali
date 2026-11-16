// server/db/seed.js
// Production seed: Initializes user credentials and master catalogs only.
// NO dummy orders, loadings, dispatches, stock ledger entries, or fake audit logs are generated.

const bcrypt = require('bcryptjs');
const { initDb, transaction } = require('./index');

function seed() {
    console.log('[Seed] Initializing master catalogs without dummy operational data...');
    initDb();

    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin123', salt);
    const operatorHash = bcrypt.hashSync('operator123', salt);
    const supplierHash = bcrypt.hashSync('Bhagwathi@2026', salt);

    transaction((db) => {
        // Clear any old dummy operational data
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
        db.exec('DELETE FROM po_sub_orders;');
        db.exec('DELETE FROM purchase_orders;');
        db.exec('PRAGMA foreign_keys = ON;');

        // 1. Default Authorized Users
        const insertUser = db.prepare(`
            INSERT OR IGNORE INTO users (username, password_hash, full_name, role, email, phone)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        insertUser.run('admin', adminHash, 'Rajendra Deshmukh (Admin)', 'Admin', 'admin@kesharkali.com', '+91 98220 12345');
        insertUser.run('operator', operatorHash, 'Vikram Shinde (Operator)', 'Operator', 'operator@kesharkali.com', '+91 98220 54321');
        insertUser.run('bhagwathi_supplier', supplierHash, 'Bhagwathi Rice and Agro Industries', 'Supplier', 'bhagwatirice@gmail.com', '+91 94401 88941');

        // 2. Default Milling Industry (Bhagwathi Rice and Agro Industries)
        const existingInd = db.prepare("SELECT id FROM industries WHERE name LIKE '%Bhagwath%' OR name LIKE '%Bhagwati%'").get();
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
        }

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
    });

    console.log('[Seed] Master setup completed cleanly with 0 dummy operational records.');
}

if (require.main === module) {
    seed();
}

module.exports = { seed };
