import urllib.request
import urllib.parse
import json
import time
import os

# --- COMMANDER SETTINGS ---
COMFY_URL = "http://127.0.0.1:8188"
OUTPUT_DIR = "/workspace/output/turnarounds"
SEED = 42424242 # Strict identity lock

# 3D Topology Framing Matrix
FRAMINGS = [
    "Macro close-up of face, portrait",
    "Head and shoulders portrait, looking at camera",
    "Medium shot, upper torso, chest up",
    "Medium full shot, from the knees up",
    "Full body shot, head to toe, standing completely visible"
]

# Clinical Rotation Matrix (Avoiding token collision)
ANGLES = [
    {"label": "000_front", "prompt": "0-degree front facing, looking directly at camera, facial symmetry"},
    {"label": "045_three_quarter", "prompt": "45-degree three-quarter view, looking slightly away"},
    {"label": "090_profile", "prompt": "90-degree profile view, side of face, looking to the side"},
    {"label": "135_back_quarter", "prompt": "135-degree three-quarter back view, looking away"},
    {"label": "180_back", "prompt": "180-degree back view, shot from behind, facing completely away from camera"},
    {"label": "270_opp_profile", "prompt": "270-degree opposite profile view, side of face, looking to the other side"}
]

# Attire Matrix
ATTIRES = [
    {"label": "clothed", "prompt": "wearing a form fitting medium blue lighter navy blue 1 piece swimsuit with no heavy seams"},
    {"label": "nude", "prompt": "anatomically correct nude, bare skin, exposed anatomy"} # Assuming spicy LoRA handles the rest
]

# Base Injectors
BASE_ENVIRONMENT = "against a moody dark charcoal gray textured studio backdrop, professional portrait photography, subtle vignette, soft box studio lighting, high contrast cinematic depth"
BASE_IDENTITY = "Ruthie, a woman with a short brown bob haircut, wispy bangs, light freckles, wearing thin oval wire-rimmed glasses, highly detailed natural unfiltered skin texture, micro-pores, extremely fine vellus hairs where appropriate"

WORKFLOW_DATA = {
  "3": {"class_type": "KSampler", "inputs": {"seed": 42424242, "steps": 9, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0, "model": ["50", 0], "positive": ["27", 0], "negative": ["33", 0], "latent_image": ["13", 0]}},
  "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["29", 0]}},
  "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "Loom_Sovereign", "images": ["8", 0]}},
  "13": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
  "27": {"class_type": "CLIPTextEncode", "inputs": {"text": "placeholder", "clip": ["50", 1]}},
  "28": {"class_type": "UNETLoader", "inputs": {"unet_name": "z_image_turbo_bf16.safetensors", "weight_dtype": "default"}},
  "29": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
  "30": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b_fp8_mixed.safetensors", "type": "lumina2", "device": "default"}},
  "33": {"class_type": "CLIPTextEncode", "inputs": {"text": "blurry, ugly, bad, deformed, extra fingers, text, watermark", "clip": ["50", 1]}},
  "50": {"class_type": "LoraLoader", "inputs": {"lora_name": "ruthie_lokr_v2.safetensors", "strength_model": 2.00, "strength_clip": 1.40, "model": ["28", 0], "clip": ["30", 0]}}
}

def queue_prompt(prompt_workflow):
    p = {"prompt": prompt_workflow}
    data = json.dumps(p).encode('utf-8')
    req = urllib.request.Request(f"{COMFY_URL}/prompt", data=data)
    try:
        urllib.request.urlopen(req)
        print(" -> Job queued successfully.")
    except urllib.error.HTTPError as e:
        print(f" -> ERROR queuing job: {e} - {e.read().decode('utf-8')}")
    except Exception as e:
        print(f" -> ERROR queuing job: {e}")

def generate_matrix():
    print(f"[MneOS] Commencing Sovereign Turnaround Matrix...")
    print(f"Total projected renders: {len(FRAMINGS) * len(ANGLES) * len(ATTIRES)}")
    
    workflow = WORKFLOW_DATA
    
    # Node Mapping for Z-Image Turbo / AuraFlow Architecture
    POSITIVE_PROMPT_NODE_ID = "27"  # The ID for your main positive text prompt
    SAVE_IMAGE_NODE_ID = "9"       # The ID for your SaveImage node
    KSAMPLER_NODE_ID = "3"         # The ID for your KSampler (to lock seed)
    
    job_count = 1
    for attire in ATTIRES:
        for frame in FRAMINGS:
            for angle in ANGLES:
                print(f"\n[Job {job_count}/60] {attire['label'].upper()} | {frame[:20]}... | {angle['label']}")
                
                # Construct Clinical Prompt
                full_prompt = f"{BASE_IDENTITY}, {attire['prompt']}, {frame}, {angle['prompt']}, {BASE_ENVIRONMENT}"
                
                # Clone workflow to avoid mutation
                job_workflow = json.loads(json.dumps(workflow))
                
                # Inject Matrix Data
                if POSITIVE_PROMPT_NODE_ID in job_workflow:
                    job_workflow[POSITIVE_PROMPT_NODE_ID]["inputs"]["text"] = full_prompt
                
                if KSAMPLER_NODE_ID in job_workflow:
                    job_workflow[KSAMPLER_NODE_ID]["inputs"]["seed"] = SEED
                
                if SAVE_IMAGE_NODE_ID in job_workflow:
                    filename_prefix = f"turnaround_{attire['label']}_{angle['label']}_{job_count}"
                    job_workflow[SAVE_IMAGE_NODE_ID]["inputs"]["filename_prefix"] = filename_prefix

                queue_prompt(job_workflow)
                job_count += 1
                time.sleep(0.5) # Prevent socket flooding

if __name__ == "__main__":
    generate_matrix()
    print("\n[MneOS] All 60 topology renders have been successfully injected into the ComfyUI queue.")
