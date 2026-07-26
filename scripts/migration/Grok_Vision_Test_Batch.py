import os
import sys
import json
import base64
import requests
import io
from PIL import Image, ImageOps
from pymongo import MongoClient
import time
import uuid

# Disable DecompressionBombWarning for massive panoramas
Image.MAX_IMAGE_PIXELS = None

# Force UTF-8 for Windows console (mojibake prevention)
sys.stdout.reconfigure(encoding='utf-8')

from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

from dotenv import load_dotenv
load_dotenv(r"C:\MneOS\.env.local")

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

XAI_API_KEY = os.environ.get("VITE_XAI_API_KEY")
if not XAI_API_KEY:
    print("🚨 FATAL: VITE_XAI_API_KEY not found in .env.local! Halting.")
    sys.exit(1)

# The user's prompt stated we're using "Grok 4.1 Fast" conceptually for testing
MODEL_NAME = "grok-test" 

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

MAX_SIZE = (1024, 1024)

def generate_grok_caption(img_data, doc_id, filename, conv_id):
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

    prompt = "You are an expert digital archivist performing visual extraction for a vector-retrieval (RAG) database. Your goal is to provide a highly descriptive, information-rich caption that balances undeniable forensic facts with semantic nuance."
    if "Screenshot" in filename or "Capture" in filename:
        prompt += f" (Note: System filename indicates it might be a screenshot: {filename}). If this is a screenshot, extract the core text and explain what the interface or conversation is about."

    prompt += """

Analyze the image in two distinct layers, combining them into a single, cohesive paragraph:

1. THE FORENSIC BASE LAYER (Who, What, Where):
- Identify the core subjects (people, animals, objects).
- CRITICAL: Use strictly gender-neutral language (e.g., "person", "individual", "figure") for all adults to prevent misgendering. DO NOT guess subjective adult ages (e.g., "older", "middle-aged", "young"). HOWEVER, you MUST identify distinct, undeniable life stages such as "baby", "infant", "toddler", or "child" as these are critical for vector retrieval.
- Describe exact physical details: distinct architectural features, or specific weather. ONLY transcribe text on signs or buildings if it is 100% legible. If it is blurry, DO NOT guess it.
- CRITICAL COLOR RULE: If an object is heavily shadowed, DO NOT guess its exact color (e.g., assuming a shadowed car is "black"). Use terms like "dark-colored".
- CRITICAL ENVIRONMENT RULE: DO NOT hallucinate macro-environments (e.g., "forest", "wilderness") just because trees or dirt are present. Describe the literal physical elements (e.g., "paved surface", "trees", "dirt") without assigning them a broad geographic label.

2. THE ARCHIVAL CONTEXT LAYER (Nuance, Relationship, Subtext):
- Note the spatial relationship between subjects (e.g., "sitting closely across from each other" vs "standing in the background").
- Describe the ambiance or lighting (e.g., "harsh fluorescent office lighting," "warm golden hour light," "candid snapshot").
- Extract any semantic meaning that would be highly useful for future semantic search (e.g., "a chaotic family gathering," "a professional networking event," "a quiet solo hike").

CRITICAL INSTRUCTIONS:
- Jump straight into the description. DO NOT start with "The image shows..."
- DO NOT repeat the filename.
- DO NOT hallucinate text, names, locations, or backstories that are not explicitly visible.
- If text, a sign, or a background is blurry, you MUST ignore it or state it is illegible. Fabricating words (like guessing a building is a "LIBRARY") is a catastrophic failure. 
- Keep the tone clinical but observant."""

    headers = {
        "Authorization": f"Bearer {XAI_API_KEY}",
        "Content-Type": "application/json",
        "x-grok-conv-id": conv_id
    }

    payload = {
        "model": "grok-4.3", # Updated to a valid xAI model supporting vision
        "messages": [
            {
                "role": "system",
                "content": """You are a forensic archivist. You MUST use strictly gender-neutral language (they/them/person/individual). NEVER use 'man', 'woman', 'he', or 'she' under any circumstances unless explicitly told to in the prompt. This is a strict safety constraint.

EXAMPLES OF PERFECT CAPTIONS (ADOPT THIS EXACT TONE AND STRUCTURE):

Example 1 (Document):
A completed official claimant's statement form issued by the Virginia Employment Commission details an employment period from December 8, 2014 to April 24, 2015 with Lawyers Staffing Inc. The document lists the claimant's responses to questions about prior warnings, efforts to improve performance, and policy violations, includes a handwritten signature by Ann Cornett dated May 21, 2015, and bears the form identifier VEC-BA-60 RD (7/2012) at the bottom.

Example 2 (Shadowed Vehicle):
A dark-colored SUV is parked on a paved driveway surrounded by tall deciduous trees. The scene is viewed from an elevated angle. The tree canopy filters bright sunlight, casting heavy, high-contrast shadows across the leaf-strewn ground and a low concrete curb in the foreground. Additional tree trunks occupy the midground, partially screening a distant light-colored building. There is no visible human activity.

Example 3 (Vintage Portrait):
Two individuals are seated side-by-side outdoors against a red brick wall. The person on the left has short light brown hair and wears a light striped button-down shirt with a dark tie, with their right arm resting behind the person on the right. The person on the right has dark hair and wears a navy blue top, a double-strand pearl necklace, and bright red lipstick, with their mouth open in a smile showing teeth. A white architectural column is partially visible on the far right edge of the frame.

Example 4 (Indoor Subject):
A person with shoulder-length reddish-brown hair stands centered in a residential interior, wearing a black short-sleeved t-shirt bearing the text "GENUINE HARLEY-DAVIDSON MOTOR CYCLES" and gray pants, while holding a round blue plate at waist height with both hands; the plate contains a partially sliced loaf of pale bread with scattered crumbs across its surface. The individual faces forward, with a wooden dresser and television visible in the mid-ground."""
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"}}
                ]
            }
        ],
        "temperature": 0.2,
        "max_tokens": 512
    }
    
    res = requests.post("https://api.x.ai/v1/chat/completions", headers=headers, json=payload, timeout=60)
    if res.status_code == 200:
        return res.json()['choices'][0]['message']['content'].strip()
    else:
        raise Exception(f"Grok API Error {res.status_code}: {res.text}")


