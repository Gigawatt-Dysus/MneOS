const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/LifeOS/staging.db');

const query = `
    SELECT e.filepath as edited_path, o.filepath as original_path
    FROM airlock_jobs e
    JOIN airlock_jobs o ON e.filepath = replace(o.filepath, '.jpg', '-edited.jpg') COLLATE NOCASE
    WHERE e.originalName LIKE '%-edited%'
    LIMIT 1
`;

db.get(query, (err, row) => {
    if (err) {
        console.error(err);
    } else if (row) {
        console.log(row);
    } else {
        // Try another way to pair
        const query2 = `
            SELECT filepath FROM airlock_jobs WHERE originalName LIKE '%-edited%' LIMIT 2
        `;
        db.all(query2, (err, rows) => console.log("Fallback:", rows));
    }
    db.close();
});
