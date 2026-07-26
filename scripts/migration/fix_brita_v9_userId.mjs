import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const CORRECT_USER_ID = '2qQf69l6j5XozM43ZJ2Tyr4qJdg2';
const OLD_USER_ID = 'eric_cornett';

async function run() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db('LifeOS');
        const collection = db.collection('chat_segments');

        const docs = await collection.find({ userId: OLD_USER_ID, is_lab_import: true }).toArray();
        console.log(`Found ${docs.length} documents with wrong userId.`);

        if (docs.length === 0) {
            console.log("No documents to fix.");
            return;
        }

        const newDocs = docs.map(doc => {
            const { _id, ...rest } = doc;
            return {
                ...rest,
                userId: CORRECT_USER_ID,
                _id: `${CORRECT_USER_ID}_${doc.id}`
            };
        });

        await collection.insertMany(newDocs);
        console.log(`Inserted ${newDocs.length} corrected documents.`);

        const deleteRes = await collection.deleteMany({ userId: OLD_USER_ID, is_lab_import: true });
        console.log(`Deleted ${deleteRes.deletedCount} old documents.`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

run();
