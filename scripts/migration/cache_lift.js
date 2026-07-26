const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const copyFile = promisify(fs.copyFile);

const DB_PATH = path.join(__dirname, '..', '..', 'staging.db');
const CACHE_DIR = path.join(__dirname, '..', '..', 'airlock_cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

async function performLift() {
  console.log("🚀 Starting Airlock Cache Lift...");
  
  db.all(`SELECT hash, filepath, filename FROM airlock_jobs WHERE process_state IN ('pending', 'vision_done', 'error') AND filepath LIKE 'I:%'`, async (err, jobs) => {
    if (err) {
      console.error("❌ DB Error:", err.message);
      return;
    }

    console.log(`📦 Found ${jobs.length} pending jobs stuck on the I: drive. Commencing physical lift to internal NVMe...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const ext = path.extname(job.filename);
      // Use hash for unique filenames to prevent collisions from different folders
      const newFileName = `${job.hash}${ext}`;
      const newFilePath = path.join(CACHE_DIR, newFileName);

      try {
        if (!fs.existsSync(newFilePath)) {
          await copyFile(job.filepath, newFilePath);
        }

        // Update the SQLite database to point to the local cache!
        await new Promise((resolve, reject) => {
          db.run(`UPDATE airlock_jobs SET filepath = ? WHERE hash = ?`, [newFilePath, job.hash], function(updateErr) {
            if (updateErr) reject(updateErr);
            else resolve();
          });
        });

        // Also update the main files table just to keep the schema intact
        await new Promise((resolve, reject) => {
          db.run(`UPDATE files SET filepath = ? WHERE hash = ?`, [newFilePath, job.hash], function(updateErr) {
            if (updateErr) reject(updateErr);
            else resolve();
          });
        });

        successCount++;
        if (successCount % 500 === 0) {
          console.log(`🔄 Lifted ${successCount} / ${jobs.length} files into sovereign cache...`);
        }
      } catch (e) {
        console.error(`⚠️ Failed to lift ${job.filepath}:`, e.message);
        failCount++;
      }
    }

    console.log(`\n✅ LIFT COMPLETE!`);
    console.log(`Successfully moved ${successCount} files to C:\\LifeOS\\airlock_cache\\`);
    console.log(`You may now physically disconnect the I: drive! The pipeline will pull from the cache.`);
    db.close();
  });
}

performLift();
