import os
import sys
import io
import time
import uuid
import datetime
import re
import threading
from queue import Queue
from pymongo import MongoClient
from PIL import Image, ImageOps
import requests
import google.auth
import google.auth.transport.requests
import exifread
import urllib.request

# ==============================================================================
# CONFIGURATION
# ==============================================================================
MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"
COLLECTION_NAME = "pending_accessions"
PROJECT_ID = "gigi-time-machine"
LOCATION = "us-central1"
MODEL_NAME = "gemini-2.5-pro"  # Using 2.5 Pro for mass visual QA and forensics

# Scaling / Rate Limiting
WORKER_THREADS = 5
MAX_SIZE = (1024, 1024)
BATCH_LIMIT = 25  # Strict 25 image test run

# ==============================================================================
# PROMPT ARCHITECTURE WITH HARDWARE GLOSSARY
# ==============================================================================
SYSTEM_INSTRUCTION = """You are a forensic archivist and hardware analyst. Analyze the provided image and the provided metadata date (if available).
1. Provide a dense, highly literal, and objective visual description of the scene. You may identify unmistakable pop-culture characters, brands, or public figures, but do not hallucinate context. Avoid poetic language.
2. Based on the visual characteristics (bokeh, noise, resolution, algorithmic HDR, artifacting) and the provided Date, infer which hardware from the User's Hardware Glossary took the photo.
3. Analyze the physical orientation of the image. If it is sideways or upside down, determine the EXACT degree rotation required to make the image upright (90, 180, 270, or 0 if correct). Note: 90 means rotate 90 degrees clockwise.

USER HARDWARE GLOSSARY:
- Pre-2000: 35mm Film (Scanned physical artifacts, heavy grain)
- 2000-2001: Olympus C700UZ (Early digital, low res)
- 2007: Motorola RAZR V3m (Extremely low quality, flip phone)
- 2008-2009: Apple iPhone 3G (Early smartphone, small sensor)
- 2008-2018: Canon PowerShot SD600 (Compact point and shoot)
- 2008-2019: Nikon D5000 DSLR (True optical depth of field, sharp focus, large sensor)
- 2010s+: Samsung Galaxy S-Series (S7, S8, S9, S10, etc. Computational photography, HDR, modern smartphone wide-angle)
- Any Era: Social Media / Web Download (Memes, screenshots, heavy JPEG artifacting, text overlays)

OUTPUT FORMAT:
DESCRIPTION: <Your literal visual description here>
CAMERA_GUESS: <The specific camera from the glossary>
CAMERA_REASONING: <Brief visual evidence>
"""

# ==============================================================================
# AUTHENTICATION
# ==============================================================================
SERVICE_ACCOUNT_FILE = r"C:\MneOS\serviceAccountKey.json"

def get_access_token():
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = SERVICE_ACCOUNT_FILE
    credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    auth_req = google.auth.transport.requests.Request()
    credentials.refresh(auth_req)
    return credentials.token

