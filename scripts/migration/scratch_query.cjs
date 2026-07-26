const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('F:/staging.db');

db.all("SELECT filename, filepath, size FROM files WHERE filename = '_DSC0134(6).JPG'", [], (err, rows) => {
    if (err) console.error(err);
    else console.log("Exact match for _DSC0134(6).JPG:", rows);
});

db.all("SELECT filename, filepath, size FROM files WHERE filename = '_DSC0133(5).JPG'", [], (err, rows) => {
    if (err) console.error(err);
    else console.log("Exact match for _DSC0133(5).JPG:", rows);
    db.close();
});
