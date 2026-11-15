// scripts/seed-firestore.mjs
// Automated Firestore collection creation & initial data seeding for Keshar Kali Portal
import fs from 'fs';
import path from 'path';
import { initializeApp as initClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, doc as clientDoc, setDoc as clientSetDoc } from 'firebase/firestore';
import admin from 'firebase-admin';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "kesharkaliportal";
const serviceAccountPath = path.resolve('serviceAccountKey.json');

let db = null;
let mode = 'client';

if (fs.existsSync(serviceAccountPath)) {
  console.log(`[Auth Mode] Found serviceAccountKey.json! Using Firebase Admin SDK (Rule Bypass)...`);
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  mode = 'admin';
} else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  console.log(`[Auth Mode] Using Firebase Admin SDK credentials from environment...`);
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
  db = admin.firestore();
  mode = 'admin';
} else {
  console.log(`[Auth Mode] Using Firebase Web Client SDK (${projectId})...`);
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyBhks0oj5288L3He_JhgH2M7IVtE5rYyUc",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "kesharkaliportal.firebaseapp.com",
    projectId: projectId,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "kesharkaliportal.firebasestorage.app",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "758973369267",
    appId: process.env.VITE_FIREBASE_APP_ID || "1:758973369267:web:e24c25e878f14b2e39d9c6"
  };
  const clientApp = initClientApp(firebaseConfig);
  db = getClientFirestore(clientApp);
  mode = 'client';
}

console.log('================================================================');
console.log('KESHAR KALI OPERATIONS PORTAL — FIRESTORE SEEDER');
console.log(`Target Project: ${projectId}`);
console.log(`Active Mode: ${mode.toUpperCase()}`);
console.log('================================================================\n');

