import sqlite3Pkg from 'sqlite3';
import path from 'path';

const sqlite3 = sqlite3Pkg.verbose();
const dbPath = path.join(process.cwd(), 'staging.db');
const db = new sqlite3.Database(dbPath);

const query = "SELECT * FROM forge_training_data WHERE sat_shift > 40 AND decision LIKE 'AUTO_PRUNE%'";

db.all(query, [], (err, rows) => {
    if (err) console.error(err);
    else console.log("Found:", rows.length);
    db.close();
});
