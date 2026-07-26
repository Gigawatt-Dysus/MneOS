import sqlite3Pkg from 'sqlite3';
import path from 'path';

const sqlite3 = sqlite3Pkg.verbose();
const dbPath = path.join(process.cwd(), 'staging.db');
const db = new sqlite3.Database(dbPath);

const query = "SELECT COUNT(*) as c FROM forge_training_data WHERE decision LIKE 'AUTO_PRUNE%'";
db.all(query, [], (err, rows) => {
    console.log("Total AUTO_PRUNE records:", rows[0].c);
    db.close();
});
