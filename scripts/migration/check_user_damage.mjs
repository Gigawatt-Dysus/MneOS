import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env.local' });

async function checkUserDamage() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGODB_URI missing in .env.local");
        return;
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('LifeOS');
        const users = await db.collection('users').find({}).toArray();
        console.log("Total documents in users collection:", users.length);
        users.forEach(u => {
            console.log("User _id:", u._id, "Keys:", Object.keys(u).join(', '));
            if (u.role === 'user' || u.role === 'model') {
                console.log("WARNING: Found a document that looks like a SimulacrumMessage!");
            }
        });
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkUserDamage();
