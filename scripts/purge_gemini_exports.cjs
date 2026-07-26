const fs = require('fs');
const path = require('path');

const VAULT_DIRS = [
    path.join('C:', 'MneOS', '_SESSION_EXPORTS'),
    path.join('G:', 'My Drive', 'MneOS_Memory_Vault')
];

let totalPurged = 0;

console.log("[MneOS Gemini Purge] Purging all GEMINI_* session export files for a fresh pass...");

VAULT_DIRS.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        if (file.startsWith('GEMINI_') && file.endsWith('.md')) {
            try {
                fs.unlinkSync(path.join(dir, file));
                totalPurged++;
            } catch(e) {
                console.error(`Failed to delete ${file}:`, e.message);
            }
        }
    });
});

console.log(`[MneOS Gemini Purge] Complete! Purged ${totalPurged} GEMINI export files.`);
