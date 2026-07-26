import os
import sys
import json
import base64
import requests
import io
from PIL import Image, ImageOps
from pymongo import MongoClient
import time
import sqlite3
import shutil
import gc
import threading
from queue import Queue

# Disable DecompressionBombWarning for massive panoramas/TIFFs from Google Takeout
Image.MAX_IMAGE_PIXELS = None

# Force UTF-8 for Windows console (mojibake prevention)
sys.stdout.reconfigure(encoding='utf-8')

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

# [LOCAL CONFIGURATION]
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MODEL_NAME = "moondream:latest"

# 384x384 max constraint. The mobile RTX 3050 has 6GB VRAM (with ~1.5-2GB eaten by Windows display overhead), so we must downsample to fit the remaining ~4GB.
MAX_SIZE = (384, 384)

print(f"🔥 Forging Victus AI Sweeper ({MODEL_NAME}) targeting localhost...")
client = MongoClient(MONGO_URI)
db = client[DB_NAME]

def process_worker(q, collection, conn_str):
    # Need a separate sqlite connection per thread
    conn = sqlite3.connect(conn_str, timeout=15.0)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA busy_timeout=5000;")

    while True:
        task = q.get()
        if task is None:
            break
            
        doc_id, url, filename, current_retries, img_data, hash_val = task
        
        try:
            print(f"🔄 Processing [{doc_id}] {filename} (Retry: {current_retries})...")
            
            image = Image.open(io.BytesIO(img_data)).convert("RGB")
            image = ImageOps.exif_transpose(image) # Fix EXIF rotation
            
            # In-memory resize to strictly prevent VRAM spikes on the 3050
            image.thumbnail(MAX_SIZE)
            buffered = io.BytesIO()
            image.save(buffered, format="JPEG", quality=85)
            b64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')
            
            # Send to local Ollama with filename context to prevent mechanical hallucinations
            prompt = f"This image is named '{filename}'."
            
            # Contextual Anchoring: Fetch parent event to guide Moondream
            parent_event = db["events"].find_one({"mediaIds": doc_id})
            if parent_event:
                title = parent_event.get("title", "")
                details = parent_event.get("details", "")
                
                # Strip basic markdown images to save tokens and prevent confusion
                import re
                clean_details = re.sub(r'!\[.*?\]\(.*?\)', '', details)
                clean_details = re.sub(r'\[.*?\]\(.*?\)', '', clean_details)
                
                context_chunk = f"{title}. {clean_details}"[:800].strip()
                if context_chunk:
                    prompt += f"\n\nCONTEXT FROM JOURNAL ENTRY: '{context_chunk}'\n\nUse this context to accurately identify the specific names of people, object colors, or locations if they appear in the image, but DO NOT hallucinate things from the text that are not actually visible in the image."
            
            prompt += "\n\nDescribe this image precisely and objectively. Focus on the overall scene, people, actions, and environment. CRITICAL: DO NOT hallucinate or invent details. If an object is blurry, do not guess its contents. If you cannot clearly see the color of hair, vehicles, or clothing, do not state a color. Only describe what is undeniably visible."
            
            payload = {
                "model": MODEL_NAME,
                "prompt": prompt,
                "images": [b64_image],
                "stream": False,
                "options": {
                    "num_ctx": 4096
                }
            }
            
            start_time = time.time()
            res = requests.post(OLLAMA_URL, json=payload)
            res.raise_for_status()
            result = res.json()
            caption = result.get("response", "").strip()
            ttft = round(time.time() - start_time, 2)
            
            print(f"   ✅ [MOONDREAM] Done in {ttft}s | Caption: {caption.replace(chr(10), ' ')}")
            
            # --- NEW: Inline Vectorization via Voyage 4 ---
            embedding = None
            try:
                voyage_url = "https://api.voyageai.com/v1/embeddings"
                voyage_headers = {
                    "Authorization": "Bearer pa-Pd0jzTCrkPtvT6MqHkFPKHvNWp1YYqXNAkbQrUTaPoj",
                    "Content-Type": "application/json"
                }
                v_payload = {
                    "input": [caption],
                    "model": "voyage-large-2-instruct"
                }
                emb_res = requests.post(voyage_url, headers=voyage_headers, json=v_payload)
                if emb_res.status_code == 200:
                    v_result = emb_res.json()
                    embedding = v_result['data'][0]['embedding']
            except Exception as emb_e:
                print(f"   ⚠️ Warning: Failed to generate embedding: {emb_e}")
            
            import datetime
            now = datetime.datetime.utcnow().isoformat() + "Z"
            
            update_data = {
                "caption": caption, 
                "triage.summary": caption, 
                "aiProcessed": True,
                "aiModel": MODEL_NAME,
                "aiProcessedAt": now
            }
            if embedding:
                update_data["embedding"] = embedding
                
            # Atomic update
            collection.update_one(
                {"_id": doc_id},
                {"$set": update_data}
            )
            
            # Atomic update SQLite for local staging dashboard viewing
            if hash_val:
                cursor.execute("UPDATE airlock_jobs SET caption = ?, processed_at = CURRENT_TIMESTAMP WHERE hash = ?", (caption, hash_val))
                conn.commit()
            
        except Exception as e:
            print(f"   ❌ Error processing {doc_id}: {e}")
            new_retries = current_retries + 1
            if new_retries >= 3:
                print(f"   🚨 Strike 3! Marking as permanently failed.")
                collection.update_one(
                    {"_id": doc_id},
                    {"$set": {"aiProcessed": True, "error_msg": f"Failed 3 times. Last error: {str(e)}"}, "$inc": {"aiRetryCount": 1}}
                )
            else:
                print(f"   ♻️ Strike {new_retries}. Returning to queue.")
                collection.update_one(
                    {"_id": doc_id},
                    {"$set": {"error_msg": str(e)}, "$inc": {"aiRetryCount": 1}}
                )
        finally:
            image = None
            buffered = None
            b64_image = None
            img_data = None
            gc.collect()
            q.task_done()

    conn.close()

