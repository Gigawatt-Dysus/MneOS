const { MongoClient } = require('mongodb'); 
require('dotenv').config({ path: '.env.local' }); 

async function check() { 
    const c = new MongoClient(process.env.MONGODB_URI); 
    await c.connect(); 
    const db = c.db('LifeOS'); 
    
    // Sample a record from pending_accessions
    const sample = await db.collection('pending_accessions').findOne({ 
        fileType: { $regex: /^image/i } 
    }); 
    
    console.log('--- SAMPLE PENDING_ACCESSIONS RECORD ---');
    console.log('logicalDate:', sample.logicalDate);
    console.log('createdAt:', sample.createdAt);
    console.log('year:', sample.year);
    console.log('fileName:', sample.fileName);
    console.log('originalName:', sample.originalName);
    console.log('size:', sample.size);
    console.log('userId:', sample.userId);
    console.log('thumbnailUrls:', JSON.stringify(sample.thumbnailUrls));
    console.log('thumbnail_metadata_healed:', sample.thumbnail_metadata_healed);

    // Check screenshots_archive for a sample
    const screenshotSample = await db.collection('screenshots_archive').findOne({
        fileType: { $regex: /^image/i }
    });
    if (screenshotSample) {
        console.log('\n--- SAMPLE SCREENSHOTS_ARCHIVE RECORD ---');
        console.log('fileName:', screenshotSample.fileName);
        console.log('originalName:', screenshotSample.originalName);
        console.log('size:', screenshotSample.size);
        console.log('logicalDate:', screenshotSample.logicalDate);
    }

    // Check google_edited for a sample
    const editedSample = await db.collection('google_edited').findOne({
        fileType: { $regex: /^image/i }
    });
    if (editedSample) {
        console.log('\n--- SAMPLE GOOGLE_EDITED RECORD ---');
        console.log('fileName:', editedSample.fileName);
        console.log('originalName:', editedSample.originalName);
        console.log('size:', editedSample.size);
        console.log('logicalDate:', editedSample.logicalDate);
    }

    await c.close(); 
} 

check().catch(console.error);
