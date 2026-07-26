const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/LifeOS/staging.db');
db.all("SELECT originalName, size, count(*) as c FROM airlock_jobs GROUP BY originalName, size HAVING c > 1 LIMIT 5", (err, rows) => {
    console.log("DUPLICATES BY NAME AND SIZE:", rows);
});
