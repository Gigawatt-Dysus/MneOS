from pymongo import MongoClient
import sys

client = MongoClient('mongodb://zen:sovereign@100.116.12.18:27017')
db = client.LifeOS

# Find all items that are images and NOT yet processed
image_query = {"aiProcessed": False, "type": "IMAGE"}
total_images = db.pending_accessions.count_documents(image_query)

# Find all items of any type NOT yet processed
all_pending_query = {"aiProcessed": False}
total_pending = db.pending_accessions.count_documents(all_pending_query)

# Find all processed images
processed_images = db.pending_accessions.count_documents({"aiProcessed": True, "type": "IMAGE"})

print(f"Total unprocessed IMAGES (Needs Gemini): {total_images}")
print(f"Total unprocessed ITEMS (All types): {total_pending}")
print(f"Total PROCESSED images sitting in pending: {processed_images}")

# Also let's check file types just to see what the 314,000 items are
types = db.pending_accessions.aggregate([
    {"$group": {"_id": "$type", "count": {"$sum": 1}}}
])
print("\nBreakdown by Type:")
for t in types:
    print(f"{t.get('_id', 'Unknown')}: {t.get('count')}")