# ==============================================================================
# WORKER LOGIC
# ==============================================================================
def process_worker(worker_id, q, db):
    collection = db[COLLECTION_NAME]
    
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {get_access_token()}",
        "Content-Type": "application/json"
    })
    
    API_URL = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{MODEL_NAME}:generateContent"

    while True:
        task = q.get()
        if task is None:
            break
            
        doc_id, url, filename, logical_date, current_retries, img_data = task
        
        try:
            print(f"[Worker-{worker_id}] 🔄 Processing: {filename} (Date: {logical_date})")
            
            # EXACT PIL SEQUENCE TO PRESERVE AND APPLY EXIF
            image = Image.open(io.BytesIO(img_data))
            image = ImageOps.exif_transpose(image) # Fix EXIF rotation BEFORE converting
            image = image.convert("RGB") # Now safe to convert to RGB to strip alpha/exif bloat
            
            image.thumbnail(MAX_SIZE)
            buffered = io.BytesIO()
            image.save(buffered, format="JPEG", quality=85)
            mime_type = "image/jpeg"
            
            # Send to Gemini
            prompt_text = f"Image metadata Date: {logical_date}. Execute instructions."
            
            payload = {
                "systemInstruction": {
                    "parts": [{"text": SYSTEM_INSTRUCTION}]
                },
                "contents": [{
                    "role": "user",
                    "parts": [
                        {"text": prompt_text},
                        {"inlineData": {"mimeType": mime_type, "data": buffered.getvalue().hex()}} # Using hex or base64 based on API constraints. Vertex prefers base64, wait let's use standard base64
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 2048
                },
                "safetySettings": [
                    {
                        "category": "HARM_CATEGORY_HATE_SPEECH",
                        "threshold": "BLOCK_NONE"
                    },
                    {
                        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                        "threshold": "BLOCK_NONE"
                    },
                    {
                        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        "threshold": "BLOCK_NONE"
                    },
                    {
                        "category": "HARM_CATEGORY_HARASSMENT",
                        "threshold": "BLOCK_NONE"
                    }
                ]
            }
            
            import base64
            payload["contents"][0]["parts"][1]["inlineData"]["data"] = base64.b64encode(buffered.getvalue()).decode('utf-8')

            # Call Vertex API
            response = session.post(API_URL, json=payload)
            if response.status_code == 401:
                session.headers.update({"Authorization": f"Bearer {get_access_token()}"})
                response = session.post(API_URL, json=payload)
                
            response.raise_for_status()
            res_json = response.json()
            
            if "candidates" not in res_json or not res_json["candidates"]:
                print(f"[Worker-{worker_id}] ⚠️ API Error / No Candidates: {res_json}")
                raise Exception(f"No candidates returned: {res_json}")
                
            candidate = res_json["candidates"][0]
            if "content" not in candidate:
                print(f"[Worker-{worker_id}] ⚠️ API Error / Blocked Content: {res_json}")
                raise Exception(f"Content blocked or empty: {res_json}")
                
            response_text = candidate["content"]["parts"][0]["text"].strip()
            
            # INTERCEPT PARSING
            description = ""
            camera_guess = ""
            camera_reasoning = ""
            
            desc_match = re.search(r'DESCRIPTION:\s*(.*?)(?=CAMERA_GUESS:)', response_text, re.DOTALL)
            cam_guess_match = re.search(r'CAMERA_GUESS:\s*(.*?)(?=CAMERA_REASONING:)', response_text, re.DOTALL)
            cam_reason_match = re.search(r'CAMERA_REASONING:\s*(.*)', response_text, re.DOTALL)
            
            if desc_match:
                description = desc_match.group(1).strip()
            if cam_guess_match:
                camera_guess = cam_guess_match.group(1).strip()
            if cam_reason_match:
                camera_reasoning = cam_reason_match.group(1).strip()
                
            # Fallback if parsing completely fails
            if not description:
                description = response_text
                print(f"[Worker-{worker_id}] ⚠️ Regex parsing failed. Falling back to raw output.")
            
            now = datetime.datetime.now(datetime.timezone.utc)
            
            update_data = {
                "caption": description,
                "triage.summary": description,
                "aiInferredCamera": {
                    "model": camera_guess,
                    "reasoning": camera_reasoning
                },
                "aiProcessed": True,
                "aiModel": MODEL_NAME,
                "aiProcessedAt": now,
                "originalUrl": url,
                "originalName": filename
            }
            
            # PURE EXIF EXTRACTION (The ultimate truth)
            rotation_fix = 0
            try:
                # Fetch only the first 64KB of the original JPG to save massive bandwidth and time
                req_exif = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Range': 'bytes=0-65535'})
                with urllib.request.urlopen(req_exif) as response_exif:
                    exif_bytes = response_exif.read()
                
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
            except Exception as e:
                print(f"[Worker-{worker_id}] EXIF extraction failed: {e}")
            
            # Absolute Source of Truth: Overwrite any hallucinated or manual rotations with Hardware EXIF
            update_data["rotation"] = rotation_fix
            if rotation_fix != 0:
                print(f"[Worker-{worker_id}] 🚨 Native EXIF match! Applying {rotation_fix}deg fix.")
            
            # Apply correct dimensions based on PIL image
            if rotation_fix in [90, 270]:
                update_data["width"] = image.height
                update_data["height"] = image.width
            else:
                update_data["width"] = image.width
                update_data["height"] = image.height
            
            # Update pending_accessions directly
            collection.update_one({"_id": doc_id}, {"$set": update_data})
            print(f"[Worker-{worker_id}] ✅ Success: {filename} -> Camera: {camera_guess}")
            
            time.sleep(1) # Soft rate limit

        except Exception as e:
            print(f"[Worker-{worker_id}] ❌ Error processing {filename}: {e}")
            collection.update_one(
                {"_id": doc_id}, 
                {"$inc": {"aiRetryCount": 1}, "$set": {"aiLastError": str(e)}}
            )
            time.sleep(2)
        
        q.task_done()

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================
def process_collection():
    sys.stdout.reconfigure(encoding='utf-8')
    print(f"\n========================================================")
    print(f"🚀 MNEOS V2 - MASS INGESTION ENGINE: {MODEL_NAME}")
    print(f"========================================================\n")
    
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    
    # Query for unprocessed items (No AI Processed Flag)
    docs = list(db[COLLECTION_NAME].find({
        "aiProcessed": {"$ne": True}
    }).limit(BATCH_LIMIT))
    total_found = len(docs)
    print(f"Found {total_found} pending items for processing in this batch.")
    
    if total_found == 0:
        print("Everything is processed. Shutting down.")
        client.close()
        return

    worker_id = f"worker-{str(uuid.uuid4())[:6]}"
    session = requests.Session()
    
    q = Queue()
    threads = []
    
    for i in range(WORKER_THREADS):
        t = threading.Thread(target=process_worker, args=(i, q, db))
        t.start()
        threads.append(t)
        
    print("📥 Claiming and downloading payload...")
    for doc in docs:
        doc_id = doc["_id"]
        url = doc.get("url")
        filename = doc.get("originalName", str(doc_id))
        logical_date = doc.get("logicalDate", "Unknown")
        retries = doc.get("aiRetryCount", 0)
        
        if not url:
            print(f"Skipping {filename} - no URL")
            continue
            
        try:
            resp = session.get(url, timeout=10)
            resp.raise_for_status()
            q.put((doc_id, url, filename, logical_date, retries, resp.content))
        except Exception as e:
            print(f"Failed to download {filename}: {e}")
            collection.update_one({"_id": doc_id}, {"$inc": {"aiRetryCount": 1}})

    q.join()
    
    for i in range(WORKER_THREADS):
        q.put(None)
    for t in threads:
        t.join()
        
    print("\n✅ Batch complete.")
    client.close()

if __name__ == "__main__":
    process_collection()
