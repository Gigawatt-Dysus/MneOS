const fs = require('fs');
const path = require('path');

const VAULT_DIRS = [
    path.join('C:', 'MneOS', '_SESSION_EXPORTS'),
    path.join('G:', 'My Drive', 'MneOS_Memory_Vault')
];

const MEDIA_KEYWORDS = [
    'portrait',
    'photorealistic',
    'realistic',
    'generation',
    'animation',
    'pillow',
    'freckled',
    'face',
    'video',
    'image',
    'picture',
    'illustration',
    'draw',
    'sketch',
    'wallpaper',
    'avatar',
    'nan_banana',
    'nanbanana'
];

console.log("[MneOS Vault Cleaner] Scanning for Media/Image/Video generation export files...");

let purgedCount = 0;

VAULT_DIRS.forEach(dir => {
    if (!fs.existsSync(dir)) {
        console.warn(`Directory not found: ${dir}`);
        return;
    }

    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const lowerName = file.toLowerCase();
        const matchesKeyword = MEDIA_KEYWORDS.some(kw => lowerName.includes(kw));

        if (matchesKeyword && file.endsWith('.md')) {
            const fullPath = path.join(dir, file);
            try {
                fs.unlinkSync(fullPath);
                console.log(`[Purged] Deleted media session file: ${file} from ${dir}`);
                purgedCount++;
            } catch(e) {
                console.error(`Failed to delete ${fullPath}:`, e.message);
            }
        }
    });
});

console.log(`\n[MneOS Vault Cleaner] Complete! Purged ${purgedCount} media generation files from local & Google Drive vaults.`);
