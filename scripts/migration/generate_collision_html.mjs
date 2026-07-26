import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017";
const DB_NAME = "LifeOS";

async function run() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('pending_accessions');

        // We are grabbing some of the exact filenames that threw ETag skips
        const filenames = [
            'IMG_20180206_154752885.jpg',
            'IMG_20180206_155705697.jpg',
            'Waterfall - 001.jpg',
            'IMG_20180206_160511631.jpg',
            'IMG_20180206_155813629_HDR.jpg'
        ];

        const cursor = collection.find({ originalName: { $in: filenames } }, {
            projection: { originalName: 1, url: 1, size: 1, _id: 1 }
        });

        const docs = await cursor.toArray();
        
        // Group them by filename so the user can compare them side-by-side
        const grouped = {};
        for(let doc of docs) {
            if(!grouped[doc.originalName]) grouped[doc.originalName] = [];
            grouped[doc.originalName].push(doc);
        }

        let html = `<html><head><title>Collision Audit Log</title><style>
            body { font-family: sans-serif; background: #111; color: #fff; padding: 20px; }
            .group { margin-bottom: 40px; border-bottom: 1px solid #333; padding-bottom: 20px; }
            .grid { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 10px; }
            .card { background: #222; padding: 10px; border-radius: 8px; text-align: center; min-width: 300px; }
            img { max-width: 100%; height: auto; max-height: 300px; object-fit: contain; }
            .name { font-size: 14px; margin-top: 10px; font-weight: bold; }
            .detail { font-size: 12px; color: #aaa; margin-top: 5px; }
        </style></head><body>
        <h1>ETag Collision Visual Audit</h1>
        <p>Comparing identical filenames that failed ETag (MD5 Hash) deduplication. Notice how the file sizes might differ slightly, or the images might be completely different!</p>`;
        
        for(let name of Object.keys(grouped)) {
            html += `<div class="group"><h2>${name} (${grouped[name].length} versions found)</h2><div class="grid">`;
            for(let doc of grouped[name]) {
                 html += `<div class="card">
                        <a href="${doc.url}" target="_blank"><img src="${doc.url}" loading="lazy" /></a>
                        <div class="detail">ID: ${doc._id}</div>
                        <div class="detail">Size: ${doc.size} bytes</div>
                    </div>`;
            }
            html += `</div></div>`;
        }
        
        html += `</body></html>`;
        
        const outPath = path.join('C:\\MneOS', 'collision_audit.html');
        fs.writeFileSync(outPath, html);
        console.log(`✅ Visual Audit Log generated at: ${outPath}`);
    } finally {
        await client.close();
    }
}
run().catch(console.error);
