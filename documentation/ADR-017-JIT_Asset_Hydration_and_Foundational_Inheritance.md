# ADR-017: JIT Asset Hydration & Foundational Inheritance

## Status
Accepted

## Context
As the Iron Market architecture (ADR-016) evolves, we face a storage and efficiency bottleneck regarding base models. Modern image architectures (SDXL, Flux, Z-Image) spawn thousands of community fine-tunes (checkpoints). Downloading an entire `Assets` directory containing dozens of 15GB+ models during a node boot sequence introduces unacceptable latency and storage bloat.

Furthermore, we recognized that we do not need to bake a unique Ruthie LoRA for every community checkpoint. Because community models are derived from a few foundational architectures, a LoRA baked against the base model (e.g., Flux.1-Dev) will seamlessly inject into any community checkpoint derived from that same foundation.

Finally, while the ephemeral rental pipeline (Vast.ai) serves our immediate needs, the mid-term architectural roadmap targets February 2027 for a transition to in-house "Genesis-Delta" or "Epsilon" compute, leveraging owned heavy-tier GPUs (e.g., RTX 5090, RTX 4090) to permanently eliminate hourly compute costs while utilizing this exact same JIT architecture locally.

## Decision
1. **Foundational Inheritance Structure**: 
   The B2 `MegaForge/Assets` Vault will be rigidly organized by **Foundation Architecture** rather than by community model names. 
   *Example Structure:*
   - `Assets/FLUX/LoRAs/Ruthie_Master.safetensors`
   - `Assets/FLUX/Checkpoints/Juggernaut_Flux.safetensors`
   - `Assets/SDXL/LoRAs/Ruthie_SDXL_Master.safetensors`

2. **Just-In-Time (JIT) Asset Hydration**:
   Inference nodes will boot completely empty (carrying only the lightweight `Factory` ComfyUI engine). When a render is requested via MneOS, a lightweight proxy will evaluate the required Foundation Architecture.
   If the required Foundation assets are not present in `/workspace/Assets/`, the proxy will dynamically execute a surgical `rclone` pull from the B2 Vault *before* sending the workflow to ComfyUI. 
   Because the nodes retain a 150GB disk, subsequent renders on the same architecture will hit the local cache instantly.

3. **Compute Engine Agnosticism (Roadmap to Feb 2027)**:
   This JIT architecture treats the compute node purely as an engine. Whether the engine is an ephemeral A6000 on Vast.ai today, or a local RTX 5090 in the "Genesis-Delta" rig in February 2027, the MneOS orchestration remains identical. The local node will simply JIT-hydrate from the local disk instead of the B2 Vault.

## Consequences
- **Positive:** Node boot times are reduced to seconds, as zero heavy models are downloaded at startup.
- **Positive:** The Bakery workload is slashed; we only train one "Ruthie Master" per Foundation Architecture.
- **Positive:** Future-proofs the MneOS backend for the seamless integration of in-house Genesis compute hardware in 2027.
- **Negative:** Requires developing a lightweight JIT orchestration proxy script on the Inference node to intercept UI requests and trigger `rclone` pulls.
