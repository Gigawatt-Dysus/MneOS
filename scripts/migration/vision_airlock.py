import os
import sys
import sqlite3
import time
from unittest.mock import MagicMock
from PIL import Image

print("\n=======================================================")
print("👁️ LifeOS Vision Airlock (Phase 3 & 4)")
print("=======================================================\n")

# ==============================================================================
# FLORENCE-2 / FLASH-ATTN MONKEY PATCHES (Windows/RTX Bypass)
# ==============================================================================
print("🔧 Injecting runtime monkey-patches for flash_attn and sdpa...")
sys.modules['flash_attn'] = MagicMock()

import transformers
original_is_flash_attn_2_available = transformers.utils.is_flash_attn_2_available
def mocked_is_flash_attn_2_available(): return False
transformers.utils.is_flash_attn_2_available = mocked_is_flash_attn_2_available
transformers.utils.import_utils.is_flash_attn_2_available = mocked_is_flash_attn_2_available

if hasattr(transformers.modeling_utils.PreTrainedModel, '_supports_sdpa'):
    transformers.modeling_utils.PreTrainedModel._supports_sdpa = property(lambda self: False)

# ==============================================================================
# IMPORTS & MODEL LOADING
# ==============================================================================
import torch
from transformers import AutoProcessor, AutoModelForCausalLM
from sentence_transformers import SentenceTransformer

# Alter columns if missing
db_path = os.path.join(os.getcwd(), 'staging.db')
print(f"📦 Connecting to Staging DB: {db_path}")
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Ensure schema has enrichment columns
try:
    c.execute("ALTER TABLE files ADD COLUMN caption TEXT")
except: pass
try:
    c.execute("ALTER TABLE files ADD COLUMN embedding TEXT")
except: pass
conn.commit()

# Setup Hardware
device = "cuda" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

print(f"🧠 Loading Florence-2-large onto {device} ({torch_dtype})...")
model_id = "microsoft/Florence-2-large"
processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype=torch_dtype, trust_remote_code=True).to(device)

print(f"🌌 Loading Vector Embedding model (all-MiniLM-L6-v2)...")
embedder = SentenceTransformer('all-MiniLM-L6-v2', device=device)

# ==============================================================================
# INFERENCE PIPELINE
# ==============================================================================
def run_florence(image_path):
    try:
        # For efficiency, we resize huge raw images before inference
        image = Image.open(image_path).convert("RGB")
        image.thumbnail((1024, 1024)) 
        
        prompt = "<MORE_DETAILED_CAPTION>"
        inputs = processor(text=prompt, images=image, return_tensors="pt").to(device, torch_dtype)

        with torch.no_grad():
            generated_ids = model.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=1024,
                num_beams=3
            )

        generated_text = processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
        return processor.post_process_generation(generated_text, task=prompt, image_size=(image.width, image.height))[prompt]
    except Exception as e:
        print(f"⚠️ VLM Error on {image_path}: {str(e)}")
        return None

# ==============================================================================
# EXECUTION LOOP
# ==============================================================================
c.execute("SELECT hash, filepath, filename FROM files WHERE processing_status = 'pending' AND extension IN ('.jpg', '.jpeg', '.png', '.webp')")
pending_files = c.fetchall()

print(f"🚀 Found {len(pending_files)} pending images to vectorize.\n")

count = 0
for file_hash, filepath, filename in pending_files:
    print(f"🔍 Analyzing: {filename}")
    
    caption = run_florence(filepath)
    if not caption:
        # Fallback to filename if image is corrupt
        caption = f"Image file named {filename}"

    print(f"   => 🗣️ {caption}")
    
    # Vectorize the caption
    with torch.no_grad():
        embedding_array = embedder.encode(caption).tolist()
    
    # Convert embedding array to string for SQLite storage
    embedding_str = str(embedding_array)

    # Update Staging DB
    c.execute("""
        UPDATE files 
        SET caption = ?, embedding = ?, processing_status = 'vectorized' 
        WHERE hash = ?
    """, (caption, embedding_str, file_hash))
    conn.commit()
    
    count += 1
    
    # Grok's Suggestion: Prevent PyTorch VRAM fragmentation on huge batches
    if count % 50 == 0:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

print("\n🎉 Vision Airlock processing complete! All pending items vectorized.")
conn.close()
