import os
import sys
import json
import base64
import requests
import io
from PIL import Image, ImageOps
from pymongo import MongoClient
import time
from dotenv import load_dotenv

import google.auth
import google.auth.transport.requests
from google.oauth2 import service_account

# Disable DecompressionBombWarning for massive panoramas
Image.MAX_IMAGE_PIXELS = None
sys.stdout.reconfigure(encoding='utf-8')

from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

load_dotenv(r"C:\MneOS\.env.local")

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

SA_PATH = r"C:\MneOS\vertex_sa.json"
if not os.path.exists(SA_PATH):
    print(f"🚨 FATAL: Service account key not found at {SA_PATH}")
    sys.exit(1)

credentials = service_account.Credentials.from_service_account_file(
    SA_PATH, scopes=['https://www.googleapis.com/auth/cloud-platform']
)
auth_req = google.auth.transport.requests.Request()
credentials.refresh(auth_req)

access_token = credentials.token
project_id = credentials.project_id
region = "us-central1"
MODEL_NAME = "gemini-2.5-flash"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

# APOLLO 13 TOKEN SAVING PROTOCOL: Post-stamp resolution to fit in a single API tile
MAX_SIZE = (384, 384) 

def generate_gemini_json_caption(img_data, doc_id):
    # Prepare image
    image = Image.open(io.BytesIO(img_data)).convert("RGB")
    image = ImageOps.exif_transpose(image)
    
    media_doc = db["media"].find_one({"_id": doc_id})
    stored_rotation = media_doc.get("rotation", 0) if media_doc else 0
    if stored_rotation == 90:
        image = image.rotate(-90, expand=True)
    elif stored_rotation == 180:
        image = image.rotate(-180, expand=True)
    elif stored_rotation == 270:
        image = image.rotate(-270, expand=True)

    image.thumbnail(MAX_SIZE)
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG", quality=85)
    b64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')

    # APOLLO 13 TOKEN SAVING PROTOCOL: Ultra-minimal system instruction
    system_instruction = "You are a forensic vision system. Output strictly gender-neutral facts in JSON format. Do not guess subjective details."

    url = f"https://{region}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{region}/publishers/google/models/{MODEL_NAME}:generateContent"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    payload = {
        "systemInstruction": {
            "parts": [{"text": system_instruction}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [
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
            "temperature": 0.0,
            "maxOutputTokens": 256,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "subjects": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                        "description": "Literal subjects like 'person', 'car', 'dog'. NO genders (use person/individual)."
                    },
                    "environment": {
                        "type": "STRING",
                        "description": "Literal physical setting (e.g. paved driveway, interior room)."
                    },
                    "lighting": {
                        "type": "STRING",
                        "description": "Lighting conditions (e.g. harsh sunlight, dark)."
                    },
                    "text_present": {
                        "type": "STRING",
                        "description": "Any highly legible text. Null if none."
                    }
                },
                "required": ["subjects", "environment", "lighting"]
            }
        }
    }
    
    res = requests.post(url, headers=headers, json=payload, timeout=60)
    if res.status_code == 200:
        data = res.json()
        
        # APOLLO 13 TELEMETRY
        usage = data.get("usageMetadata", {})
        in_tokens = usage.get("promptTokenCount", 0)
        out_tokens = usage.get("candidatesTokenCount", 0)
        total_tokens = usage.get("totalTokenCount", 0)
        print(f"   [TELEMETRY] Input: {in_tokens} | Output: {out_tokens} | Total: {total_tokens} tokens")
        
        if "candidates" in data and len(data["candidates"]) > 0:
            json_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            return json.loads(json_text)
        else:
            raise Exception("No candidates returned from Gemini.")
    else:
        raise Exception(f"Gemini API Error {res.status_code}: {res.text}")


def process_test_batch():
    collection = db["media"]
    # Target uncaptioned items! The remaining 20k backlog.
    query = {"caption": {"$exists": False}}
    
    print(f"📦 Searching for uncaptioned backlog items...")
    
    LIMIT = 10 
    docs = list(collection.find(query).limit(LIMIT))
    
    if not docs:
        print("No uncaptioned items found! The backlog is clear.")
        return
        
    print(f"🚀 Launching Apollo 13 Gemini Protocol on {len(docs)} items...")
    
    success_count = 0
    for doc in docs:
        doc_id = doc["_id"]
        filename = doc.get("originalName") or doc.get("fileName") or "Unknown"
        print(f"🔄 Processing [{doc_id}] {filename}...")
        
        thumb_url = None
        if "thumbnailUrls" in doc:
            if "large" in doc["thumbnailUrls"]:
                thumb_url = doc["thumbnailUrls"]["large"]
            elif "medium" in doc["thumbnailUrls"]:
                thumb_url = doc["thumbnailUrls"]["medium"]
        elif "url" in doc:
            thumb_url = doc["url"]
            
        img_data = None
        try:
            if thumb_url and thumb_url.startswith("data:image"):
                raw_b64 = thumb_url.split(",", 1)[1]
                img_data = base64.b64decode(raw_b64)
            elif thumb_url:
                req = requests.get(thumb_url, timeout=15)
                req.raise_for_status()
                img_data = req.content
            else:
                full_doc = collection.find_one({"_id": doc_id}, {"base64Data": 1})
                if full_doc and full_doc.get("base64Data"):
                    raw_b64 = full_doc["base64Data"]
                    if "," in raw_b64:
                        raw_b64 = raw_b64.split(",", 1)[1]
                    img_data = base64.b64decode(raw_b64)
                    
            if not img_data:
                print(f"   ❌ Could not load image data for {doc_id}")
                continue
                
            start_time = time.time()
            caption_json = generate_gemini_json_caption(img_data, doc_id)
            ttft = round(time.time() - start_time, 2)
            
            # Combine JSON into a readable base clinical string
            subjects = ", ".join(caption_json.get("subjects", []))
            base_caption = f"Subjects: {subjects}. Environment: {caption_json.get('environment', 'unknown')}. Lighting: {caption_json.get('lighting', 'unknown')}."
            if caption_json.get("text_present"):
                base_caption += f" Text: {caption_json.get('text_present')}."
                
            print(f"   ✅ Done in {ttft}s | Fact-String: {base_caption}")
            
            # Atomic update
            import datetime
            now = datetime.datetime.utcnow().isoformat() + "Z"
            collection.update_one(
                {"_id": doc_id},
                {"$set": {
                    "caption": base_caption,
                    "triage.summary": base_caption,
                    "aiProcessed": True,
                    "aiModel": "gemini-apollo13",
                    "aiProcessedAt": now,
                    "apollo13_json": caption_json # Save the raw JSON just in case!
                }}
            )
            success_count += 1
            
        except Exception as e:
            print(f"   ❌ Error processing {doc_id}: {e}")
            
    print(f"\n🎉 Apollo 13 Test Flight complete! Successfully processed {success_count} / {len(docs)} items.")

if __name__ == "__main__":
    process_test_batch()
