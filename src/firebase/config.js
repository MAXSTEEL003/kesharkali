// src/firebase/config.js
// Modular Firebase SDK v11 (Client-side)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'firebase/storage';

const getCleanEnv = (val, fallback) => (!val || val.includes('your-') || val.includes('your_') || val.includes('G-XXXX') ? fallback : val);

const firebaseConfig = {
  apiKey: getCleanEnv(import.meta.env.VITE_FIREBASE_API_KEY, "AIzaSyBhks0oj5288L3He_JhgH2M7IVtE5rYyUc"),
  authDomain: getCleanEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, "kesharkaliportal.firebaseapp.com"),
  projectId: getCleanEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID, "kesharkaliportal"),
  storageBucket: getCleanEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, "kesharkaliportal.firebasestorage.app"),
  messagingSenderId: getCleanEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, "758973369267"),
  appId: getCleanEnv(import.meta.env.VITE_FIREBASE_APP_ID, "1:758973369267:web:e24c25e878f14b2e39d9c6"),
  measurementId: getCleanEnv(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, "G-FXR9L2X0HC")
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  firebaseConfig.apiKey !== 'your_firebase_api_key_here'
);

let app = null;
let auth = null;
let db = null;
let storage = null;
let analytics = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    // Initialize Analytics if supported in environment (browser only)
    if (typeof window !== 'undefined') {
      isSupported().then((supported) => {
        if (supported) {
          analytics = getAnalytics(app);
          console.log('[Firebase Analytics] Initialized for project:', firebaseConfig.projectId);
        }
      }).catch((err) => {
        console.warn('[Firebase Analytics] Not supported in current browser environment:', err);
      });
    }
  } catch (err) {
    console.error('Firebase initialization error:', err);
  }
} else {
  // Helpful developer guidance in console
  console.info(
    '%c[Keshar Kali Firebase Integration]%c Configuration pending. Add your Firebase keys to .env to activate Cloud Auth, Firestore & Storage.',
    'color: #C69A3B; font-weight: bold;',
    'color: inherit;'
  );
}

export { 
  app, 
  auth, 
  db, 
  storage, 
  analytics,
  googleProvider,
  // Auth Helpers
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  // Firestore Helpers
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  // Storage Helpers
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL
};

