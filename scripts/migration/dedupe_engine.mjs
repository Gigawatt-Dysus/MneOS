import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ==========================================
// CONFIGURATION
// ==========================================
const args = process.argv.slice(2).filter(arg => arg !== '--dry-run');
const TARGET_DIR = args[0] || "I:\\LifeOS_Archive";
const QUARANTINE_DIR = path.join(TARGET_DIR, "DUPLICATE_QUARANTINE");
const LEDGER_FILE = path.join(TARGET_DIR, "duplicates_report.json");
const IS_DRY_RUN = process.argv.includes('--dry-run');

console.log(`\n=========================================`);
console.log(`[INIT] High-Speed Tri-Stage Deduplication Engine`);
console.log(`[INIT] Target: ${TARGET_DIR}`);
console.log(`[INIT] Mode: ${IS_DRY_RUN ? 'DRY RUN' : 'PRODUCTION (Will move files)'}`);
console.log(`=========================================\n`);

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

// Asynchronous directory walker
async function walkDir(dir) {
    let results = [];
    try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (let entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            // Skip the quarantine directory and system volumes
            if (fullPath === QUARANTINE_DIR || entry.name.includes('$RECYCLE.BIN') || entry.name.includes('System Volume Information')) {
                continue;
            }

            if (entry.isDirectory()) {
                results = results.concat(await walkDir(fullPath));
            } else {
                results.push(fullPath);
            }
        }
    } catch (e) {
        // Ignore permission errors on specific deep directories
    }
    return results;
}

// Compute hash of the first 8KB (Stage 2)
function getPartialHash(filePath, bytes = 8192) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath, { start: 0, end: bytes - 1 });
        stream.on('error', err => resolve(null)); // On read error, ignore safely
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

// Compute full file hash (Stage 3)
function getFullHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => resolve(null));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

// Ensure directory exists
async function ensureDir(dirPath) {
    try {
        await fs.promises.access(dirPath);
    } catch {
        await fs.promises.mkdir(dirPath, { recursive: true });
    }
}

// Logic to determine which file is the "Original" vs "Duplicate"
function scoreOriginality(filePath) {
    const filename = path.basename(filePath).toLowerCase();
    let penalty = 0;
    
    // Penalize files with (1), (2), etc. common in Google Takeout duplicates
    if (/\(\d+\)/.test(filename)) penalty += 100;
    if (filename.includes('copy')) penalty += 50;
    if (filename.includes('edited')) penalty += 20;

    // Favor shorter paths (usually higher up the tree / more organized)
    penalty += filePath.length; 

    return penalty;
}

