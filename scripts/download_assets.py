import os
import subprocess

print("[MneOS] Igniting Asset Hydration Protocol...")

def run_cmd(cmd, cwd=None):
    subprocess.run(cmd, shell=True, check=True, cwd=cwd)

print("1. Installing aria2c just in case...")
run_cmd("apt-get update && apt-get install -y aria2")

print("2. Hydrating Z-Image VAE...")
run_cmd('aria2c -c -x 4 -s 4 -d /workspace/ComfyUI/models/vae/ "https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors?download=true"')

print("3. Hydrating Z-Image Text Encoder (Qwen 3.4B FP8)...")
run_cmd('aria2c -c -x 4 -s 4 -d /workspace/ComfyUI/models/clip/ "https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/text_encoders/qwen_3_4b_fp8_mixed.safetensors?download=true"')

print("[MneOS] Asset Hydration Complete! Ready to update the matrix.")
