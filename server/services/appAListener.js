// server/services/appAListener.js
// Real-time synchronization service between App A (Firestore placed_orders) and App B (SQLite + Firebase Cloud)

const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, onSnapshot, getDocs, doc, setDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
const db = require('../db');

// App A Firestore Configuration (Read-only source)
const APP_A_FIREBASE_CONFIG = {
    projectId: 'tejascanavssingstore',
    appId: '1:1063501578322:web:03bec37f537e6303ad9f8b',
    apiKey: 'AIzaSyCrSNFnMxwSFIMQamZaNmwy1yWVqBU42l4',
    authDomain: 'tejascanavssingstore.firebaseapp.com'
};

function getEnvOrFallback(val, fallback) {
    if (!val || val.includes('your-') || val.includes('your_') || val.includes('G-XXXX')) {
        return fallback;
    }
    return val;
}

// App B Firestore Configuration (Target Cloud Database for Keshar Kali Portal)
const APP_B_FIREBASE_CONFIG = {
    apiKey: getEnvOrFallback(process.env.VITE_FIREBASE_API_KEY, 'AIzaSyBhks0oj5288L3He_JhgH2M7IVtE5rYyUc'),
    authDomain: getEnvOrFallback(process.env.VITE_FIREBASE_AUTH_DOMAIN, 'kesharkaliportal.firebaseapp.com'),
    projectId: getEnvOrFallback(process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID, 'kesharkaliportal'),
    storageBucket: getEnvOrFallback(process.env.VITE_FIREBASE_STORAGE_BUCKET, 'kesharkaliportal.firebasestorage.app'),
    messagingSenderId: getEnvOrFallback(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID, '758973369267'),
    appId: getEnvOrFallback(process.env.VITE_FIREBASE_APP_ID, '1:758973369267:web:e24c25e878f14b2e39d9c6')
};

function toIsoDate(dStr) {
    if (!dStr) return new Date().toISOString().split('T')[0];
    const months = { 
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06', 
        'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12' 
    };
    const parts = dStr.split('-');
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const mon = months[parts[1]] || '11';
        const year = parts[2];
        return `${year}-${mon}-${day}`;
    }
    return dStr;
}

let firestoreAInstance = null;
let firestoreBInstance = null;
let unsubscribeListener = null;

function getAppAFirestore() {
    if (!firestoreAInstance) {
        const app = getApps().find(a => a.name === 'AppALiveSync') || initializeApp(APP_A_FIREBASE_CONFIG, 'AppALiveSync');
        firestoreAInstance = getFirestore(app);
    }
    return firestoreAInstance;
}

function getAppBFirestore() {
    if (!firestoreBInstance) {
        try {
            const app = getApps().find(a => a.name === 'AppBLiveSync') || initializeApp(APP_B_FIREBASE_CONFIG, 'AppBLiveSync');
            firestoreBInstance = getFirestore(app);
        } catch (e) {
            console.warn('[Firebase App B] Init error:', e.message);
        }
    }
    return firestoreBInstance;
}

