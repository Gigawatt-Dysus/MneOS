# ADR-016: Sovereign Ephemeral Forge Modularization (The Golden Image Split)

## Status
Accepted

## Context
Project GIGI: Mnemosyne (MneOS) utilizes a rent-on-demand ephemeral GPU compute bridge (The Iron Market) via Vast.ai to execute photorealistic image generation (Inference) and AI-Toolkit LoRA training (Bakery). 

Historically, this required spinning up a transient GPU node and executing a monolithic 70GB+ hydration sequence using `rclone` to pull the complete `MegaForge` backup from our Backblaze B2 Vault. 

While attached storage on Vast.ai is incredibly cheap (rendering efforts to aggressively prune disk footprint financially meaningless), the *hydration network transfer time* creates unacceptable cold-start latency. 
If the Commander requested an Inference render via the UI, the pipeline was forced to download 40GB of unused training datasets and `ai-toolkit` dependencies before the node could accept a ComfyUI generation queue, burning 3-4 minutes of boot time.

## Decision
We are splitting the monolithic B2 Golden Image into three explicit, modular sectors:

1. **`MegaForge/Bakery`**: 
   - Contains: Ostris `ai-toolkit`, training scripts, dataset processing tools.
   - Boot Behavior: Only pulled when MneOS requests a Training Lease.
   - Exclusion: Strict exclusion of `venv/`, `.cache/`, and HuggingFace cache directories. The `ai-dock` base images rebuild these faster internally than we can sync them, saving immense object storage and transfer time.

2. **`MegaForge/Factory`**: 
   - Contains: ComfyUI, Custom Nodes, and headless Workflow JSON orchestrators.
   - Boot Behavior: Pulled instantly when MneOS requests an Inference Lease, ensuring rapid time-to-first-pixel.

3. **`MegaForge/Assets`**: 
   - Contains: Base Models (e.g., 15GB Z-Image Safetensors), Pure LoRAs (e.g., `ruthie_lora_v2.safetensors`), and fluid overlays.
   - Boot Behavior: Actively shared and pulled by *both* the Factory and the Bakery depending on the required pipeline. 

Additionally, we mandate a minimum 150GB disk provision for all Iron Market leases regardless of pipeline. The cost difference is negligible (fractions of a penny per hour), and this prevents catastrophic `Out of Space` errors during 16K latent caching or dataset unpacking.

## Consequences
- **Positive:** Time-to-first-pixel on Inference boots is drastically reduced.
- **Positive:** B2 Vault storage efficiency is maximized by avoiding bloated Python cache syncs.
- **Positive:** Protects against catastrophic mid-run disk-full crashes by establishing a 150GB minimum disk allocation standard.
- **Negative:** Requires slightly more complex `rclone` targeting in the `vastLeaseService.ts` scripts to ensure the correct sectors are hydrated.

## Constraint: Z-Image Validation
Due to the VRAM requirements of the 15GB Z-Image base weight, the local development bridge (RTX 3050 6GB) **cannot** be used to run the `sovereign_atomic_test.py` validation sequence. The atomic validation must *always* be executed by spinning up an ephemeral Inference lease (Factory + Assets) on the Iron Market (e.g., A6000, 4090) to process the render before the node is terminated.
