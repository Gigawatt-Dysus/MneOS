const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/LifeOS/staging.db');

const query = `
    SELECT filepath FROM airlock_jobs WHERE originalName LIKE '%-edited%' LIMIT 5
`;
db.all(query, (err, rows) => {
    console.log(rows);
    db.close();
});