def process_collection(collection_name):
    import uuid
    import datetime
    session_id = f"worker-{uuid.uuid4().hex[:6]}"
    
    print(f"\n📡 Sweeping collection: {collection_name} | Node ID: {session_id}")
    collection = db[collection_name]
    
    # 1. Unlock stale claims (nodes that crashed and held Pez candies for > 2 hours)
    two_hours_ago = (datetime.datetime.utcnow() - datetime.timedelta(hours=2)).isoformat() + "Z"
    unlocked = collection.update_many(
        {"aiProcessed": False, "claim_time": {"$lt": two_hours_ago}},
        {"$unset": {"claimed_by": "", "claim_time": ""}}
    )
    if unlocked.modified_count > 0:
        print(f"🔓 Unlocked {unlocked.modified_count} stale candies from previous crashed sessions.")

    # 2. Base query for available work (must not be claimed)
    query = {
        "aiProcessed": False, 
        "claimed_by": {"$exists": False},
        "aiRetryCount": {"$in": [None, 0, 1, 2]},
        "$or": [
            {"fileType": {"$regex": "^image/", "$options": "i"}},
            {"type": "IMAGE"}
        ]
    }
    
    total_remaining = collection.count_documents({"aiProcessed": False, "aiRetryCount": {"$in": [None, 0, 1, 2]}})
    print(f"📦 System total: {total_remaining} pending images in {collection_name}")
    
    LIMIT = 500
    projection = {
        "base64Data": 0, 
        "embedding": 0   
    }
    
    print(f"🍬 [PEZ SYSTEM] Dispensing up to {LIMIT} documents for exclusive checkout...")
    
    # 3. Optimized Bulk Checkout
    now = datetime.datetime.utcnow().isoformat() + "Z"
    
    # Fast scan to find candidate IDs
    candidate_docs = list(collection.find(query, {"_id": 1}).limit(LIMIT))
    candidate_ids = [doc["_id"] for doc in candidate_docs]
    
    claimed_docs = []
    if candidate_ids:
        # Atomically claim the candidates that are STILL unclaimed
        claim_result = collection.update_many(
            {"_id": {"$in": candidate_ids}, "claimed_by": {"$exists": False}},
            {"$set": {"claimed_by": session_id, "claim_time": now}}
        )
        
        # Fetch the full payloads for the ones we successfully won
        if claim_result.modified_count > 0:
            claimed_docs = list(collection.find(
                {"_id": {"$in": candidate_ids}, "claimed_by": session_id}, 
                projection
            ))
            
    tasks = []
    docs_found = len(claimed_docs)
    
    if docs_found == 0:
        return
        
    print(f"🗄️ Querying SQLite staging.db to map {docs_found} claimed documents to physical paths...")
    sqlite_db_path = r'C:\MneOS\staging.db'
    conn = sqlite3.connect(sqlite_db_path, timeout=5.0)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA busy_timeout=5000;")
    
    for doc in claimed_docs:
        docs_found += 1
        filename = doc.get("originalName") or doc.get("fileName")
        hash_val = None
        
        if filename:
            cursor.execute("SELECT hash FROM airlock_jobs WHERE filename = ? LIMIT 1", (filename,))
            row = cursor.fetchone()
            if row:
                hash_val = row[0]
        
        # Determine the thumbnail URL
        thumb_url = None
        if "thumbnailUrls" in doc and "medium" in doc["thumbnailUrls"]:
            thumb_url = doc["thumbnailUrls"]["medium"]
        elif "url" in doc:
            thumb_url = doc["url"] # Fallback to full size B2 if no thumb

        # Only store lightweight metadata in the array
        doc_id = doc["_id"]
        current_retries = doc.get("aiRetryCount", 0)
        tasks.append((doc_id, thumb_url, filename or "Unknown", current_retries, hash_val))
    
    conn.close()

    if docs_found == 0:
        return
    
    staging_dir = r"C:\MneOS\temp_vision_staging"
    os.makedirs(staging_dir, exist_ok=True)
    
    # [ZEN PIPELINE ARCHITECTURE]: Thread-safe Producer-Consumer Queue
    # Producer thread fetches tiny WEBP thumbnails from B2 into RAM.
    # Consumer thread pushes RAM buffer to Ollama API. 
    # This overlaps the GPU inference time with the internet fetch times!
    work_queue = Queue(maxsize=5) # Small maxsize to prevent RAM bloat
    
    # Start consumer thread
    consumer_thread = threading.Thread(target=process_worker, args=(work_queue, collection, sqlite_db_path), daemon=True)
    consumer_thread.start()
    
    for doc_id, thumb_url, filename, current_retries, hash_val in tasks:
        try:
            # [ZEN FIX] Fast-pass skip for Google Takeout -edited files to save compute
            if "-edited" in (filename or "").lower():
                print(f"   ⏩ [PRODUCER] Skipping Google Takeout edit variant: {filename}")
                import datetime
                now = datetime.datetime.utcnow().isoformat() + "Z"
                collection.update_one(
                    {"_id": doc_id},
                    {"$set": {
                        "caption": "[Skipped: Edit Variant]",
                        "triage.summary": "[Skipped: Edit Variant]",
                        "aiProcessed": True,
                        "aiModel": "skipped",
                        "aiProcessedAt": now
                    }}
                )
                continue

            img_data = None
            
            if thumb_url and thumb_url.startswith("data:image"):
                raw_b64 = thumb_url.split(",", 1)[1]
                img_data = base64.b64decode(raw_b64)
                
            elif thumb_url:
                print(f"   ☁️ [PRODUCER] Fetching tiny B2 thumbnail: {thumb_url.split('/')[-1]}")
                req = requests.get(thumb_url, timeout=15)
                req.raise_for_status()
                img_data = req.content
            else:
                # [ZEN PATCH]: On-demand JIT fetch for base64 payloads to save RAM
                full_doc = collection.find_one({"_id": doc_id}, {"base64Data": 1})
                if full_doc and full_doc.get("base64Data"):
                    raw_b64 = full_doc["base64Data"]
                    if "," in raw_b64:
                        raw_b64 = raw_b64.split(",", 1)[1]
                    img_data = base64.b64decode(raw_b64)
                else:
                    raise ValueError("No URL, base64Data, or local filepath found")
            
            if img_data:
                # Put the loaded raw image into the queue. This will block if Ollama is busy and queue is full
                work_queue.put((doc_id, thumb_url, filename, current_retries, img_data, hash_val))
            
        except Exception as e:
            print(f"   ❌ [PRODUCER] Error loading {doc_id}: {e}")
            new_retries = current_retries + 1
            if new_retries >= 3:
                collection.update_one({"_id": doc_id}, {"$set": {"aiProcessed": True, "error_msg": f"Failed 3 times. {str(e)}"}, "$inc": {"aiRetryCount": 1}})
            else:
                collection.update_one({"_id": doc_id}, {"$set": {"error_msg": str(e)}, "$inc": {"aiRetryCount": 1}})

    # Wait for the queue to empty
    work_queue.join()
    # Stop the worker
    work_queue.put(None)
    consumer_thread.join()

try:
    process_collection("media")
    process_collection("pending_accessions")
    print("\n🎉 Sweep Complete. All media processed.")
except KeyboardInterrupt:
    print("\n⚠️ Sweep safely interrupted by user.")
finally:
    client.close()
