const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GEMINI_BASE_DIR = path.join('C:', 'MneOS', '_SESSION_EXPORTS', 'GEMINI_SESSIONS');

function getHashes(dirName) {
    const dir = path.join(GEMINI_BASE_DIR, dirName);
    const hashes = new Map();
    if (!fs.existsSync(dir)) return hashes;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    files.forEach(f => {
        const content = fs.readFileSync(path.join(dir, f), 'utf8');
        const lines = content.split('\n').filter(l => !l.startsWith('# GEMINI') && !l.startsWith('# Session ID:') && !l.startsWith('# Category:') && !l.startsWith('# Date:'));
        const hash = crypto.createHash('sha256').update(lines.join('\n').trim()).digest('hex');
        hashes.set(hash, f);
    });
    return hashes;
}

const artinaeHashes = getHashes('RESCUED_ALL_ARTINAE');
const dysusHashes = getHashes('RESCUED_ALL_DYSUS2024');

console.log(`RESCUED_ALL_ARTINAE total: ${artinaeHashes.size}`);
console.log(`RESCUED_ALL_DYSUS2024 total: ${dysusHashes.size}`);

let sharedCount = 0;
for (let [hash, artinaeFile] of artinaeHashes.entries()) {
    if (dysusHashes.has(hash)) {
        sharedCount++;
        console.log(`[SHARED SESSION #${sharedCount}]`);
        console.log(`   Artinae:   ${artinaeFile}`);
        console.log(`   Dysus2024: ${dysusHashes.get(hash)}`);
    }
}

console.log(`\nTotal cross-account shared sessions between Artinae and Dysus2024: ${sharedCount}`);
