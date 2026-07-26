import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const VAST_API_KEY = process.env.VAST_API_KEY;
const VAST_BASE_URL = 'https://console.vast.ai/api/v0';
// B2 Envs mapped from .env.local
const B2_ENDPOINT = process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com';
const B2_BUCKET = process.env.B2_BUCKET_NAME || 'LifeOS-Media';

/**
 * Creates an instance on Vast.ai from a selected offer ID.
 * Injects the B2 cold-start payload to download the Sovereign Flux environment.
 */
export async function createVastLease(offerId: number, dph_total: number, leaseType: string = 'universal', templateHash?: string) {
  if (!VAST_API_KEY) throw new Error('VAST_API_KEY not defined in environment.');

  const b2DatasetUrl = `${B2_ENDPOINT}/${B2_BUCKET}/Ruthie_Stealth_Bake.zip`;
  
  let dockerImage = 'ghcr.io/ai-dock/comfyui:latest-cuda';
  
  const b2KeyId = process.env.B2_KEY_ID || '0055db00fff7f080000000002';
  const b2AppKey = process.env.B2_APP_KEY || 'K0050CdEagJspMBvvDLTJSTHXspBH1E';

  const onstartScript = `#!/bin/bash
echo "[MneOS] Universal Forge Provisioning Initiated."

# Inject SSH Key
mkdir -p /root/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPlvynNBn3gegXjRT8pa9H+/+QXn8dQZDxCkvwkilkcL artin@MneOS-Prime" > /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# Setup Rclone & Deps
apt-get update && apt-get install -y wget git unzip curl rclone aria2 python3-venv
mkdir -p /root/.config/rclone
cat << 'EOF' > /root/.config/rclone/rclone.conf
[b2]
type = b2
account = ${b2KeyId}
key = ${b2AppKey}
EOF

# 1. Inference Workspace
echo "[MneOS] Hydrating ComfyUI from B2..."
rm -rf /workspace/ComfyUI
rclone sync --config /root/.config/rclone/rclone.conf --progress --transfers 16 \
  --exclude "venv/**" --exclude ".venv/**" --exclude "python_embeded/**" --exclude "__pycache__/**" \
  b2:${B2_BUCKET}/MegaForge/Factory /workspace/ComfyUI
chmod -R 777 /workspace/ComfyUI

# 2. Engine Persistence & Execution Hijack
echo "[MneOS] Hijacking ai-dock supervisor to execute from persistent workspace..."
supervisorctl stop comfyui
rm -rf /opt/ComfyUI
ln -s /workspace/ComfyUI /opt/ComfyUI

echo "[MneOS] Patching ComfyUI engine to latest master & rebooting cache..."
cd /opt/ComfyUI && git checkout master && git pull
/opt/environments/python/comfyui/bin/pip install -r /opt/ComfyUI/requirements.txt
cat << 'EOF' > /tmp/patch_attention.py
import sys
f = "/workspace/ComfyUI/comfy/ldm/modules/attention.py"
c = open(f).read()
patch = """    sdpa_keys = ("scale",)
    sdpa_extra = {k: v for k, v in kwargs.items() if k in sdpa_keys}

    if k.shape[1] != q.shape[1]:
        num_repeat = q.shape[1] // k.shape[1]
        k = k.repeat_interleave(num_repeat, dim=1)
        v = v.repeat_interleave(num_repeat, dim=1)

    if SDP_BATCH_LIMIT >= b:"""
existing = """    sdpa_keys = ("scale",)
    sdpa_extra = {k: v for k, v in kwargs.items() if k in sdpa_keys}

    if SDP_BATCH_LIMIT >= b:"""
c = c.replace('sdpa_keys = ("scale", "enable_gqa")', 'sdpa_keys = ("scale",)')
c = c.replace(existing, patch)
open(f, "w").write(c)
EOF
python3 /tmp/patch_attention.py
supervisorctl start comfyui

# 2. Training Bakery
echo "[MneOS] Provisioning Ostris AI-Toolkit..."
cd /workspace
git clone https://github.com/ostris/ai-toolkit.git
cd ai-toolkit
git submodule update --init --recursive
python3 -m venv venv
source venv/bin/activate
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
pip install "numpy<2"

echo "[MneOS] Pulling Ruthie Dataset..."
mkdir -p /workspace/dataset
aria2c -x 16 -s 16 -d /workspace/dataset ${b2DatasetUrl}
unzip -q /workspace/dataset/Ruthie_Stealth_Bake.zip -d /workspace/dataset
rm /workspace/dataset/Ruthie_Stealth_Bake.zip

echo "[MneOS] Generating AI-Toolkit YAML Configuration..."
cat << 'EOF' > /workspace/ai-toolkit/config/ruthie_lora_zimage_v3.yaml
job: extension
config:
  name: ruthie_lora_zimage_v3
  process:
    - type: diffusion_trainer
      training_folder: /workspace/output
      device: cuda:0
      network:
        type: lora
        linear: 32
        linear_alpha: 16
      save:
        dtype: bf16
        save_every: 300
        max_step_saves_to_keep: 6
      datasets:
        - folder_path: /workspace/dataset
          caption_ext: txt
          caption_dropout_rate: 0.10
          cache_latents_to_disk: true
          resolution:
          - 1024
      train:
        batch_size: 1
        steps: 1800
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

cat << 'EOF' > /workspace/bake_lora.sh
#!/bin/bash
cd /workspace/ai-toolkit
source venv/bin/activate
export HF_HOME=/workspace/hf_cache 
export HF_HUB_ENABLE_HF_TRANSFER=0 
python run.py config/ruthie_lora_zimage_v3.yaml
EOF
chmod +x /workspace/bake_lora.sh

# 3. Inject Interactive Terminal Menu
cat << 'EOF' > /root/.bashrc
# MneOS Interactive Terminal Menu
show_menu() {
  clear
  echo "========================================"
  echo "     MneOS UNIVERSAL FORGE CONTROL"
  echo "========================================"
  echo "[1] Tail ComfyUI Inference Logs"
  echo "[2] Start LoRA Bake (Ruthie_v3)"
  echo "[3] Tail Bakery Training Logs"
  echo "[4] Stop / Kill LoRA Bake"
  echo "[5] Force-Sync B2 MegaForge Updates"
  echo "[6] Atomic Render Console (Sovereign Director)"
  echo "[X] Exit to Standard Terminal"
  echo "========================================"
  read -p "Select an operation (1-6, X): " choice
  case $choice in
    1) tail -f /workspace/jupyter_init.log ;;
    2) nohup bash /workspace/bake_lora.sh > /workspace/bake.log 2>&1 & echo "Bake Started." ;;
    3) tail -f /workspace/bake.log ;;
    4) pkill -f "run.py config/ruthie_lora_zimage_v3.yaml" && echo "Bake stopped." ;;
    5) rclone sync --config /root/.config/rclone/rclone.conf --progress b2:${B2_BUCKET}/MegaForge/Factory /workspace/ComfyUI ;;
    6) python3 /workspace/Sovereign_Director.py ;;
    X|x) echo "Exiting to terminal." ;;
    *) echo "Invalid option." ;;
  esac
}
show_menu
EOF

echo "[MneOS] Universal Forge Online. Auto-igniting ai-dock."
nohup /opt/ai-dock/bin/init.sh > /workspace/jupyter_init.log 2>&1 &
`;

  const url = `${VAST_BASE_URL}/asks/${offerId}/`;
  
  const payload: any = {
    client_id: "me",
    disk: 150, // Massive allocation required to safely house the full 15GB Z-Image base weight and B2 payload
  };

  if (templateHash && templateHash.trim() !== '') {
    payload.template_hash_id = templateHash.trim();
  } else {
    payload.image = dockerImage;
    payload.args = [];
    payload.env = {
      "DIRECT_ADDRESS": "1",
      "JUPYTER_DIR": "/",
      "PUBLIC_KEY": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPlvynNBn3gegXjRT8pa9H+/+QXn8dQZDxCkvwkilkcL artin@MneOS-Prime"
    };
    payload.onstart = onstartScript;
    payload.runtype = "jupyter_direct_ssh";
  }

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VAST_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[VastLease] Failed to create lease: ${response.status} - ${errText}`);
      throw new Error(`Failed to create lease: ${response.status} - ${errText}`);
    }

    const data = await response.json() as any;
    console.log(`[VastLease] 🟢 Lease created. Type: ${leaseType.toUpperCase()}. Contract ID: ${data.new_contract}`);
    return data; 
  } catch (error) {
    console.error('[VastLease] API Error during create:', error);
    throw error;
  }
}

/**
 * The 15-Minute Guillotine Protocol
 * Destroys a Vast.ai instance immediately to prevent budget runaway.
 */
export async function destroyVastLease(instanceId: number) {
  if (!VAST_API_KEY) throw new Error('VAST_API_KEY not defined in environment.');

  const url = `${VAST_BASE_URL}/instances/${instanceId}/`;
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${VAST_API_KEY}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[VastLease] Failed to destroy lease ${instanceId}: ${response.status} - ${errText}`);
      throw new Error(`Failed to destroy lease: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    console.log(`[VastLease] 🔴 Guillotine executed. Lease ${instanceId} terminated.`);
    return data;
  } catch (error) {
    console.error(`[VastLease] API Error during destroy of ${instanceId}:`, error);
    throw error;
  }
}

export async function getVastInstances() {
  if (!VAST_API_KEY) throw new Error('VAST_API_KEY not defined in environment.');

  const url = `https://console.vast.ai/api/v1/instances/`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${VAST_API_KEY}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[VastLease] Failed to fetch instances: ${response.status} - ${errText}`);
      throw new Error(`Failed to fetch instances: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[VastLease] API Error during getInstances:', error);
    throw error;
  }
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const data = await getVastInstances();
      return res.status(200).json({ status: 'success', data: data.instances || [] });
    }

    if (req.method === 'POST') {
      const { offerId, price, leaseType, templateHash } = req.body;
      const data = await createVastLease(offerId, price, leaseType, templateHash);
      return res.status(200).json({ status: 'success', data });
    }
    
    if (req.method === 'DELETE') {
      const { instanceId } = req.body;
      if (!instanceId) return res.status(400).json({ error: 'instanceId required' });
      const data = await destroyVastLease(instanceId);
      return res.status(200).json({ status: 'success', data });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('[VastLease] Handler Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process Vast.ai lease operation', 
      details: error.message 
    });
  }
}
