const db = require('../server/db');

console.log('--- Current DB State ---');
const loadings = db.query('SELECT id, loading_number, po_id, sub_order_no, loading_quantity, vehicle_number FROM loading_entries');
console.log('Loading entries (' + loadings.length + '):', loadings);

const stockEntries = db.query('SELECT id, transaction_type, inward_quantity, outward_quantity, product_id FROM stock_ledger');
console.log('Stock ledger entries (' + stockEntries.length + '):', stockEntries);

// Delete all test loading entries
if (loadings.length > 0) {
    console.log('Clearing all loading entries...');
    db.run('DELETE FROM dispatches');
    db.run('DELETE FROM loading_entries');
}

// Reset all po_sub_orders loaded_quantity to 0 and status to Pending
db.run("UPDATE po_sub_orders SET loaded_quantity = 0, status = 'Pending'");

// Reset all purchase_orders status to New
db.run("UPDATE purchase_orders SET status = 'New'");

// Reset stock ledger if any
if (stockEntries.length > 0) {
    console.log('Clearing stock ledger...');
    db.run('DELETE FROM stock_ledger');
}

// Reset warehouse_stock and product physical_stock if needed
const warehouses = db.query('SELECT * FROM warehouses');
console.log('Warehouses:', warehouses.length);

const prods = db.query('SELECT id, name, code FROM products');
console.log('Products:', prods.length);

console.log('--- Verification After Reset ---');
const afterLoadings = db.query('SELECT COUNT(*) as c FROM loading_entries')[0].c;
const afterStock = db.query('SELECT COUNT(*) as c FROM stock_ledger')[0].c;
const subsWithLoad = db.query('SELECT COUNT(*) as c FROM po_sub_orders WHERE loaded_quantity > 0')[0].c;
console.log(`Loadings count: ${afterLoadings}, Stock ledger count: ${afterStock}, Subs with loading: ${subsWithLoad}`);
console.log('Clean complete.');
