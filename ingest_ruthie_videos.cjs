const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: 'C:/MneOS/.env' });

const TARGET_TAG_ID = 'tag-1763214032814'; // Ruthie
const USER_ID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23'; // Dysus2024
const PUBLIC_DIR = path.join('C:/MneOS', 'public', 'matrix_assets', 'ruthie_emo');

const videos = [
    "G:\\My Drive\\[ Documents ]\\[ Project GIGI - MneOS - Eric Cornett ]\\[ People ]\\[ Evers, Ruth Marie ]\\Headshots\\Grok Emo Tests\\RME_Surprised__001.mp4",
    "G:\\My Drive\\[ Documents ]\\[ Project GIGI - MneOS - Eric Cornett ]\\[ People ]\\[ Evers, Ruth Marie ]\\Headshots\\Grok Emo Tests\\RME_Vulnerable__001.mp4",
    "G:\\My Drive\\[ Documents ]\\[ Project GIGI - MneOS - Eric Cornett ]\\[ People ]\\[ Evers, Ruth Marie ]\\Headshots\\Grok Emo Tests\\RME_Says_Yes.mp4"
];

async function ingest() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db('LifeOS');

        if (!fs.existsSync(PUBLIC_DIR)) {
            fs.mkdirSync(PUBLIC_DIR, { recursive: true });
        }

        const tagDocs = await db.collection('tags').find({ id: TARGET_TAG_ID }).toArray();
        if (tagDocs.length === 0) {
            console.error("Tag not found!");
            return;
        }

        const addedMediaIds = [];
        const addedGalleryItems = [];

        for (const videoPath of videos) {
            if (!fs.existsSync(videoPath)) {
                console.warn(`File not found: ${videoPath}`);
                continue;
            }

            const fileName = path.basename(videoPath);
            const destPath = path.join(PUBLIC_DIR, fileName);
            fs.copyFileSync(videoPath, destPath);
            console.log(`Copied ${fileName} to public/matrix_assets/ruthie_emo`);

            const url = `/matrix_assets/ruthie_emo/${fileName}`;
            const mediaId = `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

            const mediaDoc = {
                _id: `${USER_ID}_${mediaId}`,
                id: mediaId,
                userId: USER_ID,
                url: url,
                thumbnailUrl: url,
                caption: fileName.replace('.mp4', '').replace(/_/g, ' '),
                uploadDate: new Date(),
                fileType: 'video/mp4',
                fileName: fileName,
                tagIds: [TARGET_TAG_ID],
                status: 'clean',
            };

            await db.collection('media').insertOne(mediaDoc);
            console.log(`Inserted media record: ${mediaId}`);

            addedMediaIds.push(mediaId);
            addedGalleryItems.push({
                type: 'video',
                date: new Date(),
                url: url,
                mediaId: mediaId,
                caption: mediaDoc.caption
            });
        }

        if (addedMediaIds.length > 0) {
            // Update BOTH tag documents (user1 and user2)
            for (const t of tagDocs) {
                await db.collection('tags').updateOne(
                    { _id: t._id },
                    { 
                        $push: { 
                            mediaIds: { $each: addedMediaIds },
                            mediaGallery: { $each: addedGalleryItems }
                        },
                        $set: { updatedAt: new Date() }
                    }
                );
                console.log(`Updated tag document: ${t._id}`);
            }
        }
        
        console.log("Done!");

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

ingest();
