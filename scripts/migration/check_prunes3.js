import sqlite3Pkg from 'sqlite3';
import path from 'path';

const sqlite3 = sqlite3Pkg.verbose();
const dbPath = path.join(process.cwd(), 'staging.db');
const db = new sqlite3.Database(dbPath);

const query = "SELECT sat_shift, decision FROM forge_training_data WHERE sat_shift IS NOT NULL AND decision LIKE 'AUTO_PRUNE%' ORDER BY CAST(sat_shift as REAL) DESC LIMIT 10";
db.all(query, [], (err, rows) => {
    console.log(rows);
    db.close();
});
