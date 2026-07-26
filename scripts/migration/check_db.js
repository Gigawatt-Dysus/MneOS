import sqlite3Pkg from 'sqlite3';
import path from 'path';

const sqlite3 = sqlite3Pkg.verbose();
const dbPath = path.join(process.cwd(), 'staging.db');
const db = new sqlite3.Database(dbPath);

const query = `
    SELECT 
        p.filepath as proxyPath, 
        p.originalName as proxyName,
        m.filepath as masterPath,
        m.originalName as masterName
    FROM airlock_jobs p
    JOIN airlock_jobs m 
        ON m.originalName = replace(p.originalName, '-edited', '')
        AND replace(m.filepath, m.originalName, '') = replace(p.filepath, p.originalName, '')
    WHERE p.filepath LIKE '%-edited%' 
    LIMIT 20
`;

db.all(query, [], (err, rows) => {
    if (err) console.error(err);
    else console.log(rows);
    db.close();
});
