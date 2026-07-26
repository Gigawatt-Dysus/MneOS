import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import readline from 'readline';

// Load env vars so we can connect to Mongo
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('\n=======================================================');
console.log('🌌 SOVEREIGN INGESTION ORCHESTRATOR INITIATED');
console.log('=======================================================\n');

const CWD = process.cwd();
const errorLogPath = path.join(CWD, 'orchestrator_errors.log');

// Terminal Colors (High Contrast / Bright)
const colors = {
    reset: '\x1b[0m',
    cyan: '\x1b[96m',     // Bright Cyan
    magenta: '\x1b[95m',  // Bright Magenta
    green: '\x1b[92m',    // Bright Green
    yellow: '\x1b[93m',   // Bright Yellow
    red: '\x1b[91m',      // Bright Red
    blue: '\x1b[97m'      // Bright White (Replacing dark blue for metrics)
};

// Define the three core engines
const engines = [
    {
        name: 'CRAWLER',
        icon: '🔍',
        color: colors.cyan,
        cmd: 'node',
        args: ['scripts/migration/airlock_ingest.js', '--resume']
    },
    {
        name: 'SYNC',
        icon: '🚀',
        color: colors.magenta,
        cmd: 'node',
        args: ['scripts/migration/forge_sync.js']
    },
    {
        name: 'VISION',
        icon: '🧠',
        color: colors.green,
        cmd: 'python',
        args: ['scripts/migration/victus_ai_sweeper.py']
    }
];

const children = [];

// Helper to format output with prefixes
function prefixOutput(data, name, icon, color) {
    const lines = data.toString().split('\n');
    const prefix = `${color}${icon} [${name}]${colors.reset} `;
    lines.forEach(line => {
        if (line.trim()) {
            process.stdout.write(`${prefix}${line}\n`);
        }
    });
}

// ---------------------------------------------------------
// 📊 METRICS HEARTBEAT + ETA (Bridge Dashboard)
// ---------------------------------------------------------
async function startMetricsHeartbeat() {
    const uri = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
    if (!uri) {
        console.log(`${colors.red}⚠️ Cannot start metrics: MONGODB_URI missing from .env.local${colors.reset}`);
        return;
    }

    try {
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        const db = client.db();

        let initialProcessedCount = null;
        let startTime = Date.now();
        
        // Error log watcher daemon
        let lastErrorSize = 0;
        if (fs.existsSync(errorLogPath)) {
            lastErrorSize = fs.statSync(errorLogPath).size;
        }

        setInterval(async () => {
            try {
                // Check for new errors first
                if (fs.existsSync(errorLogPath)) {
                    const currentErrorSize = fs.statSync(errorLogPath).size;
                    if (currentErrorSize > lastErrorSize) {
                        // Fire acoustic bell and visual alert
                        process.stdout.write('\x07');
                        console.log(`\n${colors.red}🔔====================================================🔔`);
                        console.log(`🚨 NEW ERRORS DETECTED: Please review orchestrator_errors.log`);
                        console.log(`🔔====================================================🔔${colors.reset}\n`);
                        lastErrorSize = currentErrorSize;
                    }
                }

                const pending = await db.collection('pending_accessions').countDocuments();
                const pendingProcessed = await db.collection('pending_accessions').countDocuments({ aiProcessed: true });
                const unprocessed = await db.collection('media').countDocuments({ aiProcessed: false });
                const totalMedia = await db.collection('media').countDocuments();
                const processedFinished = await db.collection('media').countDocuments({ aiProcessed: true });

                const remaining = (pending - pendingProcessed) + unprocessed;

                if (initialProcessedCount === null) {
                    initialProcessedCount = processedFinished + pendingProcessed;
                    startTime = Date.now(); // Reset start time to exactly when we got our baseline
                }

                const elapsedSeconds = (Date.now() - startTime) / 1000;
                const itemsFinishedThisRun = (processedFinished + pendingProcessed) - initialProcessedCount;
                
                let eta = "Calculating...";

                if (itemsFinishedThisRun > 0 && elapsedSeconds > 0) {
                    const rate = itemsFinishedThisRun / elapsedSeconds; // Average items completed per second
                    const secondsLeft = Math.round(remaining / rate);
                    const hours = Math.floor(secondsLeft / 3600);
                    const minutes = Math.floor((secondsLeft % 3600) / 60);
                    eta = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                }

                const msg = `Staging Queue: ${pending} | Airlock AI: ${pendingProcessed} of ${pending} | Matrix AI: ${processedFinished} of ${totalMedia} | ETA: ${eta}`;
                console.log(`\n${colors.blue}📊 [METRICS] ${msg}${colors.reset}\n`);

            } catch (err) {
                // Silently ignore poll errors so we don't spam the console if the connection blips
            }
        }, 8000); // Every 8 seconds
    } catch (err) {
        console.log(`${colors.red}⚠️ Failed to connect to MongoDB for metrics heartbeat.${colors.reset}`);
    }
}

