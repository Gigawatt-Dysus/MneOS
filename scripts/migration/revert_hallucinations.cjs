const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/LifeOS/staging.db');
db.run("UPDATE airlock_jobs SET caption = NULL, processed_at = NULL, process_state = 'pending' WHERE processed_at >= '2026-06-06 21:40:00'", function(err) {
    if (err) console.error(err);
    console.log("Reverted", this.changes, "hallucinated injection rows");
});
