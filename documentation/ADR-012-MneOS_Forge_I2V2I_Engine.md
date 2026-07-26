# ADR-012: The MneOS Forge I2V2I Generative Pipeline

## Context
The generative pipeline for emotional tensors and UI assets in MneOS has matured into a three-step **Image-to-Video-to-Image (I2V2I)** atomic process. This approach entirely bypasses local VRAM-heavy hardware upscalers (such as ComfyUI, Sharp, or Pillow) and Runpod serverless environments, which suffered from severe inventory shortages and reliability issues. Instead, MneOS leverages a highly orchestrated relay of cloud API strengths.

## The Atomic I2V2I Pipeline
1. **Phase 1: Temporal Generation (I2V)** 
   - A video endpoint is invoked to generate a brief, 2-second clip (48 frames). This captures the natural spatiotemporal transition into a desired affect or gesture.
2. **Phase 2: The Golden Frame Pluck (Extraction)**
   - The 5-8 "golden" frames are surgically extracted from the 48-frame burst. Transitional motion blur and redundant frames are discarded to isolate the absolute structural peak of the expression.
3. **Phase 3: The Texture Pass (V2I)**
   - The isolated golden frames are fed *back* into a static image diffusion model for the final render. This stage injects the hyper-realistic physical details (e.g., vellus hairs, micro-pores, God-tier skin texture).

---

## The Three Tiers of Execution Models

### 1. Primary Engine: Grok 4.x
*   **I2V (Motion):** Grok generates the 2-second video at **720p**. (Note: Resolution drops to 480p when daily tier limits are exhausted).
*   **V2I (Texture):** The 5-8 extracted golden frames are fed back into **Grok (Aurora)** for the static render. Grok is hard-capped at a maximum resolution of **2K (2048x2048)**.

### 2. Secondary Engine: Gemini (Nano Banana)
*   **I2V (Motion):** Gemini generates the 2-second video at **720p** (until rate limits hit).
*   **V2I (Texture):** The extracted golden frames are fed back into **Gemini (Nano Banana Static)**. Because Gemini possesses 4K rendering capability, this pipeline achieves the absolute **4K (4096x4096)** God-tier photorealistic texture pass required for elite structural fidelity.

### 3. Clinical / NSFW Engine: Seedance 1.5 Spicy -> Seedream 4.5 Pro Spicy
*   **I2V (Motion):** **Seedance 1.5 Spicy** generates the spatial/motion video data.
*   **V2I (Texture):** The golden frames are routed to **Seedream 4.5 Pro Spicy**. 
*   **CRITICAL CAVEAT:** Because Grok and Gemini enforce puritanical safety filters, they cannot be used for clinical or NSFW tensors. We rely on Seedream for the final texture pass. However, Seedream's default weights heavily bias toward an anime/TikTok "glow-up" aesthetic. **The V2I prompt sent to Seedream MUST aggressively override this innate bias** to force the gritty, anatomical, clinical hyper-realism required for MneOS telemetry. 

## Architectural Mandates
*   **NO LOCAL COMFYUI / RUNPOD:** Do not attempt to route upscaling or texture injection through local ports (e.g., `127.0.0.1:8188`) or Runpod APIs. The pipeline is exclusively reliant on the Grok / Gemini / Seedance API relays.
*   **NO 4K GROK HALLUCINATIONS:** Grok 4.x caps at 2K. Never promise or attempt to force 4K resolution out of the Grok V2I phase. 4K is strictly the domain of Gemini (Nano Banana).
