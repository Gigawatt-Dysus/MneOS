import pymongo

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
client = pymongo.MongoClient(MONGO_URI)
db = client["LifeOS"]
collection = db["pending_accessions"]

# Revert ANY record where width < height AND rotation is 90 or 270 back to rotation: 0
# Because if the WebP is already Portrait (width < height), it is already perfectly upright,
# and applying CSS rotation 90 will turn it sideways.
query = {
    "rotation": {"$in": [90, 270]},
    "$expr": {"$lt": ["$width", "$height"]}
}

count = collection.count_documents(query)
print(f"Found {count} perfectly-good Portrait WebPs that have rotation:90/270.")

if count > 0:
    result = collection.update_many(query, {"$set": {"rotation": 0}})
    print(f"Reverted {result.modified_count} records to rotation: 0.")

client.close()
