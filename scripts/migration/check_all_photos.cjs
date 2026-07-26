const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:\\LifeOS\\staging.db');
db.all("SELECT filepath FROM files WHERE filepath LIKE '%ALL_PHOTOS%' LIMIT 5", [], (err, rows) => {
    console.log("ALL_PHOTOS matches:", rows);
    db.all("SELECT filepath FROM files WHERE filepath NOT LIKE '%ALL_PHOTOS%' LIMIT 5", [], (err2, rows2) => {
        console.log("NON-ALL_PHOTOS matches:", rows2);
        db.close();
    });
});
