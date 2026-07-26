const { MongoClient } = require('mongodb');

async function getWebpDimensions(url) {
    try {
        const response = await fetch(url, { headers: { 'Range': 'bytes=0-29' } });
        if (!response.ok) return null;
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
        const format = buffer.toString('ascii', 12, 16);
        let width, height;
        if (format === 'VP8 ') {
            const raw = buffer.readUInt32LE(26);
            width = raw & 0x3fff; height = (raw >> 16) & 0x3fff;
        } else if (format === 'VP8L') {
            const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
            width = 1 + (((b2 & 0x3F) << 8) | b1);
            height = 1 + (((b4 & 0xF) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6));
        } else if (format === 'VP8X') {
            width = 1 + buffer.readUIntLE(24, 3);
            height = 1 + buffer.readUIntLE(27, 3);
        } else return null;
        return { width, height };
    } catch (err) { return null; }
}

async function scan() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin');
    await client.connect();
    const db = client.db('LifeOS');
    
    const badRecords = [];
    const CONCURRENCY = 100;

    for (const colName of ['media', 'pending_accessions']) {
        const collection = db.collection(colName);
        console.log(`\nFetching ${colName}...`);
        const records = await collection.find({
            fileType: { $regex: /^image\//i },
            thumbnailUrls: { $exists: true },
            thumbnail_metadata_healed: true
        }).project({ _id: 1, originalName: 1, width: 1, height: 1, thumbnailUrls: 1 }).toArray();

        console.log(`Scanning ${records.length} images in ${colName}...`);
        let processed = 0;

        for (let i = 0; i < records.length; i += CONCURRENCY) {
            const chunk = records.slice(i, i + CONCURRENCY);
            await Promise.all(chunk.map(async (record) => {
                if (!record.thumbnailUrls || !record.thumbnailUrls.medium) return;
                if (!record.width || !record.height) return;
                const dims = await getWebpDimensions(record.thumbnailUrls.medium);
                if (dims) {
                    const dbIsPortrait = record.width < record.height;
                    const webpIsPortrait = dims.width < dims.height;
                    // Strict aspect ratio check for off-by-90-degrees
                    if (dbIsPortrait !== webpIsPortrait && record.width !== record.height && dims.width !== dims.height) {
                        badRecords.push({ _id: record._id, collection: colName });
                    }
                }
            }));
            processed += chunk.length;
            if (processed % 1000 === 0) console.log(`Processed ${processed}/${records.length}`);
        }
    }

    console.log(`\nFound ${badRecords.length} sideways thumbnails total.`);
    
    if (badRecords.length > 0) {
        await db.collection('temp_sideways').deleteMany({});
        await db.collection('temp_sideways').insertMany(badRecords);
        console.log('Saved to temp_sideways collection.');
    }
    await client.close();
}
scan().catch(console.error);
