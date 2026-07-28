const fs = require('fs');
const path = require('path');

const LOCAL_VAULT = path.join('C:', 'MneOS', '_SESSION_EXPORTS', 'GEMINI_SESSIONS', 'RESCUED_ALL');
const GDRIVE_VAULT = path.join('G:', 'My Drive', 'MneOS_Memory_Vault', 'GEMINI_SESSIONS', 'RESCUED_ALL');

const RED_HERRING_SIGNATURES = [
    'initial-scale=1,minimum-scale=1',
    'Google Sans Flex',
    'landing/a/i18n',
    'fur baby, Finn',
    'sci-fi books',
    'Neo-Glam Revival'
];

function purgeDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        console.log(`[Purge] Directory does not exist: ${dirPath}`);
        return;
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
    let purgedCount = 0;

    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const isRedHerring = RED_HERRING_SIGNATURES.some(sig => content.includes(sig));
            
            if (isRedHerring) {
                fs.unlinkSync(filePath);
                console.log(`[Purge] 💥 Deleted fake session: ${file}`);
                purgedCount++;
            }
        } catch (e) {
            console.warn(`[Purge] Failed to check/delete ${file}:`, e.message);
        }
    });

    console.log(`[Purge] Finished ${dirPath}: Purged ${purgedCount} fake files.`);
}

console.log('[Purge] Starting Red-Herring Vault Purge...');
purgeDirectory(LOCAL_VAULT);
purgeDirectory(GDRIVE_VAULT);
console.log('[Purge] Purge complete.');
