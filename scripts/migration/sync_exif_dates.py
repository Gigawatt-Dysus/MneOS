import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import requests
import io
import datetime
from PIL import Image, ExifTags
from pymongo import MongoClient

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db["pending_accessions"]

# Target the 106 gemini-test items to fix their timeline position immediately
query = {"aiModel": "gemini-test"}
docs = list(collection.find(query))

print(f"📦 Found {len(docs)} documents to forensic-sync.")

updated_count = 0

for doc in docs:
    url = doc.get("url")
    if not url:
        print(f"⚠️ Skipping {doc['_id']}: No primary URL found.")
        continue
    
    try:
        # We only need the EXIF headers, which are always at the start of the file.
        # Grabbing just the first 128KB saves massive bandwidth and time.
        headers = {"Range": "bytes=0-131071"}
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code in (200, 206):
            img_data = response.content
            # Suppress DecompressionBomb warning since we are reading partial data anyway
            Image.MAX_IMAGE_PIXELS = None
            
            # Using ImageFile.LOAD_TRUNCATED_IMAGES allows PIL to parse headers even 
            # if we artificially cut off the rest of the image stream.
            from PIL import ImageFile
            ImageFile.LOAD_TRUNCATED_IMAGES = True
            
            img = Image.open(io.BytesIO(img_data))
            
            exif_data = img._getexif()
            if exif_data:
                # 36867 is DateTimeOriginal, 306 is DateTime (Modification)
                date_str = exif_data.get(36867) or exif_data.get(306)
                
                if date_str:
                    # EXIF format is usually "YYYY:MM:DD HH:MM:SS"
                    # We need to convert it to ISO 8601 for Sovereign DB compatibility
                    parts = date_str.split(" ")
                    if len(parts) == 2:
                        date_part = parts[0].replace(":", "-")
                        time_part = parts[1]
                        iso_date = f"{date_part}T{time_part}.000Z"
                        
                        year = int(date_part.split("-")[0])
                        
                        print(f"✅ Extracted {iso_date} for {doc.get('originalName', doc['_id'])}")
                        
                        # Apply atomic update to the DB
                        collection.update_one(
                            {"_id": doc["_id"]},
                            {"$set": {
                                "logicalDate": iso_date,
                                "year": year,
                                "datePrecision": "exact"
                            }}
                        )
                        updated_count += 1
                        continue
                        
            print(f"⚠️ No EXIF DateTime found in header for {doc.get('originalName', doc['_id'])}")
        else:
            print(f"❌ HTTP {response.status_code} fetching {url}")
            
    except Exception as e:
        print(f"❌ Error processing {doc.get('originalName', doc['_id'])}: {e}")

print(f"\n🚀 Done! Successfully backfilled true EXIF dates for {updated_count} documents.")
