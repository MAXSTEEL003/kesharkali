// src/firebase/firestoreService.js
// Client-side Firestore service for Keshar Kali Operations Portal
import { 
  db, 
  isFirebaseConfigured, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot 
} from './config';
import { REQUIRED_COLLECTIONS } from './schema';

/**
 * Fetch all documents in a specific collection
 */
export async function getCollectionDocs(collectionName) {
  if (!isFirebaseConfigured || !db) return [];
  try {
    const q = query(collection(db, collectionName));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error(`Error fetching Firestore collection [${collectionName}]:`, err);
    throw err;
  }
}

/**
 * Save or update a document in a collection
 */
export async function saveDocument(collectionName, docId, data) {
  if (!isFirebaseConfigured || !db) return false;
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, {
      ...data,
      updated_at: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error(`Error saving document to [${collectionName}/${docId}]:`, err);
    throw err;
  }
}

/**
 * Subscribe to real-time updates for a collection
 */
export function subscribeToCollection(collectionName, callback, filters = []) {
  if (!isFirebaseConfigured || !db) return () => {};
  try {
    let q = collection(db, collectionName);
    if (filters.length > 0) {
      q = query(q, ...filters);
    }
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(items);
    }, (err) => {
      console.warn(`Firestore subscription notice for [${collectionName}]:`, err.message);
    });
  } catch (err) {
    console.error(`Failed to subscribe to [${collectionName}]:`, err);
    return () => {};
  }
}

/**
 * Check collection status and document counts
 */
export async function inspectCollections() {
  if (!isFirebaseConfigured || !db) return [];
  
  const results = [];
  for (const coll of REQUIRED_COLLECTIONS) {
    try {
      const q = query(collection(db, coll.id), limit(5));
      const snap = await getDocs(q);
      results.push({
        id: coll.id,
        name: coll.name,
        description: coll.description,
        status: snap.empty ? 'Empty' : 'Active',
        sampleCount: snap.size
      });
    } catch (err) {
      results.push({
        id: coll.id,
        name: coll.name,
        description: coll.description,
        status: 'Uninitialized / Rules Locked',
        error: err.message
      });
    }
  }
  return results;
}