def process_test_batch():
    collection = db["media"]
    # We target items that were recently processed, bypassing the aiModel string entirely
    # to catch the corrupted batch based on when they were written.
    query = {"aiProcessed": True, "aiProcessedAt": {"$exists": True}}
    
    print(f"📦 Searching for the most recently processed items...")
    
    LIMIT = 10 # We'll do a fast 10-item test just to check the prompt trajectory
    # Sort by aiProcessedAt descending to grab the freshest (most recently corrupted) items
    docs = list(collection.find(query).sort("aiProcessedAt", -1).limit(LIMIT))
    
    if not docs:
        print("No processed items found to test.")
        return
        
    print(f"🚀 Processing {len(docs)} items for the Grok Test Batch...")
    
    # We use a single session ID for the batch to take advantage of prompt caching
    conv_id = f"grok-test-{uuid.uuid4().hex[:8]}"
    
    success_count = 0
    for doc in docs:
        doc_id = doc["_id"]
        filename = doc.get("originalName") or doc.get("fileName") or "Unknown"
        print(f"🔄 Processing [{doc_id}] {filename}...")
        
        # Determine the thumbnail URL
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
            caption = generate_grok_caption(img_data, doc_id, filename, conv_id)
            ttft = round(time.time() - start_time, 2)
            
            print(f"   ✅ [GROK] Done in {ttft}s | Caption: {caption.replace(chr(10), ' ')}")
            
            # Atomic update
            import datetime
            now = datetime.datetime.utcnow().isoformat() + "Z"
            collection.update_one(
                {"_id": doc_id},
                {"$set": {
                    "caption": caption, 
                    "triage.summary": caption, 
                    "aiProcessed": True,
                    "aiModel": MODEL_NAME, # Tags it as grok test data for the UI
                    "aiProcessedAt": now
                }}
            )
            success_count += 1
            
        except Exception as e:
            print(f"   ❌ Error processing {doc_id}: {e}")
            
    print(f"\n🎉 Batch complete! Successfully reclaimed {success_count} / {len(docs)} items.")
    print("Go to the Matrix Gallery and select 'Grok Test' from the Provenance filters to curate the Golden Dataset.")

if __name__ == "__main__":
    process_test_batch()
