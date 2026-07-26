import os
import sys
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
import io
import base64
import urllib.request
import json
import time
from pathlib import Path
from PIL import Image
from dotenv import load_dotenv

# Load API Keys
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env.local"))
VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY")

# ==========================================
# TEST CONFIGURATION
# ==========================================
TARGET_DIR = os.path.dirname(__file__)

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "lfm2.5-vl:1.6b"
VOYAGE_MODEL = "voyage-4-large"

print("=======================================================")
print(f"LFM2.5-VL-1.6B (OLLAMA) + VOYAGE-4-LARGE SANDBOX")
print("=======================================================\n")

if not VOYAGE_API_KEY:
    print("❌ Error: VOYAGE_API_KEY not found in .env.local")
    exit(1)

def run_test(image_path):
    filename = os.path.basename(image_path)
    try:
        print(f"=======================================================")
        print(f"📦 Processing Image: {filename}")
        print(f"=======================================================")
        start_time = time.time()
        
        # 1. Resize Image (Aggressive downscale to reduce token context)
        image = Image.open(image_path).convert("RGB")
        image.thumbnail((384, 384))
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG", quality=85)
        img_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        resize_time = time.time()
        print(f"[OK] Image resized to {image.size} in {resize_time - start_time:.2f}s")
        
        # 2. Ollama Vision Pass
        print(f"[*] Sending to Ollama ({OLLAMA_MODEL})...")
        task_prompt = "Describe the individuals and the setting in detail."
        
        vision_start = time.time()
        
        # Query Ollama
        ollama_data = {
            "model": OLLAMA_MODEL,
            "prompt": task_prompt,
            "images": [img_b64],
            "stream": False
        }
        ollama_req = urllib.request.Request(OLLAMA_URL, data=json.dumps(ollama_data).encode('utf-8'), headers={
            'Content-Type': 'application/json'
        })
        
        with urllib.request.urlopen(ollama_req) as response:
            result = json.loads(response.read().decode('utf-8'))
            caption = result.get("response", "").strip()
        
        vision_time = time.time()
        
        print(f"[OK] Caption generated in {vision_time - vision_start:.2f}s")
        print(f"\n[CAPTION OUTPUT]\n{caption}\n")
        
        # 3. Voyage Embedding Pass
        print(f"☁️ Sending caption to Voyage Cloud ({VOYAGE_MODEL})...")
        embed_text = f"File: {filename}. Description: {caption}"
        
        voyage_url = "https://api.voyageai.com/v1/embeddings"
        voyage_data = {
            "input": [embed_text],
            "model": VOYAGE_MODEL,
            "output_dimension": 1024
        }
        voyage_req = urllib.request.Request(voyage_url, data=json.dumps(voyage_data).encode('utf-8'), headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {VOYAGE_API_KEY}'
        })
        
        embed_start = time.time()
        with urllib.request.urlopen(voyage_req) as v_response:
            v_result = json.loads(v_response.read().decode('utf-8'))
            embedding_list = v_result['data'][0]['embedding']
            
        embed_time = time.time()
        print(f"✅ 1024d Embedding generated in {embed_time - embed_start:.2f}s")
        print(f"📊 Vector length verified: {len(embedding_list)} dimensions")
        print(f"🔍 Vector preview: {embedding_list[:5]}...")
        
        print(f"\n🎉 Total Image Processing Time: {time.time() - start_time:.2f}s\n")

    except Exception as e:
        print(f"❌ Test Failed for {filename}: {e}\n")

if __name__ == "__main__":
    valid_extensions = ('.jpg', '.jpeg', '.png', '.webp')
    images = [f for f in os.listdir(TARGET_DIR) if f.lower().endswith(valid_extensions)]
    
    if not images:
        print(f"❌ Error: No images found in {TARGET_DIR}")
        print("Please drop some .jpg or .png files into the folder and run again.")
        exit(1)
        
    print(f"Found {len(images)} images to test. Firing up the matrix...\n")
    
    # Run test on just the first couple to avoid spamming the logs
    for img in images[:2]:
        run_test(os.path.join(TARGET_DIR, img))
