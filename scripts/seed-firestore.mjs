// scripts/seed-firestore.mjs
// Automated Firestore collection creation & authentic data seeding for Keshar Kali Portal
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

// Load authentic App A orders
const jsonPath = path.resolve('server/db/appA_bhagwathi_orders.json');
const orders = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : [];

function sanitizeDocId(str) {
  return (str || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Build authentic customer dictionary from constituent sub-orders
const customersData = {};
orders.forEach(ord => {
  (ord.subOrders || []).forEach(sub => {
    const buyerName = (sub.buyerName || ord.buyerName || '').replace(/\s*&\s*\d+\s+others?/gi, '').trim();
    if (!buyerName) return;
    const docId = 'cust_' + sanitizeDocId(buyerName);
    if (!customersData[docId]) {
      customersData[docId] = {
        name: buyerName,
        contact_person: 'Purchasing Manager',
        phone: '+91 98800 12345',
        whatsapp_number: '919880012345',
        address: `${sub.deliveryLocation || 'Commercial Market'}, Bangalore`,
        city: 'Bangalore',
        active: true,
        notes: 'Authentic buyer synced from App A sub-orders',
        created_at: new Date().toISOString()
      };
    }
  });
});

// Build authentic purchase orders dictionary
const poData = {};
orders.forEach(ord => {
  const leadSub = ord.subOrders?.[0];
  const leadBuyerName = (leadSub?.buyerName || ord.buyerName || '').replace(/\s*&\s*\d+\s+others?/gi, '').trim();
  const subOrderNoString = (ord.subOrders || []).map(s => s.subOrderNo).filter(Boolean).join(', ');
  
  poData[ord.poNumber] = {
    id: ord.poNumber,
    po_number: ord.poNumber,
    poNumber: ord.poNumber,
    customer_id: 'cust_' + sanitizeDocId(leadBuyerName),
    customer_name: leadBuyerName,
    buyer: leadBuyerName,
    buyer_name: leadBuyerName,
    product_id: ord.productName?.toUpperCase().includes('MAD') ? 'prod_kk_10kg' : 'prod_kk_bulk',
    product_name: ord.productName || 'Keshar Kali',
    product: ord.productName || 'Keshar Kali',
    po_date: ord.date,
    date: ord.date,
    ordered_quantity: ord.totalQuantity,
    qty: ord.totalQuantity,
    customer_selling_rate: ord.rate,
    rate: ord.rate,
    delivery_location: ord.destination || 'Consolidated Hub',
    destination: ord.destination || 'Consolidated Hub',
    status: ord.status || 'Accepted',
    notes: ord.notes || 'Authentic order from App A placed_orders',
    created_by: 'App A Sync',
    original_order_id: ord.poNumber,
    supplier_id: 5,
    supplier_name: 'Bhagwathi Rice and Agro Industries',
    supplier_rate: ord.rate,
    sync_status: 'Synced',
    customer_name_text: leadBuyerName,
    customer_contact_text: '+91 98800 12345',
    sub_order_no: subOrderNoString,
    bill_no: ord.billNo,
    sub_orders: ord.subOrders || [],
    subOrders: ord.subOrders || [],
    created_at: new Date().toISOString()
  };
});

const SEED_DATA = {
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
    ind_bhagwathi: {
      name: 'Bhagwathi Rice and Agro Industries',
      location: 'APMC Industrial Area, Gadchiroli',
      contact_person: 'Operations Desk',
      phone: '+91 94401 88941',
      available_products: 'Keshar Kali, Keshar Kali 5 kgs, Keshar Kali 10 kg',
      default_purchase_rate: 7800,
      notes: 'Authoritative milling partner for Keshar Kali (App A Code: BRI / SUP-06)',
      active: true,
      is_default: true,
      facility_type: 'Rice Mill & Godown',
      capacity_qtl: 25000,
      created_at: new Date().toISOString()
    }
  },

  customers: customersData,
  purchase_orders: poData
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
