const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('F:\\staging.db', sqlite3.OPEN_READONLY);
db.all("SELECT * FROM files WHERE filename LIKE ?;", ['%DSC_0109%'], (err, rows) => {
    if(err) console.error(err);
    else console.log(rows);
    db.close();
});