const SEED_DATA = {
  customers: {
    cust_abc_traders: {
      name: 'ABC Traders',
      contact_person: 'Anand Agrawal',
      phone: '+91 98230 11223',
      whatsapp_number: '919823011223',
      address: 'G-12, Kalamna Grain Market',
      city: 'Nagpur',
      gstin: '27AABCT1234F1Z8',
      notes: 'Prime wholesale buyer, priority delivery',
      active: true,
      created_at: new Date().toISOString()
    },
    cust_mahavir_provisions: {
      name: 'Mahavir Provisions',
      contact_person: 'Bhavin Shah',
      phone: '+91 94221 44556',
      whatsapp_number: '919422144556',
      address: 'Main Bazaar, Near Clock Tower',
      city: 'Gondia',
      gstin: '27AABCM5678M1Z2',
      notes: 'Regular monthly off-taker of HMT and Kolam',
      active: true,
      created_at: new Date().toISOString()
    },
    cust_shree_ganesh_agro: {
      name: 'Shree Ganesh Agro',
      contact_person: 'Ganesh Patel',
      phone: '+91 97130 99887',
      whatsapp_number: '919713099887',
      address: 'Wholesale Yard, Pandri',
      city: 'Raipur',
      gstin: '22AABCS9988R1Z1',
      notes: 'Direct mill deliveries preferred',
      active: true,
      created_at: new Date().toISOString()
    },
    cust_royal_grains: {
      name: 'Royal Grains Mart',
      contact_person: 'Maheshwari Brothers',
      phone: '+91 99750 33445',
      whatsapp_number: '919975033445',
      address: 'Shop 44, APMC Yard',
      city: 'Bhandara',
      gstin: '27AABCR3344P1Z5',
      notes: 'Payment terms 15 days',
      active: true,
      created_at: new Date().toISOString()
    },
    cust_keshar_wholesale: {
      name: 'Keshar Wholesale Depot',
      contact_person: 'Sunil Jaiswal',
      phone: '+91 98900 77665',
      whatsapp_number: '919890077665',
      address: 'Plot 88, Outer Ring Road Godown Hub',
      city: 'Nagpur',
      gstin: '27AABCK7766K1Z9',
      notes: 'Bulk receiver with 50-ton weighbridge',
      active: true,
      created_at: new Date().toISOString()
    }
  },

  products: {
    prod_kk_bulk: {
      code: 'PROD-KK',
      name: 'Keshar Kali',
      brand: 'Keshar Kali',
      variety: 'Standard Loose Steamed Rice (Bulk)',
      unit: 'QTL',
      min_stock_threshold: 100,
      standard_selling_rate: 3200,
      active: true,
      created_at: new Date().toISOString()
    },
    prod_kk_5kg: {
      code: 'PROD-KK-5KG',
      name: 'Keshar Kali 5 kgs',
      brand: 'Keshar Kali',
      variety: '5 kg Consumer Bag Packaging',
      unit: 'QTL',
      min_stock_threshold: 80,
      standard_selling_rate: 3600,
      active: true,
      created_at: new Date().toISOString()
    },
    prod_kk_10kg: {
      code: 'PROD-KK-10KG',
      name: 'Keshar Kali 10 kg',
      brand: 'Keshar Kali',
      variety: '10 kg Consumer Bag Packaging',
      unit: 'QTL',
      min_stock_threshold: 60,
      standard_selling_rate: 3500,
      active: true,
      created_at: new Date().toISOString()
    }
  },

  warehouses: {
    wh_central_01: {
      name: 'Central Godown - Yard 1',
      location: 'Wardha Road, MIDC Butibori, Nagpur',
      capacity_qtl: 15000,
      manager_name: 'Prakash Jadhav',
      contact_phone: '+91 98223 33111',
      active: true,
      created_at: new Date().toISOString()
    },
    wh_railway_02: {
      name: 'Railway Siding Godown',
      location: 'Kalamna Mandi Complex, Nagpur',
      capacity_qtl: 25000,
      manager_name: 'Sunil Meshram',
      contact_phone: '+91 98223 33222',
      active: true,
      created_at: new Date().toISOString()
    },
    wh_hingna_03: {
      name: 'Hingna Storage Depot',
      location: 'Electronic Zone, Hingna MIDC, Nagpur',
      capacity_qtl: 10000,
      manager_name: 'Devendra Raut',
      contact_phone: '+91 98223 33333',
      active: true,
      created_at: new Date().toISOString()
    }
  },

  industries: {
    ind_balaji_01: {
      name: 'Industry A (Balaji Modern Rice Mill)',
      location: 'Bhandara Industrial Area',
      contact_person: 'Rameshji Balaji',
      phone: '+91 94231 10001',
      available_products: 'Keshar Kali, Keshar Kali 5 kgs, Keshar Kali 10 kg',
      default_purchase_rate: 2850,
      notes: 'High quality sorting, reliable dispatch',
      active: true,
      created_at: new Date().toISOString()
    },
    ind_vaishnavi_02: {
      name: 'Industry B (Vaishnavi Agro Industries)',
      location: 'Gondia Road, Tiroda',
      contact_person: 'Suresh Vaishnav',
      phone: '+91 94231 20002',
      available_products: 'Keshar Kali, Keshar Kali 5 kgs, Keshar Kali 10 kg',
      default_purchase_rate: 2900,
      notes: 'Equipped with Sortex 5-chute machines',
      active: true,
      created_at: new Date().toISOString()
    },
    ind_kisan_03: {
      name: 'Industry C (Kisan Rice Industries)',
      location: 'Tumsar Mandi Gate',
      contact_person: 'Dinesh Kisan',
      phone: '+91 94231 30003',
      available_products: 'Keshar Kali, Keshar Kali 10 kg',
      default_purchase_rate: 2820,
      notes: 'Direct rail siding connectivity',
      active: true,
      created_at: new Date().toISOString()
    },
    ind_shree_ram_04: {
      name: 'Industry D (Shree Ram Milling Corp)',
      location: 'Waraseoni Highway, Balaghat',
      contact_person: 'Harishchand Sharma',
      phone: '+91 94231 40004',
      available_products: 'Keshar Kali, Keshar Kali 5 kgs',
      default_purchase_rate: 2950,
      notes: 'Aged paddy stocks available',
      active: true,
      created_at: new Date().toISOString()
    }
  },

  purchase_orders: {
    po_2026_001: {
      po_number: 'PO-2026-001',
      customer_id: 'cust_abc_traders',
      customer_name: 'ABC Traders',
      product_id: 'prod_kk_bulk',
      product_name: 'Keshar Kali',
      po_date: '2026-11-02',
      ordered_quantity: 100,
      customer_selling_rate: 3200,
      delivery_location: 'Nagpur APMC',
      expected_delivery_date: '2026-11-10',
      status: 'Allocated',
      created_by: 'Staff',
      created_at: new Date().toISOString()
    },
    po_2026_002: {
      po_number: 'PO-2026-002',
      customer_id: 'cust_mahavir_provisions',
      customer_name: 'Mahavir Provisions',
      product_id: 'prod_kk_5kg',
      product_name: 'Keshar Kali 5 kgs',
      po_date: '2026-11-04',
      ordered_quantity: 75,
      customer_selling_rate: 3600,
      delivery_location: 'Gondia Main Market',
      expected_delivery_date: '2026-11-12',
      status: 'Partially Loaded',
      created_by: 'Staff',
      created_at: new Date().toISOString()
    }
  },

  industry_allocations: {
    alloc_po1_01: {
      po_id: 'po_2026_001',
      po_number: 'PO-2026-001',
      industry_id: 'ind_balaji_01',
      industry_name: 'Industry A (Balaji Modern Rice Mill)',
      product_id: 'prod_kk_bulk',
      allocated_quantity: 40,
      purchase_rate: 2850,
      purchase_amount: 114000,
      expected_loading_date: '2026-11-08',
      status: 'Pending',
      created_at: new Date().toISOString()
    },
    alloc_po1_02: {
      po_id: 'po_2026_001',
      po_number: 'PO-2026-001',
      industry_id: 'ind_vaishnavi_02',
      industry_name: 'Industry B (Vaishnavi Agro Industries)',
      product_id: 'prod_kk_bulk',
      allocated_quantity: 35,
      purchase_rate: 2900,
      purchase_amount: 101500,
      expected_loading_date: '2026-11-09',
      status: 'Pending',
      created_at: new Date().toISOString()
    },
    alloc_po1_03: {
      po_id: 'po_2026_001',
      po_number: 'PO-2026-001',
      industry_id: 'ind_kisan_03',
      industry_name: 'Industry C (Kisan Rice Industries)',
      product_id: 'prod_kk_bulk',
      allocated_quantity: 25,
      purchase_rate: 2820,
      purchase_amount: 70500,
      expected_loading_date: '2026-11-10',
      status: 'Pending',
      created_at: new Date().toISOString()
    }
  },

  loading_entries: {
    load_2026_0001: {
      loading_number: 'LOAD-2026-0001',
      loading_date: '2026-11-05',
      po_id: 'po_2026_002',
      po_number: 'PO-2026-002',
      industry_id: 'ind_vaishnavi_02',
      product_id: 'prod_kk_5kg',
      fulfillment_type: 'Warehouse',
      warehouse_id: 'wh_railway_02',
      loading_location: 'Gondia Road, Tiroda',
      vehicle_number: 'MH-31-CB-9022',
      driver_phone: '+91 98224 88771',
      loading_quantity: 30,
      purchase_rate: 3150,
      loading_amount: 94500,
      loading_status: 'Loaded',
      dispatch_status: 'Dispatched',
      created_by: 'Staff',
      created_at: new Date().toISOString()
    },
    load_2026_0002: {
      loading_number: 'LOAD-2026-0002',
      loading_date: '2026-11-06',
      po_id: 'po_2026_002',
      po_number: 'PO-2026-002',
      industry_id: 'ind_balaji_01',
      product_id: 'prod_kk_5kg',
      fulfillment_type: 'Warehouse',
      warehouse_id: 'wh_central_01',
      loading_location: 'Bhandara Industrial Area',
      vehicle_number: 'MH-31-TR-4411',
      driver_phone: '+91 98224 55442',
      loading_quantity: 25,
      purchase_rate: 3100,
      loading_amount: 77500,
      loading_status: 'Loaded',
      dispatch_status: 'Pending',
      created_by: 'Staff',
      created_at: new Date().toISOString()
    }
  },

  dispatches: {
    disp_2026_0001: {
      dispatch_number: 'DISP-2026-0001',
      loading_id: 'load_2026_0001',
      po_id: 'po_2026_002',
      dispatch_date: '2026-11-05',
      dispatch_quantity: 30,
      vehicle_number: 'MH-31-CB-9022',
      driver_phone: '+91 98224 88771',
      source_type: 'Warehouse',
      warehouse_id: 'wh_railway_02',
      notification_status: 'Sent',
      remarks: 'Delivered to Mahavir Provisions Godown',
      created_by: 'Staff',
      created_at: new Date().toISOString()
    }
  },

  stock_ledger: {
    txn_2026_0001: {
      transaction_number: 'TXN-2026-0001',
      date: '2026-11-01',
      product_id: 'prod_kk_bulk',
      product_name: 'Keshar Kali',
      warehouse_id: 'wh_central_01',
      warehouse_name: 'Central Godown - Yard 1',
      transaction_type: 'Opening Stock',
      reference_number: 'INIT-2026-01',
      source: 'Beginning Inventory',
      destination: 'Central Godown - Yard 1',
      inward_quantity: 500,
      outward_quantity: 0,
      rate: 2800,
      amount: 1400000,
      running_balance: 500,
      remarks: 'FY2026 Opening physical stock balance verified',
      created_at: new Date().toISOString()
    },
    txn_2026_0002: {
      transaction_number: 'TXN-2026-0002',
      date: '2026-11-01',
      product_id: 'prod_kk_5kg',
      product_name: 'Keshar Kali 5 kgs',
      warehouse_id: 'wh_railway_02',
      warehouse_name: 'Railway Siding Godown',
      transaction_type: 'Opening Stock',
      reference_number: 'INIT-2026-02',
      source: 'Beginning Inventory',
      destination: 'Railway Siding Godown',
      inward_quantity: 300,
      outward_quantity: 0,
      rate: 3100,
      amount: 930000,
      running_balance: 300,
      remarks: 'FY2026 Opening physical stock balance verified',
      created_at: new Date().toISOString()
    },
    txn_2026_0003: {
      transaction_number: 'TXN-2026-0003',
      date: '2026-11-01',
      product_id: 'prod_kk_10kg',
      product_name: 'Keshar Kali 10 kg',
      warehouse_id: 'wh_central_01',
      warehouse_name: 'Central Godown - Yard 1',
      transaction_type: 'Opening Stock',
      reference_number: 'INIT-2026-03',
      source: 'Beginning Inventory',
      destination: 'Central Godown - Yard 1',
      inward_quantity: 200,
      outward_quantity: 0,
      rate: 3000,
      amount: 600000,
      running_balance: 200,
      remarks: 'FY2026 Opening physical stock balance verified',
      created_at: new Date().toISOString()
    }
  },

  stock_transfers: {
    _schema_template: {
      transfer_number: 'TRF-TEMPLATE',
      note: 'Collection initialized for Inter-Godown Stock Movements',
      created_at: new Date().toISOString()
    }
  },

  stock_adjustments: {
    _schema_template: {
      adjustment_number: 'ADJ-TEMPLATE',
      note: 'Collection initialized for Physical Count Audit Reconciliations',
      created_at: new Date().toISOString()
    }
  },

  whatsapp_notifications: {
    notif_2026_0001: {
      idempotency_key: 'DISP-2026-0001_DISPATCH_NOTIF',
      dispatch_id: 'disp_2026_0001',
      po_id: 'po_2026_002',
      customer_id: 'cust_mahavir_provisions',
      recipient_phone: '919422144556',
      template_name: 'dispatch_notification_v1',
      message_body: 'Hello Bhavin Shah, Your order has been dispatched...',
      status: 'Sent',
      retry_count: 0,
      created_at: new Date().toISOString()
    }
  },

  audit_logs: {
    log_init_001: {
      entity_type: 'System',
      entity_id: 'INITIALIZE',
      action: 'COLLECTIONS_CREATED',
      actor: 'System Admin',
      details: 'Initialized 15 Firestore collections for Keshar Kali Operations',
      created_at: new Date().toISOString()
    }
  },

  users: {
    user_admin: {
      username: 'admin',
      full_name: 'Rajendra Deshmukh (Admin)',
      role: 'Admin',
      email: 'admin@kesharkali.com',
      phone: '+91 98220 12345',
      active: true,
      created_at: new Date().toISOString()
    },
    user_operator: {
      username: 'operator',
      full_name: 'Vikram Shinde (Operator)',
      role: 'Operator',
      email: 'operator@kesharkali.com',
      phone: '+91 98220 54321',
      active: true,
      created_at: new Date().toISOString()
    }
  },

  system_settings: {
    portal_config: {
      brand_name: 'KESHAR KALI',
      tagline: 'Precision in Every Grain',
      default_uom: '1 Quintal (QTL) = 100 Kilograms (KG)',
      theme: {
        primary: '#8F1717',
        accent: '#C69A3B',
        background: '#FAF9F6'
      },
      updated_at: new Date().toISOString()
    }
  }
};

