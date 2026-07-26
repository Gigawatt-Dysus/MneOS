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

from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

from dotenv import load_dotenv
load_dotenv(r"C:\MneOS\.env.local")

from google.oauth2 import service_account
MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

# Using Gemini 2.5 Flash via Vertex AI SDK (Consuming $300 GCP Credits)
MODEL_NAME = "gemini-2.5-flash" 
SERVICE_ACCOUNT_FILE = r"C:\MneOS\serviceAccountKey.json"

if not os.path.exists(SERVICE_ACCOUNT_FILE):
    print(f"🚨 FATAL: {SERVICE_ACCOUNT_FILE} not found! Halting.")
    sys.exit(1)

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = SERVICE_ACCOUNT_FILE

with open(SERVICE_ACCOUNT_FILE, 'r') as f:
    key_data = json.load(f)
PROJECT_ID = key_data.get("project_id", "gigi-time-machine")

from google import genai
from google.genai import types

# Initialize a thread-safe global Vertex AI client
vertex_client = genai.Client(vertexai=True, project=PROJECT_ID, location="us-central1")

# 384x384 max constraint. We downsample in Python to reduce the base64 string size, saving tokens!
MAX_SIZE = (384, 384)

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

import random
def process_worker(q, collection):
    # Stagger thread startup to prevent a massive 10-thread concurrency burst 
    # that trips Google's instant load-balancer rate limits.
    time.sleep(random.uniform(0.1, 2.5))
    
    while True:
        task = q.get()
        if task is None:
            break
            
        doc_id, url, filename, current_retries, img_data, hash_val = task
        
        try:
            print(f"🔄 Processing [{doc_id}] {filename} (Retry: {current_retries})...")
            
            image = Image.open(io.BytesIO(img_data)).convert("RGB")
            image = ImageOps.exif_transpose(image) # Fix EXIF rotation (if any remains)
            
            # Apply our new Sovereign orientation heuristic if present
            media_doc = db["media"].find_one({"_id": doc_id})
            stored_rotation = media_doc.get("rotation", 0) if media_doc else 0
            if stored_rotation == 90:
                image = image.rotate(-90, expand=True)
            elif stored_rotation == 180:
                image = image.rotate(-180, expand=True)
            elif stored_rotation == 270:
                image = image.rotate(-270, expand=True)
            
            # In-memory resize to strictly prevent API token bloat
            image.thumbnail(MAX_SIZE)
            buffered = io.BytesIO()
            image.save(buffered, format="JPEG", quality=85)
            b64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')
            
            # Start the prompt without explicitly forcing the filename into the model's mouth
            prompt = "You are a family historian looking through a massive archive of family photos and historical documents. Analyze this image with a warm, respectful, and observant eye."
            if "Screenshot" in filename or "Capture" in filename:
                prompt += f" (Note: System filename indicates it might be a screenshot: {filename}). If this is a screenshot, extract the core text and explain what the interface or conversation is about."
            
            # Contextual Anchoring: Fetch parent event to guide Grok
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
                    prompt += f"\n\nCONTEXT FROM JOURNAL ENTRY: '{context_chunk}'\n\nUse this context to inform your description of relationships, object colors, or locations if they appear in the image, but DO NOT hallucinate things from the text that are not actually visible. Describe the people present without attempting to run facial recognition."
            
            prompt += "\n\nCRITICAL INSTRUCTIONS:\n1. Jump straight into the description. DO NOT start with boilerplate like 'This image shows' or 'Here we see'.\n2. DO NOT repeat the filename.\n3. Provide a dense, highly literal, and objective visual description of the scene. Focus strictly on visible objects, people, colors, text, and physical actions. Avoid all poetic language, emotional fluff, or novelistic scene-setting. We need high-signal keywords for vector search.\n4. Write a concise, information-rich paragraph. DO NOT provide short fragments, but do not pad with flowery prose.\n5. DO NOT hallucinate or invent details."
            
            # --- VERTEX AI SDK INVOCATION ---
            start_time = time.time()
            
            vertex_retry_count = 0
            while True:
                try:
                    res = vertex_client.models.generate_content(
                        model=MODEL_NAME,
                        contents=[
                            prompt,
                            types.Part.from_bytes(data=buffered.getvalue(), mime_type="image/jpeg")
                        ],
                        config=types.GenerateContentConfig(
                            temperature=0.2,
                            max_output_tokens=4096,
                            safety_settings=[
                                types.SafetySetting(
                                    category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                                ),
                                types.SafetySetting(
                                    category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                                ),
                                types.SafetySetting(
                                    category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                                ),
                                types.SafetySetting(
                                    category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                                ),
                            ]
                        )
                    )
                    caption = res.text.strip()
                    break # Success!
                except Exception as e:
                    err_str = str(e)
                    if '429' in err_str or 'Rate limited' in err_str or 'Quota' in err_str:
                        vertex_retry_count += 1
                        wait_time = min(10 * vertex_retry_count, 60)
                        print(f"   ⏳ Rate limited (429) by Vertex AI for {doc_id}. Waiting {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise e # Throw it to the outer try/except for strike handling
            # -------------------------------------
            ttft = round(time.time() - start_time, 2)
            
            print(f"   ✅ [VERTEX AI] Done in {ttft}s | Caption: {caption.replace(chr(10), ' ')}")
            
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
                emb_res = requests.post(voyage_url, headers=voyage_headers, json=v_payload, timeout=15)
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
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                print(f"   ⚠️ Rate limited (429)! Google says: {e.response.text}")
                time.sleep(10)
            else:
                print(f"   ❌ HTTP Error processing {doc_id}: {e}")
            
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
                
        except Exception as e:
            print(f"   ❌ Generic Error processing {doc_id}: {e}")
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

    # Clean exit for thread

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
        "claimed_by": None,
        "aiRetryCount": None
    }
    
    total_remaining = collection.count_documents(query)
    print(f"📦 System total: {total_remaining} pending images in {collection_name}")
    
    LIMIT = 500
    projection = {
        "base64Data": 0, 
        "embedding": 0   
    }
    
    print(f"🍬 [PEZ SYSTEM] Dispensing up to {LIMIT} documents for exclusive checkout...")
    
    # 3. Optimized Bulk Checkout
    now = datetime.datetime.utcnow().isoformat() + "Z"
    
    # Run exact matches because $in and $or are failing on MongoDB index
    candidate_ids = []
    for mime in ["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif"]:
        exact_query = query.copy()
        exact_query["fileType"] = mime
        docs = list(collection.find(exact_query, {"_id": 1}).limit(LIMIT - len(candidate_ids)))
        candidate_ids.extend([d["_id"] for d in docs])
        if len(candidate_ids) >= LIMIT:
            break
    
    claimed_docs = []
    if candidate_ids:
        # Atomically claim the candidates that are STILL unclaimed
        claim_result = collection.update_many(
            {"_id": {"$in": candidate_ids}, "claimed_by": None},
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
        return (0, total_remaining)
        
    for doc in claimed_docs:
        docs_found += 1
        filename = doc.get("originalName") or doc.get("fileName")
        hash_val = None
        
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
    
    if docs_found == 0:
        return (0, total_remaining)
    
    staging_dir = r"C:\MneOS\temp_vision_staging"
    os.makedirs(staging_dir, exist_ok=True)
    
    # [ZEN PIPELINE ARCHITECTURE]: Thread-safe Producer-Consumer Queue
    WORKER_THREADS = 10
    # Increase maxsize slightly so the producer can keep all 10 threads fed
    work_queue = Queue(maxsize=WORKER_THREADS * 2) 
    
    # Start consumer threads
    consumer_threads = []
    for _ in range(WORKER_THREADS):
        t = threading.Thread(target=process_worker, args=(work_queue, collection), daemon=True)
        t.start()
        consumer_threads.append(t)
    
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
    
    # Stop the workers
    for _ in range(WORKER_THREADS):
        work_queue.put(None)
    for t in consumer_threads:
        t.join()
        
    return (docs_found, total_remaining)

try:
    while True:
        m_res = process_collection("media") or (0, 0)
        p_res = process_collection("pending_accessions") or (0, 0)
        
        m_found, m_remaining = m_res
        p_found, p_remaining = p_res
        
        # If there are TRULY NO MORE images remaining in the database, we can safely exit.
        if m_remaining == 0 and p_remaining == 0:
            print("\n🎉 Sweep Complete. All media processed.")
            break
            
        # If there ARE images remaining, but we got 0 THIS loop, it means we lost the race 
        # to another node. We should sleep briefly and try again.
        if m_found == 0 and p_found == 0:
            print(f"   ⏳ Nodes competing for checkout. Resting 5 seconds before next attempt...")
            time.sleep(5)
except KeyboardInterrupt:
    print("\n⚠️ Sweep safely interrupted by user.")
finally:
    client.close()
