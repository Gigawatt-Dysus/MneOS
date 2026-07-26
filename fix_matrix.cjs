const fs = require('fs');
let content = fs.readFileSync('c:/MneOS/src/components/matrix/MatrixGrid.tsx', 'utf8');
const lines = content.split('\n');

// 1. Remove the tools from BorderGlow
const extracted = lines.splice(676, 116);

// 2. Find the wrapper div
const targetIdx = lines.findIndex(l => l.includes('{innerMediaContent}'));

if (targetIdx > -1) {
    // 3. Insert the tools AFTER innerMediaContent
    lines.splice(targetIdx + 1, 0, ...extracted);
    
    // 4. Update the wrapper div to have group/card
    const wrapperIdx = targetIdx - 1;
    if (lines[wrapperIdx].includes('<div style={{ width: asset.isFirstInGroup')) {
        lines[wrapperIdx] = lines[wrapperIdx].replace('<div style={{', '<div className="relative group/card w-full h-full" style={{');
    }
    
    // 5. Update group-hover to group-hover/card
    for (let i = targetIdx; i < targetIdx + 116 + 5; i++) {
        if (lines[i]) {
            lines[i] = lines[i].replace(/group-hover:/g, 'group-hover/card:');
            lines[i] = lines[i].replace(/group-hover\/drawer:/g, 'group-hover/drawer:'); // preserve the drawer ones
        }
    }
}

fs.writeFileSync('c:/MneOS/src/components/matrix/MatrixGrid.tsx', lines.join('\n'));
console.log('Done');
