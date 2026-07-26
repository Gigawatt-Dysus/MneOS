import os
import sys
from pymongo import MongoClient

# Force UTF-8 for Windows console
sys.stdout.reconfigure(encoding='utf-8')

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

print("🔍 Inspecting Moondream captions in Sovereign MongoDB...")
client = MongoClient(MONGO_URI)
db = client[DB_NAME]

for collection_name in ["media", "pending_accessions"]:
    print(f"\n--- Collection: {collection_name} ---")
    query = {"aiProcessed": True, "caption": {"$exists": True}}
    
    docs = db[collection_name].find(query).sort("_id", -1).limit(10)
    count = 0
    for doc in docs:
        count += 1
        filename = doc.get("originalName") or doc.get("fileName") or "Unknown"
        caption = doc.get("caption")
        print(f"\nFile: {filename}\nCaption: {caption}")
        
    if count == 0:
        print("No processed captions found.")

client.close()
