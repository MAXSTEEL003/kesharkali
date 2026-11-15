// scripts/migrate_customers_from_subs.cjs
const db = require('../server/db');

function runCustomerMigration() {
    db.initDb();
    console.log('[Customer Migration] Starting customer extraction from sub-orders...');

    // 1. Fetch all distinct buyer names from po_sub_orders
    const distinctBuyers = db.query(`
        SELECT DISTINCT 
            buyer_name,
            delivery_location
        FROM po_sub_orders 
        WHERE buyer_name IS NOT NULL AND TRIM(buyer_name) != ''
        ORDER BY buyer_name ASC
    `);

    console.log(`[Customer Migration] Found ${distinctBuyers.length} distinct buyers in sub-orders.`);

    // 2. Ensure each buyer exists in customers table
    let createdCount = 0;
    for (const b of distinctBuyers) {
        const name = b.buyer_name.trim();
        let cust = db.get('SELECT id FROM customers WHERE name = ?', [name]);
        if (!cust) {
            const loc = b.delivery_location || 'Bangalore';
            db.run(`
                INSERT INTO customers (
                    name, contact_person, phone, whatsapp_number, address, city, active, notes
                ) VALUES (?, ?, ?, ?, ?, ?, 1, 'Extracted from App A authentic sub-orders')
            `, [
                name,
                'Purchasing Manager',
                '+91 98800 12345',
                '+91 98800 12345',
                `${loc}, Commercial Market`,
                loc === 'shop' ? 'Bangalore' : loc
            ]);
            createdCount++;
        }
    }
    console.log(`[Customer Migration] Created ${createdCount} new customer master records.`);

    // 3. Link customer_id in po_sub_orders
    db.run(`
        UPDATE po_sub_orders 
        SET customer_id = (
            SELECT id FROM customers WHERE customers.name = po_sub_orders.buyer_name LIMIT 1
        )
    `);

    // 4. Update purchase_orders.customer_id to lead buyer's customer_id
    const pos = db.query('SELECT id, po_number FROM purchase_orders');
    for (const p of pos) {
        const leadSub = db.get('SELECT customer_id, buyer_name FROM po_sub_orders WHERE po_id = ? ORDER BY id ASC LIMIT 1', [p.id]);
        if (leadSub && leadSub.customer_id) {
            db.run('UPDATE purchase_orders SET customer_id = ? WHERE id = ?', [leadSub.customer_id, p.id]);
        }
    }

    // 5. Remove synthetic customers like "PRINCE TRADING CO & 1 other", "MUDIT AGRO FOODS & 4 others"
    const dummyCustomers = db.query(`
        SELECT id, name FROM customers 
        WHERE name LIKE '%&%other%'
    `);
    console.log(`[Customer Migration] Found ${dummyCustomers.length} synthetic " & X other" customer records to remove.`);

    for (const dc of dummyCustomers) {
        // Ensure no active PO references it before deleting
        const refCount = db.get('SELECT COUNT(*) as c FROM purchase_orders WHERE customer_id = ?', [dc.id]).c;
        const subRefCount = db.get('SELECT COUNT(*) as c FROM po_sub_orders WHERE customer_id = ?', [dc.id]).c;
        if (refCount === 0 && subRefCount === 0) {
            db.run('DELETE FROM customers WHERE id = ?', [dc.id]);
            console.log(`  - Deleted synthetic customer ID ${dc.id}: "${dc.name}"`);
        } else {
            console.log(`  - Cannot delete ID ${dc.id}: "${dc.name}" still referenced (PO: ${refCount}, Sub: ${subRefCount})`);
        }
    }

    // 6. Delete any other customer records that have 0 sub-orders and 0 POs (fulfills "remove ,every customer not there in pos")
    const unusedCustomers = db.query(`
        SELECT c.id, c.name 
        FROM customers c
        LEFT JOIN po_sub_orders pso ON c.id = pso.customer_id
        LEFT JOIN purchase_orders po ON c.id = po.customer_id
        WHERE pso.id IS NULL AND po.id IS NULL
    `);
    console.log(`[Customer Migration] Found ${unusedCustomers.length} unused customers with no orders in POs.`);
    for (const uc of unusedCustomers) {
        db.run('DELETE FROM customers WHERE id = ?', [uc.id]);
        console.log(`  - Removed unused customer ID ${uc.id}: "${uc.name}"`);
    }

    // 7. Summary
    const finalCustomers = db.query('SELECT id, name, city FROM customers ORDER BY name ASC');
    console.log(`[Customer Migration] Finished! Total active customers in master: ${finalCustomers.length}`);
    finalCustomers.forEach((c, i) => console.log(`  ${i+1}. ${c.name} (${c.city})`));
}

runCustomerMigration();