// Helper to launch engines with auto-respawn
let isShuttingDown = false;
function launchEngine(engine) {
    if (isShuttingDown) return;

    console.log(`${engine.color}▶ Starting ${engine.icon} ${engine.name}...${colors.reset}`);
    const child = spawn(engine.cmd, engine.args, {
        cwd: CWD,
        env: { ...process.env, FORCE_COLOR: '1', PYTHONUNBUFFERED: '1' }
    });

    child.stdout.on('data', (data) => prefixOutput(data, engine.name, engine.icon, engine.color));
    
    child.stderr.on('data', (data) => {
        const errorStr = data.toString();
        prefixOutput(errorStr, engine.name, engine.icon, colors.red);
        // Silently append to the persistent error log so it isn't lost in the scroll
        fs.appendFileSync(errorLogPath, `[${new Date().toISOString()}] [${engine.name} ERROR] ${errorStr}\n`);
    });

    child.on('close', (code) => {
        if (isShuttingDown) return;
        
        // Remove dead child from array
        const index = children.indexOf(child);
        if (index > -1) children.splice(index, 1);

        if (code === 2) {
            console.log(`\n${colors.red}💀 FATAL ABORT: ${engine.icon} ${engine.name} exited with code 2 (Hardware/Critical Failure).`);
            console.log(`Auto-restart disabled for this engine. Please inspect the hardware.${colors.reset}\n`);
            return;
        }

        console.log(`${colors.yellow}⚠️ ${engine.icon} ${engine.name} exited with code ${code}. Auto-restarting in 5 seconds...${colors.reset}`);
        setTimeout(() => launchEngine(engine), 5000);
    });

    children.push(child);
}

const isVisionOnly = process.argv.includes('--vision-only');

function startEngines(isNo) {
    if (isNo) {
        console.log(`\n${colors.cyan}dY-,,? OFF-GRID MODE ENGAGED. Launching VISION ONLY.${colors.reset}\n`);
        const visionEngine = engines.find(e => e.name === 'VISION');
        if (visionEngine) launchEngine(visionEngine);
    } else {
        console.log(`\n${colors.cyan}dY-,,? STANDARD MODE ENGAGED. Launching ALL engines (staggered to protect system memory).${colors.reset}\n`);
        engines.forEach((engine, index) => {
            setTimeout(() => {
                launchEngine(engine);
            }, index * 25000); // [ZEN] 25 second delay to allow VRAM/RAM allocation before next engine hits
        });
    }

    // Start the metrics dashboard heartbeat
    startMetricsHeartbeat();
}

if (isVisionOnly) {
    startEngines(true);
} else {
    // Setup interactive prompt for Off-Grid mode
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question(`${colors.yellow}Engage ALL 3 engines? (Y/n) [Press 'n' for Off-Grid VISION only]: ${colors.reset}`, (answer) => {
        rl.close();
        const isNo = answer.trim().toLowerCase() === 'n';
        startEngines(isNo);
    });
}

// Graceful Shutdown on Ctrl+C
process.on('SIGINT', () => {
    isShuttingDown = true;
    console.log(`\n${colors.red}🛑 SHUTDOWN SIGNAL RECEIVED (Ctrl+C)${colors.reset}`);
    console.log(`${colors.yellow}Sending graceful stop to all engines... please wait.${colors.reset}\n`);
    
    children.forEach(child => {
        if (!child.killed) {
            child.kill('SIGINT');
        }
    });

    // Give them 3 seconds to safely close SQLite handles
    setTimeout(() => {
        console.log(`\n${colors.green}✅ All engines safely powered down. You may now pack up the Victus.${colors.reset}`);
        process.exit(0);
    }, 3000);
});
