import { MongoClient } from 'mongodb';
import exifr from 'exifr';

const MONGO_URI = 'mongodb://zen:sovereign@100.116.12.18:27017';
const DB_NAME = 'LifeOS';
const COLLECTION_NAME = 'media';

// EXIF Orientation to Degree Mapping
const EXIF_ROTATION_MAP = {
    3: 180,
    6: 90,
    8: 270
};

async function fetchExifRotation(url) {
    try {
        // Fetch only the first 128KB of the file to save bandwidth and speed up the process
        const response = await fetch(url, { 
            headers: { Range: 'bytes=0-131071' },
            // timeout isn't natively supported in fetch without AbortController, but we can keep it simple
        });
        
        if (!response.ok && response.status !== 206) {
            throw new Error(`HTTP ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Parse just the orientation tag
        const parsed = await exifr.parse(buffer, { pick: ['Orientation'] });
        if (parsed && parsed.Orientation) {
            let orient = parsed.Orientation;
            // Depending on exifr version, it might return strings like 'Rotate 90 CW'
            // We'll normalize it using EXIF_ROTATION_MAP or string matching
            if (typeof orient === 'number') {
                return EXIF_ROTATION_MAP[orient] || 0;
            } else if (typeof orient === 'string') {
                if (orient.includes('180')) return 180;
                if (orient.includes('90 CW')) return 90;
                if (orient.includes('270 CW')) return 270;
            }
        }
        return 0; // default if no rotation found
    } catch (err) {
        // console.error(`[EXIF Error for ${url}]`, err.message);
        return -1; // -1 indicates error (e.g. file missing, not an image)
    }
}

async function run() {
    console.log(`🔌 Connecting to Sovereign Matrix...`);
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Find all images that have no rotation data
    const docs = await collection.find({
        fileType: { $regex: /^image\//i },
        url: { $exists: true, $ne: null },
        $or: [
            { rotation: 0 }, 
            { rotation: null }, 
            { rotation: { $exists: false } }
        ]
    }).toArray();

    console.log(`🎯 Found ${docs.length} unhealed images with URLs in '${COLLECTION_NAME}' collection.`);
    
    let healed = 0;
    let failed = 0;
    let alreadyUpright = 0;

    const CHUNK_SIZE = 20; // 20 concurrent HTTP requests
    
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        
        const promises = chunk.map(async (doc) => {
            const rotation = await fetchExifRotation(doc.url);
            
            if (rotation > 0) {
                // It's physically sideways! Heal it.
                await collection.updateOne(
                    { _id: doc._id },
                    { $set: { rotation: rotation } }
                );
                healed++;
                // console.log(`🪄 Healed [${doc.originalName || doc.id}]: ${rotation}°`);
            } else if (rotation === 0) {
                alreadyUpright++;
            } else {
                failed++;
            }
        });

        await Promise.all(promises);
        
        // Progress HUD
        if ((i + chunk.length) % 100 === 0 || (i + chunk.length) === docs.length) {
            console.log(`⏳ Progress: ${i + chunk.length} / ${docs.length} | Healed: ${healed} | Upright: ${alreadyUpright} | Failed: ${failed}`);
        }
    }

    console.log(`\n🎉 B2 EXIF HEAL COMPLETE`);
    console.log(`Total Scanned: ${docs.length}`);
    console.log(`Total Actually Sideways (Healed): ${healed}`);
    console.log(`Total Naturally Upright (No Action Needed): ${alreadyUpright}`);
    console.log(`Total Errors (Missing URL/Bad Header): ${failed}`);

    await client.close();
}

run().catch(console.error);
