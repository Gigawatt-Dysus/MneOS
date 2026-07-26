import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // <--- NEW IMPORT

// --- CONFIGURATION ---
export const firebaseConfig = {
  apiKey: "AIzaSyAQXJfP5RmxhTgET3zpYcosrSsRJqLO45M",
  authDomain: "gigi-time-machine.firebaseapp.com",
  projectId: "gigi-time-machine",
  storageBucket: "gigi-time-machine.firebasestorage.app",
  messagingSenderId: "402649544404",
  appId: "1:402649544404:web:6a7357062274309b77e309"
};

// --- INITIALIZATION ---
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // <--- NEW EXPORT

// --- DIAGNOSTICS ---
export const isFirebaseConfigured = () => true;
export const getConfigDiagnostics = () => ({ 
    isConfigured: true, 
    source: "Hardcoded Nuclear Option" 
});