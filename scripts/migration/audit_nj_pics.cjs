const fs = require('fs');
const path = require('path');
const exifr = require('exifr');
const { MongoClient } = require('mongodb');

const TARGET_DIR = "F:\\[ BACKUP - DO NOT DELETE ]\\NJ Pics";
const LOCAL_URI = "mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin";

function walkSync(dir, filelist = []) {
    if (!fs.existsSync(dir)) return filelist;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);
        if (stat.isDirectory()) {
            walkSync(filepath, filelist);
        } else {
            if (filepath.toLowerCase().match(/\.(jpg|jpeg|png)$/)) {
                filelist.push({ path: filepath, name: file, size: stat.size });
            }
        }
    }
    return filelist;
}

async function run() {
    console.log(`[NJ Pics Audit] Scanning directory: ${TARGET_DIR}`);
    const files = walkSync(TARGET_DIR);
    console.log(`[NJ Pics Audit] Found ${files.length} images.`);

    if (files.length === 0) {
        console.log("No images found or path is inaccessible. Exiting.");
        return;
    }

    // Connect to Sovereign Mongo
    const client = new MongoClient(LOCAL_URI);
    await client.connect();
    const db = client.db('LifeOS');

    console.log(`[NJ Pics Audit] Running Forensic Match on a sample of 15 files...`);
    
    // Sample 15 random files
    const sample = files.sort(() => 0.5 - Math.random()).slice(0, 15);
    
    let betterCount = 0;
    let matchCount = 0;

    for (const f of sample) {
        console.log(`\n=========================================`);
        console.log(`📸 Analyzing: ${f.name}`);
        console.log(`   Source Size: ${(f.size / 1024).toFixed(2)} KB`);
        
        let hasExif = false;
        try {
            const exifData = await exifr.parse(f.path, { tiff: true, exif: true, gps: true });
            if (exifData && (exifData.DateTimeOriginal || exifData.Make)) {
                hasExif = true;
                console.log(`   Source EXIF: ✅ YES (Camera: ${exifData.Make || 'Unknown'}, Date: ${exifData.DateTimeOriginal || 'Unknown'})`);
            } else {
                console.log(`   Source EXIF: ⚠️ VERY LIMITED (No Date/Camera)`);
            }
        } catch (e) {
            console.log(`   Source EXIF: ❌ NO`);
        }

        // Check DB
        const pendingDocs = await db.collection('pending_accessions').find({ 
            $or: [{ fileName: f.name }, { originalName: f.name }, { title: f.name }]
        }).toArray();

        const mediaDocs = await db.collection('media').find({ 
            $or: [{ fileName: f.name }, { originalName: f.name }, { title: f.name }]
        }).toArray();

        const allDocs = [...pendingDocs, ...mediaDocs];

        if (allDocs.length > 0) {
            matchCount++;
            console.log(`   🗄️  Found in DB: ${allDocs.length} record(s)`);
            for (const doc of allDocs) {
                const dbSize = doc.size || 0;
                console.log(`      -> DB Record [${doc.id}] | Size: ${(dbSize / 1024).toFixed(2)} KB | Col: ${doc.status === 'clean' ? 'media' : 'pending'}`);
                
                if (f.size > dbSize) {
                    console.log(`      🏆 F: Drive file is LARGER than DB record! (+${((f.size - dbSize) / 1024).toFixed(2)} KB)`);
                    betterCount++;
                } else if (f.size < dbSize) {
                    console.log(`      ❌ DB record is larger.`);
                } else {
                    console.log(`      ⚖️ Sizes match perfectly.`);
                }
            }
        } else {
            console.log(`   👻 NOT FOUND in Sovereign Database (Brand new original!)`);
            betterCount++; // A brand new original is obviously better
        }
    }

    console.log(`\n=========================================`);
    console.log(`[AUDIT COMPLETE] 15 files sampled.`);
    console.log(`Found ${matchCount} matches in DB.`);
    console.log(`In ${betterCount} cases, the F: drive original was larger (less compressed) or brand new.`);
    console.log(`If this trend holds for the other ${files.length - 15} files, this directory is a goldmine.`);

    await client.close();
}

run();
