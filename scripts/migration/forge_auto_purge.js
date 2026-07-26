import sqlite3Pkg from 'sqlite3';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const sqlite3 = sqlite3Pkg.verbose();
const dbPath = path.join(process.cwd(), 'staging.db');
const db = new sqlite3.Database(dbPath);

const CONCURRENCY_LIMIT = 4; // Run 4 Python CV evaluations simultaneously

async function runAutoPurge() {
    console.log("🔥 INITIATING SOVEREIGN AUTO-PURGE WORKER 🔥");

    const query = `
        SELECT 
            p.hash as proxyHash, 
            p.filepath as proxyPath, 
            p.originalName as proxyName,
            m.hash as masterHash, 
            m.filepath as masterPath
        FROM airlock_jobs p
        JOIN airlock_jobs m 
            ON m.originalName = replace(p.originalName, '-edited', '')
            AND replace(m.filepath, m.originalName, '') = replace(p.filepath, p.originalName, '')
        WHERE p.filepath LIKE '%-edited%' 
        AND p.hash NOT IN (SELECT proxy_hash FROM forge_training_data)
    `;

    db.get(`SELECT ssim_threshold, sat_diff_threshold FROM forge_heuristics WHERE id = 1`, [], (err, config) => {
        const SSIM_THRESH = config?.ssim_threshold || 0.85;
        const SAT_THRESH = config?.sat_diff_threshold || 40.0;
        console.log(`[System] Active Heuristics -> SSIM: >= ${SSIM_THRESH.toFixed(3)} | SatShift: > ${SAT_THRESH.toFixed(1)}\n`);

        db.all(query, [], async (err, rows) => {
            if (err) {
                console.error("Database error:", err);
                return db.close();
            }

            if (rows.length === 0) {
                console.log("No proxies pending evaluation. The Forge is empty.");
                return db.close();
            }

            console.log(`[System] Found ${rows.length} proxies for structural evaluation.`);
            console.log(`[System] Processing with concurrency limit of ${CONCURRENCY_LIMIT}...\n`);

            let processedCount = 0;
            let nukeCount = 0;
            let flagCount = 0;

            // Process in chunks based on concurrency limit
            for (let i = 0; i < rows.length; i += CONCURRENCY_LIMIT) {
                const chunk = rows.slice(i, i + CONCURRENCY_LIMIT);
                
                await Promise.all(chunk.map(async (row) => {
                    const pyScript = path.join(process.cwd(), 'scripts', 'migration', 'eval_pair.py');
                    try {
                        const { stdout } = await execAsync(`python "${pyScript}" "${row.proxyPath}" "${row.masterPath}"`);
                        const data = JSON.parse(stdout);
                        if (data.error) return;

                        const ssim = data.ssimScore;
                        const pSize = data.proxySize;
                        const mSize = data.masterSize;
                        const pRatio = data.proxyDimensions.w / data.proxyDimensions.h;
                        const mRatio = data.masterDimensions.w / data.masterDimensions.h;
                        
                        const isSmaller = pSize < mSize;
                        
                        // Allow for 1-pixel rounding differences OR EXIF rotation swaps (portrait vs landscape metadata mismatch)
                        const aspectDiff = Math.abs(pRatio - mRatio);
                        const aspectSwapDiff = Math.abs((1/pRatio) - mRatio);
                        const isSameAspect = aspectDiff < 0.05 || aspectSwapDiff < 0.05;
                        
                        const isHighSSIM = ssim >= SSIM_THRESH;
                        const isPillarBoxed = data.isPillarBoxed;

                        let decision = null;
                        if (data.satDiff > SAT_THRESH) {
                            // High histogram difference means they are likely mismatched files from Google Takeout (1) bugs
                            // We push to vision queue to let Moondream 3 decide
                            decision = 'PENDING_VISION'; 
                        } else if (isPillarBoxed) {
                            decision = 'AUTO_PRUNE_PILLARBOX';
                        } else if (isSmaller && isSameAspect && isHighSSIM) {
                            decision = 'AUTO_PRUNE_COMPRESSED';
                        }

                        if (decision) {
                            if (decision.startsWith('AUTO_PRUNE')) {
                                nukeCount++;
                            } else {
                                flagCount++;
                            }
                            
                            // Insert into DB as Soft-Quarantine or Vision Queue
                            await new Promise((resolve) => {
                                const insertStmt = db.prepare(`
                                    INSERT INTO forge_training_data (proxy_hash, master_hash, ssim_score, sat_shift, decision) 
                                    VALUES (?, ?, ?, ?, ?)
                                    ON CONFLICT(proxy_hash) DO UPDATE SET decision=excluded.decision
                                `);
                                insertStmt.run([row.proxyHash, row.masterHash, ssim, data.satDiff, decision], resolve);
                            });
                            if (decision.startsWith('AUTO_PRUNE')) {
                                console.log(`[AUTO-NUKE] ${row.proxyName} -> ${decision}`);
                            } else {
                                console.log(`[VISION Q]  ${row.proxyName} -> ${decision}`);
                            }
                        } else {
                            // Wait, if it didn't trigger any condition, just skip (e.g., low SSIM but satDiff < 40)
                            flagCount++;
                            console.log(`[FLAGGED]   ${row.proxyName} -> Retained for Manual Review`);
                        }
                    } catch (e) {
                        console.error(`[Error] Failed on ${row.proxyName}`);
                    }
                }));
                
                processedCount += chunk.length;
                if (processedCount % 20 === 0 || processedCount === rows.length) {
                    console.log(`\n--- Progress: ${processedCount}/${rows.length} | Nuked: ${nukeCount} | Flagged: ${flagCount} ---\n`);
                }
            }
            
            console.log(`\n✅ Auto-Purge Worker Complete.`);
            console.log(`Total Nuked (Soft-Quarantine): ${nukeCount}`);
            console.log(`Total Flagged for Review: ${flagCount}`);
            db.close();
        });
    });
}

runAutoPurge();
