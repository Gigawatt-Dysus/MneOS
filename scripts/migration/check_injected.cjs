const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/LifeOS/staging.db');
db.all("SELECT filename, caption FROM airlock_jobs WHERE caption IS NOT NULL ORDER BY processed_at DESC LIMIT 15", (err, rows) => {
    console.log(rows);
});
