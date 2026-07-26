const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/LifeOS/staging.db');
db.all("SELECT originalName, count(*) as c FROM airlock_jobs WHERE caption IS NOT NULL GROUP BY originalName HAVING c > 1", (err, rows) => {
    console.log("DUPLICATES FOUND:", rows);
});
