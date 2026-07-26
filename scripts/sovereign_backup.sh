#!/bin/bash
# sovereign_backup.sh
# Performs an atomic, surgical backup of the Sovereign Forge to B2.
# Skips venv bloat, cache, and dependency thousands of tiny files.

echo "[MneOS] Initiating Sovereign Atomic Backup..."

# Ensure Rclone is configured
if [ ! -f "/root/.config/rclone/rclone.conf" ]; then
    echo "ERROR: Rclone not configured. Hydrate first or setup manually."
    exit 1
fi

# Define the B2 target
B2_TARGET="b2:LifeOS-Media/MegaForge"

# Define the standard exclusion list (Drops 20GB+ of useless I/O files)
EXCLUDES="--exclude venv/** --exclude .venv/** --exclude python_embeded/** --exclude __pycache__/** --exclude .cache/** --exclude node_modules/** --exclude .git/**"

echo "=========================================="
echo " PHASE 1: Backing up Factory (ComfyUI)"
echo "=========================================="
if [ -d "/workspace/ComfyUI" ]; then
    rclone sync /workspace/ComfyUI $B2_TARGET/Factory --progress --transfers 16 $EXCLUDES
else
    echo "Factory (/workspace/ComfyUI) not found. Skipping."
fi

echo "=========================================="
echo " PHASE 2: Backing up Bakery (AI-Toolkit)"
echo "=========================================="
if [ -d "/workspace/ai-toolkit" ]; then
    rclone sync /workspace/ai-toolkit $B2_TARGET/Bakery --progress --transfers 16 $EXCLUDES
else
    echo "Bakery (/workspace/ai-toolkit) not found. Skipping."
fi

echo "=========================================="
echo " PHASE 3: Backing up Shared Assets (Models/Datasets)"
echo "=========================================="
if [ -d "/workspace/models" ]; then
    rclone sync /workspace/models $B2_TARGET/Assets/models --progress --transfers 16 $EXCLUDES
else
    echo "Models directory (/workspace/models) not found. Skipping."
fi

if [ -d "/workspace/dataset" ]; then
    rclone sync /workspace/dataset $B2_TARGET/Assets/dataset --progress --transfers 16 $EXCLUDES
else
    echo "Dataset directory (/workspace/dataset) not found. Skipping."
fi

echo "[MneOS] Atomic Backup Complete. Pod is ready for the Guillotine."
