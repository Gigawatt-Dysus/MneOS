const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/services/firebase');
const files = fs.readdirSync(dir);

files.forEach(file => {
    if (!file.endsWith('.ts')) return;
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace './dbAdapter' with '../sovereignDbAdapter'
    content = content.replace(/['"]\.\/dbAdapter['"]/g, "'../sovereignDbAdapter'");
    // Replace './core' with '../sovereignCore'
    content = content.replace(/['"]\.\/core['"]/g, "'../sovereignCore'");

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated:', filePath);
    }
});
console.log('Done.');
