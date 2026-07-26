import pymongo

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
client = pymongo.MongoClient(MONGO_URI)
db = client["LifeOS"]
collection = db["pending_accessions"]

# Target items where width < height (Portrait dimensions) but rotation is 0
query = {
    "rotation": 0,
    "$expr": {"$lt": ["$width", "$height"]}
}

count = collection.count_documents(query)
print(f"Found {count} portrait-dimension anomalies that lost their rotation.")

if count > 0:
    result = collection.update_many(query, {"$set": {"rotation": 90}})
    print(f"Restored rotation: 90 to {result.modified_count} items.")

client.close()
