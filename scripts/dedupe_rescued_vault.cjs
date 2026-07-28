const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GEMINI_BASE_DIR = path.join('C:', 'MneOS', '_SESSION_EXPORTS', 'GEMINI_SESSIONS');
const DUPES_BACKUP_DIR = path.join(GEMINI_BASE_DIR, '_DUPES_BACKUP');

if (!fs.existsSync(DUPES_BACKUP_DIR)) {
    fs.mkdirSync(DUPES_BACKUP_DIR, { recursive: true });
}

function normalizeContent(str) {
    const lines = str.split('\n');
    const contentLines = lines.filter(l => !l.startsWith('# GEMINI Rescued Session Log:') && !l.startsWith('# Session ID:') && !l.startsWith('# Category:') && !l.startsWith('# Date:'));
    return contentLines.join('\n').trim();
}

function hashContent(str) {
    const norm = normalizeContent(str);
    return crypto.createHash('sha256').update(norm).digest('hex');
}

function dedupeDirectory(dirName) {
    const targetDir = path.join(GEMINI_BASE_DIR, dirName);
    console.log(`\n================================================================`);
    console.log(`🧹 Processing Vault Directory: [${dirName}]`);
    console.log(`================================================================`);

    if (!fs.existsSync(targetDir)) {
        console.log(`[Dedupe] Directory does not exist: ${targetDir}`);
        return;
    }

    const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.md'));
    console.log(`[Dedupe] Found ${files.length} markdown files in ${dirName}.`);

    const hashMap = new Map();
    let dupeCount = 0;
    let uniqueCount = 0;

    files.forEach(filename => {
        const filePath = path.join(targetDir, filename);
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const contentHash = hashContent(raw);

            if (hashMap.has(contentHash)) {
                dupeCount++;
                const existingFile = hashMap.get(contentHash);
                console.log(`[DUPLICATE #${dupeCount}]`);
                console.log(`   Keeper: ${existingFile}`);
                console.log(`   Dupe:   ${filename}`);

                // Move duplicate file to DUPES_BACKUP_DIR
                const destPath = path.join(DUPES_BACKUP_DIR, `${dirName}_${filename}`);
                fs.renameSync(filePath, destPath);
            } else {
                hashMap.set(contentHash, filename);
                uniqueCount++;
            }
        } catch(e) {
            console.error(`[Dedupe] Error processing ${filename}:`, e.message);
        }
    });

    console.log(`----------------------------------------------------------------`);
    console.log(`🎉 [${dirName}] Deduplication Complete!`);
    console.log(`   Total Scanned:  ${files.length}`);
    console.log(`   Unique Retained: ${uniqueCount}`);
    console.log(`   Dupes Removed:  ${dupeCount}`);
    console.log(`----------------------------------------------------------------`);
}

const dirsToScan = ['RESCUED_ALL', 'RESCUED_ALL_DYSUS2024', 'RESCUED_ALL_ARTINAE'];
dirsToScan.forEach(d => dedupeDirectory(d));
