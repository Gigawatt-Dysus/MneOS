import os
import sys
import io
import time
import gc
import json
import base64
import subprocess
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps
from pymongo import MongoClient
import requests

# Force UTF-8 for Windows console (mojibake prevention)
sys.stdout.reconfigure(encoding='utf-8')

# ========================= CONFIG =========================
MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llava-phi3:latest"       # Safe, highly capable 3B model that works on this Ollama version
MAX_DIM = 384                         # Critical: Do NOT go above 512 on 6GB
BATCH_SIZE = 3                        # Keep low for stability
MAX_RETRIES = 3

# Clinical / Forensic prompt optimized for LifeOS archival
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

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db["media"]

# ====================== ANSI COLORS ======================
C_GREEN = '\033[92m'
C_YELLOW = '\033[93m'
C_ORANGE = '\033[38;5;208m'
C_RED = '\033[91m'
C_FLASH = '\033[5;91m'
C_RESET = '\033[0m'

def get_color(val, t_yellow, t_orange, t_red):
    if val >= t_red: return C_FLASH
    if val >= t_orange: return C_ORANGE
    if val >= t_yellow: return C_YELLOW
    return C_GREEN

def play_klaxon():
    """Play the red alert MP3 via PowerShell in the background."""
    try:
        klaxon_path = r"C:\MneOS\public\assets\red_alert.mp3"
        if os.path.exists(klaxon_path):
            ps_cmd = f"$player = New-Object -ComObject WMPlayer.OCX; $player.URL = '{klaxon_path}'; $player.controls.play(); Start-Sleep -Seconds 5"
            subprocess.Popen(
                ["powershell", "-WindowStyle", "Hidden", "-Command", ps_cmd],
                creationflags=0x08000000  # CREATE_NO_WINDOW prevents the blue flash
            )
    except:
        pass

# ====================== AUTOPILOT TELEMETRY ======================
def check_hardware_telemetry():
    """Autopilot: Read GPU and RAM sensors. Abort if approaching redline."""
    ram_str = "Unknown"
    
    # 1. Check System RAM (if psutil is installed)
    try:
        import psutil
        ram_percent = psutil.virtual_memory().percent
        ram_str = f"{ram_percent}%"
        if ram_percent > 88.0:
            print(f"\n🚨 AUTOPILOT ENGAGED: PULL UP! PULL UP! 🚨")
            print(f"System RAM is at {ram_percent}%. Imminent pagefile thrashing detected.")
            print(f"Aborting batch to save the ship.")
            sys.exit(1)
    except ImportError:
        ram_str = "N/A (psutil not installed)"

    # 2. Check GPU VRAM and Temp (via built-in nvidia-smi)
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=memory.used,memory.total,temperature.gpu', '--format=csv,noheader,nounits'],
            stdout=subprocess.PIPE, text=True
        )
        if result.stdout.strip():
            used, total, temp = map(int, result.stdout.strip().split(', '))
            vram_percent = (used / total) * 100
            
            c_vram = get_color(vram_percent, 80, 90, 97)
            c_temp = get_color(temp, 75, 82, 87)
            c_ram = C_RESET
            if "psutil" in sys.modules:
                c_ram = get_color(ram_percent, 60, 75, 88)
            
            print(f"   [AUTOPILOT] VRAM: {c_vram}{used}MB / {total}MB ({vram_percent:.1f}%){C_RESET} | RAM: {c_ram}{ram_str}{C_RESET} | GPU Temp: {c_temp}{temp}°C{C_RESET}")
            
            # Thermal Redline (87°C is generally throttling territory for laptop RTX 3050s)
            if temp > 87:
                print(f"\n{C_FLASH}🚨 AUTOPILOT ENGAGED: THERMAL CRITICAL! 🚨{C_RESET}")
                print(f"{C_RED}GPU Temperature hit {temp}°C. Imminent thermal throttling/damage risk.{C_RESET}")
                print(f"{C_RED}Aborting batch to let the ship cool down.{C_RESET}")
                play_klaxon()
                time.sleep(1) # Let the sound start
                sys.exit(1)
                
            # VRAM Redline is 97% on a 6GB card (Ollama naturally sits at 90-95% when loaded)
            if vram_percent > 97.0:
                print(f"\n{C_FLASH}🚨 AUTOPILOT ENGAGED: PULL UP! PULL UP! 🚨{C_RESET}")
                print(f"{C_RED}VRAM is critically high at {vram_percent:.1f}% ({used}MB). Imminent spillover detected.{C_RESET}")
                print(f"{C_RED}Aborting batch to save the ship.{C_RESET}")
                play_klaxon()
                time.sleep(1) # Let the sound start
                sys.exit(1)
    except Exception as e:
        print(f"   [AUTOPILOT] Sensors degraded (could not read nvidia-smi): {e}")


