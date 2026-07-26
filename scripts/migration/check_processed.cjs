const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/LifeOS/staging.db');
db.all("SELECT hash, processed_at, caption FROM airlock_jobs WHERE caption IS NOT NULL LIMIT 5", (err, rows) => {
    console.log(rows);
});
