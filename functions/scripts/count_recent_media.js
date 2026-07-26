const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb://zen:sovereign@100.116.12.18:27017";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');

    const collections = ['media', 'pending_accessions'];
    let totalImages = 0;
    let totalRecentImages = 0;

    const tenYearsAgo = new Date('2016-01-01T00:00:00Z');

    for (const collName of collections) {
      const coll = db.collection(collName);
      
      const isImageCondition = {
        $or: [
          { fileType: { $regex: "^image/", $options: "i" } },
          { type: "IMAGE" }
        ]
      };

      const dateConditionsDate = {
        $or: [
           { timestamp: { $gte: tenYearsAgo } },
           { date: { $gte: tenYearsAgo } },
           { createdAt: { $gte: tenYearsAgo } }
        ]
      };

      const dateConditionsRegex = {
         $or: [
           { timestamp: { $regex: /^(201[6-9]|202[0-9])/ } },
           { date: { $regex: /^(201[6-9]|202[0-9])/ } },
           { createdAt: { $regex: /^(201[6-9]|202[0-9])/ } }
         ]
      };

      const dateConditionsNum = {
         timestamp: { $gte: tenYearsAgo.getTime() }
      };

      const totalImageCount = await coll.countDocuments(isImageCondition);
      totalImages += totalImageCount;
      
      const countDate = await coll.countDocuments({ $and: [isImageCondition, dateConditionsDate] });
      const countRegex = await coll.countDocuments({ $and: [isImageCondition, dateConditionsRegex] });
      const countNum = await coll.countDocuments({ $and: [isImageCondition, dateConditionsNum] });

      const recentCount = Math.max(countDate, countRegex, countNum);
      totalRecentImages += recentCount;

      console.log(`\nCollection [${collName}]`);
      console.log(`  Total Images: ${totalImageCount}`);
      console.log(`  Images >= 2016: ${recentCount}`);
    }

    console.log(`\n--- SUMMARY ---`);
    console.log(`Total Images across DB: ${totalImages}`);
    console.log(`Total Images >= 2016: ${totalRecentImages}`);

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
