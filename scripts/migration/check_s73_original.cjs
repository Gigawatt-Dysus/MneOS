const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/LifeOS/staging.db');
db.all("SELECT filepath, size FROM airlock_jobs WHERE originalName LIKE 'S7300008%'", (err, rows) => {
    console.log(rows);
});
