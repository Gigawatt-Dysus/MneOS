import sys
import io
import time
import urllib.request
import threading
from queue import Queue
from pymongo import MongoClient
import exifread

# ==============================================================================
# CONFIGURATION
# ==============================================================================
MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"
COLLECTION_NAME = "pending_accessions"

WORKER_THREADS = 20  # High concurrency since it's just 64KB header requests!

def process_worker(worker_id, q, db):
    collection = db[COLLECTION_NAME]
    
    while True:
        task = q.get()
        if task is None:
            break
            
        doc_id, url, filename = task
        
        try:
            rotation_fix = 0
            
            # Fetch ONLY the first 64KB (65536 bytes) of the original file
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Range': 'bytes=0-65535'})
            with urllib.request.urlopen(req, timeout=10) as response:
                exif_bytes = response.read()
            
            # Parse the EXIF header
            tags = exifread.process_file(io.BytesIO(exif_bytes), details=False)
            
            for k, v in tags.items():
                if 'Orientation' in k:
                    orientation_val = v.values[0] if v.values else v
                    if orientation_val == 6:
                        rotation_fix = 90
                    elif orientation_val == 8:
                        rotation_fix = 270
                    elif orientation_val == 3:
                        rotation_fix = 180
                    break

            # Update the DB. We set rotation_verified so we don't process it again.
            update_data = {
                "rotation": rotation_fix,
                "rotation_verified": True
            }
            
            collection.update_one({"_id": doc_id}, {"$set": update_data})
            
            if rotation_fix != 0:
                print(f"[Worker-{worker_id}] 🚨 FIXED: {filename} -> {rotation_fix}deg")
            else:
                print(f"[Worker-{worker_id}] ✅ OK: {filename} -> 0deg")

        except Exception as e:
            print(f"[Worker-{worker_id}] ❌ Error on {filename}: {str(e)[:50]}")
            # Mark as verified so we don't get stuck in a loop on corrupted files
            collection.update_one({"_id": doc_id}, {"$set": {"rotation_verified": True, "rotation_error": str(e)[:100]}})
        
        q.task_done()

def process_collection():
    sys.stdout.reconfigure(encoding='utf-8')
    print(f"\n========================================================")
    print(f"🚀 SURGICAL EXIF ROTATION HEALER (64KB BYPASS)")
    print(f"========================================================\n")
    
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    
    # Target only JPEGs that haven't been verified yet
    query = {
        "originalName": {"$regex": r'(?i)\.(jpg|jpeg)$'},
        "rotation_verified": {"$ne": True}
    }
    
    total_found = collection.count_documents(query)
    print(f"Found {total_found} pending JPEGs for rotation healing.")
    
    if total_found == 0:
        print("Everything is processed. Shutting down.")
        client.close()
        return

    # Fetch cursor
    docs = collection.find(query, {"url": 1, "originalName": 1})
    
    q = Queue()
    threads = []
    
    for i in range(WORKER_THREADS):
        t = threading.Thread(target=process_worker, args=(i, q, db))
        t.start()
        threads.append(t)
        
    print("📥 Queuing URLs...")
    count = 0
    for doc in docs:
        doc_id = doc["_id"]
        url = doc.get("url")
        filename = doc.get("originalName", str(doc_id))
        
        if url:
            q.put((doc_id, url, filename))
            count += 1

    print(f"Queued {count} items. Workers are executing...")
    q.join()
    
    for i in range(WORKER_THREADS):
        q.put(None)
    for t in threads:
        t.join()
        
    print("\n✅ Batch complete.")
    client.close()

if __name__ == "__main__":
    process_collection()
