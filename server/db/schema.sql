-- Keshar Kali Business Operations Management Portal
-- Database Schema for SQLite3

PRAGMA foreign_keys = ON;

-- 1. Users & Roles
CREATE TABLE IF NOT EXISTS users (
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

-- 2. Customers
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    whatsapp_number TEXT NOT NULL,
    address TEXT,
    city TEXT,
    gstin TEXT,
    notes TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- 3. Industries (Rice Mills / Sourcing Partners - STRICTLY INTERNAL)
CREATE TABLE IF NOT EXISTS industries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    available_products TEXT, -- Comma-separated or descriptive
    default_purchase_rate REAL DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    capacity_qtl REAL DEFAULT 15000,
    facility_type TEXT DEFAULT 'Rice Mill & Godown',
    notes TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Products (Rice Varieties & Brands)
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'Keshar Kali',
    variety TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'QTL',
    min_stock_threshold REAL NOT NULL DEFAULT 50.0,
    standard_selling_rate REAL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Warehouses / Godowns
CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    capacity_qtl REAL DEFAULT 10000,
    manager_name TEXT,
    contact_phone TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Customer Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    po_date DATE NOT NULL,
    ordered_quantity REAL NOT NULL, -- in QTL
    customer_selling_rate REAL NOT NULL, -- ₹/QTL
    delivery_location TEXT NOT NULL,
    expected_delivery_date DATE,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN (
        'Pending',
        'New',
        'Allocation Pending',
        'Partially Allocated',
        'Allocated',
        'Pending Acceptance',
        'Accepted',
        'Query Raised',
        'Loading Scheduled',
        'Partially Loaded',
        'Loaded',
        'Partially Dispatched',
        'Dispatched',
        'Delivered',
        'Completed',
        'Cancelled',
        'Awaiting Settlement'
    )),
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
    created_by TEXT DEFAULT 'Staff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Industry Sourcing Allocations (Internal sourcing breakdown for a PO)
CREATE TABLE IF NOT EXISTS industry_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    industry_id INTEGER NOT NULL REFERENCES industries(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    allocated_quantity REAL NOT NULL, -- QTL
    purchase_rate REAL NOT NULL, -- ₹/QTL
    purchase_amount REAL NOT NULL, -- allocated_quantity * purchase_rate
    expected_loading_date DATE,
    notes TEXT,
    override_allowed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN (
        'Pending',
        'Partially Loaded',
        'Loaded',
        'Completed',
        'Cancelled'
    )),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Loading Entries (Master Loading Register single source of truth)
CREATE TABLE IF NOT EXISTS loading_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loading_number TEXT UNIQUE NOT NULL,
    loading_date DATE NOT NULL,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id),
    sub_order_no TEXT,
    sub_order_id INTEGER REFERENCES po_sub_orders(id),
    allocation_id INTEGER REFERENCES industry_allocations(id),
    industry_id INTEGER NOT NULL REFERENCES industries(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    fulfillment_type TEXT NOT NULL DEFAULT 'Warehouse' CHECK(fulfillment_type IN ('Warehouse', 'Direct')),
    warehouse_id INTEGER REFERENCES warehouses(id), -- Required if fulfillment_type == 'Warehouse'
    loading_location TEXT,
    vehicle_number TEXT NOT NULL,
    driver_phone TEXT,
    loading_quantity REAL NOT NULL, -- QTL
    purchase_rate REAL NOT NULL, -- ₹/QTL
    loading_amount REAL NOT NULL, -- loading_quantity * purchase_rate
    loading_status TEXT NOT NULL DEFAULT 'Loaded' CHECK(loading_status IN ('Pending', 'Loading', 'Loaded', 'Cancelled')),
    dispatch_status TEXT NOT NULL DEFAULT 'Pending' CHECK(dispatch_status IN ('Pending', 'Partially Dispatched', 'Dispatched')),
    remarks TEXT,
    created_by TEXT DEFAULT 'Staff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Dispatches
CREATE TABLE IF NOT EXISTS dispatches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dispatch_number TEXT UNIQUE NOT NULL,
    loading_id INTEGER NOT NULL REFERENCES loading_entries(id),
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id),
    dispatch_date DATE NOT NULL,
    dispatch_quantity REAL NOT NULL, -- QTL
    vehicle_number TEXT NOT NULL,
    driver_phone TEXT,
    source_type TEXT NOT NULL CHECK(source_type IN ('Warehouse', 'Direct')),
    warehouse_id INTEGER REFERENCES warehouses(id),
    remarks TEXT,
    notification_status TEXT NOT NULL DEFAULT 'Pending' CHECK(notification_status IN ('Pending', 'Sent', 'Failed', 'Delivered')),
    created_by TEXT DEFAULT 'Staff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Stock Ledger Transactions (Authoritative accounting running balance)
