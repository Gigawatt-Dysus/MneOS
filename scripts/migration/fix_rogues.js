import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function fix() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("Missing MONGODB_URI");
        process.exit(1);
    }
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('LifeOS');
    
    // Find the proper userId from an existing valid media
    const validMedia = await db.collection('media').findOne({ userId: { $exists: true } });
    const userId = validMedia ? validMedia.userId : null;
    
    if (!userId) {
        console.error("Could not determine userId from media collection!");
        process.exit(1);
    }
    console.log(`Using inferred userId: ${userId}`);
    
    // Find recent rogue uploads (last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const rogues = await db.collection('media').find({
        uploadDate: { $gte: twoHoursAgo },
        originalName: { $exists: true }
    }).toArray();
    
    console.log(`Found ${rogues.length} rogue files in 'media'.`);
    
    if (rogues.length > 0) {
        const pendingCol = db.collection('pending_accessions');
        
        for (const r of rogues) {
            r.status = 'pending';
            r.userId = userId;
            r.triage = {
                title: r.originalName || r.title,
                summary: r.caption || '',
                suggestedTags: r.tagIds || []
            };
            r.createdAt = new Date();
            
            await pendingCol.insertOne(r);
            await db.collection('media').deleteOne({ _id: r._id });
            console.log(`➡️  Moved [${r.originalName}] to pending_accessions`);
        }
        console.log("✅ All rogues successfully relocated!");
    } else {
        console.log("No rogues found. They might have already been moved.");
    }
    await client.close();
}
fix();
