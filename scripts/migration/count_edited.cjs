const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/LifeOS/staging.db');

const query = `
    SELECT 
        COUNT(*) as total_edited,
        SUM(size) as total_bytes
    FROM airlock_jobs 
    WHERE originalName LIKE '%-edited%'
`;

db.get(query, (err, row) => {
    if (err) {
        console.error("Error executing query:", err);
    } else {
        console.log("\n========================================");
        console.log(`ðŸ“¦ TOTAL "-edited" FILES FOUND: ${row.total_edited.toLocaleString()}`);
        console.log(`ðŸ’¾ TOTAL SIZE (Bloat): ${(row.total_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`);
        console.log("========================================\n");
    }
    db.close();
});
