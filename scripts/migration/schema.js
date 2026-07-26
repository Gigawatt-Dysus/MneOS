const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('C:/MneOS/staging.db');
db.all("SELECT sql FROM sqlite_master WHERE type='table'", (err, rows) => {
    console.log(rows);
});
