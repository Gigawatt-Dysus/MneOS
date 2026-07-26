import os
import subprocess
import time

print("[MneOS] Forcing exact filenames for VAE and CLIP...")

# Find and delete the broken hashes from aria2c just to clean up
subprocess.run("rm -f /workspace/ComfyUI/models/vae/*", shell=True)
subprocess.run("rm -f /workspace/ComfyUI/models/clip/*", shell=True)

# Redownload using wget with the explicit -O flag so we don't get AWS CDN hash names!
cmd_vae = 'wget -q --show-progress -O /workspace/ComfyUI/models/vae/ae.safetensors "https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors"'
cmd_clip = 'wget -q --show-progress -O /workspace/ComfyUI/models/clip/qwen_3_4b_fp8_mixed.safetensors "https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/text_encoders/qwen_3_4b_fp8_mixed.safetensors"'

print("1. Hydrating VAE with correct name...")
subprocess.run(cmd_vae, shell=True)

print("2. Hydrating CLIP with correct name (this is ~3.4GB, wait a moment)...")
subprocess.run(cmd_clip, shell=True)

print("3. Hard Rebooting ComfyUI...")
subprocess.run("kill -9 $(lsof -t -i:8188) 2>/dev/null || true", shell=True)
subprocess.run("pkill -9 -f main.py 2>/dev/null || true", shell=True)

time.sleep(3)

subprocess.Popen(
    "nohup python main.py --listen 0.0.0.0 --port 8188 > /workspace/comfy.log 2>&1 &",
    shell=True,
    cwd="/workspace/ComfyUI"
)

print("[MneOS] Asset fix complete! Wait 10 seconds and run python sovereign_turnaround_batch.py")
