import urllib.request
import json
import random
import os
import sys
import time

COMFY_URL = "http://127.0.0.1:8188"
SLOTS_FILE = "/workspace/slots.json"

current_state = {
    "prompt": "",
    "negative_prompt": "blurry, lowres, bad anatomy, bad hands, missing fingers, extra digits, deformed, ugly, poorly drawn face, bad proportions, extra limbs, cloned face, watermark, text, signature, logo, censored, bar, mosaic, grainy, overexposed, underexposed, cartoon, painting, 3d render, plastic skin, cross-eyed, strabismus, close-set eyes, asymmetrical eyes, distorted pupils, facial asymmetry, warped face, squished face, crushed features, eye crunch, nose distortion, asian, korean, japanese, chinese, east asian features, monolids, epicanthic folds",
    "seed": -1,
    "steps": 25,
    "cfg": 2.0,
    "sampler": "euler",
    "scheduler": "sgm_uniform",
    "loras": {
        "ruthie": {"name": "ruthie_lora_zimage_v3_000000900.safetensors", "model": 0.95, "clip": 0.95},
        "enhancement": {"name": "cumming.safetensors", "model": 0.0, "clip": 0.0},
        "genitalia": {"name": "dildo.safetensors", "model": 0.0, "clip": 0.0}
    }
}

