// server/db/index.js
// Node.js 22 built-in SQLite wrapper with transaction support

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);

const DB_DIR = process.env.DB_DIR || (
    isServerless 
        ? path.join(os.tmpdir(), 'kesharkali_data') 
        : path.resolve(__dirname, '../../data')
);

if (!fs.existsSync(DB_DIR)) {
    try {
        fs.mkdirSync(DB_DIR, { recursive: true });
    } catch (e) {
        console.warn('[DB] Warning creating DB_DIR:', e.message);
    }
}

const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'kesharkali.db');

let dbInstance = null;

function getDb() {
    if (!dbInstance) {
        dbInstance = new DatabaseSync(DB_PATH);
        // Optimize for concurrent operational reads and high performance
        dbInstance.exec('PRAGMA foreign_keys = ON;');
        dbInstance.exec('PRAGMA journal_mode = WAL;');
        dbInstance.exec('PRAGMA synchronous = NORMAL;');
    }
    return dbInstance;
}

let isSeeding = false;

function initDb() {
    const db = getDb();
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
    try {
        db.exec('ALTER TABLE dispatches ADD COLUMN driver_phone TEXT;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE loading_entries ADD COLUMN driver_phone TEXT;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE loading_entries ADD COLUMN driver_name TEXT;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE users ADD COLUMN supplier_id INTEGER REFERENCES industries(id);');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN original_order_id TEXT;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN supplier_id INTEGER REFERENCES industries(id);');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN supplier_rate REAL DEFAULT 0;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN supplier_notes TEXT;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN query_text TEXT;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN revised_date DATE;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN sync_status TEXT DEFAULT "Synced";');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN customer_name_text TEXT;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN customer_contact_text TEXT;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN sub_order_no TEXT;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN bill_no TEXT;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN sub_orders_json TEXT;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN is_accepted INTEGER DEFAULT 0;');
    } catch (_) { }
    try {
        db.exec('ALTER TABLE purchase_orders ADD COLUMN accepted_at DATETIME;');
    } catch (_) { }

    // Migrate CHECK constraint on purchase_orders if existing table rejects 'Accepted' or 'Pending'
    try {
        const poMaster = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='purchase_orders'").get();
        if (poMaster && (!poMaster.sql.includes("'Accepted'") || !poMaster.sql.includes("'Pending'"))) {
            console.log('[DB] Migrating purchase_orders table to support Accepted, Pending, and Settlement statuses...');
            db.exec('PRAGMA foreign_keys = OFF;');
            db.exec(`
                CREATE TABLE purchase_orders_migrated (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    po_number TEXT UNIQUE NOT NULL,
                    customer_id INTEGER NOT NULL REFERENCES customers(id),
                    product_id INTEGER NOT NULL REFERENCES products(id),
                    po_date DATE NOT NULL,
                    ordered_quantity REAL NOT NULL,
                    customer_selling_rate REAL NOT NULL,
                    delivery_location TEXT NOT NULL,
                    expected_delivery_date DATE,
                    notes TEXT,
                    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN (
                        'Pending', 'New', 'Allocation Pending', 'Partially Allocated', 'Allocated',
                        'Pending Acceptance', 'Accepted', 'Query Raised', 'Loading Scheduled',
                        'Partially Loaded', 'Loaded', 'Partially Dispatched', 'Dispatched',
                        'Delivered', 'Completed', 'Cancelled', 'Awaiting Settlement'
                    )),
                    created_by TEXT DEFAULT 'Staff',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    original_order_id TEXT,
                    supplier_id INTEGER REFERENCES industries(id),
                    supplier_rate REAL DEFAULT 0,
                    supplier_notes TEXT,
                    query_text TEXT,
                    revised_date DATE,
                    sync_status TEXT DEFAULT 'Synced',
                    customer_name_text TEXT,
                    customer_contact_text TEXT,
                    sub_order_no TEXT,
                    bill_no TEXT,
                    sub_orders_json TEXT,
                    is_accepted INTEGER DEFAULT 0,
                    accepted_at DATETIME
                );
                INSERT INTO purchase_orders_migrated (
                    id, po_number, customer_id, product_id, po_date, ordered_quantity, customer_selling_rate,
                    delivery_location, expected_delivery_date, notes, status, created_by, created_at, updated_at,
                    original_order_id, supplier_id, supplier_rate, supplier_notes, query_text, revised_date,
                    sync_status, customer_name_text, customer_contact_text, sub_order_no, bill_no, sub_orders_json,
                    is_accepted, accepted_at
                ) SELECT 
                    id, po_number, customer_id, product_id, po_date, ordered_quantity, customer_selling_rate,
                    delivery_location, expected_delivery_date, notes, status, created_by, created_at, updated_at,
                    original_order_id, supplier_id, supplier_rate, supplier_notes, query_text, revised_date,
                    sync_status, customer_name_text, customer_contact_text, sub_order_no, bill_no, sub_orders_json,
                    is_accepted, accepted_at
                FROM purchase_orders;
                DROP TABLE purchase_orders;
                ALTER TABLE purchase_orders_migrated RENAME TO purchase_orders;
                PRAGMA foreign_keys = ON;
            `);
            console.log('[DB] purchase_orders table migration completed successfully!');
        }
    } catch (migErr) {
        console.warn('[DB] Migration of purchase_orders notice:', migErr.message);
    }
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS po_sub_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
                po_number TEXT NOT NULL,
                sub_order_no TEXT NOT NULL,
                buyer_name TEXT NOT NULL,
                product_name TEXT NOT NULL,
                ordered_quantity REAL NOT NULL,
                rate REAL NOT NULL,
                amount REAL NOT NULL,
                bill_no TEXT,
                delivery_location TEXT,
                status TEXT DEFAULT 'New',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_sub_po ON po_sub_orders(po_id);
            CREATE INDEX IF NOT EXISTS idx_sub_no ON po_sub_orders(sub_order_no);
        `);
    } catch (_) { }

    try {
        db.exec("ALTER TABLE po_sub_orders ADD COLUMN bill_url TEXT;");
    } catch (_) { }
    try {
        db.exec("ALTER TABLE po_sub_orders ADD COLUMN bill_file_name TEXT;");
    } catch (_) { }
    try {
        db.exec("ALTER TABLE po_sub_orders ADD COLUMN bill_uploaded_at DATETIME;");
    } catch (_) { }
    try {
        db.exec("ALTER TABLE po_sub_orders ADD COLUMN loaded_quantity REAL DEFAULT 0;");
    } catch (_) { }
    try {
        db.exec("ALTER TABLE po_sub_orders ADD COLUMN customer_id INTEGER REFERENCES customers(id);");
    } catch (_) { }
    try {
        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_po_subno ON po_sub_orders(po_id, sub_order_no);");
    } catch (_) { }
    try {
        db.exec("ALTER TABLE industries ADD COLUMN is_default INTEGER DEFAULT 0;");
    } catch (_) { }
    try {
        db.exec("ALTER TABLE industries ADD COLUMN capacity_qtl REAL DEFAULT 15000;");
    } catch (_) { }
    try {
        db.exec("ALTER TABLE industries ADD COLUMN facility_type TEXT DEFAULT 'Rice Mill & Godown';");
    } catch (_) { }
    try {
        db.exec("ALTER TABLE loading_entries ADD COLUMN sub_order_no TEXT;");
    } catch (_) { }
    try {
        db.exec("ALTER TABLE loading_entries ADD COLUMN sub_order_id INTEGER REFERENCES po_sub_orders(id);");
    } catch (_) { }

    try {
        const userTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
        if (userTableSql && userTableSql.sql && !userTableSql.sql.includes("'Supplier'")) {
            db.exec('PRAGMA foreign_keys = OFF;');
            db.exec(`
                CREATE TABLE IF NOT EXISTS users_migrated (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('Admin', 'Operator', 'Supplier')),
                    email TEXT,
                    phone TEXT,
                    supplier_id INTEGER REFERENCES industries(id),
                    active INTEGER NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                INSERT OR IGNORE INTO users_migrated (id, username, password_hash, full_name, role, email, phone, supplier_id, active, created_at)
                SELECT id, username, password_hash, full_name, role, email, phone, supplier_id, active, created_at FROM users;
                DROP TABLE users;
                ALTER TABLE users_migrated RENAME TO users;
            `);
            db.exec('PRAGMA foreign_keys = ON;');
        }
    } catch (uMigErr) {
        console.warn('[DB Migration] Users role migration note:', uMigErr.message);
    }

    try {
        const duplicates = db.prepare(`
            SELECT name, MIN(id) as canonical_id, GROUP_CONCAT(id) as all_ids, COUNT(*) as cnt
            FROM customers
            GROUP BY name
            HAVING cnt > 1
        `).all();

        for (const dup of duplicates) {
            const allIds = dup.all_ids.split(',').map(Number);
            const dupIds = allIds.filter(id => id !== dup.canonical_id);
            if (dupIds.length > 0) {
                const placeholders = dupIds.map(() => '?').join(',');
                db.prepare(`UPDATE purchase_orders SET customer_id = ? WHERE customer_id IN (${placeholders})`).run(dup.canonical_id, ...dupIds);
                db.prepare(`UPDATE po_sub_orders SET customer_id = ? WHERE customer_id IN (${placeholders})`).run(dup.canonical_id, ...dupIds);
                db.prepare(`DELETE FROM customers WHERE id IN (${placeholders})`).run(...dupIds);
            }
        }
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_name ON customers(name);');
    } catch (custDedupErr) {
        console.warn('[DB Migration] Customer deduplication note:', custDedupErr.message);
    }

    // Auto-seed baseline master records if fresh database or if older seed needs upgrade
    try {
        if (!isSeeding) {
            const prodCount = db.prepare('SELECT COUNT(*) as count FROM products;').get();
            const poCount = db.prepare('SELECT COUNT(*) as count FROM purchase_orders;').get();
            const ordersJsonPath = path.resolve(__dirname, 'appA_bhagwathi_orders.json');
            let bundledCount = 0;
            if (fs.existsSync(ordersJsonPath)) {
                try { bundledCount = JSON.parse(fs.readFileSync(ordersJsonPath, 'utf8')).length; } catch (_) {}
            }

            if (!prodCount || prodCount.count === 0 || (bundledCount > 0 && (!poCount || poCount.count < bundledCount))) {
                console.log(`[DB] Baseline data check: seeding/updating authentic App A POs (bundled: ${bundledCount}, current: ${poCount ? poCount.count : 0})...`);
                isSeeding = true;
                const { seed } = require('./seed');
                seed();
                isSeeding = false;
            }

            // Rule: Until loaded, orders are considered Pending (even if accepted or partially loaded)
            if (fs.existsSync(ordersJsonPath)) {
                try {
                    const bundledOrders = JSON.parse(fs.readFileSync(ordersJsonPath, 'utf8'));
                    for (const bo of bundledOrders) {
                        if (bo.poNumber && bo.status === 'Accepted') {
                            db.prepare("UPDATE purchase_orders SET is_accepted = 1 WHERE po_number = ?").run(bo.poNumber);
                        }
                    }
                } catch (_) {}
            }

            // Reconcile status: preserve Accepted status for accepted orders
            db.prepare(`
                UPDATE purchase_orders 
                SET status = CASE 
                    WHEN (SELECT COALESCE(SUM(dispatch_quantity), 0) FROM dispatches WHERE po_id = purchase_orders.id) >= ordered_quantity AND ordered_quantity > 0 THEN 'Completed'
                    WHEN (SELECT COALESCE(SUM(loading_quantity), 0) FROM loading_entries WHERE po_id = purchase_orders.id AND loading_status != 'Cancelled') >= ordered_quantity AND ordered_quantity > 0 THEN 'Loaded'
                    WHEN is_accepted = 1 OR status = 'Accepted' THEN 'Accepted'
                    ELSE 'Pending'
                END
                WHERE status != 'Cancelled'
            `).run();
        }
    } catch (seedErr) {
        isSeeding = false;
        console.warn('[DB] Auto-seed check notice:', seedErr.message);
    }

    return db;
}

// Helper methods with clean parameter handling
function query(sql, params = []) {
    const db = getDb();
    const stmt = db.prepare(sql);
    return stmt.all(...params);
}

function get(sql, params = []) {
    const db = getDb();
    const stmt = db.prepare(sql);
    return stmt.get(...params);
}

function run(sql, params = []) {
    const db = getDb();
    const stmt = db.prepare(sql);
    return stmt.run(...params);
}

// Transaction wrapper with automatic rollback on error
function transaction(fn) {
    const db = getDb();
    db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
        const result = fn(db);
        db.exec('COMMIT;');
        return result;
    } catch (err) {
        try {
            db.exec('ROLLBACK;');
        } catch (rollbackErr) {
            console.error('Rollback error:', rollbackErr);
        }
        throw err;
    }
}

module.exports = {
    getDb,
    initDb,
    query,
    get,
    run,
    transaction,
    DB_PATH
};

