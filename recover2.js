import fs from 'fs';
const lines = fs.readFileSync('C:/Users/artin/.gemini/antigravity/brain/cdff6619-730c-4859-a924-6448e44e9d32/.system_generated/logs/overview.txt', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('"name":"replace_file_content","args":{"AllowMultiple":"false","Description":"\\"Restoring the actual Muse statue image assets')) {
        console.log('Found replace_file_content at line ' + i);
        console.log(lines[i]);
    }
}
