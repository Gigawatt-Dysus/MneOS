// CRITICAL ARCHITECTURE NOTE (Zen/Planner):
// We are NO LONGER using Firestore/Firebase.
// Current stack: Local SQLite for ingestion tracking + MongoDB Atlas (or equivalent) for vector/RAG storage.
// All references to Firestore must be ignored/removed.

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CONFIGURATION
// ==========================================
// Pass the --offline flag to the CLI when tethering or offline.
// This prevents forge_sync.js from obliterating your mobile hotspot data cap.
const OFFLINE_MODE = process.argv.includes('--offline');

console.log("=======================================================");
console.log("🔥 FORGE MASTER ORCHESTRATOR INITIATED");
if (OFFLINE_MODE) {
  console.log("⚠️  OFFLINE MODE ENGAGED: Sync module (B2/Mongo) disabled.");
}
console.log("=======================================================\n");

const startProcess = (name, command, args, colorCode) => {
  // Use shell: true to resolve 'python' and 'node' from PATH correctly on Windows
  const p = spawn(command, args, { 
    cwd: path.join(__dirname, '..', '..'), 
    shell: true,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });
  
  p.stdout.on('data', data => {
    // Split by newline and prefix each line to keep it clean
    const lines = data.toString().trimEnd().split('\n');
    for (const line of lines) {
      process.stdout.write(`\x1b[${colorCode}m[${name}]\x1b[0m ${line}\n`);
    }
  });
  
  p.stderr.on('data', data => {
    const lines = data.toString().trimEnd().split('\n');
    for (const line of lines) {
      process.stderr.write(`\x1b[31m[${name} ERROR]\x1b[0m ${line}\n`);
    }
  });
  
  p.on('close', code => {
    console.log(`\x1b[31m[${name}] Process exited with code ${code}. Auto-restarting in 5s...\x1b[0m`);
    setTimeout(() => startProcess(name, command, args, colorCode), 5000);
  });
  
  return p;
};

// Start the 2 pillars of the Forge Airlock on Genesis Alpha (Producer)
startProcess("API", "node", ["scripts/migration/staging_api.js"], "36");     // Cyan

if (!OFFLINE_MODE) {
  startProcess("SYNC", "node", ["scripts/migration/forge_sync.js"], "35");       // Magenta
}

console.log("All systems nominal. Routing telemetry to Master Console...\n");
