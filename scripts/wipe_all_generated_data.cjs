// scripts/wipe_all_generated_data.cjs
// Completely clears all generated/demo/test data from Keshar Kali Operations Database
const db = require('../server/db');

console.log('=== WIPING ALL GENERATED OPERATIONAL DATA ===');

const rawDb = db.getDb();
rawDb.exec('PRAGMA foreign_keys = OFF;');

// 1. Wipe all operational transactions in reverse dependency order
rawDb.exec('DELETE FROM whatsapp_notifications;');
rawDb.exec('DELETE FROM dispatches;');
rawDb.exec('DELETE FROM loading_entries;');
rawDb.exec('DELETE FROM stock_reservations;');
rawDb.exec('DELETE FROM stock_transfers;');
rawDb.exec('DELETE FROM stock_adjustments;');
rawDb.exec('DELETE FROM stock_ledger;');
rawDb.exec('DELETE FROM industry_allocations;');
rawDb.exec('DELETE FROM po_sub_orders;');
rawDb.exec('DELETE FROM purchase_orders;');
rawDb.exec('DELETE FROM audit_logs;');

// 2. Wipe dummy customers from original seed (keep real App A buyers)
rawDb.exec(`
    DELETE FROM customers 
    WHERE name IN (
        'ABC Traders', 
        'Mahavir Provisions', 
        'Shree Ganesh Agro', 
        'Royal Grains Mart', 
        'Keshar Wholesale Depot'
    );
`);

// 3. Wipe dummy placeholder industries from original seed
rawDb.exec(`
    DELETE FROM industries 
    WHERE name LIKE 'Industry A%' 
       OR name LIKE 'Industry B%' 
       OR name LIKE 'Industry C%' 
       OR name LIKE 'Industry D%';
`);

// 4. Ensure Bhagwathi Rice and Agro Industries exists
const bhagwathi = rawDb.prepare("SELECT id FROM industries WHERE name LIKE '%Bhagwath%' OR name LIKE '%Bhagwati%'").get();
if (!bhagwathi) {
    rawDb.prepare(`
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
    console.log('Ensured Bhagwathi Rice and Agro Industries exists as default mill partner.');
}

// 5. Ensure 3 official products exist
rawDb.exec(`
    INSERT OR IGNORE INTO products (code, name, brand, variety, unit, min_stock_threshold, standard_selling_rate, active)
    VALUES 
        ('PROD-KK', 'Keshar Kali', 'Keshar Kali', 'Standard Loose Steamed Rice (Bulk)', 'QTL', 100, 3200, 1),
        ('PROD-KK-5KG', 'Keshar Kali 5 kgs', 'Keshar Kali', '5 kg Consumer Bag Packaging', 'QTL', 80, 3600, 1),
        ('PROD-KK-10KG', 'Keshar Kali 10 kg', 'Keshar Kali', '10 kg Consumer Bag Packaging', 'QTL', 60, 3500, 1);
`);

// 6. Reset sqlite auto-increment sequences for wiped tables
rawDb.exec(`
    DELETE FROM sqlite_sequence 
    WHERE name IN (
        'dispatches',
        'loading_entries',
        'stock_ledger',
        'stock_reservations',
        'stock_transfers',
        'stock_adjustments',
        'industry_allocations',
        'po_sub_orders',
        'purchase_orders',
        'whatsapp_notifications',
        'audit_logs'
    );
`);

rawDb.exec('PRAGMA foreign_keys = ON;');

console.log('\n--- VERIFICATION OF DATABASE STATE ---');
const tables = [
    'purchase_orders',
    'po_sub_orders',
    'loading_entries',
    'dispatches',
    'stock_ledger',
    'industry_allocations',
    'stock_reservations',
    'stock_transfers',
    'stock_adjustments',
    'whatsapp_notifications',
    'audit_logs'
];

for (const t of tables) {
    const row = db.get(`SELECT COUNT(*) as count FROM ${t}`);
    console.log(`${t}: ${row.count} records`);
}

const customersCount = db.get('SELECT COUNT(*) as count FROM customers').count;
const industriesCount = db.get('SELECT COUNT(*) as count FROM industries').count;
const productsCount = db.get('SELECT COUNT(*) as count FROM products').count;
console.log(`Customers: ${customersCount} (Real buyers preserved)`);
console.log(`Industries: ${industriesCount}`);
console.log(`Products: ${productsCount}`);

console.log('\nAll generated operational data has been completely removed!');
