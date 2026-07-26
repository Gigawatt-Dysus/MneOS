# CRITICAL ARCHITECTURE NOTE (Zen/Planner):
# We are NO LONGER using Firestore/Firebase.
# Current stack: Local SQLite for ingestion tracking + MongoDB Atlas (or equivalent) for vector/RAG storage.
# All references to Firestore must be ignored/removed.

import os
import sys
import sqlite3
import json
import torch
from datetime import datetime
import warnings
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env.local"))
VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY")

warnings.filterwarnings('ignore')

# ========================= CONFIG =========================
DB_PATH = "staging.db"
BATCH_SIZE = 32          # Adjust based on your 6GB VRAM
CHECKPOINT_EVERY = 50
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
# ========================================================

print("🔥 Forge Vision Pipeline - LFM2.5-VL-1.6B + Voyage-4-Large Cloud Embeddings")
print(f"Device: {DEVICE} | Batch Size: {BATCH_SIZE}\n")

# Ensure required columns exist
print("📦 Verifying staging.db schema...")
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()
try: c.execute("ALTER TABLE airlock_jobs ADD COLUMN process_state TEXT DEFAULT 'pending'")
except: pass
try: c.execute("ALTER TABLE airlock_jobs ADD COLUMN caption TEXT")
except: pass
try: c.execute("ALTER TABLE airlock_jobs ADD COLUMN embedding TEXT")
except: pass
try: c.execute("ALTER TABLE airlock_jobs ADD COLUMN processed_at DATETIME")
except: pass
try: c.execute("ALTER TABLE airlock_jobs ADD COLUMN error_msg TEXT")
except: pass
conn.commit()
conn.close()

print("✅ Local VRAM perfectly isolated for Vision. (Embeddings offloaded to Voyage Cloud)\n")

def get_pending_jobs():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT hash, filepath, filename, fileType, process_state, caption 
        FROM airlock_jobs 
        WHERE fileType = 'IMAGE' 
          AND status IN ('NEW', 'UPGRADE_SSOT')
          AND (process_state IS NULL OR process_state = 'pending' OR process_state = 'reembed_pending')
        ORDER BY classifiedAt ASC
        LIMIT ?
    """, (BATCH_SIZE * 4,))
    jobs = cursor.fetchall()
    conn.close()
    return jobs

def update_job(hash_val, caption, embedding_list):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE airlock_jobs 
        SET caption = ?, 
            embedding = ?, 
            process_state = 'vision_done',
            processed_at = CURRENT_TIMESTAMP
        WHERE hash = ?
    """, (caption, json.dumps(embedding_list), hash_val))
    conn.commit()
    conn.close()

def process_batch(jobs):
    for job in jobs:
        filepath = job['filepath']
        hash_val = job['hash']
        filename = job['filename']

        try:
            # LFM2.5-VL Captioning
            if job['process_state'] == 'reembed_pending' and job['caption']:
                caption = job['caption']
                print(f"⏩ Skipping LFM for manual caption on {filename}")
            else:
                import io
                import base64
                import urllib.request
                from PIL import Image
                
                task_prompt = "Describe this image in detail but neutrally. Focus on overall scene, people, actions, and environment. Avoid over-emphasizing any single object like clothing or shoes unless central."
                
                # Downscale image to save API overhead and RAM (Dropped to 512x512 for TTFT speed)
                image = Image.open(filepath).convert("RGB")
                image.thumbnail((512, 512))
                buffered = io.BytesIO()
                image.save(buffered, format="JPEG", quality=85)
                img_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
                
                url = "http://localhost:11434/api/generate"
                data = {
                    "model": "hf.co/LiquidAI/LFM2.5-VL-1.6B-GGUF",
                    "prompt": task_prompt,
                    "images": [img_b64],
                    "stream": False,
                    "options": {
                        "num_ctx": 8192
                    }
                }
                
                req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(req) as response:
                    result = json.loads(response.read().decode('utf-8'))
                    caption = result.get('response', '').strip()

            # Enhanced text for embedding
            embed_text = f"File: {filename}. Description: {caption}"

            # 1024d Embedding via Voyage Cloud (Option Beta)
            voyage_url = "https://api.voyageai.com/v1/embeddings"
            voyage_data = {
                "input": [embed_text],
                "model": "voyage-4-large",
                "output_dimension": 1024
            }
            voyage_req = urllib.request.Request(voyage_url, data=json.dumps(voyage_data).encode('utf-8'), headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {VOYAGE_API_KEY}'
            })
            with urllib.request.urlopen(voyage_req) as v_response:
                v_result = json.loads(v_response.read().decode('utf-8'))
                embedding_list = v_result['data'][0]['embedding']

            update_job(hash_val, caption, embedding_list)
            
            print(f"✅ Processed: {filename} | Caption length: {len(caption)}", flush=True)

        except Exception as e:
            print(f"❌ Failed {filename}: {e}", flush=True)
            conn = sqlite3.connect(DB_PATH)
            conn.execute("UPDATE airlock_jobs SET process_state = 'error', error_msg = ? WHERE hash = ?", 
                        (str(e), hash_val))
            conn.commit()
            conn.close()

    print(f"📊 Batch complete. {len(jobs)} images processed.\n")

def export_telemetry(processed_total, current_filename=""):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM airlock_jobs WHERE fileType = 'IMAGE' AND status IN ('NEW', 'UPGRADE_SSOT')")
        total_jobs = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM airlock_jobs WHERE process_state = 'vision_done'")
        done_jobs = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM airlock_jobs WHERE process_state = 'error'")
        error_jobs = cursor.fetchone()[0]
        conn.close()
        
        telemetry = {
            "total_jobs": total_jobs,
            "done_jobs": done_jobs,
            "error_jobs": error_jobs,
            "pending_jobs": total_jobs - done_jobs - error_jobs,
            "processed_this_session": processed_total,
            "current_file": current_filename,
            "last_updated": datetime.utcnow().isoformat() + "Z"
        }
        
        telemetry_path = os.path.join(os.path.dirname(__file__), "..", "..", "public", "airlock_telemetry.json")
        with open(telemetry_path, 'w') as f:
            json.dump(telemetry, f, indent=2)
    except Exception as e:
        print(f"Telemetry export failed: {e}")

# ====================== MAIN LOOP ======================
if __name__ == "__main__":
    processed_total = 0
    export_telemetry(processed_total)
    
    while True:
        jobs = get_pending_jobs()
        if not jobs:
            print("🎉 No more pending IMAGE jobs. Vision pipeline complete!")
            export_telemetry(processed_total, "COMPLETE")
            break
        
        for job in jobs:
            export_telemetry(processed_total, job['filename'])
            process_batch([job])
            processed_total += 1
            print(f"Total processed so far: {processed_total}")

