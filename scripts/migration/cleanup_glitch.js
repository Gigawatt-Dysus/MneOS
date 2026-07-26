import sqlite3Pkg from 'sqlite3';
import path from 'path';

const sqlite3 = sqlite3Pkg.verbose();
const dbPath = path.join(process.cwd(), 'staging.db');
const db = new sqlite3.Database(dbPath);

db.run(`DELETE FROM forge_training_data WHERE decision LIKE 'AUTO_PRUNE%'`, function(err) {
    if (err) console.error(err);
    else console.log('Rows deleted:', this.changes);
    db.close();
});
