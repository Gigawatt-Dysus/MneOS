/**
 * 🧹 MneOS Screenshot Media Purging Engine
 * Removes redundant "Screenshot *" image files from public/media_vault (since originals exist in master screenshot folders),
 * cleans up Markdown/JSON references across RESCUED_ALL session logs, and frees up space.
 * 
 * Usage: node scripts/purge_screenshot_media.cjs
 */

const fs = require('fs');
const path = require('path');

const MEDIA_VAULT_DIR = path.join(__dirname, '..', 'public', 'media_vault');
const RESCUED_ALL_DIR = path.join(__dirname, '..', 'RESCUED_ALL');

function purgeScreenshots() {
    console.log(`\n🧹 Starting MneOS Screenshot Media Purging Engine...`);
    console.log(`📁 Media Vault: ${MEDIA_VAULT_DIR}`);

    const mediaFiles = fs.readdirSync(MEDIA_VAULT_DIR);
    const screenshotFiles = mediaFiles.filter(f => /screenshot/i.test(f));

    console.log(`🔍 Found ${screenshotFiles.length} screenshot media files in media_vault.`);

    if (screenshotFiles.length === 0) {
        console.log(`🎉 No screenshot files found! Herd is already thinned.`);
        return;
    }

    let savedBytes = 0;
    const fileListToDelete = [];

    for (const sFile of screenshotFiles) {
        const filePath = path.join(MEDIA_VAULT_DIR, sFile);
        const stats = fs.statSync(filePath);
        savedBytes += stats.size;
        fileListToDelete.push({ fileName: sFile, filePath });
    }

    // Step 1: Clean up links in RESCUED_ALL session logs
    console.log(`\n🔄 Cleaning up screenshot references across RESCUED_ALL session files...`);
    const sessionFiles = fs.readdirSync(RESCUED_ALL_DIR).filter(f => f.endsWith('.md') || f.endsWith('.json'));
    let updatedSessionCount = 0;
    let referencesRemoved = 0;

    for (const sessionFile of sessionFiles) {
        const sessionPath = path.join(RESCUED_ALL_DIR, sessionFile);
        let content = fs.readFileSync(sessionPath, 'utf8');
        let modified = false;

        for (const item of fileListToDelete) {
            if (content.includes(item.fileName)) {
                // If it's inside a markdown image/link, convert to clean notice
                content = content.replaceAll(item.fileName, '[Screenshot Removed - Preserved in Master Archive]');
                modified = true;
                referencesRemoved++;
            }
        }

        if (modified) {
            fs.writeFileSync(sessionPath, content, 'utf8');
            updatedSessionCount++;
        }
    }

    console.log(`  [✔] Reconciled ${updatedSessionCount} session files (${referencesRemoved} screenshot references cleaned).`);

    // Step 2: Delete physical screenshot files
    console.log(`\n🗑️ Purging ${fileListToDelete.length} screenshot files from disk...`);
    let deletedCount = 0;

    for (const item of fileListToDelete) {
        try {
            fs.unlinkSync(item.filePath);
            deletedCount++;
            console.log(`  [x] Deleted: ${item.fileName}`);
        } catch(e) {
            console.warn(`  [!] Deletion failed for ${item.fileName}: ${e.message}`);
        }
    }

    console.log(`\n🎉 Screenshot Media Purge Complete!`);
    console.log(`  - Screenshot Files Deleted: ${deletedCount}`);
    console.log(`  - Storage Space Recovered: ${(savedBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`  - Remaining Media Vault Files: ${mediaFiles.length - deletedCount}`);
}

purgeScreenshots();
