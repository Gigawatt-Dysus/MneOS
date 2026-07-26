# ADR-018: Sovereign Z-Image Architecture and Boot Sequencing

## Status
Accepted

## Context
As we integrated the **Z-Image** (Tongyi-MAI) architecture into the MneOS Universal Forge, we encountered several critical failures during the initial ephemeral node boot and workflow execution. These failures exposed three distinct architectural challenges that must be addressed for future provisioning:

1. **The Lumina/Z-Image Dependency Chain**:
   Z-Image is a Lumina-based model utilizing a Scalable Single-Stream Diffusion Transformer (S3-DiT). It is not a monolith. It functionally depends on the Flux VAE (`ae.safetensors`) for tokenization and the Qwen-3 text encoder (`qwen_3_4b_fp8_mixed.safetensors`). Early deployments failed because the B2 "Gold Source" only contained the UNET, resulting in empty CLIP and VAE arrays in ComfyUI.

2. **The ComfyUI Version Lag**:
   The standard `ghcr.io/ai-dock/comfyui:latest-cuda` base image frequently lags behind bleeding-edge architectural updates. During our initial Z-Image test, the engine rejected the `lumina2` node type because it had not yet been merged into the container's version of the ComfyUI repository.

3. **The Boot Race Condition**:
   Vast.ai and RunPod nodes execute their primary background scripts (e.g., `ai-dock` supervisor tasks) simultaneously with our custom `onstart.sh` injection. This means ComfyUI will boot and cache the `/workspace/ComfyUI/models/` directory *before* our 15GB+ `rclone sync` from B2 finishes. The result is a fully synced folder but a completely blind ComfyUI engine that thinks no models exist.

## Decision
To guarantee a pristine, zero-touch boot sequence for the Z-Image pipeline, we are implementing the following structural rules:

1. **Complete Architectural Payloads**: 
   The B2 Vault (`MegaForge/Factory/models`) MUST explicitly include all decoupled dependencies for a target architecture. For Z-Image, this means `ae.safetensors` must permanently reside in the `vae` folder, and `qwen_3_4b_fp8_mixed.safetensors` in the `clip` folder.

2. **JIT Engine Patching**:
   If a bleeding-edge architecture like Lumina2 is required, the deployment script MUST execute a dynamic `git checkout master && git pull` within the `/opt/ComfyUI` repository, followed by a `pip install` of any new dependencies (e.g., `sqlalchemy` in recent frontend changes) to ensure the engine natively recognizes the node types.

3. **Synchronous Cache Busting (The Race Condition Fix)**:
   The final step of any B2 `rclone sync` hydration script MUST be an explicit command to restart the ComfyUI backend service (e.g., `supervisorctl restart comfyui`). This forces the engine to re-index the models directory immediately after the massive payload physically arrives on disk, eliminating the blind cache state.

## Consequences
- **Positive:** Ensures zero-touch, headless deployment of bleeding-edge architectures like Z-Image.
- **Positive:** Eliminates "Value not in list" and missing model errors caused by asynchronous hydration.
- **Negative:** Adds a few extra seconds to the boot sequence while the ComfyUI service restarts.
- **Negative:** Requires strict administrative discipline when updating the B2 Gold Source to ensure VAE and CLIP components are never forgotten.
