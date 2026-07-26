import { MongoClient, ObjectId } from 'mongodb';
import exifr from 'exifr';
import fetch from 'node-fetch';

const MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017";
const DB_NAME = "LifeOS";

async function run() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('pending_accessions');

        console.log(`\n🔍 Commencing Forensic EXIF Cleanup on Collisions...\n`);

        // Find all documents
        const docs = await collection.find({}, {
            projection: { originalName: 1, url: 1, size: 1, _id: 1, rotation: 1 }
        }).toArray();
        
        // Group by originalName
        const grouped = {};
        for (let doc of docs) {
            if (!doc.originalName) continue;
            // Ignore small random names or hashes, only focus on typical camera filenames like IMG_
            if (doc.originalName.length < 10) continue;
            
            if (!grouped[doc.originalName]) grouped[doc.originalName] = [];
            grouped[doc.originalName].push(doc);
        }

        const duplicates = Object.entries(grouped).filter(([_, files]) => files.length > 1);
        console.log(`Found ${duplicates.length} duplicate groups based on originalName.`);

        const toDelete = [];

        for (const [name, files] of duplicates) {
            console.log(`\n=========================================`);
            console.log(`📄 Analyzing: ${name} (${files.length} clones)`);
            console.log(`=========================================`);
            
            const results = [];
            
            for (let i = 0; i < files.length; i++) {
                const doc = files[i];
                let hasExif = false;
                let data = null;
                
                try {
                    const res = await fetch(doc.url);
                    if (res.ok) {
                        const buffer = await res.buffer();
                        data = await exifr.parse(buffer, { gps: true, tiff: true, exif: true });
                        hasExif = !!data;
                    }
                } catch (e) {
                    console.log(`  - Clone ${i+1} EXIF Parse Error: ${e.message}`);
                }
                
                results.push({
                    doc,
                    index: i + 1,
                    hasExif,
                    size: doc.size || 0,
                    data
                });
                
                console.log(`  Clone ${i + 1}: ID: ${doc._id} | Size: ${doc.size || 0} | EXIF: ${hasExif ? '✅ YES' : '❌ NO'}`);
            }
            
            // Sort to find the BEST clone
            // 1. Prefer EXIF
            // 2. Prefer larger size
            results.sort((a, b) => {
                if (a.hasExif && !b.hasExif) return -1;
                if (!a.hasExif && b.hasExif) return 1;
                return b.size - a.size;
            });
            
            const bestClone = results[0];
            console.log(`\n  🏆 WINNER: Clone ${bestClone.index} (ID: ${bestClone.doc._id})`);
            
            for (let i = 1; i < results.length; i++) {
                console.log(`  🗑️ FLAGGED FOR PURGE: Clone ${results[i].index} (ID: ${results[i].doc._id})`);
                toDelete.push(results[i].doc._id);
            }
        }

        if (toDelete.length > 0) {
            console.log(`\n⚠️ Found ${toDelete.length} inferior clones. Executing PURGE...`);
            const deleteResult = await collection.deleteMany({ _id: { $in: toDelete } });
            console.log(`✅ Successfully deleted ${deleteResult.deletedCount} clones.`);
        } else {
            console.log(`\n✅ No inferior clones found to purge.`);
        }

    } finally {
        await client.close();
    }
}
run().catch(console.error);
