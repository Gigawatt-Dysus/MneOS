import os
import sys
import json
from pymongo import MongoClient

# Force UTF-8 for Windows console
sys.stdout.reconfigure(encoding='utf-8')

# ========================= CONFIG =========================
MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

SYSTEM_PROMPT = """You are a precise forensic archivist. 
Describe ONLY what is literally visible. 
Use clinical, neutral language. 
Output ONLY valid JSON with these exact keys:
{
  "subjects": ["list of main visible things"],
  "key_objects": ["list of notable objects"],
  "environment": "brief setting description",
  "lighting": "lighting conditions",
  "text": "any legible text or null",
  "notable_details": ["important visible details"],
  "medical_context": "any visible medical/postpartum/injury indicators or null"
}
Be factual. No opinions. No fluff."""

MODEL_NAME = "grok-vision-beta" # or latest xAI vision model

def generate_batch_file(output_filename="grok_batch_jobs.jsonl", limit=None):
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db["media"]
    
    # Only grab uncaptioned items
    query = {"caption": {"$exists": False}}
    cursor = collection.find(query)
    
    if limit:
        cursor = cursor.limit(limit)
        
    docs = list(cursor)
    if not docs:
        print("No uncaptioned items found!")
        return
        
    print(f"Found {len(docs)} items requiring forensic captions.")
    print(f"Generating JSONL batch file...")
    
    valid_count = 0
    with open(output_filename, 'w', encoding='utf-8') as outfile:
        for doc in docs:
            doc_id = str(doc["_id"])
            
            # Extract the best available public URL
            thumb_url = None
            if "thumbnailUrls" in doc:
                if "large" in doc["thumbnailUrls"]:
                    thumb_url = doc["thumbnailUrls"]["large"]
                elif "medium" in doc["thumbnailUrls"]:
                    thumb_url = doc["thumbnailUrls"]["medium"]
            elif "url" in doc:
                thumb_url = doc["url"]
                
            # If it's a base64 string directly in the URL field, we skip it for now to keep the payload lean
            # or we could include it, but Backblaze URLs are preferred.
            if not thumb_url or thumb_url.startswith("data:image"):
                continue
                
            # xAI Batch API Format
            job_request = {
                "custom_id": doc_id,
                "method": "POST",
                "url": "/v1/chat/completions",
                "body": {
                    "model": MODEL_NAME,
                    "messages": [
                        {
                            "role": "system",
                            "content": SYSTEM_PROMPT
                        },
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": thumb_url
                                    }
                                }
                            ]
                        }
                    ],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"}
                }
            }
            
            json.dump(job_request, outfile)
            outfile.write('\n')
            valid_count += 1
            
    print(f"Successfully generated {output_filename} with {valid_count} requests.")
    print(f"Ready to upload to xAI Batch API.")

if __name__ == "__main__":
    generate_batch_file("grok_batch_payload.jsonl")
