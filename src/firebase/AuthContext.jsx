// src/firebase/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth, 
  googleProvider, 
  isFirebaseConfigured,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from './config';

const FirebaseAuthContext = createContext({
  currentUser: null,
  loading: true,
  isConfigured: false,
  loginWithEmail: async () => {},
  signupWithEmail: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {}
});

export function FirebaseAuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email, password) => {
    if (!auth) throw new Error('Firebase Auth is not configured. Please supply keys in .env.');
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signupWithEmail = async (email, password, displayName) => {
    if (!auth) throw new Error('Firebase Auth is not configured. Please supply keys in .env.');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName && cred.user) {
      await updateProfile(cred.user, { displayName });
    }
    return cred;
  };

  const loginWithGoogle = async () => {
    if (!auth || !googleProvider) throw new Error('Firebase Auth is not configured. Please supply keys in .env.');
    return signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    if (!auth) return;
    return signOut(auth);
  };

  const value = {
    currentUser,
    loading,
    isConfigured: isFirebaseConfigured,
    loginWithEmail,
    signupWithEmail,
    loginWithGoogle,
    logout
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  return useContext(FirebaseAuthContext);
}

