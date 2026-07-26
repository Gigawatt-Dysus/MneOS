import { MongoClient } from 'mongodb';
import path from 'path';

// Re-implement getMimeType to fix existing records
const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.heic': 'image/heic',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime'
  };
  return mimeMap[ext] || 'application/octet-stream';
};

async function fixFileTypes() {
  const uri = 'mongodb://zen:sovereign@100.116.12.18:27017';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('LifeOS');
  
  console.log("ðŸš€ Fixing missing fileType metadata in pending_accessions...");

  // Find documents missing fileType
  const docs = await db.collection('pending_accessions').find({ fileType: { $exists: false } }).toArray();
  console.log(`ðŸ”Ž Found ${docs.length} records missing fileType.`);

  if (docs.length === 0) {
    console.log("âœ… All records have fileType.");
    await client.close();
    return;
  }

  let updated = 0;
  const bulkOps = [];

  for (const doc of docs) {
    if (doc.originalName) {
      const mime = getMimeType(doc.originalName);
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { fileType: mime } }
        }
      });
      updated++;
    }
    
    // Process in batches of 1000
    if (bulkOps.length >= 1000) {
      await db.collection('pending_accessions').bulkWrite(bulkOps);
      console.log(`â ³ Processed ${updated} records...`);
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    await db.collection('pending_accessions').bulkWrite(bulkOps);
    console.log(`â ³ Processed ${updated} records...`);
  }

  console.log(`ðŸŽ‰ Successfully patched ${updated} records with fileType metadata!`);
  await client.close();
}

fixFileTypes().catch(console.error);
