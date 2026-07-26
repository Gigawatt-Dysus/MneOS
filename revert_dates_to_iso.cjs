const { MongoClient } = require('mongodb');
require('dotenv').config({ path: 'C:/MneOS/.env' });

async function revertDates() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db('LifeOS');
        
        console.log("Converting native Date objects to ISO strings to prevent Firebase onCall crash...");

        const tags = await db.collection('tags').find({ id: 'tag-1763214032814' }).toArray();
        for (const t of tags) {
            const updates = {};
            
            if (t.updatedAt instanceof Date) {
                updates.updatedAt = t.updatedAt.toISOString();
            }
            if (t.metadata && t.metadata.dates && t.metadata.dates.birth instanceof Date) {
                updates['metadata.dates.birth'] = t.metadata.dates.birth.toISOString();
            }
            
            let galleryUpdated = false;
            const newGallery = (t.mediaGallery || []).map(g => {
                if (g.date instanceof Date) {
                    galleryUpdated = true;
                    return { ...g, date: g.date.toISOString() };
                }
                return g;
            });
            
            if (galleryUpdated) {
                updates.mediaGallery = newGallery;
            }

            if (Object.keys(updates).length > 0) {
                await db.collection('tags').updateOne({ _id: t._id }, { $set: updates });
                console.log(`Updated tag: ${t._id}`);
            }
        }

        const medias = await db.collection('media').find({ tagIds: 'tag-1763214032814' }).toArray();
        for (const m of medias) {
            const updates = {};
            if (m.uploadDate instanceof Date) {
                updates.uploadDate = m.uploadDate.toISOString();
            }
            if (Object.keys(updates).length > 0) {
                await db.collection('media').updateOne({ _id: m._id }, { $set: updates });
                console.log(`Updated media: ${m._id}`);
            }
        }

        console.log("Done reverting dates!");
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

revertDates();