async function seedCollections() {
  const collectionNames = Object.keys(SEED_DATA);
  console.log(`Starting Firestore initialization for ${collectionNames.length} collections...`);
  
  let totalDocsWritten = 0;
  let successCollections = 0;

  for (const collName of collectionNames) {
    const docs = SEED_DATA[collName];
    const docIds = Object.keys(docs);
    console.log(`\n• Seeding collection: [${collName}] (${docIds.length} documents)`);
    
    try {
      for (const docId of docIds) {
        if (mode === 'admin') {
          await db.collection(collName).doc(docId).set(docs[docId], { merge: true });
        } else {
          const docRef = clientDoc(db, collName, docId);
          await clientSetDoc(docRef, docs[docId], { merge: true });
        }
        totalDocsWritten++;
      }
      successCollections++;
      console.log(`  ✓ Collection [${collName}] ready with ${docIds.length} documents.`);
    } catch (err) {
      console.error(`  ✗ Error writing collection [${collName}]:`, err.message);
      if (err.code === 'permission-denied' || err.message?.includes('PERMISSION_DENIED')) {
        console.error('\n================================================================');
        console.error('🔒 HOW TO SOLVE "PERMISSION_DENIED" IN FIRESTORE:');
        console.error('----------------------------------------------------------------');
        console.error('By default, newly created Firestore databases block unauthenticated');
        console.error('writes from client SDK scripts. You have two easy ways to resolve this:\n');
        console.error('METHOD A (Quickest - 30 seconds):');
        console.error('1. Open your Firestore Rules in Firebase Console:');
        console.error(`   https://console.firebase.google.com/project/${projectId}/firestore/rules`);
        console.error('2. Change the rule temporarily to allow setup:');
        console.error('   rules_version = \'2\';');
        console.error('   service cloud.firestore {');
        console.error('     match /databases/{database}/documents {');
        console.error('       match /{document=**} {');
        console.error('         allow read, write: if true;');
        console.error('       }');
        console.error('     }');
        console.error('   }');
        console.error('3. Click "Publish", then re-run:');
        console.error('   npm run seed:firestore\n');
        console.error('METHOD B (Admin Service Account - Bypasses all rules):');
        console.error('1. Open:');
        console.error(`   https://console.firebase.google.com/project/${projectId}/settings/serviceaccounts/adminsdk`);
        console.error('2. Click "Generate new private key".');
        console.error('3. Save the downloaded JSON file as "serviceAccountKey.json" in this project folder.');
        console.error('4. Re-run:');
        console.error('   npm run seed:firestore');
        console.error('================================================================\n');
        process.exit(1);
      }
    }
  }

  console.log('\n================================================================');
  console.log(`🎉 SUCCESS! SEEDED ${successCollections}/${collectionNames.length} COLLECTIONS (${totalDocsWritten} TOTAL DOCUMENTS)`);
  console.log('================================================================');
  process.exit(0);
}

seedCollections().catch((err) => {
  console.error('Fatal Seeding Error:', err);
  process.exit(1);
});
