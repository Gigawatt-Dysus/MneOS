import os
import sys
import time
import requests
import torch
import warnings
from PIL import Image
from pymongo import MongoClient
from dotenv import load_dotenv

warnings.filterwarnings('ignore')

# 1. Load Environment
env_path = os.path.join(os.getcwd(), '.env.local')
load_dotenv(dotenv_path=env_path)
MONGO_URI = os.getenv("MONGODB_URI")

if not MONGO_URI:
    print("❌ MONGODB_URI not found in .env.local")
    sys.exit(1)

# 2. Database Connection
client = MongoClient(MONGO_URI)
db = client.get_database("LifeOS")
collection = db.get_collection("takeout_media")

# 3. Load Moondream2 (Optimized for 6GB VRAM)
print("Loading Moondream2 Vision Model into VRAM (fp16)...")
try:
    from transformers import AutoModelForCausalLM, AutoTokenizer
    model_id = "vikhyatk/moondream2"
    revision = "2024-08-26"
    
    model = AutoModelForCausalLM.from_pretrained(
        model_id, 
        trust_remote_code=True, 
        revision=revision,
        torch_dtype=torch.float16 # Half precision to save VRAM
    ).to("cuda")
    
    tokenizer = AutoTokenizer.from_pretrained(model_id, revision=revision)
    print("✅ Moondream2 Loaded Successfully")
except Exception as e:
    print(f"❌ Failed to load Vision Model: {e}")
    print("Note: You may need to run: pip install einops pillow torchvision")
    sys.exit(1)

# 4. Check Vector Server Status
try:
    requests.options("http://localhost:5005/embed")
    print("✅ Sovereign Vector Server is reachable.")
except Exception:
    print("❌ Cannot reach http://localhost:5005/embed. Ensure vector_server.py is running.")
    sys.exit(1)

def process_batch(batch_size=10):
    # Find images that haven't been captioned yet
    query = {
        "extension": {"$in": [".jpg", ".jpeg", ".png", ".webp"]},
        "caption": {"$exists": False}
    }
    
    cursor = collection.find(query).limit(batch_size)
    docs = list(cursor)
    
    if not docs:
        print("🎉 No uncaptioned images found. You are 100% indexed!")
        return 0
        
    print(f"\nProcessing Batch of {len(docs)} images...")
    
    success_count = 0
    for doc in docs:
        filepath = doc.get("filepath")
        if not filepath or not os.path.exists(filepath):
            # Skip gracefully if drive is not docked
            print(f"⚠️ Missing (Drive offline?): {filepath}")
            continue
            
        try:
            # 1. Image Inference
            image = Image.open(filepath)
            enc_image = model.encode_image(image)
            caption = model.answer_question(
                enc_image, 
                "Describe this image in detail. Focus on subjects, colors, background, and specific objects. Be concise.", 
                tokenizer
            )
            
            # 2. Text Vectorization (Filename + New Caption)
            vector_text = f"{doc.get('filename', '')} {caption}"
            res = requests.post("http://localhost:5005/embed", json={"text": vector_text})
            
            if res.status_code == 200:
                embedding = res.json().get("embedding")
                
                # 3. Atlas Transaction
                collection.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {
                        "caption": caption,
                        "embedding": embedding,
                        "vlm_model": "moondream2"
                    }}
                )
                print(f"✔️ Captioned: [{doc['filename']}] -> {caption}")
                success_count += 1
            else:
                print(f"❌ Vectorizer error on {doc['filename']}")
                
        except Exception as e:
            print(f"❌ Failed to process {filepath}: {e}")
            
    return success_count

if __name__ == '__main__':
    print("\n=======================================================")
    print("👁️  G.I.G.I. Genesis - Visual Perception Pipeline")
    print("=======================================================\n")
    
    # We run in batches so the user can see progress and stop safely
    total_processed = 0
    while True:
        processed = process_batch(batch_size=20)
        if processed == 0:
            break
        total_processed += processed
        
    print(f"\n✅ Session Complete. Visually indexed {total_processed} new images.")
