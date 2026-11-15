// server/firebase/admin.js
// Firebase Admin SDK initialization & token verification middleware
const admin = require('firebase-admin');

let isFirebaseAdminConfigured = false;
let adminAuth = null;
let adminDb = null;
let adminStorage = null;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    // Handle escaped newlines in environment variable
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      }),
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`
    });
    isFirebaseAdminConfigured = true;
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    isFirebaseAdminConfigured = true;
  }

  if (isFirebaseAdminConfigured) {
    adminAuth = admin.auth();
    adminDb = admin.firestore();
    adminStorage = admin.storage();
    console.log('[Firebase Admin] Successfully connected to Firebase project:', projectId);
  }
} catch (err) {
  console.warn('[Firebase Admin] Running in offline mode (credentials not yet provided):', err.message);
}

/**
 * Express middleware to verify Firebase ID Token (Bearer Token in Authorization header)
 */
async function verifyFirebaseToken(req, res, next) {
  if (!isFirebaseAdminConfigured || !adminAuth) {
    // Pass through if Firebase Admin is not configured
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    req.firebaseUser = decodedToken;
    next();
  } catch (err) {
    console.error('[Firebase Admin] Token verification failed:', err.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid Firebase token' });
  }
}

module.exports = {
  admin,
  adminAuth,
  adminDb,
  adminStorage,
  isFirebaseAdminConfigured,
  verifyFirebaseToken
};

