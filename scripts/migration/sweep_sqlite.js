import sqlite3Pkg from 'sqlite3';
const sqlite3 = sqlite3Pkg.verbose();

const db = new sqlite3.Database('C:\\LifeOS\\staging.db');

console.log('Sweeping local SQLite DB for garbage...');

db.run("DELETE FROM airlock_jobs WHERE fileType = 'UNKNOWN' OR filename LIKE '%.ps1' OR filename LIKE '%.cmd' OR filename LIKE '%.js' OR filename LIKE '%.ini' OR filename LIKE '%.json' OR filename LIKE '%.html' OR filename LIKE '%.md'", function(err) {
    if (err) {
        console.error(err);
    } else {
        console.log(`[SUCCESS] Purged ${this.changes} garbage rows from staging.db.`);
    }
    db.close();
});
