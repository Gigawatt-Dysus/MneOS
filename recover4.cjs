const fs = require('fs');
const txt = fs.readFileSync('C:\\Users\\artin\\.gemini\\antigravity\\brain\\cdff6619-730c-4859-a924-6448e44e9d32\\.system_generated\\logs\\overview.txt', 'utf8');
const lines = txt.split('\n');
for(let line of lines) {
    if (line.includes('"step_index":883')) {
        const obj = JSON.parse(line);
        const args = obj.tool_calls[0].args;
        console.log("Chunks:");
        const chunks = JSON.parse(args.ReplacementChunks);
        for (let chunk of chunks) {
            console.log("--- TARGET CONTENT ---");
            console.log(chunk.TargetContent);
        }
        break;
    }
}
