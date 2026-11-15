const db = require('../server/db');
console.log("Industries:", db.query("SELECT id, name FROM industries"));
console.log("Products:", db.query("SELECT id, name FROM products"));
console.log("Customers count:", db.query("SELECT COUNT(*) as c FROM customers")[0].c);
console.log("PO TC-3411:", db.query("SELECT id, po_number, customer_id, product_id, supplier_id FROM purchase_orders WHERE po_number = ?", ["TC-3411"]));
const cust3411 = db.query("SELECT * FROM customers WHERE id = ?", [36]);
console.log("Customer ID 36:", cust3411);
