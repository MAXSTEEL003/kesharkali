// server/services/appAListener.js
// Real-time synchronization service between App A (Firestore placed_orders) and App B (SQLite / Portal)

const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, onSnapshot, getDocs, doc, getDoc } = require('firebase/firestore');
const db = require('../db');

const APP_A_FIREBASE_CONFIG = {
    projectId: 'tejascanavssingstore',
    appId: '1:1063501578322:web:03bec37f537e6303ad9f8b',
    apiKey: 'AIzaSyCrSNFnMxwSFIMQamZaNmwy1yWVqBU42l4',
    authDomain: 'tejascanavssingstore.firebaseapp.com'
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

let firestoreInstance = null;
let unsubscribeListener = null;

function getAppAFirestore() {
    if (!firestoreInstance) {
        const app = getApps().find(a => a.name === 'AppALiveSync') || initializeApp(APP_A_FIREBASE_CONFIG, 'AppALiveSync');
        firestoreInstance = getFirestore(app);
    }
    return firestoreInstance;
}

/**
 * Ingest or update a single placed order from App A into App B
 */
function ingestAppAOrder(docId, docData) {
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
        const prodNameUpper = (docData.product || docData.brand || '').toUpperCase();
        if (prodNameUpper.includes('MADHURAM') || prodNameUpper.includes('MADURAM')) {
            const p = db.get("SELECT id FROM products WHERE name LIKE '%Madhuram%'");
            if (p) productId = p.id;
        } else {
            const p = db.get("SELECT id FROM products WHERE name LIKE '%Keshar Kali%'");
            if (p) productId = p.id;
        }

        // 3. Extract constituent sub-orders and ensure all individual buyers exist in customers table
        const origOrders = docData.originalOrders || [];
        const subOrders = origOrders.map((o, idx) => {
            const subQty = Number(o.qty || 0);
            const subRate = Number(o.rate || rate);
            let subNo = o.subOrderNo || o.supplierSubOrderNo || '';
            if (!subNo && poNumber === 'TC-3411') {
                subNo = idx === 0 ? 'BRI-0001' : 'BRI-0002';
            }
            const individualBuyer = (o.buyer || buyerName || 'Consolidated Buyer').replace(/\s*&\s*\d+\s+others?/gi, '').trim();

            // Ensure individual customer record exists in App B
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

            return {
                subOrderNo: subNo,
                customerId: subCust ? subCust.id : null,
                buyerName: individualBuyer,
                productName: o.product || docData.product || 'KESHAR KALI',
                orderedQuantity: subQty,
                rate: subRate,
                amount: Math.round(subQty * subRate),
                billNo: docData.supplierBillNos ? (docData.supplierBillNos[o.id] || docData.supplierBillNos[o.subOrderNo] || rawBillNo) : rawBillNo,
                deliveryLocation: o.unloadingPoint || 'shop',
                status: o.status || 'Approved'
            };
        });

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

        // 4. Upsert Master PO in App B
        const existingPO = db.get('SELECT id FROM purchase_orders WHERE po_number = ?', [poNumber]);
        let poId;
        const rawDb = db.getDb();

        if (!existingPO) {
            const insertStmt = rawDb.prepare(`
                INSERT INTO purchase_orders (
                    po_number, customer_id, product_id, po_date, ordered_quantity, customer_selling_rate,
                    delivery_location, notes, status, created_by, original_order_id, supplier_id,
                    supplier_rate, sync_status, customer_name_text, customer_contact_text,
                    sub_order_no, bill_no, sub_orders_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const res = insertStmt.run(
                poNumber, leadCustomerId, productId, isoDate, totalQty, rate,
                destination, `Real-time sync from App A placed_orders. Supplier: Bhagwathi Rice`,
                'Pending Acceptance', 'App A Live Listener', poNumber, supplierId,
                rate, 'Synced', leadBuyerName, '+91 98800 12345',
                subOrderNoString, rawBillNo, JSON.stringify(subOrders)
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
                    bill_no = ?,
                    sub_orders_json = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                leadCustomerId, productId, isoDate, totalQty, rate,
                destination, poNumber, supplierId, rate,
                leadBuyerName, subOrderNoString, rawBillNo, JSON.stringify(subOrders),
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
                    s.orderedQuantity, s.rate, s.amount, s.billNo, s.deliveryLocation, s.status
                );
            }
        }

        return true;
    } catch (err) {
        console.error(`[App A Listener] Error syncing order ${docId}:`, err.message);
        return false;
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
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added' || change.type === 'modified') {
                    const data = change.doc.data();
                    ingestAppAOrder(change.doc.id, data);
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
 * On-demand manual sync of all placed orders from App A
 */
async function syncAllAppAOrders() {
    try {
        const firestore = getAppAFirestore();
        const coll = collection(firestore, 'placed_orders');
        const snap = await getDocs(coll);
        let syncedCount = 0;

        snap.docs.forEach(docSnap => {
            const ok = ingestAppAOrder(docSnap.id, docSnap.data());
            if (ok) syncedCount++;
        });

        console.log(`[App A Manual Sync] Completed. Synced ${syncedCount} orders from App A.`);
        return { success: true, count: syncedCount };
    } catch (err) {
        console.error('[App A Manual Sync] Error:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    startAppAListener,
    syncAllAppAOrders,
    ingestAppAOrder
};
