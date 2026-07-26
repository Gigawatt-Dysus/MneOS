import { MongoClient } from 'mongodb';
import { S3Client, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import os from 'os';

dotenv.config({ path: "c:\\MneOS\\.env.local" });

const NODE_ID = `${os.hostname()}_purger_${process.pid}`;
const uri = "mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin";
const B2_ENDPOINT = 'https://s3.us-east-005.backblazeb2.com';
const B2_REGION = process.env.B2_REGION || 'us-east-005';
const B2_BUCKET = process.env.B2_BUCKET_NAME || 'LifeOS-Media';

const s3Client = new S3Client({
    endpoint: B2_ENDPOINT,
    region: B2_REGION,
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    }
});

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('LifeOS');
        const mediaColl = db.collection('media');
        const pendingColl = db.collection('pending_accessions');

        console.log(`[Swarm Node: ${NODE_ID}] Booting up __url phantom HEAL & PURGE routine...`);

        let processed = 0;
        let deleted = 0;
        let healed = 0;

        while (true) {
            // Atomic Pez Dispenser Lock
            const target = await mediaColl.findOneAndUpdate(
                {
                    url: /__url$/,
                    processing_lock: { $exists: false }
                },
                {
                    $set: { processing_lock: NODE_ID }
                },
                { returnDocument: 'after' }
            );

            if (!target) {
                console.log(`[Swarm Node: ${NODE_ID}] No more unlocked phantoms found in media collection.`);
                break;
            }

            processed++;
            console.log(`[Swarm Node: ${NODE_ID}] Locked phantom: ${target._id} (${target.originalName})`);

            try {
                // Check if a clean sibling exists
                const siblingInMedia = await mediaColl.find({ 
                    originalName: target.originalName, 
                    url: { $not: /__url$/ } 
                }).toArray();

                const siblingInPending = await pendingColl.find({
                    originalName: target.originalName, 
                    url: { $not: /__url$/ } 
                }).toArray();

                const hasCleanSibling = siblingInMedia.length > 0 || siblingInPending.length > 0;

                const urlParts = target.url.split('/LifeOS-Media/');
                const b2Key = urlParts.length > 1 ? urlParts[1] : null;

                if (hasCleanSibling) {
                    console.log(`[Swarm Node: ${NODE_ID}] -> Sibling found! Purging duplicate...`);
                    if (b2Key) {
                        await s3Client.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: b2Key }));
                    }
                    await mediaColl.deleteOne({ _id: target._id });
                    deleted++;
                } else {
                    console.log(`[Swarm Node: ${NODE_ID}] -> NO SIBLING. Healing orphaned master copy...`);
                    if (b2Key) {
                        const newKey = b2Key.replace('__url', '');
                        const newUrl = target.url.replace('__url', '');

                        // S3 Copy
                        await s3Client.send(new CopyObjectCommand({
                            Bucket: B2_BUCKET,
                            CopySource: `${B2_BUCKET}/${b2Key}`,
                            Key: newKey
                        }));

                        // S3 Delete Old
                        await s3Client.send(new DeleteObjectCommand({
                            Bucket: B2_BUCKET,
                            Key: b2Key
                        }));

                        // DB Update
                        await mediaColl.updateOne(
                            { _id: target._id },
                            { $set: { url: newUrl }, $unset: { processing_lock: "" } }
                        );
                        healed++;
                    } else {
                        // Edge case: URL wasn't formatted as expected, unlock it
                        await mediaColl.updateOne({ _id: target._id }, { $unset: { processing_lock: "" } });
                    }
                }
            } catch (err) {
                console.error(`[Swarm Node: ${NODE_ID}] Failed to process ${target._id}:`, err);
                await mediaColl.updateOne(
                    { _id: target._id },
                    { $unset: { processing_lock: "" }, $set: { error: err.message } }
                );
            }

            await new Promise(resolve => setTimeout(resolve, 50));
        }

        console.log(`[Swarm Node: ${NODE_ID}] Complete. Processed: ${processed} | Deleted: ${deleted} | Healed: ${healed}`);

    } finally {
        await client.close();
    }
}

run().catch(console.error);
