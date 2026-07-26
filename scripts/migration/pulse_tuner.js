import sqlite3Pkg from 'sqlite3';
import path from 'path';

const sqlite3 = sqlite3Pkg.verbose();
const dbPath = path.join(process.cwd(), 'staging.db');
const db = new sqlite3.Database(dbPath);

console.log("🧠 [Pulse Tuner] Recalibrating Heuristics...");

db.all(`SELECT ssim_score, sat_shift, decision FROM forge_training_data WHERE decision IN ('KEEP_PROXY', 'PRUNE_PROXY')`, [], (err, rows) => {
    if (err) {
        console.error("Database error:", err);
        return db.close();
    }

    if (rows.length < 5) {
        console.log("🧠 [Pulse Tuner] Insufficient data to tune (needs at least 5 manual decisions).");
        return db.close();
    }

    // Safety constraints
    let bestSsim = 0.85; 
    const minAllowedSsim = 0.70; // Never go below 70%
    const maxAllowedSsim = 0.98; // Never go above 98%

    // We want to find the lowest SSIM threshold that safely auto-prunes
    // WITHOUT accidentally auto-pruning a KEEP_PROXY (false positive).
    // False positives (pruning a KEEP) are catastrophic.
    // False negatives (not pruning a PRUNE) just means more manual work.

    const keeps = rows.filter(r => r.decision === 'KEEP_PROXY').map(r => r.ssim_score);
    const prunes = rows.filter(r => r.decision === 'PRUNE_PROXY').map(r => r.ssim_score);

    if (keeps.length > 0) {
        // Find the lowest SSIM that was kept. We cannot auto-prune anything that looks THIS different or more.
        // Wait, lower SSIM = more different. Higher SSIM = more identical.
        // If they keep an image with 0.88, we MUST NOT auto-prune 0.88.
        // What if they keep a 0.95? That means we MUST NOT auto-prune 0.95.
        // So the threshold must be strictly HIGHER than the highest KEEP.
        // Wait, if we set threshold to 0.96, we will only auto-prune 0.96-1.00.
        // If a user KEEPS a 0.99 (because it has a watermark), the threshold becomes 0.991. The system basically stops auto-pruning.
        // To prevent a single outlier from ruining the system, we will allow a 5% false positive rate 
        // OR we just use the 90th percentile of KEEPs.
        // Let's sort KEEPs descending.
        keeps.sort((a, b) => b - a);
        
        // If we have many keeps, we can drop the top 5% of KEEPs as outliers.
        const outlierIndex = Math.floor(keeps.length * 0.05);
        const safeKeep = keeps[outlierIndex]; 

        // Set threshold slightly above the safe KEEP
        bestSsim = safeKeep + 0.005;
    } else if (prunes.length > 0) {
        // If no keeps yet, just lower the threshold to the highest prune to aggressively clear junk
        prunes.sort((a, b) => b - a);
        bestSsim = prunes[Math.floor(prunes.length / 2)]; // Median prune
    }

    // Clamp within sane boundaries
    bestSsim = Math.max(minAllowedSsim, Math.min(maxAllowedSsim, bestSsim));

    // Update the database
    db.run(`UPDATE forge_heuristics SET ssim_threshold = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`, [bestSsim], function(err) {
        if (err) {
            console.error("Tuner error:", err);
            return db.close();
        }
        
        console.log(`🧠 [Pulse Tuner] Recalibration Complete. New SSIM Threshold: ${bestSsim.toFixed(4)}`);
        
        // Retroactively eject items from Quarantine that no longer meet the tightened threshold!
        db.run(`DELETE FROM forge_training_data WHERE decision = 'AUTO_PRUNE_COMPRESSED' AND ssim_score < ?`, [bestSsim], function(err) {
            if (this.changes > 0) {
                console.log(`🧠 [Pulse Tuner] Ejected ${this.changes} false-positives from the Quarantine Queue based on new heuristics.`);
            }
            db.close();
        });
    });
});
