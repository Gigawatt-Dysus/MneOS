const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('C:\\MneOS\\staging.db', sqlite3.OPEN_READONLY, (err) => {
  if (err) return console.error(err);
  db.all("SELECT filepath FROM files WHERE filename LIKE '%Image055.jpg%'", (err, rows) => {
    console.log(err || rows);
    process.exit(0);
  });
});
