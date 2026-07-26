const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb://zen:sovereign@100.116.12.18:27017";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    const pendingCollection = db.collection('pending_accessions');

    const strayCount = await pendingCollection.countDocuments({
        thumbnailUrls: { $exists: false },
        fileType: { $regex: '^image/' }
    });

    console.log(`\n🔍 DROPLET FORGE STRAY CHECK`);
    console.log(`Strays remaining: ${strayCount}`);

    if (strayCount > 0) {
       console.log("\nFetching a few stray examples...");
       const strays = await pendingCollection.find({
            thumbnailUrls: { $exists: false },
            fileType: { $regex: '^image/' }
       }).limit(5).toArray();
       
       strays.forEach(s => console.log(` - ${s._id} | ${s.originalName}`));
    } else {
       console.log("✅ The Droplet Forge finished perfectly clean. Zero strays.");
    }

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
