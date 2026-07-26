import sqlite3Pkg from 'sqlite3';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';

const execAsync = util.promisify(exec);
const sqlite3 = sqlite3Pkg.verbose();

const dbPath = path.join(process.cwd(), 'staging.db');
const db = new sqlite3.Database(dbPath);

const CONCURRENCY_LIMIT = 2; // Scaled down for sandbox

console.log("=================================================");
console.log("🧪 FORGE MASS TRANSPLANT (SANDBOX TEST) 🧪");
console.log("=================================================");

const SANDBOX_DIR = path.join(process.cwd(), '_SANDBOX_LIFEBOAT');
const SCRATCH_DIR = path.join(process.cwd(), '_SCRATCH_TRANSPLANT');

// Clean and recreate sandbox and scratch dirs
if (fs.existsSync(SANDBOX_DIR)) fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
if (fs.existsSync(SCRATCH_DIR)) fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
fs.mkdirSync(SANDBOX_DIR, { recursive: true });
fs.mkdirSync(SCRATCH_DIR, { recursive: true });

console.log(`Created isolated Sandbox at: ${SANDBOX_DIR}`);

// Get exactly 5 items to test
const query = `
    SELECT 
        ftd.proxy_hash, 
        ftd.master_hash, 
        ftd.ssim_score,
        ftd.sat_shift,
        p.originalName as proxyName,
        p.filepath as proxyPath,
        m.originalName as masterName,
        m.filepath as masterPath
    FROM forge_training_data ftd
    JOIN airlock_jobs p ON p.hash = ftd.proxy_hash
    JOIN airlock_jobs m ON m.hash = ftd.master_hash
    WHERE ftd.decision = 'AUTO_PRUNE_COMPRESSED'
    LIMIT 250
`;

db.all(query, [], async (err, rows) => {
    if (err) {
        console.error("DB Error:", err);
        return db.close();
    }

    if (rows.length === 0) {
        console.log("No items found to test.");
        return db.close();
    }

    console.log(`\n📦 Staging ${rows.length} pairs into the Sandbox to simulate the Lifeboat...`);
    const t0 = performance.now();
    
    // 1. STAGE THE SANDBOX (Simulate F: Drive)
    const sandboxRows = [];
    for (const row of rows) {
        const sbMaster = path.join(SANDBOX_DIR, 'SANDBOX_' + row.masterName);
        const sbProxy = path.join(SANDBOX_DIR, 'SANDBOX_' + row.proxyName);
        
        fs.copyFileSync(row.masterPath, sbMaster);
        fs.copyFileSync(row.proxyPath, sbProxy);
        
        sandboxRows.push({
            ...row,
            masterPath: sbMaster,
            proxyPath: sbProxy
        });
    }

    const pyScript = path.join(process.cwd(), 'scripts', 'migration', 'histo_transplant.py');

    // 2. SEQUENTIAL BULK READ (from Sandbox to Scratch)
    for (const row of sandboxRows) {
        row.scratchMaster = path.join(SCRATCH_DIR, row.master_hash + '.jpg');
        row.scratchProxy = path.join(SCRATCH_DIR, row.proxy_hash + '.jpg');
        row.scratchOut = path.join(SCRATCH_DIR, row.master_hash + '_OUT.jpg');
        
        fs.copyFileSync(row.masterPath, row.scratchMaster);
        fs.copyFileSync(row.proxyPath, row.scratchProxy);
    }
    
    const t1 = performance.now();
    console.log(`⏱️  I/O Read Phase completed in ${((t1 - t0) / 1000).toFixed(2)}s`);

    console.log(`\n🚀 EXECUTING PRODUCTION LOGIC ON SANDBOX FILES...`);
    // 3. CONCURRENT PROCESSING
    for (let j = 0; j < sandboxRows.length; j += CONCURRENCY_LIMIT) {
        const microChunk = sandboxRows.slice(j, j + CONCURRENCY_LIMIT);
        await Promise.all(microChunk.map(async (row) => {
            try {
                const { stdout } = await execAsync(`python "${pyScript}" "${row.scratchMaster}" "${row.scratchProxy}" "${row.scratchOut}"`);
                const result = JSON.parse(stdout.trim());
                if (!result.success) row.failed = true;
            } catch (e) {
                row.failed = true;
            }
        }));
    }
    
    const t2 = performance.now();
    console.log(`⏱️  CPU Math Phase completed in ${((t2 - t1) / 1000).toFixed(2)}s`);

    // 4. SEQUENTIAL BULK WRITE & PURGE
    console.log(`\n💾 Writing enhanced files back to Sandbox and purging Sandbox proxies...`);
    for (const row of sandboxRows) {
        if (row.failed || !fs.existsSync(row.scratchOut)) continue;

        fs.copyFileSync(row.scratchOut, row.masterPath);
        
        if (fs.existsSync(row.proxyPath)) fs.unlinkSync(row.proxyPath);
        
        if (fs.existsSync(row.scratchMaster)) fs.unlinkSync(row.scratchMaster);
        if (fs.existsSync(row.scratchProxy)) fs.unlinkSync(row.scratchProxy);
        if (fs.existsSync(row.scratchOut)) fs.unlinkSync(row.scratchOut);
    }
    
    const t3 = performance.now();
    console.log(`⏱️  I/O Write Phase completed in ${((t3 - t2) / 1000).toFixed(2)}s`);

    const totalSecs = (t3 - t0) / 1000;
    const perSec = (rows.length / totalSecs).toFixed(2);
    
    console.log("\n=================================================");
    console.log("📊 SANDBOX TELEMETRY REPORT");
    console.log("=================================================");
    console.log(`Total Chunk Time:   ${totalSecs.toFixed(2)}s`);
    console.log(`Processing Rate:    ${perSec} pairs / second`);
    console.log(`Proj. 15k Time:     ${((15000 / perSec) / 60).toFixed(1)} minutes`);
    console.log("=================================================");
    db.close();
});
