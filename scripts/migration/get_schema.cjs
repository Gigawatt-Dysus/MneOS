const db = require('better-sqlite3')('c:/LifeOS/staging.db');
const tables = db.prepare("SELECT sql FROM sqlite_master WHERE type='table'").all();
console.log(JSON.stringify(tables, null, 2));
