import pymongo
import mimetypes
from urllib.parse import urlparse
import sys
import time

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

def determine_asset_type(filename):
    if not filename:
        return "UNKNOWN"
    
    filename = filename.lower()
    
    # Custom/hardcoded fallbacks for common types
    if filename.endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.tiff')):
        return "IMAGE"
    elif filename.endswith(('.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv')):
        return "VIDEO"
    elif filename.endswith(('.txt', '.md', '.json', '.csv', '.pdf', '.doc', '.docx')):
        return "TEXT"
    elif filename.endswith(('.mp3', '.wav', '.ogg', '.m4a', '.flac')):
        return "AUDIO"
        
    # Fallback to mimetypes library
    mime_type, _ = mimetypes.guess_type(filename)
    if mime_type:
        if mime_type.startswith('image/'): return "IMAGE"
        if mime_type.startswith('video/'): return "VIDEO"
        if mime_type.startswith('text/'): return "TEXT"
        if mime_type.startswith('audio/'): return "AUDIO"
        
    return "UNKNOWN"

def main():
    print(f"\n=========================================")
    print(f"[INIT] Sovereign Matrix - MIME Type & Asset Triage")
    print(f"=========================================\n")
    
    print("🔌 Connecting to Sovereign Matrix (MongoDB)...")
    try:
        # Fast fail if the database isn't reachable
        client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        collection = db['pending_accessions']
        
        print("🔍 Querying for items missing 'assetType'...")
        # Target items that have not been triaged yet
        query = { "$or": [ {"assetType": {"$exists": False}}, {"assetType": "UNKNOWN"} ] }
        
        total_items = collection.count_documents(query)
        print(f"📦 Found {total_items} undocumented items to triage.")
        
        if total_items == 0:
            print("✅ All items have already been triaged! Standing down.")
            return

        cursor = collection.find(query, {"_id": 1, "originalName": 1, "url": 1, "fileName": 1})
        
        updates = []
        batch_size = 5000
        processed = 0
        
        stats = {"IMAGE": 0, "VIDEO": 0, "TEXT": 0, "AUDIO": 0, "UNKNOWN": 0}

        print("🚀 Commencing Triage...")
        start_time = time.time()
        
        for doc in cursor:
            # Try to get the best filename source
            filename = doc.get('originalName') or doc.get('fileName')
            if not filename and doc.get('url'):
                # Extract from URL as last resort
                parsed = urlparse(doc['url'])
                filename = parsed.path.split('/')[-1]
                
            asset_type = determine_asset_type(filename)
            stats[asset_type] = stats.get(asset_type, 0) + 1
            
            updates.append(pymongo.UpdateOne(
                {"_id": doc["_id"]},
                {"$set": {"assetType": asset_type}}
            ))
            
            if len(updates) >= batch_size:
                collection.bulk_write(updates, ordered=False)
                processed += len(updates)
                print(f"⏳ Processed {processed} / {total_items} records...")
                updates.clear()
                
        # Flush the final batch
        if updates:
            collection.bulk_write(updates, ordered=False)
            processed += len(updates)
            print(f"⏳ Processed {processed} / {total_items} records...")
            
        elapsed = time.time() - start_time
        
        print("\n=========================================")
        print("🎉 TRIAGE COMPLETE!")
        print(f"✅ Successfully tagged {processed} items in {elapsed:.2f} seconds.")
        print("📊 ASSET BREAKDOWN:")
        for k, v in stats.items():
            print(f"   - {k}: {v}")
        print("=========================================\n")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
