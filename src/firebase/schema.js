// src/firebase/schema.js
// Authoritative Firestore Collections Schema Definition for Keshar Kali Operations Portal

export const REQUIRED_COLLECTIONS = [
  {
    id: 'customers',
    name: 'Customers',
    description: 'Wholesale grain buyers, party names, GSTIN, and WhatsApp contact numbers',
    documentCount: 5,
    sampleId: 'cust_abc_traders',
    schema: {
      name: 'string (e.g. "ABC Traders")',
      contact_person: 'string',
      phone: 'string',
      whatsapp_number: 'string (E.164 without +, e.g. "919823011223")',
      address: 'string',
      city: 'string',
      gstin: 'string',
      notes: 'string',
      active: 'boolean',
      created_at: 'timestamp',
      updated_at: 'timestamp'
    }
  },
  {
    id: 'products',
    name: 'Products (Brand Catalog)',
    description: 'Keshar Kali authorized rice brand items with packing formats & thresholds',
    documentCount: 3,
    sampleId: 'prod_kk_standard',
    schema: {
      code: 'string (e.g. "PROD-KK")',
      name: 'string (e.g. "Keshar Kali")',
      brand: 'string ("Keshar Kali")',
      variety: 'string',
      unit: 'string ("QTL")',
      min_stock_threshold: 'number (QTL)',
      standard_selling_rate: 'number (₹/QTL)',
      active: 'boolean',
      created_at: 'timestamp',
      updated_at: 'timestamp'
    }
  },
  {
    id: 'warehouses',
    name: 'Warehouses / Godowns',
    description: 'Storage godowns with yard capacities, manager contacts, and locations',
    documentCount: 3,
    sampleId: 'wh_central_yard_1',
    schema: {
      name: 'string (e.g. "Central Godown - Yard 1")',
      location: 'string',
      capacity_qtl: 'number',
      manager_name: 'string',
      contact_phone: 'string',
      active: 'boolean',
      created_at: 'timestamp'
    }
  },
  {
    id: 'industries',
    name: 'Industries (Rice Mills)',
    description: 'Confidential sourcing partners, sortex mill contacts, and baseline purchase rates',
    documentCount: 4,
    sampleId: 'ind_balaji_rice_mill',
    schema: {
      name: 'string (e.g. "Industry A (Balaji Modern Rice Mill)")',
      location: 'string',
      contact_person: 'string',
      phone: 'string',
      available_products: 'string[] or string',
      default_purchase_rate: 'number (₹/QTL)',
      notes: 'string',
      active: 'boolean',
      created_at: 'timestamp',
      updated_at: 'timestamp'
    }
  },
  {
    id: 'purchase_orders',
    name: 'Purchase Orders',
    description: 'Customer commitments with ordered quantities, pricing, and fulfillment state',
    documentCount: 2,
    sampleId: 'po_2026_001',
    schema: {
      po_number: 'string (e.g. "PO-2026-001")',
      customer_id: 'string (reference)',
      customer_name: 'string (denormalized)',
      product_id: 'string (reference)',
      product_name: 'string (denormalized)',
      po_date: 'string (YYYY-MM-DD)',
      ordered_quantity: 'number (QTL)',
      customer_selling_rate: 'number (₹/QTL)',
      delivery_location: 'string',
      expected_delivery_date: 'string (YYYY-MM-DD)',
      notes: 'string',
      status: 'string (New | Allocated | Partially Loaded | Completed)',
      created_by: 'string',
      created_at: 'timestamp',
      updated_at: 'timestamp'
    }
  },
  {
    id: 'industry_allocations',
    name: 'Industry Allocations',
    description: 'Internal sourcing breakdown splitting customer POs across mills',
    documentCount: 3,
    sampleId: 'alloc_po1_ind_a',
    schema: {
      po_id: 'string (reference)',
      po_number: 'string',
      industry_id: 'string (reference)',
      industry_name: 'string',
      product_id: 'string (reference)',
      allocated_quantity: 'number (QTL)',
      purchase_rate: 'number (₹/QTL)',
      purchase_amount: 'number',
      expected_loading_date: 'string',
      status: 'string (Pending | Completed)',
      created_at: 'timestamp'
    }
  },
  {
    id: 'loading_entries',
    name: 'Master Loading Register',
    description: 'Daily dispatch staging records (Warehouse vs Direct fulfillment)',
    documentCount: 2,
    sampleId: 'load_2026_0001',
    schema: {
      loading_number: 'string (e.g. "LOAD-2026-0001")',
      loading_date: 'string (YYYY-MM-DD)',
      po_id: 'string (reference)',
      po_number: 'string',
      industry_id: 'string (reference)',
      product_id: 'string (reference)',
      fulfillment_type: 'string ("Warehouse" | "Direct")',
      warehouse_id: 'string or null',
      loading_location: 'string',
      vehicle_number: 'string',
      driver_phone: 'string',
      loading_quantity: 'number (QTL)',
      purchase_rate: 'number (₹/QTL)',
      loading_amount: 'number',
      loading_status: 'string ("Loaded")',
      dispatch_status: 'string ("Dispatched" | "Pending")',
      remarks: 'string',
      created_by: 'string',
      created_at: 'timestamp'
    }
  },
  {
    id: 'dispatches',
    name: 'Dispatches',
    description: 'Outward deliveries to buyers with vehicle numbers, driver contacts, and WhatsApp tracking',
    documentCount: 1,
    sampleId: 'disp_2026_0001',
    schema: {
      dispatch_number: 'string (e.g. "DISP-2026-0001")',
      loading_id: 'string (reference)',
      po_id: 'string (reference)',
      dispatch_date: 'string (YYYY-MM-DD)',
      dispatch_quantity: 'number (QTL)',
      vehicle_number: 'string',
      driver_phone: 'string',
      source_type: 'string ("Warehouse" | "Direct")',
      warehouse_id: 'string or null',
      notification_status: 'string ("Sent")',
      remarks: 'string',
      created_by: 'string',
      created_at: 'timestamp'
    }
  },
  {
    id: 'stock_ledger',
    name: 'Stock Ledger (Authoritative)',
    description: 'Immutable accounting audit ledger with running balance',
    documentCount: 5,
    sampleId: 'txn_2026_0001',
    schema: {
      transaction_number: 'string (e.g. "TXN-2026-0001")',
      date: 'string (YYYY-MM-DD)',
      product_id: 'string (reference)',
      product_name: 'string',
      warehouse_id: 'string (reference)',
      warehouse_name: 'string',
      transaction_type: 'string (Opening Stock | Customer Dispatch | Stock Replenished)',
      reference_number: 'string',
      source: 'string',
      destination: 'string',
      inward_quantity: 'number (QTL)',
      outward_quantity: 'number (QTL)',
      rate: 'number (₹/QTL)',
      amount: 'number',
      running_balance: 'number (QTL)',
      remarks: 'string',
      created_at: 'timestamp'
    }
  },
  {
    id: 'stock_transfers',
    name: 'Stock Transfers',
    description: 'Inter-godown stock movements between storage yards',
    documentCount: 0,
    sampleId: 'trf_sample',
    schema: {
      transfer_number: 'string (e.g. "TRF-2026-0001")',
      date: 'string (YYYY-MM-DD)',
      product_id: 'string',
      source_warehouse_id: 'string',
      dest_warehouse_id: 'string',
      quantity: 'number (QTL)',
      vehicle_number: 'string',
      remarks: 'string',
      created_by: 'string',
      created_at: 'timestamp'
    }
  },
  {
    id: 'stock_adjustments',
    name: 'Stock Adjustments',
    description: 'Physical audit reconciliation records preserving historical trail',
    documentCount: 0,
    sampleId: 'adj_sample',
    schema: {
      adjustment_number: 'string (e.g. "ADJ-2026-0001")',
      date: 'string (YYYY-MM-DD)',
      product_id: 'string',
      warehouse_id: 'string',
      system_stock: 'number',
      physical_stock: 'number',
      difference: 'number',
      reason: 'string',
      authorized_by: 'string',
      created_at: 'timestamp'
    }
  },
  {
    id: 'whatsapp_notifications',
    name: 'WhatsApp Notifications',
    description: 'Idempotent dispatch message records sent to buyer contacts',
    documentCount: 1,
    sampleId: 'wa_notif_sample',
    schema: {
      idempotency_key: 'string (unique)',
      dispatch_id: 'string',
      po_id: 'string',
      customer_id: 'string',
      recipient_phone: 'string',
      template_name: 'string ("dispatch_notification_v1")',
      message_body: 'string (privacy safe)',
      status: 'string ("Sent")',
      retry_count: 'number',
      created_at: 'timestamp'
    }
  },
  {
    id: 'audit_logs',
    name: 'Audit Logs (Tamper-Proof)',
    description: 'Enterprise traceability logs for every user action and data modification',
    documentCount: 1,
    sampleId: 'log_seed',
    schema: {
      entity_type: 'string',
      entity_id: 'string',
      action: 'string',
      actor: 'string',
      details: 'string',
      created_at: 'timestamp'
    }
  },
  {
    id: 'users',
    name: 'Users & Permissions',
    description: 'Portal personnel profiles and role-based permissions (Admin vs Operator)',
    documentCount: 2,
    sampleId: 'user_admin',
    schema: {
      username: 'string ("admin")',
      full_name: 'string ("Rajendra Deshmukh (Admin)")',
      role: 'string ("Admin" | "Operator")',
      email: 'string ("admin@kesharkali.com")',
      phone: 'string ("+91 98220 12345")',
      active: 'boolean (true)',
      created_at: 'timestamp'
    }
  },
  {
    id: 'system_settings',
    name: 'System Settings & Branding',
    description: 'Global portal configurations, logo URL, brand guidelines, and UOM settings',
    documentCount: 1,
    sampleId: 'portal_config',
    schema: {
      brand_name: 'string ("KESHAR KALI")',
      tagline: 'string ("Precision in Every Grain")',
      default_uom: 'string ("1 QTL = 100 KG")',
      theme: 'object ({ primary: "#8F1717", accent: "#C69A3B", background: "#FAF9F6" })',
      updated_at: 'timestamp'
    }
  }
];
