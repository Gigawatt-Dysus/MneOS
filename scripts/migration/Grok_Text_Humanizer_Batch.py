import os
import sys
import requests
from pymongo import MongoClient
import time
import uuid

# Force UTF-8 for Windows console
sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv
load_dotenv(r"C:\MneOS\.env.local")

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

XAI_API_KEY = os.environ.get("VITE_XAI_API_KEY")
if not XAI_API_KEY:
    print("🚨 FATAL: VITE_XAI_API_KEY not found in .env.local! Halting.")
    sys.exit(1)

# We use the text-only model for massive cost savings!
MODEL_NAME = "grok-beta" 

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

def humanize_caption(clinical_text, conv_id):
    prompt = f"""You are a narrative archivist. Your task is to take a dry, clinical, highly literal image description and rewrite it into a warmer, more human narrative summary without losing the core factual details.
    
    CRITICAL RULES:
    1. Do not invent details that are not in the source text.
    2. Maintain any gender-neutral language if present.
    3. Keep it to a single, readable paragraph.
    4. Start directly with the narrative (do not say "This image shows...").
    
    Source Clinical Text:
    {clinical_text}
    
    Humanized Narrative:"""

    headers = {
        "Authorization": f"Bearer {XAI_API_KEY}",
        "Content-Type": "application/json",
        "x-grok-conv-id": conv_id
    }

    payload = {
        "model": MODEL_NAME, 
        "messages": [
            {
                "role": "system",
                "content": "You are an expert archivist turning clinical metadata into humanized memories."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.5,
        "max_tokens": 512
    }
    
    res = requests.post("https://api.x.ai/v1/chat/completions", headers=headers, json=payload, timeout=30)
    if res.status_code == 200:
        return res.json()['choices'][0]['message']['content'].strip()
    else:
        raise Exception(f"Grok API Error {res.status_code}: {res.text}")

def process_humanization_batch():
    collection = db["media"]
    
    # Target items that have a clinical caption but NO humanized_caption yet
    query = {
        "caption": {"$exists": True, "$ne": ""},
        "humanized_caption": {"$exists": False}
    }
    
    print(f"📦 Searching for items needing humanization...")
    
    LIMIT = 10 # Batch limit for testing
    docs = list(collection.find(query).limit(LIMIT))
    
    if not docs:
        print("No items found needing humanization.")
        return
        
    print(f"🚀 Processing {len(docs)} items for Text-to-Text Humanization...")
    
    conv_id = f"grok-text-humanizer-{uuid.uuid4().hex[:8]}"
    success_count = 0
    
    for doc in docs:
        doc_id = doc["_id"]
        clinical_caption = doc["caption"]
        print(f"🔄 Processing [{doc_id}]...")
        print(f"   [Source]: {clinical_caption[:100]}...")
        
        try:
            start_time = time.time()
            humanized_text = humanize_caption(clinical_caption, conv_id)
            ttft = round(time.time() - start_time, 2)
            
            print(f"   ✅ [GROK Text] Done in {ttft}s | Narrative: {humanized_text[:100]}...")
            
            # Write to the new field
            collection.update_one(
                {"_id": doc_id},
                {"$set": {
                    "humanized_caption": humanized_text,
                    "triage.humanizedAt": time.time()
                }}
            )
            success_count += 1
            
        except Exception as e:
            print(f"   ❌ Error processing {doc_id}: {e}")
            
    print(f"\n🎉 Batch complete! Successfully humanized {success_count} / {len(docs)} items.")

if __name__ == "__main__":
    process_humanization_batch()