# ====================== HELPERS ======================
def safe_downsample(img_data: bytes, max_dim: int = MAX_DIM) -> bytes:
    """Aggressively downsample while preserving aspect ratio and quality."""
    try:
        image = Image.open(io.BytesIO(img_data)).convert("RGB")
    except Exception as e:
        raise ValueError("Invalid or corrupted image data (might be a video or text file).")
        
    image = ImageOps.exif_transpose(image)
    
    image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG", quality=88, optimize=True)
    return buffered.getvalue()

def generate_caption(img_data: bytes, filename: str) -> dict:
    """Call Llava-Phi3 with strict JSON output."""
    small_img = safe_downsample(img_data)
    b64_img = base64.b64encode(small_img).decode('utf-8')
    
    payload = {
        "model": MODEL_NAME,
        "prompt": SYSTEM_PROMPT,
        "images": [b64_img],
        "stream": False,
        "format": "json", # Forces Ollama to conform to JSON output
        "options": {
            "temperature": 0.1,
            "num_predict": 600,
            "top_p": 0.9,
            "num_ctx": 4096 # Cap the context window strictly!
        }
    }
    
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(OLLAMA_URL, json=payload, timeout=60)
            resp.raise_for_status()
            result = resp.json()
            
            raw_text = result.get("response", "")
            
            try:
                start = raw_text.find('{')
                end = raw_text.rfind('}') + 1
                json_str = raw_text[start:end]
                data = json.loads(json_str)
                return data
            except:
                return {"error": "JSON parse failed", "raw": raw_text[:500]}
                
        except Exception as e:
            print(f"   Attempt {attempt+1} failed: {e}")
            time.sleep(2 ** attempt)
    
    return {"error": "All retries failed"}

# ====================== MAIN ======================
def run_safe_batch(limit=10):
    query = {"caption": {"$exists": False}}
    
    docs = list(collection.find(query).limit(limit))
    
    if not docs:
        print("No uncaptioned items found!")
        return
        
    print(f"Starting safe Llava-Phi3 batch: {len(docs)} images @ max {MAX_DIM}px")
    print(f"Autopilot telemetry active. Monitoring VRAM and System RAM...")
    
    success_count = 0
    total_processing_time = 0.0
    
    for idx, doc in enumerate(docs):
        doc_id = doc["_id"]
        filename = doc.get("originalName") or doc.get("fileName", "unknown")
        
        try:
            print(f"\n[{doc_id}] Processing {filename}...")
            
            # Autopilot checks the gauges BEFORE doing any heavy lifting
            check_hardware_telemetry()
            
            # Use our robust URL/Base64 extraction logic
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
                print(f"   Skipping - no image data")
                continue
            
            start = time.time()
            caption_data = generate_caption(img_data, filename)
            duration = time.time() - start
            
            if "error" in caption_data:
                print(f"   ❌ Llava returned error: {caption_data}")
                continue
                
            # Build string from JSON safely
            def safe_str(val):
                if isinstance(val, list):
                    return ", ".join(str(v) for v in val)
                return str(val)

            subjects_raw = caption_data.get("subjects", [])
            subjects = safe_str(subjects_raw) if subjects_raw else "unknown"
            
            env_val = safe_str(caption_data.get('environment', 'unknown'))
            light_val = safe_str(caption_data.get('lighting', 'unknown'))
            
            base_caption = f"Subjects: {subjects}. Environment: {env_val}. Lighting: {light_val}."
            
            text_raw = caption_data.get("text")
            if text_raw and text_raw != "null":
                base_caption += f" Text: {safe_str(text_raw)}."
                
            total_processing_time += duration
            avg_time = total_processing_time / (success_count + 1)
            remaining_items = len(docs) - (idx + 1)
            eta_seconds = remaining_items * avg_time
            eta_str = time.strftime('%H:%M:%S', time.gmtime(eta_seconds))
            
            print(f"   ✓ Done in {duration:.1f}s | Avg: {avg_time:.1f}s | Batch ETA: {eta_str}")
            print(f"   ✓ Result: {base_caption}")
            
            # Save result
            now = datetime.utcnow().isoformat() + "Z"
            collection.update_one(
                {"_id": doc_id},
                {"$set": {
                    "caption": base_caption,
                    "triage.summary": base_caption,
                    "aiProcessed": True,
                    "aiModel": f"llava-phi3-3b-{MAX_DIM}px",
                    "aiProcessedAt": now,
                    "llava_json": caption_data
                }}
            )
            success_count += 1
            
            # Memory discipline
            gc.collect()
            
        except Exception as e:
            print(f"   ❌ Failed {doc_id}: {e}")
            
    print(f"\nBatch complete. Processed {success_count} / {len(docs)}")

if __name__ == "__main__":
    try:
        run_safe_batch(limit=10)   # Start small!
    except KeyboardInterrupt:
        print("\nBatch manually aborted by Commander.")
    except Exception as e:
        print(f"\n❌ FATAL SCRIPT ERROR: {e}")
    finally:
        print("\nScript execution finished.")
        # Prevent the window from vanishing if run outside the IDE terminal
        try:
            input("Press Enter to close this window...")
        except:
            pass
