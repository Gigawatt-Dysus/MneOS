const fs = require('fs');
const txt = fs.readFileSync('C:\\Users\\artin\\.gemini\\antigravity\\brain\\cdff6619-730c-4859-a924-6448e44e9d32\\.system_generated\\logs\\overview.txt', 'utf8');

const lines = txt.split('\n');
for(let i=0; i<lines.length; i++) {
    if (lines[i].includes('"step_index":857') && lines[i].includes('TOOL_RESPONSE')) {
        const data = JSON.parse(lines[i]);
        fs.writeFileSync('C:\\MneOS\\scratch_layout1.txt', data.output);
        console.log("Wrote layout1");
    }
    if (lines[i].includes('"step_index":860') && lines[i].includes('TOOL_RESPONSE')) {
        const data = JSON.parse(lines[i]);
        fs.writeFileSync('C:\\MneOS\\scratch_layout2.txt', data.output);
        console.log("Wrote layout2");
    }
    if (lines[i].includes('"step_index":863') && lines[i].includes('TOOL_RESPONSE')) {
        const data = JSON.parse(lines[i]);
        fs.writeFileSync('C:\\MneOS\\scratch_layout3.txt', data.output);
        console.log("Wrote layout3");
    }
    if (lines[i].includes('"step_index":875') && lines[i].includes('TOOL_RESPONSE')) {
        const data = JSON.parse(lines[i]);
        fs.writeFileSync('C:\\MneOS\\scratch_layout0.txt', data.output);
        console.log("Wrote layout0");
    }
}
