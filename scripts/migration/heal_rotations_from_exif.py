import os
import sys
import argparse
from pymongo import MongoClient
from PIL import Image, ExifTags
import time
import datetime

sys.stdout.reconfigure(encoding='utf-8')

# Setup arguments
parser = argparse.ArgumentParser(description="Heal media rotations from original local Takeout files.")
parser.add_argument("--takeout-dir", type=str, required=True, help="Path to your local extracted Google Takeout folder.")
parser.add_argument("--dry-run", action="store_true", help="Do not save changes to the database.")
args = parser.parse_args()

# Database Setup (Using the standard Sovereign Genesis URI)
MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

print("🔌 Connecting to Sovereign Matrix...")
client = MongoClient(MONGO_URI)
db = client[DB_NAME]

# EXIF Orientation to Degree Mapping
# 1: Normal, 3: 180°, 6: 90° CW, 8: 270° CW
EXIF_ROTATION_MAP = {
    3: 180,
    6: 90,
    8: 270
}

# Find the integer key for 'Orientation' in PIL's ExifTags
ORIENTATION_KEY = next((k for k, v in ExifTags.TAGS.items() if v == 'Orientation'), None)

def get_exif_rotation(filepath):
    try:
        with Image.open(filepath) as img:
            exif = img._getexif()
            if not exif or not ORIENTATION_KEY:
                return 0
            
            orientation = exif.get(ORIENTATION_KEY, 1)
            return EXIF_ROTATION_MAP.get(orientation, 0)
    except Exception:
        return 0

def run():
    print(f"📂 Scanning local Takeout directory: {args.takeout_dir}")
    print(f"📡 Dry Run: {args.dry_run}")
    
    start_time = time.time()
    files_scanned = 0
    db_updates = 0
    missing_in_db = 0

    # Build a lookup dictionary from MongoDB first to make matching instant
    print("🔍 Caching MongoDB filenames from 'media' and 'pending_accessions'...")
    cursor_media = db["media"].find({"fileType": {"$regex": "image/.*"}}, {"_id": 1, "originalName": 1, "rotation": 1, "size": 1})
    cursor_pending = db["pending_accessions"].find({"fileType": {"$regex": "image/.*"}}, {"_id": 1, "originalName": 1, "rotation": 1, "size": 1})
    
    db_lookup = {}
    for doc in cursor_media:
        name = doc.get("originalName")
        size = doc.get("size")
        if name and size:
            key = (name, size)
            if key not in db_lookup:
                db_lookup[key] = []
            db_lookup[key].append((doc, "media"))
            
    for doc in cursor_pending:
        name = doc.get("originalName")
        size = doc.get("size")
        if name and size:
            key = (name, size)
            if key not in db_lookup:
                db_lookup[key] = []
            db_lookup[key].append((doc, "pending_accessions"))

    print(f"📦 Cached {len(db_lookup)} image records from database.")
    print("🚀 Commencing EXIF extraction and heal...")

    # Walk the local Takeout directory
    for root, dirs, files in os.walk(args.takeout_dir):
        for filename in files:
            if not filename.lower().endswith(('.jpg', '.jpeg')):
                continue
                
            files_scanned += 1
            
            filepath = os.path.join(root, filename)
            size = os.path.getsize(filepath)
            
            # Check if this file exists in our DB
            if (filename, size) not in db_lookup:
                missing_in_db += 1
                continue
                
            db_docs = db_lookup[(filename, size)]
            
            filepath = os.path.join(root, filename)
            rotation = get_exif_rotation(filepath)
            
            if rotation > 0:
                for (db_doc, col_name) in db_docs:
                    current_rotation = db_doc.get("rotation", 0)
                    if current_rotation not in [0, None]:
                        continue # Already fixed manually
                        
                    print(f"🪄 Found Rotated File [{col_name}]: {filename} -> Needs {rotation}°")
                    if not args.dry_run:
                        db[col_name].update_one(
                            {"_id": db_doc["_id"]},
                            {"$set": {"rotation": rotation}}
                        )
                    db_updates += 1

            if files_scanned % 1000 == 0:
                print(f"⏳ Progress: Scanned {files_scanned} files... (Healed: {db_updates})")

    elapsed = str(datetime.timedelta(seconds=int(time.time() - start_time)))
    print("\n=======================================================")
    print(f"🎉 EXIF HEAL COMPLETE in {elapsed}")
    print(f"📂 Total Local Files Scanned: {files_scanned}")
    print(f"🪄 Total Database Heals Applied: {db_updates}")
    print(f"👻 Files found locally but missing in DB: {missing_in_db}")
    print("=======================================================")

if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("\n⚠️ Operation aborted by Architect.")
    finally:
        client.close()
