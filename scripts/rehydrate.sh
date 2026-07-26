#!/bin/bash
# rehydrate.sh
# Run this script manually once the RunPod instance is cleanly booted to bypass proxy timeouts.
# Usage: ./rehydrate.sh [--factory | --bakery | --all]

MODE="all"

if [ "$1" == "--factory" ]; then
    MODE="factory"
elif [ "$1" == "--bakery" ]; then
    MODE="bakery"
elif [ "$1" == "--all" ]; then
    MODE="all"
fi

echo "[MneOS] Commencing Manual Rehydration of the Sovereign Forge in MODE: $MODE"

# Update and install dependencies
apt-get update && apt-get install -y wget git unzip curl rclone aria2 python3-venv

echo "[MneOS] Configuring Rclone for B2 Vault..."
mkdir -p /root/.config/rclone
# Replace with actual keys if injected, or use secure mechanism
cat << 'EOF' > /root/.config/rclone/rclone.conf
[b2]
type = b2
account = 0055db00fff7f080000000002
key = K0050CdEagJspMBvvDLTJSTHXspBH1E
EOF

B2_TARGET="b2:LifeOS-Media/MegaForge"
EXCLUDES="--exclude venv/** --exclude .venv/** --exclude python_embeded/** --exclude __pycache__/** --exclude .cache/** --exclude node_modules/** --exclude .git/**"

if [ "$MODE" == "factory" ] || [ "$MODE" == "all" ]; then
    echo "[MneOS] Pulling Factory (ComfyUI) from B2 Vault..."
    mkdir -p /workspace/ComfyUI
    rclone copy --config /root/.config/rclone/rclone.conf --progress --transfers 16 \
      $EXCLUDES $B2_TARGET/Factory /workspace/ComfyUI
fi

if [ "$MODE" == "bakery" ] || [ "$MODE" == "all" ]; then
    echo "[MneOS] Pulling Bakery (AI-Toolkit) from B2 Vault..."
    mkdir -p /workspace/ai-toolkit
    rclone copy --config /root/.config/rclone/rclone.conf --progress --transfers 16 \
      $EXCLUDES $B2_TARGET/Bakery /workspace/ai-toolkit

    echo "[MneOS] Provisioning Ostris AI-Toolkit for Flux/Z-Image LoRA baking..."
    cd /workspace/ai-toolkit
    git submodule update --init --recursive
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    pip install torchaudio torchvision
    pip install "numpy<2"
    
    echo "[MneOS] Generating PURE LORA AI-Toolkit YAML Configuration..."
    cat << 'EOF' > /workspace/ai-toolkit/config/ruthie_lora_v2.yaml
job: extension
config:
  name: ruthie_lora_v2
  process:
    - type: diffusion_trainer
      training_folder: /workspace/output
      device: cuda:0
      network:
        type: lora
        linear: 16
        linear_alpha: 16
      save:
        dtype: bf16
        save_every: 550
        max_step_saves_to_keep: 2
      datasets:
        - folder_path: /workspace/dataset
          caption_ext: txt
          caption_dropout_rate: 0.05
          cache_latents_to_disk: true
          resolution:
          - 512
      train:
        batch_size: 1
        steps: 2200
        gradient_accumulation: 1
        train_unet: true
        train_text_encoder: false
        gradient_checkpointing: true
        noise_scheduler: flowmatch
        optimizer: adamw8bit
        lr: 0.0001
        dtype: bf16
      model:
        name_or_path: Tongyi-MAI/Z-Image
        quantize: false
        arch: zimage
EOF
fi

echo "[MneOS] Pulling Shared Assets (Models/Datasets)..."
mkdir -p /workspace/models
rclone copy --config /root/.config/rclone/rclone.conf --progress --transfers 16 \
  $EXCLUDES $B2_TARGET/Assets/models /workspace/models

mkdir -p /workspace/dataset
rclone copy --config /root/.config/rclone/rclone.conf --progress --transfers 16 \
  $EXCLUDES $B2_TARGET/Assets/dataset /workspace/dataset

echo "[MneOS] Restoring container permissions..."
chown -R 1000:1000 /workspace
chmod -R 775 /workspace

echo "[MneOS] Bakery Rehydrated and Provisioned. Awaiting manual ignition."
