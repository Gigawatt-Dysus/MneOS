const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database('C:/LifeOS/staging.db');
const outDir = 'C:/LifeOS/Review_Corrupt';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

db.all("SELECT filepath, filename FROM airlock_jobs WHERE filename LIKE '201807%' LIMIT 20", (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  
  rows.forEach(r => {
    const dest = path.join(outDir, r.filename);
    try {
      if (fs.existsSync(r.filepath)) {
        fs.copyFileSync(r.filepath, dest);
        console.log('Copied ' + r.filename);
      } else {
        console.log('Not found on disk: ' + r.filepath);
      }
    } catch(e) {
      console.log('Failed ' + r.filename + ' - ' + e.message);
    }
  });
  console.log('Done! Files are in C:/LifeOS/Review_Corrupt');
});
