const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('C:/LifeOS/scripts/migration/staging.db');
db.all('SELECT caption FROM files WHERE caption IS NOT NULL AND caption != "" LIMIT 5;', (err, rows) => {
    console.log(rows);
    db.close();
});
