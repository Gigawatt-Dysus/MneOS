// zen-satellite.js - Local Telemetry & AI Processor
// Run this on your local machine with: node zen-satellite.js

// --- USER CONFIGURATION (PASTE YOURS HERE) ---
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBdSPXluDaF6C4UydWV-9mFWUo7iBG_saA",
  authDomain: "gigi-time-machine.firebaseapp.com",
  projectId: "gigi-time-machine",
  storageBucket: "gigi-time-machine.firebasestorage.app",
  messagingSenderId: "459534779564",
  appId: "1:459534779564:web:6a0b708fc92d49683ecb09",
  measurementId: "G-HZ5999MGQQ"
};

const USER_EMAIL = "dysus2024@gmail.com"; // Your Dev Email
const USER_PASSWORD = "Wyatt1122!"; // Your Dev Password
const APP_ID = "default-zen"; // Must match the React App ID

// --- DEPENDENCIES ---
const { initializeApp } = require("firebase/app");
const { 
  getFirestore, doc, setDoc, collection, onSnapshot, updateDoc, query, where 
} = require("firebase/firestore");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const si = require('systeminformation');

// --- INITIALIZATION ---
if (USER_PASSWORD === "YOUR_PASSWORD_HERE") {
    console.error("❌ ERROR: You must edit zen-satellite.js and set your USER_PASSWORD!");
    process.exit(1);
}

if (FIREBASE_CONFIG.apiKey === "YOUR_API_KEY" || !FIREBASE_CONFIG.projectId) {
    console.error("❌ ERROR: You must edit zen-satellite.js and paste your FIREBASE_CONFIG!");
    console.error("   >> Ensure 'projectId' is included in the config object.");
    process.exit(1);
}

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

console.log("🛰️  INITIALIZING ZEN SATELLITE...");

// --- MAIN LOGIC ---
async function startSatellite() {
    try {
        // 1. Authenticate
        console.log("🔑 Authenticating...");
        const userCredential = await signInWithEmailAndPassword(auth, USER_EMAIL, USER_PASSWORD);
        const user = userCredential.user;
        console.log(`✅ Authenticated as: ${user.email} (${user.uid})`);

        // 2. Start Telemetry Loop (The "Heartbeat")
        console.log("💓 Starting Telemetry Heartbeat...");
        setInterval(() => sendTelemetry(user.uid), 5000);

        // 3. Start Command Queue Listener (The "Ear")
        console.log("👂 Listening for AI Prompts...");
        listenForPrompts(user.uid);

    } catch (error) {
        console.error("❌ CRITICAL STARTUP ERROR:", error.message);
        if (error.code === 'auth/invalid-credential') {
            console.error("   >> CHECK YOUR EMAIL AND PASSWORD CONFIGURATION.");
        } else if (error.code === 'invalid-argument') {
             console.error("   >> CHECK YOUR FIREBASE_CONFIG. 'projectId' might be missing.");
        }
    }
}

// --- TELEMETRY FUNCTION ---
async function sendTelemetry(uid) {
    try {
        // 1. Gather Stats (Ensure all variables are defined)
        const cpuLoad = await si.currentLoad();
        const mem = await si.mem();
        const graphics = await si.graphics();
        const cpuTemp = await si.cpuTemperature();

        // [ZEN FIX] Ensure absolute value to prevent negative readings
        const rawTemp = cpuTemp.main || Math.max(...(cpuTemp.cores || [0]));
        const cleanTemp = Math.abs(Math.round(rawTemp));

        // 2. Check Ollama
        let ollamaStatus = "offline";
        let models = [];
        try {
            // Using Native Fetch (Node 18+)
            const res = await fetch('http://127.0.0.1:11434/api/tags');
            if (res.ok) {
                ollamaStatus = "online";
                const data = await res.json();
                models = data.models.map(m => m.name);
            }
        } catch (e) { /* Ollama down */ }

        // 3. Construct Payload
        const telemetryData = {
            system: {
                cpuLoad: Math.round(cpuLoad.currentLoad),
                cpuTemp: cleanTemp || 0, 
                memUsed: Math.round((mem.active / mem.total) * 100),
                gpu: graphics.controllers[0]?.model || "Unknown GPU"
            },
            ollama: {
                status: ollamaStatus,
                models: models,
                url: "http://127.0.0.1:11434"
            },
            updatedAt: Date.now() // Simple Number for easy parsing
        };

        // 4. Write to Dead Drop
        const docRef = doc(db, 'artifacts', APP_ID, 'users', uid, 'telemetry', 'realtime');
        await setDoc(docRef, telemetryData);
        
        // Console Feedback (One line to keep it clean)
        process.stdout.write(`\r📡 Uplink Active | CPU: ${telemetryData.system.cpuLoad}% | Temp: ${telemetryData.system.cpuTemp}C | Ollama: ${ollamaStatus}   `);

    } catch (e) {
        console.error("\n❌ Telemetry Error:", e.message);
    }
}

// --- PROMPT LISTENER FUNCTION ---
function listenForPrompts(uid) {
    const q = query(
        collection(db, 'artifacts', APP_ID, 'users', uid, 'queue'),
        where("status", "==", "pending")
    );

    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const task = change.doc.data();
                const docId = change.doc.id;
                
                console.log(`\n📨 New Prompt Received: [${docId}]`);
                console.log(`   Model: ${task.model}`);
                console.log(`   Prompt Preview: ${task.prompt.substring(0, 50)}...`);

                await processPrompt(docId, task, uid);
            }
        });
    });
}

// --- PROMPT PROCESSOR ---
async function processPrompt(docId, task, uid) {
    const docRef = doc(db, 'artifacts', APP_ID, 'users', uid, 'queue', docId);

    // 1. Mark as Processing
    await updateDoc(docRef, { status: "processing" });

    try {
        // 2. Send to Local Ollama (Using Native Fetch)
        console.log("   🧠 Sending to Ollama...");
        const response = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: task.model,
                prompt: task.prompt,
                stream: false // Simplify for now, no streaming
            })
        });

        if (!response.ok) throw new Error(`Ollama API Error: ${response.statusText}`);

        const data = await response.json();
        const aiText = data.response;

        // 3. Write Answer back to Firestore
        console.log("   ✅ Response Generated! Uploading...");
        await updateDoc(docRef, {
            status: "completed",
            response: aiText,
            completedAt: Date.now()
        });
        console.log("   🚀 Delivered.");

    } catch (error) {
        console.error("   ❌ Generation Failed:", error.message);
        await updateDoc(docRef, {
            status: "error",
            error: error.message
        });
    }
}

// Start the engine
startSatellite();