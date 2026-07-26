import os
import sys

print("[MneOS] Initiating Sovereign Evacuation to B2...")

# 1. Configure B2 Remote
config_cmd = 'rclone config create MneOS_B2 b2 account="0055db00fff7f080000000002" key="K0050CdEagJspMBvvDLTJSTHXspBH1E"'
print(" -> Configuring Rclone B2 credentials...")
if os.system(config_cmd) != 0:
    print("[ERROR] Failed to configure rclone.")
    sys.exit(1)

# 2. Sync to B2
sync_cmd = 'rclone sync /workspace/ MneOS_B2:LifeOS-Media/Vast_Evacuation_Backup --exclude "ComfyUI/models/checkpoints/**" --exclude "ComfyUI/models/unet/**" --exclude "**/venv/**" --exclude "**/.git/**" --exclude "**/.cache/**" --progress --transfers 8'
print(" -> Executing Diff Sync... (Skipping massive base models, git histories, and virtual environments)")
if os.system(sync_cmd) != 0:
    print("[ERROR] Sync failed or was interrupted.")
    sys.exit(1)

print("[MneOS] Evacuation Complete! You are cleared to destroy the node.")
