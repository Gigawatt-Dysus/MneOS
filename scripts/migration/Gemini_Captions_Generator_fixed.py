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

import faulthandler
faulthandler.enable(file=open(r"C:\MneOS\alpha_crash_log.txt", "w", encoding="utf-8"))

from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

from dotenv import load_dotenv
load_dotenv(r"C:\MneOS\.env.local")

from google.oauth2 import service_account
import google.auth.transport.requests

# Using Gemini 2.5 Flash via Vertex AI SDK (Consuming $300 GCP Credits)
MODEL_NAME = "gemini-2.5-flash"
SERVICE_ACCOUNT_FILE = r"C:\MneOS\vertex_sa.json"

if not os.path.exists(SERVICE_ACCOUNT_FILE):
    print(f"🚨 FATAL: {SERVICE_ACCOUNT_FILE} not found! Halting.")
    sys.exit(1)

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=['https://www.googleapis.com/auth/cloud-platform']
)
auth_req = google.auth.transport.requests.Request()
credentials.refresh(auth_req)

access_token = credentials.token
PROJECT_ID = credentials.project_id
REGION = "us-central1"

# We use raw REST requests to bypass the deprecated genai SDK
global_token_refresh_time = time.time()

# 384x384 max constraint. We downsample in Python to reduce the base64 string size, saving tokens!
MAX_SIZE = (384, 384)

