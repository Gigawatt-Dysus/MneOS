const fs = require('fs');
const path = require('path');

const gDrive = path.join('G:', 'My Drive', 'MneOS_Memory_Vault');
const lDrive = path.join('C:', 'MneOS', '_SESSION_EXPORTS');

[gDrive, lDrive].forEach(vaultDir => {
    if (!fs.existsSync(vaultDir)) return;
    const indexDir = path.join(vaultDir, '_INDEXES');
    if (!fs.existsSync(indexDir)) fs.mkdirSync(indexDir, { recursive: true });

    const files = fs.readdirSync(vaultDir);
    files.forEach(f => {
        if (f.startsWith('00_') || f.startsWith('INDEX_')) {
            const src = path.join(vaultDir, f);
            const dest = path.join(indexDir, f);
            try {
                fs.renameSync(src, dest);
                console.log(`Moved ${f} to ${indexDir}`);
            } catch (e) {
                console.warn(`Failed to move ${f}:`, e.message);
            }
        }
    });
});
