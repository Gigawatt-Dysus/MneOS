import os
import sys
import base64
import requests
import io
import time
import datetime
import argparse
from pymongo import MongoClient
import cv2
import numpy as np
import easyocr
import logging

sys.stdout.reconfigure(encoding='utf-8')
logging.getLogger("easyocr").setLevel(logging.ERROR)

# Setup arguments
parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true", help="Do not save changes to the database.")
parser.add_argument("--limit", type=int, default=None, help="Limit number of documents to evaluate.")
args = parser.parse_args()

LOG_FILE = "rotation_heal_review.log"
with open(LOG_FILE, "w", encoding="utf-8") as f:
    f.write("--- SOVEREIGN MATRIX ROTATION HEAL LOG ---\n")


# Database Setup
MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db["media"]

# Initialize Models
print("📦 Loading OpenCV Face Detector (Bypassing MediaPipe/Matplotlib DLL Block)...")
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

print("📦 Loading EasyOCR Reader (English)...")
reader = easyocr.Reader(['en'], gpu=True)

def preprocess_for_analysis(img):
    h, w = img.shape[:2]
    scale = min(800 / max(h, w), 1.0)
    if scale < 1.0:
        return cv2.resize(img, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_AREA)
    return img

def detect_faces_upright(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.1, 4)
    return len(faces) * 10 # 10 points per face found

def detect_text_orientation(img):
    try:
        results = reader.readtext(img, detail=1, paragraph=False)
        score = 0
        for (bbox, text, prob) in results:
            if prob > 0.5 and len(text.strip()) > 2:
                score += prob * 8 
        return score
    except Exception:
        return 0

def analyze_orientation(image_bytes, db_width, db_height):
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return None, None
        
    img_h, img_w = img.shape[:2]
    
    db_ratio = db_width / db_height if db_height != 0 else 1.0
    img_ratio = img_w / img_h if img_h != 0 else 1.0
    
    db_is_portrait = db_ratio < 0.95
    img_is_portrait = img_ratio < 0.95
    db_is_landscape = db_ratio > 1.05
    img_is_landscape = img_ratio > 1.05
    
    needs_rotation = False
    if (db_is_portrait and img_is_landscape) or (db_is_landscape and img_is_portrait):
        needs_rotation = True
        
    if not needs_rotation:
        return 0, None 

    rotations = [
        (90, cv2.ROTATE_90_CLOCKWISE), 
        (270, cv2.ROTATE_90_COUNTERCLOCKWISE)
    ]
    
    candidates = []
    
    for angle, cv2_rot_code in rotations:
        test_img = cv2.rotate(img, cv2_rot_code)
        test_img = preprocess_for_analysis(test_img)
        
        score = 0
        
        # 1. Face Detection
        face_score = detect_faces_upright(test_img)
        score += face_score
                
        # 2. Text Detection (Performance optimization: only run OCR if face confidence is low)
        if face_score == 0:
            score += detect_text_orientation(test_img)
        
        candidates.append((angle, score))
        
    best_angle, best_score = max(candidates, key=lambda x: x[1])
    
    flag = None
    if best_score < 8:
        flag = 'manual_review'
        
    return best_angle, flag

def sweep_and_heal():
    print(f"📡 Starting Sovereign Matrix Heal Pipeline... (Dry Run: {args.dry_run})")
    
    query = {
        "fileType": {"$in": ["image/jpeg", "image/png", "image/webp"]},
        "rotation": {"$exists": False},
        "width": {"$exists": True},
        "height": {"$exists": True}
    }
    
    cursor = collection.find(query)
    if args.limit:
        cursor = cursor.limit(args.limit)
    
    total = collection.count_documents(query)
    if args.limit and args.limit < total:
        total = args.limit
        
    print(f"📦 Found {total} candidates for evaluation.")
    
    processed = 0
    healed = 0
    flagged = 0
    start_time = time.time()
    
    for doc in cursor:
        doc_id = doc["_id"]
        filename = doc.get("originalName", "Unknown")
        db_w = doc.get("width")
        db_h = doc.get("height")
        
        if not db_w or not db_h:
            continue
            
        try:
            img_data = None
            thumb_url = None
            if "thumbnailUrls" in doc and "medium" in doc["thumbnailUrls"]:
                thumb_url = doc["thumbnailUrls"]["medium"]
            elif "url" in doc:
                thumb_url = doc["url"]
                
            if thumb_url and thumb_url.startswith("data:image"):
                raw_b64 = thumb_url.split(",", 1)[1]
                img_data = base64.b64decode(raw_b64)
            elif thumb_url:
                req = requests.get(thumb_url, timeout=10)
                req.raise_for_status()
                img_data = req.content
            elif "base64Data" in doc:
                raw_b64 = doc["base64Data"]
                if "," in raw_b64:
                    raw_b64 = raw_b64.split(",", 1)[1]
                img_data = base64.b64decode(raw_b64)
            else:
                continue
                
            if not img_data:
                continue
                
            predicted_angle, review_flag = analyze_orientation(img_data, db_w, db_h)
            
            if predicted_angle is not None and predicted_angle != 0:
                print(f"   🪄 HEALED: [{doc_id}] {filename} -> Applied {predicted_angle}° pivot. (Score Flag: {review_flag or 'CONFIDENT'})")
                
                if review_flag:
                    with open(LOG_FILE, "a", encoding="utf-8") as f:
                        f.write(f"[{doc_id}] {filename} -> {predicted_angle}° (Flagged for Review)\n")

                if not args.dry_run:
                    update_payload = {"rotation": predicted_angle}
                    if review_flag:
                        update_payload["orientation_flag"] = review_flag
                        flagged += 1
                        
                    collection.update_one(
                        {"_id": doc_id},
                        {"$set": update_payload}
                    )
                healed += 1
            else:
                if not args.dry_run:
                    collection.update_one(
                        {"_id": doc_id},
                        {"$set": {"rotation": 0}}
                    )
                
        except Exception as e:
            print(f"   ❌ Error processing {doc_id}: {e}")
            
        processed += 1
        if processed % 10 == 0:
            elapsed = time.time() - start_time
            avg_time = elapsed / processed
            eta_secs = int((total - processed) * avg_time)
            eta_str = str(datetime.timedelta(seconds=eta_secs))
            print(f"📊 Progress: {processed}/{total} ({healed} fixed, {flagged} require manual review) | ETA: {eta_str}")

    elapsed_total = str(datetime.timedelta(seconds=int(time.time() - start_time)))
    print(f"\n🎉 Healing Sweep Complete in {elapsed_total}. Permanently cured {healed} backwards assets. ({flagged} flagged for manual UI review).")

if __name__ == "__main__":
    try:
        sweep_and_heal()
    except KeyboardInterrupt:
        print("\n⚠️ Operation aborted.")
    finally:
        client.close()
