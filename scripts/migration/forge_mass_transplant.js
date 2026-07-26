import sqlite3Pkg from 'sqlite3';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';

const execAsync = util.promisify(exec);
const sqlite3 = sqlite3Pkg.verbose();
const dbPath = path.join(process.cwd(), 'staging.db');
const db = new sqlite3.Database(dbPath);

const CONCURRENCY_LIMIT = 8; // SSD can handle the high concurrency
const CHUNK_SIZE = 250; // Approx 1-2 GB max on the C: drive at any given time

console.log("=================================================");
console.log("🔥 FORGE MASS TRANSPLANT WORKER (LIFEBOAT SAVER) 🔥");
console.log("=================================================");

const SCRATCH_DIR = path.join(process.cwd(), '_SCRATCH_TRANSPLANT');
if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
}

// Query all items marked as AUTO_PRUNE_COMPRESSED
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
`;

db.all(query, [], async (err, rows) => {
    if (err) {
        console.error("DB Error:", err);
        return db.close();
    }

    if (rows.length === 0) {
        console.log("No AUTO_PRUNE_COMPRESSED items found to process.");
        return db.close();
    }

    console.log(`Found ${rows.length} subjects. Utilizing SSD Chunking (Chunk Size: ${CHUNK_SIZE})...\n`);

    const pyScript = path.join(process.cwd(), 'scripts', 'migration', 'histo_transplant.py');
    let processedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        console.log(`\n📦 Loading Chunk ${Math.floor(i/CHUNK_SIZE)+1} of ${Math.ceil(rows.length/CHUNK_SIZE)} to SSD Scratch...`);
        
        // 1. SEQUENTIAL BULK READ (Saves the mechanical head)
        for (const row of chunk) {
            const scratchMaster = path.join(SCRATCH_DIR, row.master_hash + '.jpg');
            const scratchProxy = path.join(SCRATCH_DIR, row.proxy_hash + '.jpg');
            
            try {
                fs.copyFileSync(row.masterPath, scratchMaster);
                fs.copyFileSync(row.proxyPath, scratchProxy);
                row.scratchMaster = scratchMaster;
                row.scratchProxy = scratchProxy;
                row.scratchOut = path.join(SCRATCH_DIR, row.master_hash + '_OUT.jpg');
            } catch(e) {
                console.error(`Failed to copy to scratch: ${row.masterName}`);
            }
        }

        // 2. SSD CONCURRENT PROCESSING (Ryzen goes brrrrr)
        console.log(`🚀 Processing chunk on SSD with concurrency ${CONCURRENCY_LIMIT}...`);
        for (let j = 0; j < chunk.length; j += CONCURRENCY_LIMIT) {
            const microChunk = chunk.slice(j, j + CONCURRENCY_LIMIT);
            
            await Promise.all(microChunk.map(async (row) => {
                if (!row.scratchMaster || !row.scratchProxy) return;

                try {
                    const { stdout, stderr } = await execAsync(`python "${pyScript}" "${row.scratchMaster}" "${row.scratchProxy}" "${row.scratchOut}"`);
                    
                    let result;
                    try {
                        result = JSON.parse(stdout.trim());
                    } catch (e) {
                        console.error(`  [X] Failed to parse Python output for ${row.masterName}`);
                        row.failed = true;
                        errorCount++;
                        return;
                    }

                if (result.success) {
                    row.googleStats = result.stats;
                } else {
                    console.error(`  [X] Python error on ${row.masterName}: ${result.error}`);
                    row.failed = true;
                    errorCount++;
                }
            } catch (e) {
                console.error(`  [X] Execution error on ${row.masterName}`);
                row.failed = true;
                errorCount++;
            }
        }));
    }

    // 3. SEQUENTIAL BULK WRITE & PURGE (Lifeboat friendly)
    console.log(`💾 Writing enhanced files back to Lifeboat and purging proxies...`);
    for (const row of chunk) {
        if (row.failed || !fs.existsSync(row.scratchOut)) continue;

        try {
            // Overwrite master on F:
            fs.copyFileSync(row.scratchOut, row.masterPath);
            
            // Delete proxy from F:
            if (fs.existsSync(row.proxyPath)) {
                fs.unlinkSync(row.proxyPath);
            }
            
            // Database updates
            const statsJson = row.googleStats ? JSON.stringify(row.googleStats) : null;
            await new Promise((resolve) => db.run(`DELETE FROM airlock_jobs WHERE hash = ?`, [row.proxy_hash], resolve));
            await new Promise((resolve) => db.run(`
                UPDATE forge_training_data 
                SET decision = 'RESOLVED_TRANSPLANT', google_stats_json = ? 
                WHERE proxy_hash = ?
            `, [statsJson, row.proxy_hash], resolve));
            
            processedCount++;
        } catch(e) {
                console.error(`  [X] Failed I/O on lifeboat for ${row.masterName}: ${e.message}`);
                errorCount++;
            }
            
            // Clean up scratch files
            if (fs.existsSync(row.scratchMaster)) fs.unlinkSync(row.scratchMaster);
            if (fs.existsSync(row.scratchProxy)) fs.unlinkSync(row.scratchProxy);
            if (fs.existsSync(row.scratchOut)) fs.unlinkSync(row.scratchOut);
        }
        
        console.log(`--- Progress: ${processedCount}/${rows.length} | Errors: ${errorCount} ---`);
    }

    console.log("\n=================================================");
    console.log("MASS TRANSPLANT COMPLETE.");
    console.log(`Successfully processed: ${processedCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log("=================================================");
    db.close();
});