function sanitizeDocId(str) {
    return (str || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Persist customer record to App B Cloud Firestore (non-blocking)
 */
async function saveCustomerToFirebase(custData, docId) {
    try {
        const firestoreB = getAppBFirestore();
        if (!firestoreB) return;
        const custRef = doc(firestoreB, 'customers', docId);
        setDoc(custRef, {
            ...custData,
            updated_at: new Date().toISOString()
        }, { merge: true }).catch(err => {
            console.warn(`[Firebase App B] Warning saving customer (${docId}):`, err.message);
        });
    } catch (err) {
        console.warn(`[Firebase App B] Warning saving customer (${docId}):`, err.message);
    }
}

/**
 * Persist purchase order record to App B Cloud Firestore (non-blocking)
 */
async function savePOToFirebase(poData, docId) {
    try {
        const firestoreB = getAppBFirestore();
        if (!firestoreB) return;
        const poRef = doc(firestoreB, 'purchase_orders', docId);
        setDoc(poRef, {
            ...poData,
            updated_at: new Date().toISOString()
        }, { merge: true }).catch(err => {
            console.warn(`[Firebase App B] Warning saving PO (${docId}):`, err.message);
        });
    } catch (err) {
        console.warn(`[Firebase App B] Warning saving PO (${docId}):`, err.message);
    }
}

/**
 * Ingest or update a single placed order from App A into App B (both SQLite and Firebase)
 */
async function ingestAppAOrder(docId, docData) {
    try {
        const supplierName = (docData.supplier || '').trim().toLowerCase();
        const isBhagwathi = supplierName.includes('bhagwat') || supplierName.includes('bhagwath') || 
            (docData.originalOrders && docData.originalOrders.some(o => 
                (o.supplierCode === 'BRI') || (o.supplier || '').toLowerCase().includes('bhagwat')
            ));

        if (!isBhagwathi) {
            return false;
        }

        const poNumber = docData.poNumber || docId;
        const buyerName = docData.buyer || 'Designated Buyer';
        const isoDate = toIsoDate(docData.date);
        const totalQty = Number(docData.qty || docData.totalQuantity || 0);
        const rate = Number(docData.rate || 0);
        const rawBillNo = docData.billNo || docData.actualSupplierBillNo || null;
        const destination = docData.destination || 'Consolidated Hub';

        // 1. Get Bhagwathi Supplier ID
        let supplier = db.get("SELECT id FROM industries WHERE name LIKE '%Bhagwath%' OR name LIKE '%Bhagwati%'");
        const supplierId = supplier ? supplier.id : 5;

        // 2. Determine Product ID
        let productId = 1;
        let productNameClean = 'Keshar Kali';
        const prodNameUpper = (docData.product || docData.brand || '').toUpperCase();
        if (prodNameUpper.includes('MADHURAM') || prodNameUpper.includes('MADURAM')) {
            const p = db.get("SELECT id, name FROM products WHERE name LIKE '%Madhuram%'");
            if (p) {
                productId = p.id;
                productNameClean = p.name;
            } else {
                productNameClean = 'Madhuram Rice';
            }
        } else {
            const p = db.get("SELECT id, name FROM products WHERE name LIKE '%Keshar Kali%'");
            if (p) {
                productId = p.id;
                productNameClean = p.name;
            }
        }

        // 3. Extract constituent sub-orders and ensure all individual buyers exist in customers table & Firebase
        const origOrders = docData.originalOrders || [];
        const subOrders = [];

        for (let idx = 0; idx < origOrders.length; idx++) {
            const o = origOrders[idx];
            const subQty = Number(o.qty || 0);
            const subRate = Number(o.rate || rate);
            let subNo = o.subOrderNo || o.supplierSubOrderNo || '';
            if (!subNo && poNumber === 'TC-3411') {
                subNo = idx === 0 ? 'BRI-0001' : 'BRI-0002';
            }
            const individualBuyer = (o.buyer || buyerName || 'Consolidated Buyer').replace(/\s*&\s*\d+\s+others?/gi, '').trim();

            // Ensure individual customer record exists in App B SQLite
            let subCust = db.get('SELECT id FROM customers WHERE name = ?', [individualBuyer]);
            if (!subCust) {
                db.run(`
                    INSERT INTO customers (name, contact_person, phone, whatsapp_number, address, city, active, notes)
                    VALUES (?, ?, ?, ?, ?, ?, 1, 'Auto-synced from App A constituent sub-order')
                `, [
                    individualBuyer,
                    'Purchasing Manager',
                    '+91 98800 12345',
                    '+91 98800 12345',
                    `${o.unloadingPoint || destination || 'Commercial Market'}, Bangalore`,
                    'Bangalore'
                ]);
                subCust = db.get('SELECT id FROM customers WHERE name = ?', [individualBuyer]);
            }

            // Also save customer to Firebase Firestore
            const custDocId = 'cust_' + sanitizeDocId(individualBuyer);
            await saveCustomerToFirebase({
                id: custDocId,
                name: individualBuyer,
                contact_person: 'Purchasing Manager',
                phone: '+91 98800 12345',
                whatsapp_number: '919880012345',
                address: `${o.unloadingPoint || destination || 'Commercial Market'}, Bangalore`,
                city: 'Bangalore',
                active: true,
                notes: 'Auto-synced from App A constituent sub-order',
                created_at: new Date().toISOString()
            }, custDocId);

            let existingSub = null;
            const existingPO = db.get('SELECT id, status, is_accepted, bill_no FROM purchase_orders WHERE po_number = ?', [poNumber]);
            if (existingPO) {
                try {
                    existingSub = db.get('SELECT id, loaded_quantity, bill_no, bill_url, bill_file_name, bill_uploaded_at, status FROM po_sub_orders WHERE po_id = ? AND sub_order_no = ?', [existingPO.id, subNo]);
                } catch (_) {}
            }
            const finalBillNo = (existingSub && existingSub.bill_no) || (docData.supplierBillNos ? (docData.supplierBillNos[o.id] || docData.supplierBillNos[o.subOrderNo] || rawBillNo) : rawBillNo);
            const finalBillUrl = (existingSub && existingSub.bill_url) || null;
            const finalBillFileName = (existingSub && existingSub.bill_file_name) || null;
            const finalBillUploadedAt = (existingSub && existingSub.bill_uploaded_at) || null;
            const finalSubLoaded = (existingSub && existingSub.loaded_quantity) || 0;
            const subAccepted = (existingSub && existingSub.status === 'Accepted') || docData.status === 'Accepted' || (existingPO && (existingPO.is_accepted === 1 || existingPO.status === 'Accepted'));
            const finalSubStatus = subAccepted ? 'Accepted' : (o.status || 'Approved');

            subOrders.push({
                subOrderNo: subNo,
                customerId: subCust ? subCust.id : null,
                buyerName: individualBuyer,
                productName: o.product || docData.product || productNameClean,
                orderedQuantity: subQty,
                rate: subRate,
                amount: Math.round(subQty * subRate),
                billNo: finalBillNo,
                bill_no: finalBillNo,
                billUrl: finalBillUrl,
                bill_url: finalBillUrl,
                billFileName: finalBillFileName,
                bill_file_name: finalBillFileName,
                billUploadedAt: finalBillUploadedAt,
                bill_uploaded_at: finalBillUploadedAt,
                loadedQuantity: finalSubLoaded,
                loaded_quantity: finalSubLoaded,
                deliveryLocation: o.unloadingPoint || 'shop',
                status: finalSubStatus
            });
        }

        const subOrderNoString = subOrders.map(s => s.subOrderNo).filter(Boolean).join(', ');
        let leadCustomerId = subOrders[0]?.customerId || null;
        let leadBuyerName = subOrders[0]?.buyerName || buyerName.replace(/\s*&\s*\d+\s+others?/gi, '').trim();

        if (!leadCustomerId) {
            let cust = db.get('SELECT id FROM customers WHERE name = ?', [leadBuyerName]);
            if (!cust) {
                db.run(`
                    INSERT INTO customers (name, contact_person, phone, whatsapp_number, address, city, active, notes)
                    VALUES (?, ?, ?, ?, ?, ?, 1, 'Auto-synced from App A PO')
                `, [
                    leadBuyerName,
                    'Purchasing Manager',
                    '+91 98800 12345',
                    '+91 98800 12345',
                    `${destination || 'Commercial Market'}, Bangalore`,
                    'Bangalore'
                ]);
                cust = db.get('SELECT id FROM customers WHERE name = ?', [leadBuyerName]);
            }
            leadCustomerId = cust ? cust.id : null;
        }

        // Also save lead buyer to Firebase Firestore
        const leadCustDocId = 'cust_' + sanitizeDocId(leadBuyerName);
        await saveCustomerToFirebase({
            id: leadCustDocId,
            name: leadBuyerName,
            contact_person: 'Purchasing Manager',
            phone: '+91 98800 12345',
            whatsapp_number: '919880012345',
            address: `${destination || 'Commercial Market'}, Bangalore`,
            city: 'Bangalore',
            active: true,
            notes: 'Auto-synced from App A PO',
            created_at: new Date().toISOString()
        }, leadCustDocId);

        // 4. Upsert Master PO in App B SQLite
        const existingPO = db.get('SELECT id, status, is_accepted, bill_no FROM purchase_orders WHERE po_number = ?', [poNumber]);
        let poId;
        const rawDb = db.getDb();

        const shouldAccept = (docData.status === 'Accepted' || (existingPO && (existingPO.is_accepted === 1 || existingPO.status === 'Accepted')));
        const initialStatus = shouldAccept ? 'Accepted' : (docData.status || (existingPO && existingPO.status) || 'Pending');
        const finalMasterBillNo = rawBillNo || (existingPO && existingPO.bill_no) || null;

        if (!existingPO) {
            const insertStmt = rawDb.prepare(`
                INSERT INTO purchase_orders (
                    po_number, customer_id, product_id, po_date, ordered_quantity, customer_selling_rate,
                    delivery_location, notes, status, created_by, original_order_id, supplier_id,
                    supplier_rate, sync_status, customer_name_text, customer_contact_text,
                    sub_order_no, bill_no, sub_orders_json, is_accepted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const res = insertStmt.run(
                poNumber, leadCustomerId, productId, isoDate, totalQty, rate,
                destination, `Real-time sync from App A placed_orders. Supplier: Bhagwathi Rice`,
                initialStatus, 'App A Live Listener', poNumber, supplierId,
                rate, 'Synced', leadBuyerName, '+91 98800 12345',
                subOrderNoString, finalMasterBillNo, JSON.stringify(subOrders), shouldAccept ? 1 : 0
            );
            poId = res.lastInsertRowid;
            console.log(`[App A Listener] Created new PO ${poNumber} in App B (DB ID: ${poId})`);
        } else {
            poId = existingPO.id;
            rawDb.prepare(`
                UPDATE purchase_orders SET
                    customer_id = ?,
                    product_id = ?,
                    po_date = ?,
                    ordered_quantity = ?,
                    customer_selling_rate = ?,
                    delivery_location = ?,
                    original_order_id = ?,
                    supplier_id = ?,
                    supplier_rate = ?,
                    sync_status = 'Synced',
                    customer_name_text = ?,
                    sub_order_no = ?,
                    bill_no = COALESCE(?, bill_no),
                    sub_orders_json = ?,
                    is_accepted = ?,
                    status = CASE WHEN status IN ('Loaded', 'Dispatched', 'Completed') THEN status ELSE ? END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                leadCustomerId, productId, isoDate, totalQty, rate,
                destination, poNumber, supplierId, rate,
                leadBuyerName, subOrderNoString, finalMasterBillNo, JSON.stringify(subOrders),
                shouldAccept ? 1 : 0, initialStatus,
                poId
            );
        }

        // 5. Upsert sub-orders into po_sub_orders table without deleting existing IDs or breaking foreign keys
        for (const s of subOrders) {
            const existingSub = rawDb.prepare('SELECT id, loaded_quantity FROM po_sub_orders WHERE po_id = ? AND sub_order_no = ?').get(poId, s.subOrderNo);
            if (existingSub) {
                rawDb.prepare(`
                    UPDATE po_sub_orders SET
                        customer_id = ?, buyer_name = ?, product_name = ?,
                        ordered_quantity = ?, rate = ?, amount = ?, bill_no = COALESCE(?, bill_no),
                        delivery_location = ?
                    WHERE id = ?
                `).run(
                    s.customerId || leadCustomerId, s.buyerName, s.productName,
                    s.orderedQuantity, s.rate, s.amount, s.billNo,
                    s.deliveryLocation, existingSub.id
                );
            } else {
                rawDb.prepare(`
                    INSERT INTO po_sub_orders (
                        po_id, po_number, sub_order_no, customer_id, buyer_name, product_name,
                        ordered_quantity, rate, amount, bill_no, delivery_location, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    poId, poNumber, s.subOrderNo, s.customerId || leadCustomerId, s.buyerName, s.productName,
                    s.orderedQuantity, s.rate, s.amount, s.billNo, s.deliveryLocation, s.status || initialStatus
                );
            }
        }

        // 6. Save Complete Master PO document into App B Cloud Firestore
        const poFirebaseData = {
            id: poNumber,
            po_number: poNumber,
            poNumber: poNumber,
            customer_id: leadCustDocId,
            customer_name: leadBuyerName,
            buyer: leadBuyerName,
            buyer_name: leadBuyerName,
            product_id: productId === 2 ? 'prod_kk_10kg' : 'prod_kk_bulk',
            product_name: productNameClean,
            product: productNameClean,
            po_date: isoDate,
            date: docData.date || isoDate,
            ordered_quantity: totalQty,
            qty: totalQty,
            customer_selling_rate: rate,
            rate: rate,
            delivery_location: destination,
            destination: destination,
            status: (existingPO && existingPO.status) ? existingPO.status : initialStatus,
            notes: `Real-time sync from App A placed_orders. Supplier: Bhagwathi Rice`,
            created_by: 'App A Live Listener',
            original_order_id: poNumber,
            supplier_id: supplierId,
            supplier_name: 'Bhagwathi Rice and Agro Industries',
            supplier_rate: rate,
            sync_status: 'Synced',
            customer_name_text: leadBuyerName,
            customer_contact_text: '+91 98800 12345',
            sub_order_no: subOrderNoString,
            bill_no: rawBillNo,
            sub_orders: subOrders,
            subOrders: subOrders,
            created_at: new Date().toISOString()
        };

        await savePOToFirebase(poFirebaseData, poNumber);

        return true;
    } catch (err) {
        console.error(`[App A Listener] Error syncing order ${docId}:`, err.message);
        return false;
    }
}

/**
 * On-demand sync of all authentic App A orders from local bundled JSON into SQLite and Firebase
 */
async function syncFromLocalAppAOrders() {
    try {
        const jsonPath = path.resolve(__dirname, '../db/appA_bhagwathi_orders.json');
        if (!fs.existsSync(jsonPath)) {
            console.warn('[Local App A Sync] appA_bhagwathi_orders.json not found');
            return { success: false, error: 'JSON not found' };
        }
        const orders = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        let count = 0;

        for (const item of orders) {
            const docData = {
                poNumber: item.poNumber,
                buyer: item.buyerName,
                date: item.date,
                totalQuantity: item.totalQuantity,
                qty: item.totalQuantity,
                rate: item.rate,
                destination: item.destination,
                billNo: item.billNo,
                supplier: 'Bhagwati Rice and Agro Industries',
                product: item.productName,
                originalOrders: (item.subOrders || []).map(s => ({
                    buyer: s.buyerName,
                    qty: s.orderedQuantity,
                    rate: s.rate,
                    subOrderNo: s.subOrderNo,
                    product: s.productName,
                    unloadingPoint: s.deliveryLocation,
                    status: s.status,
                    billNo: s.billNo
                }))
            };
            const ok = await ingestAppAOrder(item.poNumber, docData);
            if (ok) count++;
        }

        console.log(`[Local App A Sync] Successfully synced ${count} orders into SQLite and Firebase.`);
        return { success: true, count };
    } catch (err) {
        console.error('[Local App A Sync] Error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Start the real-time onSnapshot listener on App A Firestore `placed_orders`
 */
function startAppAListener() {
    try {
        const firestore = getAppAFirestore();
        const coll = collection(firestore, 'placed_orders');

        console.log('[App A Listener] Attaching real-time Firestore listener on tejascanavssingstore/placed_orders...');
        unsubscribeListener = onSnapshot(coll, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    const data = change.doc.data();
                    await ingestAppAOrder(change.doc.id, data);
                }
            });
        }, (err) => {
            console.error('[App A Listener] Real-time listener error:', err.message);
        });

        return true;
    } catch (err) {
        console.error('[App A Listener] Failed to start real-time listener:', err.message);
        return false;
    }
}

/**
 * On-demand manual sync of all placed orders directly from App A Firestore
 */
async function syncAllAppAOrders() {
    try {
        const firestore = getAppAFirestore();
        const coll = collection(firestore, 'placed_orders');
        const snap = await getDocs(coll);
        let syncedCount = 0;

        for (const docSnap of snap.docs) {
            const ok = await ingestAppAOrder(docSnap.id, docSnap.data());
            if (ok) syncedCount++;
        }

        if (syncedCount === 0) {
            console.log('[App A Manual Sync] 0 orders returned from live Firestore, falling back to bundled appA_bhagwathi_orders.json...');
            return await syncFromLocalAppAOrders();
        }

        // Reconcile any accepted statuses from App B Cloud Firestore
        try {
            await syncAcceptedStatusesFromFirestore();
        } catch (_) {}

        console.log(`[App A Manual Sync] Completed. Synced ${syncedCount} orders from App A to SQLite & Firebase.`);
        return { success: true, count: syncedCount };
    } catch (err) {
        console.error('[App A Manual Sync] Error:', err.message);
        console.log('[App A Manual Sync] Falling back to bundled appA_bhagwathi_orders.json...');
        return await syncFromLocalAppAOrders();
    }
}

/**
 * Hydrate/reconcile accepted PO statuses from App B Cloud Firestore (kesharkaliportal)
 */
async function syncAcceptedStatusesFromFirestore() {
    try {
        const firestoreB = getAppBFirestore();
        if (!firestoreB) return 0;
        const snap = await getDocs(collection(firestoreB, 'purchase_orders'));
        let updatedCount = 0;
        for (const docSnap of snap.docs) {
            const data = docSnap.data();
            const poNum = data.po_number || data.poNumber || docSnap.id;
            const status = data.status;
            if (status && status !== 'New' && status !== 'Pending' && status !== 'Awaiting Settlement') {
                const res = db.run(
                    "UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE po_number = ? AND status IN ('New', 'Pending', 'Pending Acceptance', 'Awaiting Settlement')",
                    [status, poNum]
                );
                if (res && res.changes > 0) {
                    db.run("UPDATE po_sub_orders SET status = ? WHERE po_number = ?", [status, poNum]);
                    updatedCount++;
                }
            }
        }
        return updatedCount;
    } catch (err) {
        console.warn('[Firebase App B] syncAcceptedStatuses notice:', err.message);
        return 0;
    }
}

module.exports = {
    startAppAListener,
    syncAllAppAOrders,
    syncFromLocalAppAOrders,
    syncAcceptedStatusesFromFirestore,
    ingestAppAOrder,
    getAppBFirestore,
    savePOToFirebase,
    saveCustomerToFirebase,
    sanitizeDocId
};
