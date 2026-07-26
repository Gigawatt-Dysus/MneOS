const fs = require('fs');
const txt = fs.readFileSync('C:\\Users\\artin\\.gemini\\antigravity\\brain\\cdff6619-730c-4859-a924-6448e44e9d32\\.system_generated\\logs\\overview.txt', 'utf8');
const targetIdx = txt.indexOf('"TargetContent":"');
const lines = txt.split('\n');
for(let i=0; i<lines.length; i++) {
    if (lines[i].includes('"step_index":883')) {
        const line = lines[i];
        const match = line.match(/"TargetContent":"(.*?)"/);
        if (match) {
            console.log(match[1]);
        } else {
            console.log("No match found in step 883");
        }
    }
}
