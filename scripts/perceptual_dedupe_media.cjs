/**
 * 👁️ MneOS Visual Perceptual Image Deduplication & Link Reconciliation Engine
 * Uses Sharp to calculate 64-bit Difference Hashes (dHash) and resolution quality for all images
 * in public/media_vault. Identifies visually identical images (even across different sizes, resolutions,
 * or JPEG compression levels), selects the HIGHEST RESOLUTION image as the canonical master, deletes all
 * lower-res/duplicate files, and updates all session links in RESCUED_ALL.
 * 
 * Usage: node scripts/perceptual_dedupe_media.cjs
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');

const MEDIA_VAULT_DIR = path.join(__dirname, '..', 'public', 'media_vault');
const RESCUED_ALL_DIR = path.join(__dirname, '..', 'RESCUED_ALL');

// Compute 64-bit Difference Hash (dHash) for an image
async function computeDHashAndMeta(filePath) {
    try {
        const metadata = await sharp(filePath).metadata();
        // Resize to 9x8 grayscale for difference hashing (8x8 differences = 64 bits)
        const buffer = await sharp(filePath)
            .resize(9, 8, { fit: 'fill' })
            .grayscale()
            .raw()
            .toBuffer();

        let dhash = '';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const left = buffer[row * 9 + col];
                const right = buffer[row * 9 + col + 1];
                dhash += left > right ? '1' : '0';
            }
        }

        const width = metadata.width || 0;
        const height = metadata.height || 0;
        const totalPixels = width * height;

        return {
            dhash,
            width,
            height,
            totalPixels,
            format: metadata.format
        };
    } catch(e) {
        return null;
    }
}

// Hamming distance between two binary dHash strings
function hammingDistance(hash1, hash2) {
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) distance++;
    }
    return distance;
}

async function runPerceptualDeduplication() {
    console.log(`\n👁️ Starting MneOS Visual Perceptual Image Deduplication Engine...`);
    console.log(`📁 Media Vault: ${MEDIA_VAULT_DIR}`);

    const files = fs.readdirSync(MEDIA_VAULT_DIR);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
    console.log(`🔍 Analyzing ${imageFiles.length} images using Sharp Perceptual dHash...`);

    const imageMetas = [];
    let processed = 0;

    for (const fileName of imageFiles) {
        const filePath = path.join(MEDIA_VAULT_DIR, fileName);
        const meta = await computeDHashAndMeta(filePath);
        if (meta) {
            imageMetas.push({
                fileName,
                filePath,
                dhash: meta.dhash,
                width: meta.width,
                height: meta.height,
                totalPixels: meta.totalPixels,
                size: fs.statSync(filePath).size
            });
        }
        processed++;
        if (processed % 100 === 0) {
            console.log(`   └─ Hashed ${processed}/${imageFiles.length} images...`);
        }
    }

    console.log(`✔ Successfully generated perceptual fingerprints for ${imageMetas.length} images.`);

    // Cluster visually identical images (dHash Hamming distance <= 4)
    const clusters = [];
    const visited = new Set();

    for (let i = 0; i < imageMetas.length; i++) {
        if (visited.has(imageMetas[i].fileName)) continue;

        const currentCluster = [imageMetas[i]];
        visited.add(imageMetas[i].fileName);

        for (let j = i + 1; j < imageMetas.length; j++) {
            if (visited.has(imageMetas[j].fileName)) continue;

            const dist = hammingDistance(imageMetas[i].dhash, imageMetas[j].dhash);
            // Distance <= 4 means visually identical (same image at different resolutions/compression)
            if (dist <= 4) {
                currentCluster.push(imageMetas[j]);
                visited.add(imageMetas[j].fileName);
            }
        }

        if (currentCluster.length > 1) {
            clusters.push(currentCluster);
        }
    }

    console.log(`\n⚡ Found ${clusters.length} visual duplicate clusters!`);

    if (clusters.length === 0) {
        console.log(`🎉 No visual duplicates found! Vault is visually unique.`);
        return;
    }

    const replacementMap = new Map(); // duplicateFileName -> masterFileName
    const filesToDelete = [];
    let savedBytes = 0;

    for (const cluster of clusters) {
        // Sort cluster so highest resolution / highest pixel count / largest file size is MASTER
        cluster.sort((a, b) => {
            if (b.totalPixels !== a.totalPixels) return b.totalPixels - a.totalPixels; // Highest resolution first
            return b.size - a.size; // Largest file size second
        });

        const master = cluster[0];
        const dupes = cluster.slice(1);

        console.log(`\n🖼️ Cluster Master: ${master.fileName} (${master.width}x${master.height}, ${(master.size/1024).toFixed(1)}KB)`);
        for (const dup of dupes) {
            console.log(`   ❌ Dupe to remove: ${dup.fileName} (${dup.width}x${dup.height}, ${(dup.size/1024).toFixed(1)}KB)`);
            replacementMap.set(dup.fileName, master.fileName);
            filesToDelete.push(dup.filePath);
            savedBytes += dup.size;
        }
    }

    console.log(`\n💾 Total Storage to Recover: ${(savedBytes / (1024 * 1024)).toFixed(2)} MB across ${replacementMap.size} files.`);

    // Reconcile references in RESCUED_ALL
    console.log(`\n🔄 Reconciling canonical links across RESCUED_ALL session files...`);
    const sessionFiles = fs.readdirSync(RESCUED_ALL_DIR).filter(f => f.endsWith('.md') || f.endsWith('.json'));
    let updatedSessions = 0;
    let replacementsCount = 0;

    for (const sFile of sessionFiles) {
        const sPath = path.join(RESCUED_ALL_DIR, sFile);
        let content = fs.readFileSync(sPath, 'utf8');
        let modified = false;

        for (const [dupName, masterName] of replacementMap.entries()) {
            if (content.includes(dupName)) {
                content = content.replaceAll(dupName, masterName);
                modified = true;
                replacementsCount++;
            }
        }

        if (modified) {
            fs.writeFileSync(sPath, content, 'utf8');
            updatedSessions++;
        }
    }

    console.log(`  [✔] Reconciled ${updatedSessions} session files (${replacementsCount} visual link replacements).`);

    // Delete duplicate physical files
    console.log(`\n🗑️ Deleting ${filesToDelete.length} visual duplicate images...`);
    let deletedCount = 0;
    for (const delPath of filesToDelete) {
        try {
            fs.unlinkSync(delPath);
            deletedCount++;
        } catch(e) {
            console.warn(`  [!] Failed to delete ${path.basename(delPath)}: ${e.message}`);
        }
    }

    console.log(`\n🎉 Visual Perceptual Deduplication Complete!`);
    console.log(`  - Visual Clusters Purged: ${clusters.length}`);
    console.log(`  - Duplicate Images Deleted: ${deletedCount}`);
    console.log(`  - Space Recovered: ${(savedBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`  - Master Images Preserved: ${imageFiles.length - deletedCount}`);
}

runPerceptualDeduplication().catch(err => console.error('Fatal error in visual deduplicator:', err));
