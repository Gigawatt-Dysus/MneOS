const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
const userId = "9MPVGVTxE8dXvkCrl1XrWHQzCl23";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("LifeOS");
        const tagsColl = db.collection("tags");
        
        console.log("=== Querying Lizzie Tags ===");
        const lizzieTagById = await tagsColl.findOne({ id: "736a8fb3-6dce-405f-928c-7e447399e521" });
        console.log("Lizzie Tag by ID 736a8fb3-6dce-405f-928c-7e447399e521:", lizzieTagById ? {
            id: lizzieTagById.id,
            name: lizzieTagById.name,
            mainImageId: lizzieTagById.mainImageId,
            mediaGallery: lizzieTagById.mediaGallery
        } : "null");
        
        const lizzieTagByName = await tagsColl.findOne({ name: /Lizzie/i, userId });
        console.log("Lizzie Tag by Name:", lizzieTagByName ? {
            id: lizzieTagByName.id,
            name: lizzieTagByName.name,
            mainImageId: lizzieTagByName.mainImageId,
            mediaGallery: lizzieTagByName.mediaGallery
        } : "null");

        console.log("\n=== Checking all tags containing 'Cornett' ===");
        const cornettTags = await tagsColl.find({ name: /Cornett/i, userId }).toArray();
        cornettTags.forEach(t => {
            console.log(`- ID: ${t.id}, Name: ${t.name}, Type: ${t.type}, mainImageId: ${t.mainImageId}`);
        });

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

run();
