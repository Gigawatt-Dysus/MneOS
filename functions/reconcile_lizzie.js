const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
const userId = "9MPVGVTxE8dXvkCrl1XrWHQzCl23";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("LifeOS");
        const vertsColl = db.collection("verts");
        const tagsColl = db.collection("tags");

        console.log("=== Finding Lizzie's Vert ===");
        const lizzieVert = await vertsColl.findOne({ 
            userId: userId, 
            displayName: /Lizzie/i 
        });

        if (lizzieVert) {
            console.log("Lizzie Vert Found:", {
                _id: lizzieVert._id,
                uid: lizzieVert.uid,
                displayName: lizzieVert.displayName,
                associatedTagId: lizzieVert.associatedTagId,
                associatedTag: lizzieVert.associatedTag
            });

            console.log("\n=== Finding Lizzie's Target Tag ===");
            const targetTag = await tagsColl.findOne({ 
                userId: userId, 
                id: "tag-new-1763324952564" 
            });

            if (targetTag) {
                console.log("Target Tag Found:", {
                    id: targetTag.id,
                    name: targetTag.name,
                    type: targetTag.type,
                    mainImageId: targetTag.mainImageId
                });

                console.log("\n=== Reconciling Vert with Target Tag ===");
                const result = await vertsColl.updateOne(
                    { _id: lizzieVert._id },
                    { 
                        $set: { 
                            associatedTagId: "tag-new-1763324952564",
                            associatedTag: targetTag.name // Ensure alignment
                        } 
                    }
                );
                console.log(`Successfully updated ${result.modifiedCount} vert document.`);
            } else {
                console.log("❌ Error: Target tag 'tag-new-1763324952564' not found in MongoDB!");
            }
        } else {
            console.log("❌ Error: Lizzie vert not found in MongoDB!");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

run();