// ==========================================
// MAIN ENGINE
// ==========================================
async function main() {
    // -----------------------------------------------------
    // STAGE 0: Discovery
    // -----------------------------------------------------
    console.log(`[STAGE 0] Discovering all files... (This takes a moment)`);
    const allFiles = await walkDir(TARGET_DIR);
    console.log(`[STAGE 0] Found ${allFiles.length} total files.`);

    // -----------------------------------------------------
    // STAGE 1: The Size Filter (Instant Math)
    // -----------------------------------------------------
    console.log(`\n[STAGE 1] Grouping files by exact byte size...`);
    const sizeMap = new Map(); // size -> array of filePaths
    
    let processed = 0;
    for (const filePath of allFiles) {
        try {
            const stats = await fs.promises.stat(filePath);
            const size = stats.size;
            
            // Ignore 0-byte files
            if (size === 0) continue;

            if (!sizeMap.has(size)) sizeMap.set(size, []);
            sizeMap.get(size).push(filePath);
        } catch (e) {}
        
        processed++;
        if (processed % 100000 === 0) console.log(`  ...mapped sizes for ${processed}/${allFiles.length} files...`);
    }

    // Filter down to only groups that have > 1 file
    const sizeCollisions = Array.from(sizeMap.values()).filter(group => group.length > 1);
    let candidateCount = sizeCollisions.reduce((acc, g) => acc + g.length, 0);
    
    console.log(`[STAGE 1] Size filter complete!`);
    console.log(`[STAGE 1] Eliminated ${allFiles.length - candidateCount} mathematically unique files.`);
    console.log(`[STAGE 1] Proceeding with ${candidateCount} potential duplicates across ${sizeCollisions.length} size-groups.`);

    if (candidateCount === 0) {
        console.log(`[DONE] No duplicates found! Your archive is completely unique.`);
        return;
    }

    // -----------------------------------------------------
    // STAGE 2: The Partial Hash (First 8KB)
    // -----------------------------------------------------
    console.log(`\n[STAGE 2] Generating partial header hashes (8KB) for potential duplicates...`);
    const partialHashGroups = []; // Array of groups of filePaths
    
    let groupCounter = 0;
    for (const group of sizeCollisions) {
        const partialMap = new Map(); // hash -> array of filePaths
        for (const filePath of group) {
            const hash = await getPartialHash(filePath, 8192);
            if (hash) {
                if (!partialMap.has(hash)) partialMap.set(hash, []);
                partialMap.get(hash).push(filePath);
            }
        }
        
        // Filter sub-groups
        for (const subGroup of partialMap.values()) {
            if (subGroup.length > 1) {
                partialHashGroups.push(subGroup);
            }
        }
        
        groupCounter++;
        if (groupCounter % 10000 === 0) console.log(`  ...processed ${groupCounter}/${sizeCollisions.length} size-groups...`);
    }

    let deepCandidateCount = partialHashGroups.reduce((acc, g) => acc + g.length, 0);
    console.log(`[STAGE 2] Partial Hash complete! Proceeding with ${deepCandidateCount} deep-match candidates.`);

    // -----------------------------------------------------
    // STAGE 3: Full Cryptographic Hash
    // -----------------------------------------------------
    console.log(`\n[STAGE 3] Performing full SHA-256 byte-for-byte hashes on survivors...`);
    const finalDuplicateGroups = [];
    
    groupCounter = 0;
    let bytesHashed = 0;
    
    for (const group of partialHashGroups) {
        const fullMap = new Map(); // hash -> array of filePaths
        for (const filePath of group) {
            const hash = await getFullHash(filePath);
            if (hash) {
                if (!fullMap.has(hash)) fullMap.set(hash, []);
                fullMap.get(hash).push(filePath);
                
                // Track bytes for UI
                try {
                    const st = await fs.promises.stat(filePath);
                    bytesHashed += st.size;
                } catch(e){}
            }
        }
        
        for (const subGroup of fullMap.values()) {
            if (subGroup.length > 1) {
                finalDuplicateGroups.push(subGroup);
            }
        }
        
        groupCounter++;
        if (groupCounter % 500 === 0) console.log(`  ...hashed ${groupCounter}/${partialHashGroups.length} partial-groups...`);
    }
    
    console.log(`[STAGE 3] Full Hash complete! Evaluated ${((bytesHashed)/1024/1024/1024).toFixed(2)} GB of candidate data.`);

    // -----------------------------------------------------
    // RESOLUTION & QUARANTINE
    // -----------------------------------------------------
    let totalDuplicatesMoved = 0;
    let spaceSaved = 0;
    const ledger = {};

    if (!IS_DRY_RUN && finalDuplicateGroups.length > 0) {
        await ensureDir(QUARANTINE_DIR);
    }

    console.log(`\n[RESOLUTION] Evaluating exact clones and assigning 'Original' status...`);

    for (const group of finalDuplicateGroups) {
        // Sort the group by "originality" penalty. The lowest penalty is index 0.
        const sortedGroup = group.sort((a, b) => scoreOriginality(a) - scoreOriginality(b));
        
        const original = sortedGroup[0];
        const duplicates = sortedGroup.slice(1);
        
        ledger[original] = duplicates;

        for (const dupe of duplicates) {
            try {
                const stat = await fs.promises.stat(dupe);
                spaceSaved += stat.size;
                
                if (!IS_DRY_RUN) {
                    // Recreate relative directory structure in Quarantine to avoid flat-folder collisions
                    const relativePath = path.relative(TARGET_DIR, dupe);
                    const destPath = path.join(QUARANTINE_DIR, relativePath);
                    await ensureDir(path.dirname(destPath));
                    
                    // Move the file
                    await fs.promises.rename(dupe, destPath);
                }
                
                totalDuplicatesMoved++;
            } catch (e) {
                console.error(`[ERROR] Failed to process duplicate ${dupe}:`, e.message);
            }
        }
    }

    // Write Ledger
    if (finalDuplicateGroups.length > 0) {
        await fs.promises.writeFile(LEDGER_FILE, JSON.stringify(ledger, null, 2), 'utf-8');
    }

    // -----------------------------------------------------
    // SUMMARY
    // -----------------------------------------------------
    console.log(`\n=========================================`);
    console.log(`[DONE] Deduplication Complete!`);
    console.log(`[STATS] Sets of Clones Found: ${finalDuplicateGroups.length}`);
    console.log(`[STATS] Total Duplicate Files: ${totalDuplicatesMoved}`);
    console.log(`[STATS] Total Space Reclaimed: ${(spaceSaved / 1024 / 1024 / 1024).toFixed(2)} GB`);
    
    if (IS_DRY_RUN) {
        console.log(`\n[NOTE] This was a DRY RUN. No files were actually moved.`);
        console.log(`[NOTE] Run the script without '--dry-run' to execute the quarantine.`);
    } else {
        console.log(`\n[SUCCESS] Duplicates have been moved to: ${QUARANTINE_DIR}`);
        console.log(`[SUCCESS] Audit ledger saved to: ${LEDGER_FILE}`);
    }
    console.log(`=========================================\n`);
}

main().catch(err => {
    console.error("[FATAL ERROR]", err);
    process.exit(1);
});