def load_slots():
    if os.path.exists(SLOTS_FILE):
        try:
            with open(SLOTS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_slots(slots_data):
    with open(SLOTS_FILE, "w") as f:
        json.dump(slots_data, f, indent=4)

def render():
    print(f"\n[MneOS] Submitting Atomic Render to {COMFY_URL}...")
    actual_seed = random.randint(1, 4294967295) if current_state["seed"] == -1 else current_state["seed"]
    
    # Base JSON Structure (Z-Image / Lumina)
    workflow = {
      "3": {"class_type": "KSampler", "inputs": {"seed": actual_seed, "steps": current_state["steps"], "cfg": current_state["cfg"], "sampler_name": current_state["sampler"], "scheduler": current_state["scheduler"], "denoise": 1.0, "model": ["52", 0], "positive": ["27", 0], "negative": ["33", 0], "latent_image": ["13", 0]}},
      "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["29", 0]}},
      "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "Sovereign_Director", "images": ["8", 0]}},
      "13": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
      "27": {"class_type": "CLIPTextEncode", "inputs": {"text": current_state["prompt"], "clip": ["52", 1]}},
      "28": {"class_type": "UNETLoader", "inputs": {"unet_name": "zimage_base.safetensors", "weight_dtype": "default"}},
      "29": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
      "30": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b_fp8_mixed.safetensors", "type": "lumina2", "device": "default"}},
      "33": {"class_type": "CLIPTextEncode", "inputs": {"text": current_state["negative_prompt"], "clip": ["52", 1]}},
      "50": {"class_type": "LoraLoader", "inputs": {"lora_name": current_state["loras"]["enhancement"]["name"], "strength_model": current_state["loras"]["enhancement"]["model"], "strength_clip": current_state["loras"]["enhancement"]["clip"], "model": ["28", 0], "clip": ["30", 0]}},
      "51": {"class_type": "LoraLoader", "inputs": {"lora_name": current_state["loras"]["ruthie"]["name"], "strength_model": current_state["loras"]["ruthie"]["model"], "strength_clip": current_state["loras"]["ruthie"]["clip"], "model": ["50", 0], "clip": ["50", 1]}},
      "52": {"class_type": "LoraLoader", "inputs": {"lora_name": current_state["loras"]["genitalia"]["name"], "strength_model": current_state["loras"]["genitalia"]["model"], "strength_clip": current_state["loras"]["genitalia"]["clip"], "model": ["51", 0], "clip": ["51", 1]}}
    }
    
    print(f" -> Steps: {current_state['steps']} | CFG: {current_state['cfg']} | Seed: {actual_seed}")
    
    p = {"prompt": workflow}
    data = json.dumps(p).encode('utf-8')
    req = urllib.request.Request(f"{COMFY_URL}/prompt", data=data)
    
    try:
        import websocket # requires: pip install websocket-client
        import uuid
        client_id = str(uuid.uuid4())
        
        p = {"prompt": workflow, "client_id": client_id}
        data = json.dumps(p).encode('utf-8')
        req = urllib.request.Request(f"{COMFY_URL}/prompt", data=data)
        
        response = urllib.request.urlopen(req)
        resp_data = json.loads(response.read().decode('utf-8'))
        prompt_id = resp_data.get("prompt_id")
        print(f" -> Job queued! Prompt ID: {prompt_id}")
        
        ws_url = COMFY_URL.replace("http://", "ws://").replace("https://", "wss://")
        ws = websocket.WebSocket()
        ws.connect(f"{ws_url}/ws?clientId={client_id}")
        
        print(" -> Rendering: [", end="", flush=True)
        while True:
            out = ws.recv()
            if isinstance(out, str):
                msg = json.loads(out)
                if msg["type"] == "progress":
                    data = msg["data"]
                    val = data["value"]
                    max_val = data["max"]
                    percent = int((val / max_val) * 20) if max_val > 0 else 0
                    sys.stdout.write("\r -> Rendering: [" + "=" * percent + " " * (20 - percent) + f"] {val}/{max_val}      ")
                    sys.stdout.flush()
                elif msg["type"] == "executing":
                    data = msg["data"]
                    if data["node"] is None:
                        # Execution is done
                        print("\n -> Render Complete! Check /workspace/ComfyUI/output/")
                        break
                    else:
                        node_id = data["node"]
                        node_class = workflow.get(str(node_id), {}).get("class_type", "Unknown Node")
                        print(f"\n -> Executing: {node_class} (ID: {node_id})", end="")
                        sys.stdout.flush()
        ws.close()
                
    except ImportError:
        print(" -> [!] 'websocket-client' not installed. Falling back to silent polling. (pip install websocket-client)")
        p = {"prompt": workflow}
        data = json.dumps(p).encode('utf-8')
        req = urllib.request.Request(f"{COMFY_URL}/prompt", data=data)
        
        response = urllib.request.urlopen(req)
        resp_data = json.loads(response.read().decode('utf-8'))
        prompt_id = resp_data.get("prompt_id")
        print(f" -> Job queued! Prompt ID: {prompt_id}")
        
        while True:
            time.sleep(1)
            q_req = urllib.request.Request(f"{COMFY_URL}/queue")
            q_resp = json.loads(urllib.request.urlopen(q_req).read().decode('utf-8'))
            pending = len(q_resp.get("queue_pending", []))
            running = len(q_resp.get("queue_running", []))
            
            if pending == 0 and running == 0:
                print(" -> Render Complete! Check /workspace/ComfyUI/output/")
                break

    except urllib.error.HTTPError as e:
        print(f" -> [!] COMFYUI HTTP ERROR: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f" -> [!] ERROR: {e}")
        print(" -> Is ComfyUI running on port 8188?")

def print_status():
    print("\n========================================")
    print("     SOVEREIGN ATOMIC DIRECTOR v2.0")
    print("========================================")
    print(f"CFG: {current_state['cfg']} | Steps: {current_state['steps']} | Seed: {current_state['seed']}")
    print(f"Sampler: {current_state['sampler']} | Scheduler: {current_state['scheduler']}")
    print("LORAS:")
    for key, lora in current_state["loras"].items():
        status = "[ON]" if lora["model"] > 0 else "[OFF]"
        print(f"  {status} {key} ({lora['model']})")
    print("========================================")
    print("Commands: /cfg <v>, /steps <v>, /seed <v>, /sampler <v>, /lora <key> <val>, /save <name>, /load <name>, /slots, /render, /status, /exit")

def main():
    print_status()
    while True:
        try:
            cmd = input("\nDirector> ").strip()
            if not cmd:
                continue
                
            parts = cmd.split(" ")
            base_cmd = parts[0].lower()
            
            if base_cmd == "/exit":
                break
            elif base_cmd == "/status":
                print_status()
            elif base_cmd == "/cfg":
                current_state["cfg"] = float(parts[1])
                print(f" -> CFG set to {current_state['cfg']}")
            elif base_cmd == "/steps":
                current_state["steps"] = int(parts[1])
                print(f" -> Steps set to {current_state['steps']}")
            elif base_cmd == "/seed":
                current_state["seed"] = int(parts[1])
                print(f" -> Seed set to {current_state['seed']}")
            elif base_cmd == "/sampler":
                current_state["sampler"] = parts[1]
                print(f" -> Sampler set to {current_state['sampler']}")
            elif base_cmd == "/scheduler":
                current_state["scheduler"] = parts[1]
                print(f" -> Scheduler set to {current_state['scheduler']}")
            elif base_cmd == "/lora":
                key = parts[1].lower()
                val = float(parts[2])
                if key in current_state["loras"]:
                    current_state["loras"][key]["model"] = val
                    current_state["loras"][key]["clip"] = val
                    print(f" -> LoRA '{key}' strength set to {val}")
                else:
                    print(f" -> Unknown LoRA key. Available: {list(current_state['loras'].keys())}")
            elif base_cmd == "/save":
                if len(parts) < 2:
                    print(" -> Usage: /save <slot_name>")
                    continue
                name = parts[1]
                slots = load_slots()
                slots[name] = current_state.copy()
                save_slots(slots)
                print(f" -> Slot '{name}' saved to {SLOTS_FILE}")
            elif base_cmd == "/load":
                if len(parts) < 2:
                    print(" -> Usage: /load <slot_name>")
                    continue
                name = parts[1]
                slots = load_slots()
                if name in slots:
                    current_state.update(slots[name])
                    print(f" -> Slot '{name}' loaded successfully.")
                    print_status()
                else:
                    print(f" -> Slot '{name}' not found.")
            elif base_cmd == "/slots":
                slots = load_slots()
                if not slots:
                    print(" -> No saved slots.")
                else:
                    print("\n--- SAVED SLOTS ---")
                    for s in slots:
                        print(f" - {s} (CFG: {slots[s]['cfg']}, Steps: {slots[s]['steps']})")
                    print("-------------------")
            elif base_cmd == "/render":
                render()
            elif base_cmd.startswith("/"):
                print(" -> Unknown command.")
            else:
                # It's a prompt
                current_state["prompt"] = cmd
                print(f" -> Prompt loaded. Type /render to execute.")
        except Exception as e:
            print(f" -> Error processing command: {e}")

if __name__ == "__main__":
    main()
