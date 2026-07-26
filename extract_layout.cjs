const fs = require('fs');
const txt = fs.readFileSync('C:\\Users\\artin\\.gemini\\antigravity\\brain\\cdff6619-730c-4859-a924-6448e44e9d32\\.system_generated\\logs\\overview.txt', 'utf8');

const lines = txt.split('\n');
for(let i=0; i<lines.length; i++) {
    if (lines[i].includes('"step_index":856')) {
        for(let j=i; j<i+10; j++) {
            if (lines[j] && lines[j].includes('output')) {
                console.log('Found 100-200');
                const out = JSON.parse(lines[j]).output;
                fs.writeFileSync('C:\\MneOS\\scratch_layout1.txt', out);
            }
        }
    }
    if (lines[i].includes('"step_index":859')) {
        for(let j=i; j<i+10; j++) {
            if (lines[j] && lines[j].includes('output')) {
                console.log('Found 200-300');
                const out = JSON.parse(lines[j]).output;
                fs.writeFileSync('C:\\MneOS\\scratch_layout2.txt', out);
            }
        }
    }
    if (lines[i].includes('"step_index":862')) {
        for(let j=i; j<i+10; j++) {
            if (lines[j] && lines[j].includes('output')) {
                console.log('Found 300-338');
                const out = JSON.parse(lines[j]).output;
                fs.writeFileSync('C:\\MneOS\\scratch_layout3.txt', out);
            }
        }
    }
    if (lines[i].includes('"step_index":874')) {
        for(let j=i; j<i+10; j++) {
            if (lines[j] && lines[j].includes('output')) {
                console.log('Found 1-100');
                const out = JSON.parse(lines[j]).output;
                fs.writeFileSync('C:\\MneOS\\scratch_layout0.txt', out);
            }
        }
    }
}
