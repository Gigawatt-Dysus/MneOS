import sys
import threading
import urllib.request
import io
from queue import Queue
from pymongo import MongoClient
from PIL import Image

# ==============================================================================
# DIMENSION BACKFILL — reads pixel dims from just the first 4KB of each thumb
# (PIL can resolve width/height from the WebP/JPEG header without full download)
# Targets records with missing width/height in pending_accessions
# ==============================================================================
MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"
COLLECTION_NAME = "pending_accessions"
WORKER_THREADS = 20
HEADER_RANGE = "bytes=0-4095"  # 4KB is plenty to parse any image header

processed = [0]
lock = threading.Lock()

def worker(worker_id, q, db):
    collection = db[COLLECTION_NAME]
    while True:
        task = q.get()
        if task is None:
            break

        doc_id, thumb_url, filename = task
        try:
            # Only fetch the header — 4KB is enough for PIL to read dimensions
            req = urllib.request.Request(
                thumb_url,
                headers={'User-Agent': 'Mozilla/5.0', 'Range': HEADER_RANGE}
            )
            with urllib.request.urlopen(req, timeout=10) as r:
                header_bytes = r.read()

            img = Image.open(io.BytesIO(header_bytes))
            w, h = img.size

            collection.update_one(
                {"_id": doc_id},
                {"$set": {"width": w, "height": h}}
            )

            with lock:
                processed[0] += 1
                if processed[0] % 1000 == 0:
                    print(f"[Progress] {processed[0]} records done...")

        except Exception as e:
            # Fall back: try downloading a larger chunk
            try:
                req2 = urllib.request.Request(
                    thumb_url,
                    headers={'User-Agent': 'Mozilla/5.0', 'Range': 'bytes=0-32767'}
                )
                with urllib.request.urlopen(req2, timeout=10) as r:
                    fallback_bytes = r.read()
                img = Image.open(io.BytesIO(fallback_bytes))
                w, h = img.size
                collection.update_one({"_id": doc_id}, {"$set": {"width": w, "height": h}})
                with lock:
                    processed[0] += 1
            except Exception as e2:
                print(f"[Worker-{worker_id}] ❌ {filename}: {str(e2)[:60]}")

        q.task_done()

def run():
    sys.stdout.reconfigure(encoding='utf-8')
    print("\n========================================================")
    print("📐 DIMENSION BACKFILL — 4KB Header Scanner")
    print(f"   Threads: {WORKER_THREADS} | Range: {HEADER_RANGE}")
    print("========================================================\n")

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    query = {
        "$or": [
            {"width": None},
            {"height": None},
            {"width": {"$exists": False}},
            {"height": {"$exists": False}}
        ],
        "thumbnailUrls": {"$exists": True, "$ne": None}
    }

    total = collection.count_documents(query)
    print(f"Found {total} records missing width/height. Starting backfill...\n")

    docs = collection.find(query, {"thumbnailUrls": 1, "originalName": 1})

    q = Queue()
    threads = []
    for i in range(WORKER_THREADS):
        t = threading.Thread(target=worker, args=(i, q, db))
        t.start()
        threads.append(t)

    count = 0
    for doc in docs:
        thumb = (doc.get('thumbnailUrls') or {}).get('medium') or (doc.get('thumbnailUrls') or {}).get('small')
        if thumb:
            q.put((doc['_id'], thumb, doc.get('originalName', str(doc['_id']))))
            count += 1

    print(f"Queued {count} items. Workers executing...\n")
    q.join()

    for _ in range(WORKER_THREADS):
        q.put(None)
    for t in threads:
        t.join()

    final = collection.count_documents(query)
    print(f"\n✅ Dimension backfill complete. {total - final} records updated. {final} remaining.")
    client.close()

if __name__ == "__main__":
    run()
