import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = 'mongodb://zen:sovereign@100.116.12.18:27017';
const client = new MongoClient(MONGO_URI);

async function run() {
    await client.connect();
    const db = client.db('LifeOS');
    
    // The Sycamore photo ID
    const id = '9MPVGVTxE8dXvkCrl1XrWHQzCl23_mbThpKeWzchFuzY5OCuJ';
    
    await db.collection('media').updateOne(
        { _id: id },
        { 
            $set: { 
                forceLandscape: true,
                rotation: 90 // Set back to 90 so it is sideways text rotated upright
            } 
        }
    );
    
    console.log(`Updated record ${id} with forceLandscape: true and rotation: 90`);
    await client.close();
}

run().catch(console.error);
