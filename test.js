const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('C:/MneOS/staging.db');
db.all("SELECT p.filepath as proxy, m.filepath as master FROM forge_training_data t JOIN airlock_jobs p ON t.proxy_hash = p.hash JOIN airlock_jobs m ON t.master_hash = m.hash WHERE t.decision = 'TAKEOUT_COLLISION' LIMIT 1", (e,r)=>console.log(r));
