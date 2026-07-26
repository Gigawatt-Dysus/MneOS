/**
 * LifeOS Takeout Date Recovery Script
 * 
 * Re-pairs orphaned AVIs and JPEGs in `date-unknown` with their JSON timestamps from 
 * the raw Google Takeout directory, applies correct mtime, and files them into YYYY/MM folders.
 */

import fs from 'fs/promises';
import path from 'path';

const TAKEOUT_DIR = 'I:\\LifeOS_Archive\\Lifeboat_Extracted\\Takeout';
const UNKNOWN_DIR = 'I:\\LifeOS_Archive\\ALL_PHOTOS\\date-unknown';
const RECOVERED_DIR = 'I:\\LifeOS_Archive\\ALL_PHOTOS\\date-recovered';

// Use process arguments for dry run
const isDryRun = process.argv.includes('--dry-run');

// Map: Cleaned Filename -> Array of Timestamps (Seconds)
const jsonMap = new Map();

/**
 * Normalizes filenames by removing gpth (1)(1) duplicate markers, -edited, etc.
 */
function cleanFilename(filename) {
    let cleaned = filename;
    
    // Remove all (1), (2) duplicate markers appended by gpth recursively
    while (cleaned.match(/\(\d+\)\./)) {
        cleaned = cleaned.replace(/\(\d+\)\./, '.');
    }
    
    // Some Takeout files are marked as -edited. We generally want to match the base file.
    cleaned = cleaned.replace(/-edited\./, '.');

    return cleaned;
}

/**
 * Scans directories recursively for .json files
 */
async function scanForJson(dir) {
    let files = [];
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
                // entry.parentPath is available in Node 20.1+ 
                // However, older versions return entry.path instead of parentPath. Let's handle both.
                const parentDir = entry.parentPath || entry.path;
                files.push(path.join(parentDir, entry.name));
            }
        }
    } catch (e) {
        console.warn(`[WARN] Could not read directory ${dir}: ${e.message}`);
    }
    return files;
}

async function main() {
    console.log(`[INIT] Starting Date Recovery for Takeout...`);
    if (isDryRun) console.log(`[MODE] DRY RUN ENABLED - No files will be modified or moved.`);
    
    console.log(`[SCAN] Searching for JSON metadata in ${TAKEOUT_DIR}... (This may take a minute)`);
    const jsonFiles = await scanForJson(TAKEOUT_DIR);
    console.log(`[SCAN] Found ${jsonFiles.length} JSON files. Parsing...`);

    let parsedCount = 0;
    
    const batchSize = 20;
    for (let i = 0; i < jsonFiles.length; i += batchSize) {
        const batch = jsonFiles.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (file) => {
            try {
                const data = await fs.readFile(file, 'utf8');
                const parsed = JSON.parse(data);
                
                if (parsed.title && parsed.photoTakenTime && parsed.photoTakenTime.timestamp) {
                    const title = cleanFilename(parsed.title);
                    const timestamp = parseInt(parsed.photoTakenTime.timestamp, 10);
                    
                    if (!jsonMap.has(title)) {
                        jsonMap.set(title, []);
                    }
                    jsonMap.get(title).push(timestamp);
                    parsedCount++;
                }
            } catch (e) {
                // Ignore badly formed JSON or permission errors quietly
            }
        }));

        // Progress logging every 10k
        if (i + batchSize >= 10000 && (i + batchSize) % 10000 === 0) {
            console.log(`  ...parsed ${i + batchSize}/${jsonFiles.length} JSONs...`);
        }
    }
    
    console.log(`[MAP] Successfully mapped ${parsedCount} valid photo timestamps across ${jsonMap.size} unique filenames.`);
    console.log(`[REPAIR] Scanning orphaned files in ${UNKNOWN_DIR}...`);

    let orphanFiles = [];
    try {
        orphanFiles = await fs.readdir(UNKNOWN_DIR);
    } catch (e) {
        console.error(`[FATAL] Cannot read date-unknown directory: ${e.message}`);
        process.exit(1);
    }
    
    console.log(`[REPAIR] Found ${orphanFiles.length} orphaned files to process.`);
    
    let successCount = 0;
    let missingCount = 0;
    
    if (!isDryRun) {
        await fs.mkdir(RECOVERED_DIR, { recursive: true });
    }

    for (const orphan of orphanFiles) {
        const fullOrphanPath = path.join(UNKNOWN_DIR, orphan);
        const cleanedName = cleanFilename(orphan);
        
        const timestamps = jsonMap.get(cleanedName);
        
        if (timestamps && timestamps.length > 0) {
            // Pick the most recent timestamp if there are multiple. 
            // Better to assume a more recent event if colliding, or we could just pick the first.
            // We'll just sort descending and take [0]
            timestamps.sort((a, b) => b - a);
            const chosenTimestamp = timestamps[0];
            
            const date = new Date(chosenTimestamp * 1000);
            
            // Format YYYY/MM
            const year = date.getFullYear().toString();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const targetFolder = path.join(RECOVERED_DIR, year, month);
            
            // Output path
            const destPath = path.join(targetFolder, orphan); // keep original name (with (1)) to prevent overwrites
            
            if (!isDryRun) {
                await fs.mkdir(targetFolder, { recursive: true });
                
                // Update file timestamps (atime, mtime)
                await fs.utimes(fullOrphanPath, date, date);
                
                // Move file
                await fs.rename(fullOrphanPath, destPath);
            }
            successCount++;
            
            if (timestamps.length > 1 && successCount % 100 === 0) {
                // Occasional conflict logging
                console.log(`  [CONFLICT] ${orphan} matched ${timestamps.length} different JSON dates. Used most recent: ${year}/${month}`);
            }
        } else {
            missingCount++;
        }
    }

    console.log(`\n=========================================`);
    console.log(`[DONE] Recovery Complete!`);
    console.log(`[STATS] Successfully Recovered & Moved: ${successCount}`);
    console.log(`[STATS] Still Unknown (No JSON Found): ${missingCount}`);
    if (isDryRun) {
        console.log(`[NOTE] This was a DRY RUN. Run again without --dry-run to apply changes.`);
    }
    console.log(`=========================================\n`);
}

main().catch(e => console.error(`[FATAL] Error in main loop: ${e.message}`));
