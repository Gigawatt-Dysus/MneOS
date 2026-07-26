const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('c:/LifeOS/staging.db');
db.all(`
    SELECT p.originalName as pName, 
           replace(p.originalName, '-edited', '') as mName 
    FROM airlock_jobs p 
    WHERE p.filepath LIKE '%-edited%' 
    LIMIT 5
`, [], (err, rows) => {
    console.log("PROXIES:", rows);
    
    db.all(`
        SELECT p.originalName as pName, m.originalName as mName 
        FROM airlock_jobs p
        JOIN airlock_jobs m ON m.originalName = replace(p.originalName, '-edited', '')
        WHERE p.filepath LIKE '%-edited%'
        LIMIT 5
    `, [], (err, pairs) => {
        console.log("PAIRS:", pairs);
    });
});