CREATE TABLE IF NOT EXISTS stock_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    warehouse_id INTEGER REFERENCES warehouses(id),
    transaction_type TEXT NOT NULL CHECK(transaction_type IN (
        'Opening Stock',
        'Stock Replenished',
        'Purchase Inward',
        'Customer Return',
        'Stock Transfer In',
        'Stock Transfer Out',
        'Customer Dispatch',
        'Internal Stock Issue',
        'Stock Adjustment In',
        'Stock Adjustment Out'
    )),
    reference_number TEXT, -- PO#, Loading#, Transfer#, Adjustment#
    source TEXT,
    destination TEXT,
    inward_quantity REAL NOT NULL DEFAULT 0,
    outward_quantity REAL NOT NULL DEFAULT 0,
    rate REAL NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0,
    running_balance REAL NOT NULL, -- Physical running balance for the product
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Stock Reservations (Order commitments that do NOT reduce physical stock)
CREATE TABLE IF NOT EXISTS stock_reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    warehouse_id INTEGER REFERENCES warehouses(id),
    reserved_quantity REAL NOT NULL,
    released_quantity REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Fulfilled', 'Released')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Stock Transfers (Inter-godown transfer)
CREATE TABLE IF NOT EXISTS stock_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    source_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    dest_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    quantity REAL NOT NULL,
    vehicle_number TEXT,
    remarks TEXT,
    created_by TEXT DEFAULT 'Staff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Stock Adjustments (Physical count reconciliation)
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    adjustment_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    system_stock REAL NOT NULL,
    physical_stock REAL NOT NULL,
    difference REAL NOT NULL,
    reason TEXT NOT NULL,
    authorized_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Customer WhatsApp Notifications
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key TEXT UNIQUE NOT NULL,
    dispatch_id INTEGER NOT NULL REFERENCES dispatches(id),
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    recipient_phone TEXT NOT NULL,
    template_name TEXT NOT NULL,
    message_body TEXT NOT NULL, -- Strictly privacy protected
    wa_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'Sent' CHECK(status IN ('Sent', 'Delivered', 'Failed', 'Pending Retry')),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. Cross-Project Integration Sync Logs (Idempotency & Replay Protection)
CREATE TABLE IF NOT EXISTS integration_sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key TEXT UNIQUE NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('INBOUND_PO', 'OUTBOUND_REVERSE')),
    source_order_id TEXT NOT NULL,
    supplier_po_number TEXT,
    supplier_id INTEGER REFERENCES industries(id),
    status TEXT NOT NULL CHECK(status IN ('Success', 'Failed', 'Duplicate_Ignored', 'Pending')),
    payload TEXT NOT NULL,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 17. Supplier Documents (Invoices, Weighbridge Slips, LR Copies)
CREATE TABLE IF NOT EXISTS supplier_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id),
    loading_id INTEGER REFERENCES loading_entries(id),
    supplier_id INTEGER NOT NULL REFERENCES industries(id),
    document_type TEXT NOT NULL CHECK(document_type IN ('Supplier Invoice', 'Weighbridge Slip', 'Loading Receipt', 'LR Copy', 'Quality Report', 'Other')),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    mime_type TEXT,
    uploaded_by TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 18. Purchase Order Chronological Ledger
CREATE TABLE IF NOT EXISTS po_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id),
    po_number TEXT NOT NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    actor TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 19. Purchase Order Sub-Orders (Constituent sub-orders with supplier-specific Sub No)
CREATE TABLE IF NOT EXISTS po_sub_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    po_number TEXT NOT NULL,
    sub_order_no TEXT NOT NULL, -- e.g. BRI-0001, BRI-0002
    buyer_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    ordered_quantity REAL NOT NULL, -- in QTL
    rate REAL NOT NULL, -- in ₹/QTL
    amount REAL NOT NULL,
    bill_no TEXT, -- Mill Bill # (e.g. 131, 127, 299)
    delivery_location TEXT,
    loaded_quantity REAL DEFAULT 0,
    customer_id INTEGER REFERENCES customers(id),
    bill_url TEXT,
    bill_file_name TEXT,
    bill_uploaded_at DATETIME,
    status TEXT DEFAULT 'New',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sub_po ON po_sub_orders(po_id);
CREATE INDEX IF NOT EXISTS idx_sub_no ON po_sub_orders(sub_order_no);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_po_customer ON purchase_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_alloc_po ON industry_allocations(po_id);
CREATE INDEX IF NOT EXISTS idx_loading_po ON loading_entries(po_id);
CREATE INDEX IF NOT EXISTS idx_loading_date ON loading_entries(loading_date);
CREATE INDEX IF NOT EXISTS idx_loading_industry ON loading_entries(industry_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_po ON dispatches(po_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_loading ON dispatches(loading_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_date ON dispatches(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_ledger_product ON stock_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON stock_ledger(date);
CREATE INDEX IF NOT EXISTS idx_ledger_warehouse ON stock_ledger(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_res_po ON stock_reservations(po_id);
CREATE INDEX IF NOT EXISTS idx_res_product ON stock_reservations(product_id);

