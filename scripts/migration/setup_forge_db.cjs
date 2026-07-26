const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/LifeOS/staging.db');

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS forge_training_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            proxy_hash TEXT NOT NULL UNIQUE,
            master_hash TEXT NOT NULL,
            ssim_score REAL,
            sat_shift REAL,
            decision TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('forge_training_data table created');
});

db.close();
