import os
import time
from pymongo import MongoClient
from PIL import Image, ExifTags
import sys

sys.stdout.reconfigure(encoding='utf-8')

# EXIF Orientation key
ORIENTATION_KEY = next((k for k, v in ExifTags.TAGS.items() if v == 'Orientation'), None)

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

def run():
    print("🔌 Connecting to Sovereign Matrix...")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # 1. Fetch all known images from Mongo
    print("🔍 Caching MongoDB filenames from 'media' and 'pending_accessions'...")
    mongo_files = set()
    
    for coll_name in ["media", "pending_accessions"]:
        cursor = db[coll_name].find({"fileType": {"$regex": "image/.*"}}, {"originalName": 1, "size": 1})
        for doc in cursor:
            if "originalName" in doc and "size" in doc:
                mongo_files.add((doc["originalName"], doc["size"]))
                
    print(f"✅ Found {len(mongo_files)} unique image footprint signatures in MongoDB.")
    client.close()

    # 2. Walk ALL_PHOTOS
    archive_dir = r"F:\LifeOS_Archive\ALL_PHOTOS"
    print(f"📂 Scanning local directory: {archive_dir}")
    
    has_orientation = 0
    no_orientation = 0
    scanned_in_mongo = 0
    
    start_time = time.time()
    
    for root, dirs, files in os.walk(archive_dir):
        for file in files:
            # We only care if it's an image
            if not file.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                continue
                
            filepath = os.path.join(root, file)
            
            try:
                size = os.path.getsize(filepath)
            except Exception:
                continue
                
            # Is this file actually in Mongo?
            if (file, size) in mongo_files:
                scanned_in_mongo += 1
                
                # Check EXIF
                try:
                    with Image.open(filepath) as img:
                        exif = img._getexif()
                        if exif and ORIENTATION_KEY in exif:
                            orientation = exif.get(ORIENTATION_KEY)
                            if orientation and orientation > 1:
                                has_orientation += 1
                            else:
                                no_orientation += 1
                        else:
                            no_orientation += 1
                except Exception:
                    no_orientation += 1
                    
                if scanned_in_mongo % 1000 == 0:
                    elapsed = time.time() - start_time
                    print(f"  ... scanned {scanned_in_mongo} verified MongoDB files in {elapsed:.1f}s")

    elapsed = time.time() - start_time
    print("-" * 50)
    print("📊 SOVEREIGN ORIENTATION AUDIT COMPLETE")
    print(f"⏱️ Time taken: {elapsed:.2f} seconds")
    print(f"📁 Verified MongoDB Image Files Scanned: {scanned_in_mongo}")
    print(f"🔄 Files WITH explicit EXIF Rotation (>1): {has_orientation}")
    print(f"❌ Files WITHOUT explicit EXIF Rotation: {no_orientation}")
    print("-" * 50)

if __name__ == "__main__":
    run()
