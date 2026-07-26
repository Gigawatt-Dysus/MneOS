const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('F:\\staging.db', sqlite3.OPEN_READONLY);

db.get("SELECT COUNT(*) as cnt FROM files WHERE filename LIKE '%Screenshot%'", (err, row) => {
    console.log('Screenshots in staging.db:', row ? row.cnt : 'ERROR');
    
    db.get("SELECT COUNT(*) as cnt FROM files WHERE filename LIKE '%-edited%'", (err2, row2) => {
        console.log('Google-edited files in staging.db:', row2 ? row2.cnt : 'ERROR');
        
        db.get("SELECT COUNT(*) as cnt FROM files", (err3, row3) => {
            console.log('Total files in staging.db:', row3 ? row3.cnt : 'ERROR');
            
            // Check what columns exist
            db.all("PRAGMA table_info(files)", (err4, cols) => {
                console.log('\nstaging.db columns:', cols.map(c => c.name).join(', '));

                // Check if the script's lookup by 'filename' even matches the column name
                db.get("SELECT * FROM files LIMIT 1", (err5, sample) => {
                    console.log('\nSample row keys:', Object.keys(sample || {}));
                    console.log('Sample row:', JSON.stringify(sample).substring(0, 300));
                    db.close();
                });
            });
        });
    });
});
