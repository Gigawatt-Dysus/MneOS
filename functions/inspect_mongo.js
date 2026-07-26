const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
const userId = "9MPVGVTxE8dXvkCrl1XrWHQzCl23";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("LifeOS");
        const users = db.collection("users");
        
        console.log("Searching user...");
        const user = await users.findOne({ _id: userId });
        if (!user) {
            console.log("User not found in MongoDB!");
            return;
        }
        
        console.log("Found user profile:");
        console.log(`- ID: ${user.id}`);
        console.log(`- Email: ${user.email}`);
        console.log(`- Display Name: ${user.displayName}`);
        console.log(`- Person Tag ID: ${user.personTagId}`);
        console.log("Companions:", JSON.stringify(user.aiCompanions, null, 2));
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

run();
