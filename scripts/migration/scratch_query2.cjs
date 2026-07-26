const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('F:/staging.db');

db.get("SELECT filepath FROM files WHERE filename = ? LIMIT 1", ['_DSC0134(6).JPG'], (err, row) => {
    if (err) console.error(err);
    else console.log("Fallback query row:", row);
    db.close();
});
