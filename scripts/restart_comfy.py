import os
import subprocess
import time

print("[MneOS] Nuclear Rebooting ComfyUI to refresh the Model Registry...")

def run_cmd(cmd):
    try:
        subprocess.run(cmd, shell=True, check=True)
    except Exception as e:
        print(f"Ignored error (probably already dead): {e}")

# Hard kill anything on port 8188 and main.py
run_cmd("kill -9 $(lsof -t -i:8188) 2>/dev/null || true")
run_cmd("pkill -9 -f main.py 2>/dev/null || true")

print("[MneOS] Waiting 3 seconds for ports to clear...")
time.sleep(3)

print("[MneOS] Reigniting ComfyUI...")
# Use nohup to start it in the background
subprocess.Popen(
    "nohup python main.py --listen 0.0.0.0 --port 8188 > /workspace/comfy.log 2>&1 &",
    shell=True,
    cwd="/workspace/ComfyUI"
)

print("[MneOS] Registry Hydrated! ComfyUI is booting in the background.")
print("[MneOS] Wait about 10 seconds, then run: python sovereign_turnaround_batch.py")
