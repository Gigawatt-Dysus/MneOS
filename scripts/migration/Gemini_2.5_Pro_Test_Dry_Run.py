import os
import sys
import io
import time
import re
from pymongo import MongoClient
from PIL import Image, ImageOps
import requests
import google.auth
import google.auth.transport.requests

# ==============================================================================
# CONFIGURATION
# ==============================================================================
MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"
COLLECTION_NAME = "pending_accessions"
PROJECT_ID = "gigi-time-machine"
LOCATION = "us-central1"
MODEL_NAME = "gemini-2.5-pro"
MAX_SIZE = (1024, 1024)

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
ROTATION_FIX: <0, 90, 180, or 270>"""

SERVICE_ACCOUNT_FILE = r"C:\MneOS\serviceAccountKey.json"

def get_access_token():
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = SERVICE_ACCOUNT_FILE
    credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    auth_req = google.auth.transport.requests.Request()
    credentials.refresh(auth_req)
    return credentials.token

def test_run():
    sys.stdout.reconfigure(encoding='utf-8')
    print(f"\n========================================================")
    print(f"🧪 SAFETY FIRST: DRY-RUN FORENSIC TEST")
    print(f"========================================================\n")
    
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    docs = list(db[COLLECTION_NAME].find({
        "aiProcessed": {"$ne": True}, 
        "base64Data": {"$exists": True, "$ne": ""},
        "fileType": {"$in": ["image/jpeg", "image/png", "image/webp", "image/gif"]}
    }).limit(3))
    
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {get_access_token()}",
        "Content-Type": "application/json"
    })
    
    API_URL = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{MODEL_NAME}:generateContent"

    import base64
    for doc in docs:
        doc_id = doc["_id"]
        url = doc.get("url")
        filename = doc.get("originalName", str(doc_id))
        logical_date = doc.get("logicalDate", "Unknown")
        
        print(f"\n📸 Processing {filename} (Date: {logical_date})")
        raw_b64 = doc.get("base64Data")
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
            
        try:
            import base64
            img_data = base64.b64decode(raw_b64)
            image = Image.open(io.BytesIO(img_data))
            image = ImageOps.exif_transpose(image)
            image = image.convert("RGB")
            image.thumbnail(MAX_SIZE)
            buffered = io.BytesIO()
            image.save(buffered, format="JPEG", quality=85)
        except Exception as e:
            print(f"❌ Failed to parse image {filename}: {e}")
            continue
        
        prompt_text = f"Image metadata Date: {logical_date}. Execute instructions."
        
        payload = {
            "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
            "contents": [{
                "role": "user",
                "parts": [
                    {"text": prompt_text},
                    {"inlineData": {"mimeType": "image/jpeg", "data": base64.b64encode(buffered.getvalue()).decode('utf-8')}}
                ]
            }],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024}
        }
        
        print(f"🧠 Asking Gemini to forensically analyze...")
        api_resp = session.post(API_URL, json=payload)
        res_json = api_resp.json()
        
        if "candidates" not in res_json:
            print("ERROR: ", res_json)
            continue
            
        response_text = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
        
        print("\n--- RAW GEMINI OUTPUT ---")
        print(response_text)
        print("-------------------------\n")
        
        desc_match = re.search(r'DESCRIPTION:\s*(.*?)(?=CAMERA_GUESS:)', response_text, re.DOTALL)
        cam_guess_match = re.search(r'CAMERA_GUESS:\s*(.*?)(?=CAMERA_REASONING:)', response_text, re.DOTALL)
        cam_reason_match = re.search(r'CAMERA_REASONING:\s*(.*?)(?=ROTATION_FIX:)', response_text, re.DOTALL)
        rot_match = re.search(r'ROTATION_FIX:\s*(\d+)', response_text)
        
        print("--- PARSED RESULTS ---")
        print(f"📝 DESCRIPTION : {'Found' if desc_match else 'FAILED TO PARSE'}")
        print(f"📷 CAMERA GUESS: {cam_guess_match.group(1).strip() if cam_guess_match else 'FAILED TO PARSE'}")
        print(f"🔍 REASONING   : {cam_reason_match.group(1).strip() if cam_reason_match else 'FAILED TO PARSE'}")
        print(f"🔄 ROTATION FIX: {rot_match.group(1).strip() if rot_match else 'FAILED TO PARSE'}")
        print("========================================================\n")
        
        time.sleep(2)

    client.close()

if __name__ == "__main__":
    test_run()
