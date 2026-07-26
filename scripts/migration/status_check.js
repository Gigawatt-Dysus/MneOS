import sqlite3Pkg from 'sqlite3';
const sqlite3 = sqlite3Pkg.verbose();
const db = new sqlite3.Database('C:\\LifeOS\\staging.db');

db.get(`SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status='NEW' THEN 1 ELSE 0 END) as pending_upload,
    SUM(CASE WHEN status='NEW' THEN size ELSE 0 END) as pending_bytes
    FROM airlock_jobs`, [], (err, row) => {
    if (err) { console.error(err); }
    else {
        console.log('\n=== AIRLOCK UPLOAD PAYLOAD ===');
        console.log(`Pending upload (NEW) : ${row.pending_upload?.toLocaleString()}`);
        console.log(`Total GB to upload   : ${(row.pending_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`);
    }
    db.close();
});
