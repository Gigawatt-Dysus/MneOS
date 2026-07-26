const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('F:\\staging.db', sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error(err.message);
        return;
    }
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
        if (err) throw err;
        console.log('Tables:', rows.map(r => r.name));
        
        if (rows.length > 0) {
            db.all("SELECT * FROM " + rows[0].name + " LIMIT 1", [], (err, sample) => {
                console.log('Sample from', rows[0].name, ':', sample);
                db.close();
            });
        }
    });
});
