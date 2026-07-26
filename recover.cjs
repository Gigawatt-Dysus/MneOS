const fs = require('fs');
const lines = fs.readFileSync('C:/Users/artin/.gemini/antigravity/brain/cdff6619-730c-4859-a924-6448e44e9d32/.system_generated/logs/overview.txt', 'utf8').split('\n');
let capturing = false;
let content = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('File Path: `file:///C:/MneOS/src/components/Layout/MainLayout.tsx`')) {
        capturing = true;
        content = [];
    } else if (capturing && lines[i].includes('The above content shows the entire')) {
        capturing = false;
        break; // We have the file
    } else if (capturing && lines[i].match(/^\d+: /)) {
        content.push(lines[i]);
    }
}
fs.writeFileSync('C:/MneOS/recovered.txt', content.join('\n'));
console.log('Recovered to recovered.txt');
