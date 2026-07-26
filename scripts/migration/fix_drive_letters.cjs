const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'staging.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error("â Œ Failed to open staging.db:", err.message);
        process.exit(1);
    }
});

async function fixDriveLetters() {
    console.log("ðŸš€ Starting vector swap in staging.db...");
    
    const queries = [
        `UPDATE files SET filepath = REPLACE(filepath, 'I:\\', 'D:\\') WHERE filepath LIKE 'I:\\%'`,
        `UPDATE airlock_jobs SET filepath = REPLACE(filepath, 'I:\\', 'D:\\') WHERE filepath LIKE 'I:\\%'`,
        `UPDATE files SET filepath = REPLACE(filepath, 'I:/', 'D:/') WHERE filepath LIKE 'I:/%'`,
        `UPDATE airlock_jobs SET filepath = REPLACE(filepath, 'I:/', 'D:/') WHERE filepath LIKE 'I:/%'`
    ];

    for (let q of queries) {
        await new Promise((resolve, reject) => {
            db.run(q, function(err) {
                if (err) {
                    console.error("â Œ Error running query:", q, err);
                    reject(err);
                } else {
                    console.log(`âœ… Updated ${this.changes} rows for: ${q}`);
                    resolve();
                }
            });
        });
    }

    db.close((err) => {
        if (err) console.error("Error closing DB", err);
        else console.log("ðŸŽ‰ Vector swap complete! You may need to restart the Airlock API.");
    });
}

fixDriveLetters().catch(console.error);
