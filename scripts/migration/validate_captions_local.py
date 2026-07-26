import os
import sys
import json
import base64
import requests
import io
from PIL import Image, ImageOps
from pymongo import MongoClient
import time

# Force UTF-8 for Windows console
sys.stdout.reconfigure(encoding='utf-8')

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

OLLAMA_URL = "http://localhost:11434/api/generate"
# You can change this to "qwen2.5-vl:3b" or "llava" if you have them pulled
MODEL = "moondream" 

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db["pending_accessions"]

def get_image_data(doc):
    thumb_url = None
    if "thumbnailUrls" in doc:
        if "large" in doc["thumbnailUrls"]:
            thumb_url = doc["thumbnailUrls"]["large"]
        elif "medium" in doc["thumbnailUrls"]:
            thumb_url = doc["thumbnailUrls"]["medium"]
    elif "url" in doc:
        thumb_url = doc["url"]
        
    img_data = None
    if thumb_url and thumb_url.startswith("data:image"):
        raw_b64 = thumb_url.split(",", 1)[1]
        img_data = base64.b64decode(raw_b64)
    elif thumb_url:
        try:
            req = requests.get(thumb_url, timeout=15)
            req.raise_for_status()
            img_data = req.content
        except Exception as e:
            print(f"Error fetching URL: {e}")
    else:
        full_doc = collection.find_one({"_id": doc["_id"]}, {"base64Data": 1})
        if full_doc and full_doc.get("base64Data"):
            raw_b64 = full_doc["base64Data"]
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            img_data = base64.b64decode(raw_b64)
            
    return img_data

def judge_caption(doc):
    img_data = get_image_data(doc)
    if not img_data:
        return {"accurate": False, "reason": "No image data"}
    
    caption = doc.get("caption", "") or doc.get("triage", {}).get("summary", "")
    if not caption:
        return {"accurate": False, "reason": "No caption"}
    
    try:
        image = Image.open(io.BytesIO(img_data)).convert("RGB")
        image = ImageOps.exif_transpose(image)
        image.thumbnail((512, 512)) # Downsample to save VRAM for local model
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG", quality=85)
        b64_img = base64.b64encode(buffered.getvalue()).decode('utf-8')
    except Exception as e:
        return {"accurate": False, "reason": f"Image processing error: {e}"}
    
    judge_prompt = f"""You are a strict forensic validator. 
Given the image and this caption, answer ONLY with JSON:
{{"accurate": true/false, "confidence": 0-1, "issues": "brief reason or empty"}}

Caption: {caption}

Rules:
- accurate=true ONLY if the caption is literally and factually correct with no hallucinations, wrong genders/ages, invented locations, or misidentified objects.
- Be extremely harsh on guesses (e.g. guessing a building is a "library" when no sign says Library, stating a picture of 25 year old is an "older woman", duplicated cats, horses for cows animal swaps, etc.)."""

    payload = {
        "model": MODEL,
        "prompt": judge_prompt,
        "images": [b64_img],
        "stream": False,
        "options": {"temperature": 0.0, "num_predict": 300}
    }
    
    try:
        r = requests.post(OLLAMA_URL, json=payload, timeout=45)
        if r.ok:
            result = r.json().get("response", "")
            # Try to extract JSON from the text response
            try:
                # Sometimes models wrap JSON in markdown code blocks
                if "```json" in result:
                    result = result.split("```json")[1].split("```")[0].strip()
                elif "```" in result:
                    result = result.split("```")[1].split("```")[0].strip()
                
                return json.loads(result)
            except json.JSONDecodeError:
                return {"accurate": "unknown", "reason": f"Could not parse JSON: {result[:100]}..."}
        else:
            return {"accurate": False, "reason": f"Ollama API Error: {r.status_code}"}
    except Exception as e:
        return {"accurate": False, "reason": f"Ollama connection error: {str(e)}"}

def run_validation_sweep():
    print(f"🚀 Starting Local Vision Judge ({MODEL}) Sweep...")
    
    # Let's test on 10 known legacy gemini items from pending_accessions first
    query = {"aiModel": "gemini-2.5-flash", "validation": {"$exists": False}}
    docs = list(db["pending_accessions"].find(query).limit(10))
    
    if not docs:
        print("No unchecked legacy Gemini captions found in pending_accessions.")
        return
        
    print(f"Found {len(docs)} items to validate.")
    
    for doc in docs:
        doc_id = doc["_id"]
        filename = doc.get("originalName") or doc.get("fileName") or "Unknown"
        print(f"\n🔄 Judging [{doc_id}] {filename}...")
        
        start_time = time.time()
        verdict = judge_caption(doc)
        ttft = round(time.time() - start_time, 2)
        
        print(f"   ⏱️ Took {ttft}s")
        print(f"   ⚖️ Verdict: {verdict}")
        
        # Update DB with validation flag
        collection.update_one(
            {"_id": doc_id}, 
            {"$set": {"validation": verdict}}
        )

if __name__ == "__main__":
    run_validation_sweep()
