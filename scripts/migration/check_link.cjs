const { MongoClient } = require('mongodb');
const uri = "mongodb://zen:sovereign@100.116.12.18:27017";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("LifeOS");
        const doc = await db.collection("media").findOne({ _id: "9MPVGVTxE8dXvkCrl1XrWHQzCl23_U7WA9hs4B5Q8E7ANGvjo" });
        console.log("Media Doc:", doc ? "FOUND" : "NOT FOUND");
        if (doc) console.log(doc.originalName);
    } finally {
        await client.close();
    }
}
run();
