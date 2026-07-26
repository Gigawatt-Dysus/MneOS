import sqlite3Pkg from 'sqlite3';
import path from 'path';
import fs from 'fs';

const sqlite3 = sqlite3Pkg.verbose();
const dbPath = path.join(process.cwd(), 'staging.db');
const db = new sqlite3.Database(dbPath);
const OLLAMA_URL = 'http://localhost:11434/api/generate'; // Local instance
const MODEL_NAME = 'moondream';

async function runVisionEval() {
    console.log("👁️  INITIATING SOVEREIGN VISION EVALUATOR (MOONDREAM 3) 👁️");

    const query = `
        SELECT 
            t.proxy_hash, 
            t.master_hash,
            p.filepath as proxy_path,
            m.filepath as master_path,
            p.originalName as proxyName
        FROM forge_training_data t
        JOIN airlock_jobs p ON t.proxy_hash = p.hash
        JOIN airlock_jobs m ON t.master_hash = m.hash
        WHERE t.decision = 'PENDING_VISION'
    `;

    db.all(query, [], async (err, rows) => {
        if (err) {
            console.error("Database error:", err);
            return;
        }

        console.log(`Found ${rows.length} anomalous pairs flagged for Moondream 3 review...`);

        for (const row of rows) {
            try {
                const scriptPath = path.join(process.cwd(), 'scripts', 'migration', 'math_eval.py');
                const pPath = row.proxy_path.replace(/"/g, '\\"');
                const mPath = row.master_path.replace(/"/g, '\\"');
                
                const responseStr = await new Promise((resolve) => {
                    import('child_process').then(cp => {
                        cp.exec(`python "${scriptPath}" "${pPath}" "${mPath}"`, (err, stdout, stderr) => {
                            if (err) {
                                console.error(`[Exec Error] ${err}`);
                                resolve(null);
                            } else {
                                resolve(stdout.trim());
                            }
                        });
                    });
                });

                if (!responseStr) continue;

                let decision = 'PENDING_VISION';
                let reason = '';
                try {
                    const json = JSON.parse(responseStr);
                    if (json.error) {
                        console.error(`[Script Error] ${json.error}`);
                        continue;
                    }
                    decision = json.decision || 'PENDING_VISION';
                    reason = json.reason || '';
                } catch(e) {
                    console.error(`[Parse Error] ${e.message}`);
                    continue;
                }

                console.log(`[MATH_EVAL] ${row.proxyName} -> ${decision} -> ${reason}`);

                // Update DB with final decision
                if (decision !== 'PENDING_VISION') {
                    await new Promise((resolve) => {
                        db.run(
                            "UPDATE forge_training_data SET decision = ? WHERE proxy_hash = ?",
                            [decision, row.proxy_hash],
                            resolve
                        );
                    });
                }

            } catch (e) {
                console.error(`[Error] Failed to process ${row.proxyName}:`, e.message);
            }
        }
        
        console.log("Vision evaluation cycle complete.");
        db.close();
    });
}

runVisionEval();