# MongoDB connection details (Tailscale IP for Genesis Alpha)
MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

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
            
        # Start the prompt with Grok's strict forensic rules
            prompt = (
                "You are a precise forensic archivist creating searchable descriptions for a personal life archive.\n\n"
                "Describe ONLY what is literally visible. Be factual and concise.\n"
                "- Pay strict attention to color accuracy and the true physical state of objects (e.g., if grass is yellow/dead, do not describe it as 'lush green').\n"
                "- Be specific with animal coat colors and patterns (e.g., 'orange and white tabby', 'black and white tuxedo', 'calico') rather than defaulting to generic terms like 'brown'.\n"
                "- Carefully distinguish physical boundaries between objects of similar colors (e.g., do not say a white blanket is 'draped over' a white cat if the cat is simply lying on it).\n"
                "- WARNING: In low-light or flash photography, colors are degraded. Do not assume a high-contrast dark and light animal is 'black and white' if the true color is obscured by shadow.\n"
                "- Use common sense for household items (e.g., items on a refrigerator are likely magnets or photos, not 'posts').\n"
                "- Default to common domestic animals (cats, dogs) in residential settings unless explicitly obvious otherwise. Do not hallucinate exotic animals like lemurs.\n"
                "- DO NOT guess the room type and hallucinate associated furniture (e.g. do not invent 'cupboards' just because you see wood paneling). If you cannot clearly identify an object, do not name it.\n"
                "- DO NOT infer emotional states or anthropomorphize (e.g., do NOT say an animal looks 'peaceful', 'happy', or 'content').\n"
                "- DO NOT guess the state of obscured body parts. If eyes are hidden by an angle, do not claim they are 'closed'.\n"
                "- DO NOT hallucinate 'various objects' in blurry or dark backgrounds. If it is blurry, ignore it.\n"
                "- Strictly use standard American English vocabulary (e.g., use 'trash can' or 'garbage can', NEVER 'dustbin' or 'rubbish bin').\n"
                "- Use gender-neutral terms for adults ('a person', 'an individual').\n"
                "- Never guess identities, relationships, locations, or intentions.\n"
                "- If something is unclear or shadowed, say 'unidentified' or 'partially visible'.\n"
                "- Transcribe text only if fully legible.\n\n"
                "Output a single, clean paragraph. Maximum 180 words.\n"
                "CRITICAL: Begin your paragraph directly with the subject. Do NOT use introductory phrases like 'The image shows', 'This is a picture of', or 'Here we see'."
            )
            
            # Contextual Anchoring: Filename and Parent Event
            original_name = filename if filename and filename != "Unknown" else ""
            if original_name:
                prompt += f"\n\n[FILE NAME HINT]: '{original_name}' (Use this to inform context, e.g., if it says 'cat' or 'Woo', it is likely a domestic cat, not a wild animal.)"
            
            # Contextual Anchoring: Fetch parent event to guide AI
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
                    prompt += f"\n\n[SUPPLEMENTAL CONTEXT]: '{context_chunk}'\nUse this context ONLY to properly name locations or objects if they are visually obvious. Do NOT violate the core forensic rules."
            
            # --- VERTEX AI REST INVOCATION ---
            global access_token, global_token_refresh_time, credentials, auth_req
            # Refresh token if it's been more than 45 minutes
            if time.time() - global_token_refresh_time > 2700:
                credentials.refresh(auth_req)
                access_token = credentials.token
                global_token_refresh_time = time.time()

            start_time = time.time()
            vertex_retry_count = 0
            
            url = f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/{MODEL_NAME}:generateContent"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": prompt},
                            {
                                "inlineData": {
                                    "mimeType": "image/jpeg",
                                    "data": b64_image
                                }
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.15,
                    "maxOutputTokens": 512,
                    "topP": 0.85
                }
            }

            while True:
                try:
                    res = requests.post(url, headers=headers, json=payload, timeout=60)
                    if res.status_code == 200:
                        data = res.json()
                        if "candidates" in data and len(data["candidates"]) > 0:
                            caption = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                            break
                        else:
                            raise Exception("No candidates returned from Gemini.")
                    elif res.status_code == 429:
                        vertex_retry_count += 1
                        wait_time = min(10 * vertex_retry_count, 60)
                        print(f"   ⏳ Rate limited (429) by Vertex AI for {doc_id}. Waiting {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise Exception(f"API Error {res.status_code}: {res.text}")
                        
                except requests.exceptions.RequestException as e:
                    raise Exception(f"Network error during API call: {str(e)}")
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
                "aiModel": "gemini-test",
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
    USER_ID = "9MPVGVTxE8dXvkCrl1XrWHQzCl23" # [ZEN] Eric's UID
    query = {
        "userId": USER_ID, # [ZEN] Crucial multi-tenant isolation!
        "aiProcessed": False, 
        "claimed_by": None,
        "aiRetryCount": None,
        "$or": [
            {"originalName": {"$regex": "Whisk", "$options": "i"}},
            {"fileName": {"$regex": "Whisk", "$options": "i"}},
            {"originalName": {"$regex": "Snick", "$options": "i"}},
            {"fileName": {"$regex": "Snick", "$options": "i"}},
            {"originalName": {"$regex": "Woo ", "$options": "i"}},
            {"fileName": {"$regex": "Woo ", "$options": "i"}}
        ]
    }
    
    total_remaining = collection.count_documents(query)
    print(f"📦 System total: {total_remaining} pending images in {collection_name}")
    
    LIMIT = 300
    projection = {
        "base64Data": 0, 
        "embedding": 0   
    }
    
    print(f"🍬 [PEZ SYSTEM] Dispensing up to {LIMIT} documents for exclusive checkout...")
    
    # 3. Optimized Bulk Checkout
    now = datetime.datetime.utcnow().isoformat() + "Z"
    
    query["type"] = "IMAGE"
    docs = list(collection.find(query, {"_id": 1}).limit(LIMIT))
    candidate_ids = [d["_id"] for d in docs]
    
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
        # m_res = process_collection("media") or (0, 0)
        p_res = process_collection("pending_accessions") or (0, 0)
        
        m_found, m_remaining = 0, 0 # m_res[0], m_res[1]
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
            
        print("\n🛑 [TEST MODE] Halting after one loop. Remove the break statement on line 458 to run continuously.")
        break
except KeyboardInterrupt:
    print("\n⚠️ Sweep safely interrupted by user.")
finally:
    client.close()
