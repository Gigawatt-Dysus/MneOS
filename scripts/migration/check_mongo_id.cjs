const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/LifeOS/staging.db');
db.all("SELECT hash, existingMongoId FROM airlock_jobs WHERE existingMongoId IS NOT NULL LIMIT 5", (err, rows) => {
    console.log(rows);
});
