import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// --- CONFIGURATION ---
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-key",
  authDomain: "lifeos-local.firebaseapp.com",
  projectId: "lifeos-local",
  storageBucket: "lifeos-local.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// --- INITIALIZATION ---
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
// console.log(`[System Infrastructure] 🔥 Core Engine Initialized. Mode: sovereign proxy. Project: ${firebaseConfig.projectId}`);
export const auth = getAuth(app);

// [ZEN FIX] Hardening Connectivity
// Force Long Polling to bypass QUIC/DNS instability (ERR_QUIC_PROTOCOL_ERROR)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const storage = getStorage(app);
export const functions = getFunctions(app);

// --- DIAGNOSTICS ---
export const isFirebaseConfigured = () => {
  // [ZEN FIX] Allow Manual Override to Local Mode via UI
  if (typeof window !== 'undefined' && window.localStorage.getItem('gigi_force_local_mode') === 'true') {
    return false;
  }
  return true;
};

export const getConfigDiagnostics = () => ({
  isConfigured: isFirebaseConfigured(),
  source: typeof window !== 'undefined' && window.localStorage.getItem('gigi_force_local_mode') === 'true'
    ? "Manual Local Override"
    : "Hardcoded Nuclear Option"
});