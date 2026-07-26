/**
 * [ZEN RESCUE MISSION] Phase 2: Media Salvage (Corrected Bucket)
 * Downloads all physical photos and videos from the suspended Firebase Storage
 * using the corrected .firebasestorage.app bucket name.
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// 1. Load the Skeleton Key
const serviceAccountPath = path.resolve('c:/Users/artin/Documents/Project-GIGI-Firebase/Project-GIGI/serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: "gigi-time-machine.firebasestorage.app"
    });
}

const bucket = admin.storage().bucket();
const deepDir = 'rescue_data_deep';
const rescueMediaDir = 'rescue_media';

if (!fs.existsSync(rescueMediaDir)) fs.mkdirSync(rescueMediaDir);

async function salvageMedia() {
    console.log("📂 [SALVAGE] Initiating Media Artifact Salvage (New Bucket)...");
    
    const userDirs = fs.readdirSync(deepDir);
    let totalCount = 0;
    let downloadedCount = 0;
    let errorCount = 0;

    for (const userId of userDirs) {
        const mediaPath = path.join(deepDir, userId, 'media.json');
        if (fs.existsSync(mediaPath)) {
            totalCount += JSON.parse(fs.readFileSync(mediaPath, 'utf8')).length;
        }
    }

    console.log(`📊 [SALVAGE] Found ${totalCount} artifacts to download.\n`);

    for (const userId of userDirs) {
        const mediaPath = path.join(deepDir, userId, 'media.json');
        if (!fs.existsSync(mediaPath)) continue;

        const mediaList = JSON.parse(fs.readFileSync(mediaPath, 'utf8'));
        const userMediaDir = path.join(rescueMediaDir, userId);
        if (!fs.existsSync(userMediaDir)) fs.mkdirSync(userMediaDir);

        for (const item of mediaList) {
            const storagePath = item.storagePath;
            if (!storagePath) continue;

            const fileName = path.basename(storagePath);
            const localPath = path.join(userMediaDir, fileName);

            try {
                // Check if already downloaded to save time/bandwidth
                if (fs.existsSync(localPath)) {
                    downloadedCount++;
                    continue;
                }

                const file = bucket.file(storagePath);
                const [exists] = await file.exists();
                
                if (exists) {
                    await file.download({ destination: localPath });
                    downloadedCount++;
                    if (downloadedCount % 50 === 0) {
                        console.log(`🚀 [PROGRESS] ${downloadedCount}/${totalCount} files secured (${Math.round((downloadedCount/totalCount)*100)}%)`);
                    }
                } else {
                    errorCount++;
                }
            } catch (err) {
                console.error(`❌ [SALVAGE] Error for ${storagePath}:`, err.message);
                errorCount++;
            }
        }
    }

    console.log(`\n💎 [SALVAGE] Complete. ${downloadedCount} files secured. ${errorCount} errors.`);
    process.exit(0);
}

salvageMedia();
