import sqlite3Pkg from 'sqlite3';
const sqlite3 = sqlite3Pkg.verbose();
const db = new sqlite3.Database('C:/MneOS/staging.db', (err) => {
    if (err) console.error(err);
});
db.all("SELECT sql FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    if (err) throw err;
    console.log(JSON.stringify(rows, null, 2));
    db.close();
});
