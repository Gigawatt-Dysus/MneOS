import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
    console.log('dYOO Initiating Errant Database Migration...');
    
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const errantDb = client.db('gigi-time-machine');
    const correctDb = client.db('LifeOS');

    // 1. Fetch data from errant DB
    const eventsToMove = await errantDb.collection('events').find({}).toArray();
    const mediaToMove = await errantDb.collection('media').find({}).toArray();

    console.log(`[*] Found ${eventsToMove.length} events and ${mediaToMove.length} media records in 'gigi-time-machine'.`);

    if (eventsToMove.length > 0 || mediaToMove.length > 0) {
        // 2. Insert into correct DB
        if (eventsToMove.length > 0) {
            await correctDb.collection('events').insertMany(eventsToMove);
            console.log(`[+] Successfully moved ${eventsToMove.length} events to 'LifeOS'.`);
        }
        if (mediaToMove.length > 0) {
            await correctDb.collection('media').insertMany(mediaToMove);
            console.log(`[+] Successfully moved ${mediaToMove.length} media records to 'LifeOS'.`);
        }

        // 3. Drop the errant database to clean up
        await errantDb.dropDatabase();
        console.log(`[🗑️] Dropped errant database 'gigi-time-machine'.`);
    } else {
        console.log('[!] Errant database is already empty.');
    }

    await client.close();
    console.log('dY"S Migration complete.');
}

run().catch(console.error);
