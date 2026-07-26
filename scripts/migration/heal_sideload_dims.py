import sys
import requests
from io import BytesIO
from PIL import Image
from pymongo import MongoClient
import time

sys.stdout.reconfigure(encoding='utf-8')

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

def heal_sideload_dims():
    print("=========================================")
    print("[INIT] MneOS Phantom Dimensions Healer")
    print("=========================================")

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db['media']

    query = {
        "$or": [
            {"width": {"$in": [0, None]}},
            {"width": {"$exists": False}},
            {"height": {"$in": [0, None]}},
            {"height": {"$exists": False}}
        ],
        "url": {"$regex": "^http"}
    }

    cursor = collection.find(query).sort("logicalDate", -1)
    
    docs = list(cursor)
    total = len(docs)
    print(f"🔍 Found {total} remote assets missing dimensions.")

    healed = 0
    for doc in docs:
        doc_id = doc['_id']
        url = doc.get('thumbnailUrls', {}).get('medium') or doc.get('url')
        
        if not url:
            continue

        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            img = Image.open(BytesIO(response.content))
            width, height = img.size

            # In case PIL auto-rotated it, we check the EXIF orientation
            # (Though Google Photos URLs usually are already rotated)
            
            collection.update_one(
                {"_id": doc_id},
                {"$set": {
                    "width": width,
                    "height": height,
                    "rotation": 0
                }}
            )

            healed += 1
            print(f"🐾 Healed [{doc_id}]: {width}x{height} -> {url[:50]}...")
            
        except Exception as e:
            print(f"❌ Failed to heal [{doc_id}]: {e}")
            
    print("=========================================")
    print(f"🎉 Dimension Healing Complete! Sized {healed} assets.")
    print("=========================================")

if __name__ == "__main__":
    heal_sideload_dims()
