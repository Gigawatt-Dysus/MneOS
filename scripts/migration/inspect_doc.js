import { MongoClient } from 'mongodb';

async function inspect() {
  const uri = 'mongodb://zen:sovereign@100.116.12.18:27017';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('LifeOS');
  
  const doc = await db.collection('pending_accessions').findOne({ 
    $or: [
      { originalName: { $regex: 'DSC_1274', $options: 'i' } },
      { fileName: { $regex: 'DSC_1274', $options: 'i' } },
      { title: { $regex: 'DSC_1274', $options: 'i' } }
    ]
  });
  console.log("=== TARGET DOC PENDING ===");
  if (doc) {
    console.log("Keys:", Object.keys(doc));
    console.log("filepath:", doc.filepath);
    console.log("absolutePath:", doc.absolutePath);
    console.log("originVector:", doc.originVector);
    console.log("sourcePath:", doc.sourcePath);
    console.log("url:", doc.url);
    console.log("triage:", doc.triage);
  } else {
    console.log("Not found.");
  }
  await client.close();
}

inspect().catch(console.error);
