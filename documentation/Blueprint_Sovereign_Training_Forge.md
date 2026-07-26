# BLUEPRINT: Sovereign Training Forge (Stage 1 Booster)

## Mission Architecture
This blueprint archives the exact ephemeral provisioning payload used to successfully bake the `ruthie_lokr_v2` LoRA on the Vast.ai Iron Market using the Ostris AI-Toolkit.

**Date Archived:** July 12, 2026
**Target Architecture:** RTX 4090 / A6000 (80GB+ Disk)
**Base Image:** `ghcr.io/ai-dock/pytorch:latest`

## The Payload (onstart Script)
```bash
#!/bin/bash
echo "[MneOS] Commencing Sovereign B2 Payload Injection (Training Forge)..."
apt-get update && apt-get install -y aria2 git python3-venv unzip

echo "[MneOS] Provisioning Ostris AI-Toolkit for Flux/Z-Image LoRA baking..."
mkdir -p /workspace
cd /workspace
git clone https://github.com/ostris/ai-toolkit.git
cd ai-toolkit
git submodule update --init --recursive
python3 -m venv venv
source venv/bin/activate
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
pip install "numpy<2"

echo "[MneOS] Pulling Ruthie Dataset from Sovereign B2 Vault..."
mkdir -p /workspace/dataset
aria2c -x 16 -s 16 -d /workspace/dataset https://s3.us-east-005.backblazeb2.com/LifeOS-Media/Ruthie_Stealth_Bake.zip
unzip -q /workspace/dataset/Ruthie_Stealth_Bake.zip -d /workspace/dataset
rm /workspace/dataset/Ruthie_Stealth_Bake.zip

echo "[MneOS] Generating AI-Toolkit YAML Configuration..."
cat << 'EOF' > /workspace/ai-toolkit/config/ruthie_lokr_v2.yaml
job: extension
config:
  name: ruthie_lokr_v2
  process:
    - type: diffusion_trainer
      training_folder: /workspace/output
      device: cuda:0
      network:
        type: lokr
        linear: 32
        linear_alpha: 32
        conv: 16
        conv_alpha: 16
        lokr_full_rank: true
        lokr_factor: 8
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

cat << 'EOF' > /workspace/bake_lokr.sh
#!/bin/bash
cd /workspace/ai-toolkit
source venv/bin/activate
export HF_HOME=/workspace/hf_cache 
export HF_HUB_ENABLE_HF_TRANSFER=0 
python run.py config/ruthie_lokr_v2.yaml
EOF

chmod +x /workspace/bake_lokr.sh
nohup bash /workspace/bake_lokr.sh > /workspace/bake.log 2>&1 &
echo "[MneOS] Training Forge Online. Bake sequence initiated in background."
echo "[MneOS] Tail /workspace/bake.log to monitor progress."

# Auto-Ignite ai-dock environment to ensure Jupyter loads immediately
nohup /opt/ai-dock/bin/init.sh > /workspace/jupyter_init.log 2>&1 &
```

## Recovery Notes
If a new LoRA needs to be baked, this payload can be injected into any bare-metal PyTorch Vast.ai instance via the Iron Market bridge.
