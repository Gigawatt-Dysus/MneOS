import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('gigi-time-machine');
    
    console.log('Sweeping Airlock for garbage node_modules and system scripts...');
    
    const res1 = await db.collection('pending_accessions').deleteMany({
        $or: [
            { fileType: 'UNKNOWN' },
            { fileType: { $exists: false } },
            { fileName: { $regex: /\.(ps1|cmd|js|ini|json|csv|html|exe|bat|sh|yaml|yml|md)$/i } },
            { title: { $regex: /\.(ps1|cmd|js|ini|json|csv|html|exe|bat|sh|yaml|yml|md)$/i } }
        ]
    });
    
    const res2 = await db.collection('media').deleteMany({
        $or: [
            { fileType: 'UNKNOWN' },
            { fileType: { $exists: false } },
            { fileName: { $regex: /\.(ps1|cmd|js|ini|json|csv|html|exe|bat|sh|yaml|yml|md)$/i } }
        ]
    });
    
    console.log(`[SUCCESS] Purged ${res1.deletedCount} from pending_accessions.`);
    console.log(`[SUCCESS] Purged ${res2.deletedCount} from media.`);
    process.exit(0);
}

run().catch(console.error);
