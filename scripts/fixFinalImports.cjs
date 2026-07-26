const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdir(dir, function(err, list) {
        if (err) return callback(err);
        let pending = list.length;
        if (!pending) return callback(null, []);
        list.forEach(function(file) {
            file = path.resolve(dir, file);
            fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function(err, res) {
                        pending -= 1;
                        if (!pending) callback(null);
                    });
                } else {
                    if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
                        processFile(file);
                    }
                    pending -= 1;
                    if (!pending) callback(null);
                }
            });
        });
    });
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace firebaseDbService with sovereignDbService
    content = content.replace(/['"](.*?)firebaseDbService['"]/g, "'$1sovereignDbService'");
    // Replace firebase/leads with sovereignLeads
    content = content.replace(/['"](.*?)firebase\/leads['"]/g, "'$1sovereignLeads'");

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated:', filePath);
    }
}

walk(path.join(__dirname, '../src'), (err) => {
    if (err) console.error(err);
    else console.log('Done.');
});
