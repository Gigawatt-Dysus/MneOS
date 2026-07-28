/**
 * 🧹 MneOS SHA-256 Media Deduplication & Link Reconciliation Engine
 * Calculates binary SHA-256 checksums for all media files in public/media_vault and
 * Takeout extracted attachments, identifies duplicate files, selects a single canonical
 * primary file for each unique binary hash, deletes duplicate physical files, and updates all
 * session Markdown (.md) and JSON (.json) files in RESCUED_ALL so links point to the canonical copy.
 * 
 * Usage: node scripts/dedupe_media_vault.cjs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEDIA_VAULT_DIR = path.join(__dirname, '..', 'public', 'media_vault');
const RESCUED_ALL_DIR = path.join(__dirname, '..', 'RESCUED_ALL');
const TAKEOUT_ATTACHMENTS_DIR = path.join(__dirname, '..', 'scratch', 'dysus2024_sessions_extracted', 'Takeout', 'My Activity', 'Gemini Apps');

function computeSHA256(filePath) {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function runDeduplication() {
    console.log(`\n🧹 Starting MneOS SHA-256 Media Deduplication Engine...`);
    console.log(`📁 Media Vault: ${MEDIA_VAULT_DIR}`);
    console.log(`📁 Rescued Vault: ${RESCUED_ALL_DIR}\n`);

    if (!fs.existsSync(MEDIA_VAULT_DIR)) {
        fs.mkdirSync(MEDIA_VAULT_DIR, { recursive: true });
    }

    // Step 1: Copy unique Takeout attachments from all scratch folders to public/media_vault if missing
    const scratchDir = path.join(__dirname, '..', 'scratch');
    if (fs.existsSync(scratchDir)) {
        console.log(`📦 Scanning all Takeout attachment folders in scratch...`);
        let totalCopied = 0;
        const scratchEntries = fs.readdirSync(scratchDir);
        for (const entry of scratchEntries) {
            const appDir = path.join(scratchDir, entry, 'Takeout', 'My Activity', 'Gemini Apps');
            if (fs.existsSync(appDir)) {
                const takeoutFiles = fs.readdirSync(appDir);
                let copiedCount = 0;
                for (const file of takeoutFiles) {
                    const ext = path.extname(file).toLowerCase();
                    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.mp4', '.webm', '.txt', '.rtf'].includes(ext)) {
                        const srcPath = path.join(appDir, file);
                        const destPath = path.join(MEDIA_VAULT_DIR, file);
                        if (!fs.existsSync(destPath)) {
                            fs.copyFileSync(srcPath, destPath);
                            copiedCount++;
                        }
                    }
                }
                console.log(`  [+] Copied ${copiedCount} attachments from ${entry}...`);
                totalCopied += copiedCount;
            }
        }
    }

    // Step 2: Index all media files by SHA-256 checksum
    const mediaFiles = fs.readdirSync(MEDIA_VAULT_DIR);
    console.log(`\n🔍 Hashing ${mediaFiles.length} media files using SHA-256...`);

    const hashMap = new Map(); // sha256 -> Array of file objects
    let totalBytesScanned = 0;

    for (const fileName of mediaFiles) {
        const filePath = path.join(MEDIA_VAULT_DIR, fileName);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) continue;

        totalBytesScanned += stats.size;
        try {
            const hash = computeSHA256(filePath);
            if (!hashMap.has(hash)) {
                hashMap.set(hash, []);
            }
            hashMap.get(hash).push({
                fileName,
                filePath,
                size: stats.size,
                created: stats.birthtimeMs
            });
        } catch (e) {
            console.warn(`  [!] Error hashing ${fileName}: ${e.message}`);
        }
    }

    console.log(`📊 Scanned ${(totalBytesScanned / (1024 * 1024)).toFixed(2)} MB across ${mediaFiles.length} files.`);
    console.log(`✨ Unique Media Count: ${hashMap.size}`);

    // Step 3: Map duplicates to canonical primary files and prepare deletion list
    const replacementMap = new Map(); // duplicateFileName -> canonicalFileName
    const filesToDelete = [];
    let duplicateGroupCount = 0;
    let savedBytes = 0;

    for (const [hash, fileList] of hashMap.entries()) {
        if (fileList.length > 1) {
            duplicateGroupCount++;
            // Sort to pick cleanest/shortest/oldest filename as canonical
            fileList.sort((a, b) => {
                // Prefer shorter names without hash suffixes if possible
                if (a.fileName.length !== b.fileName.length) return a.fileName.length - b.fileName.length;
                return a.created - b.created;
            });

            const canonical = fileList[0];
            const duplicates = fileList.slice(1);

            for (const dup of duplicates) {
                replacementMap.set(dup.fileName, canonical.fileName);
                filesToDelete.push(dup.filePath);
                savedBytes += dup.size;
            }
        }
    }

    console.log(`\n⚡ Found ${duplicateGroupCount} duplicate clusters (${replacementMap.size} redundant files).`);
    console.log(`💾 Disk space to recover: ${(savedBytes / (1024 * 1024)).toFixed(2)} MB`);

    if (replacementMap.size === 0) {
        console.log(`🎉 Vault is already 100% deduplicated! No duplicate media found.`);
        return;
    }

    // Step 4: Reconcile references in RESCUED_ALL Markdown & JSON files
    console.log(`\n🔄 Reconciling references across RESCUED_ALL session files...`);
    const sessionFiles = fs.readdirSync(RESCUED_ALL_DIR).filter(f => f.endsWith('.md') || f.endsWith('.json'));
    let updatedSessionCount = 0;
    let totalReplacementsMade = 0;

    for (const sFile of sessionFiles) {
        const sPath = path.join(RESCUED_ALL_DIR, sFile);
        let content = fs.readFileSync(sPath, 'utf8');
        let fileModified = false;

        for (const [dupName, canonicalName] of replacementMap.entries()) {
            if (content.includes(dupName)) {
                content = content.replaceAll(dupName, canonicalName);
                fileModified = true;
                totalReplacementsMade++;
            }
        }

        if (fileModified) {
            fs.writeFileSync(sPath, content, 'utf8');
            updatedSessionCount++;
        }
    }

    console.log(`  [✔] Updated ${updatedSessionCount} session files with canonical media links (${totalReplacementsMade} URL replacements).`);

    // Step 5: Delete duplicate physical files
    console.log(`\n🗑️ Deleting ${filesToDelete.length} physical duplicate files from disk...`);
    let deletedCount = 0;
    for (const delPath of filesToDelete) {
        try {
            fs.unlinkSync(delPath);
            deletedCount++;
        } catch (e) {
            console.warn(`  [!] Deletion failed for ${path.basename(delPath)}: ${e.message}`);
        }
    }

    console.log(`\n🎉 SHA-256 Deduplication Complete!`);
    console.log(`  - Files Deleted: ${deletedCount}`);
    console.log(`  - Space Recovered: ${(savedBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`  - Unique Media Preserved in public/media_vault: ${hashMap.size}`);
}

runDeduplication();
