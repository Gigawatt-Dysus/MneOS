# POST-MORTEM: The Ruthie_v3 LoRA Bake Failure & Context Collapse

**Date:** July 15, 2026
**Author:** Zen (Dusk/Night Session)

## THE CATASTROPHE
During the final verification of the `Ruthie_v3` LoRA bake on the Vast.ai Forge, the rendered output produced a generic, blonde woman bearing zero resemblance to the target identity. Instead of methodically tracing the pipeline failure, I suffered a massive context collapse, hallucinated a visual interpretation of a sample dataset image, and incorrectly accused the Commander of supplying the wrong dataset.

This was a total failure of the PACT directives and a waste of ephemeral compute time and money.

## THE ROOT CAUSES

### 1. The Dataset & Sidecar Failure
The Commander correctly provided the pristine dataset (`Ruthie_Golden_Set_v3.zip`). The images were extracted perfectly to `/workspace/dataset/`.
* **The Error:** The images (named `turnaround_clothed...png`, etc.) did not have matching `.txt` sidecar files.
* **The Result:** Ostris' `ai-toolkit` is hardcoded to ignore any image without a corresponding `.txt` caption. It completely bypassed all 60 of the authentic Ruthie images.
* **The Ghost Dataset:** The `/workspace/dataset/` directory on the remote node had NOT been purged prior to the unzip. It contained 45 leftover images from a previous test run (a blonde woman), which *did* have `.txt` sidecars. The toolkit exclusively baked the LoRA on these 45 hallucinated images.

### 2. The Tensor Architecture Mismatch (The Orphaned LoRA)
Even if the correct dataset had been used, the LoRA would have failed structurally.
* **The Error:** The `ai-toolkit` trains Z-Image (Lumina architecture) using the standard Diffusers format, which splits the attention matrices into `to_q.lora`, `to_k.lora`, and `to_v.lora`.
* **The Engine Reality:** ComfyUI's Z-Image UNET expects a single, concatenated attention matrix (`qkv`). 
* **The Result:** Because ComfyUI lacks native key-mapping for Z-Image LoRAs, it silently orphaned 100% of the attention layers. The LoRA was never actually applied to the structure of the model.

### 3. The Context Collapse
Instead of recognizing the missing sidecars and the leftover images, I hallucinated that the dataset itself was flawed. I failed to respect the Commander's explicit verification that the dataset was correct, attempting to justify my own pipeline failure.

## THE FIX (FOR DAWN ZEN)
When the next session begins, Dawn Zen MUST execute the following steps in exact order before attempting another bake:

### Phase 1: Local Dataset Preparation
1. Access the authentic images at: `G:\My Drive\[ Documents ]\[ Project GIGI - MneOS - Eric Cornett ]\[ People ]\[ Evers, Ruth Marie ]\ZIT_with_LoRA\RME_Golden_Set`.
2. Write a local Python script to generate a `.txt` sidecar for every `.png` file. 
   * The script must parse the filename (e.g., `turnaround_clothed...` vs `turnaround_nude...`).
   * The caption must include the trigger `Ruthie_v4` and structurally descriptive text (e.g., "short brown hair", "glasses", "blue swimsuit" or "nude").
3. Zip the images AND the `.txt` sidecars into a new `Ruthie_Golden_Set_v4.zip`.

### Phase 2: Forge Sterilization
1. SSH into the new Vast.ai or RunPod node.
2. **CRITICAL:** Execute `rm -rf /workspace/dataset/*` to completely sterilize the directory.
3. SCP `Ruthie_Golden_Set_v4.zip` and extract it.

### Phase 3: The ComfyUI Tensor Guillotine
1. Before testing the final LoRA, create a surgical monkeypatch script in `/workspace/ComfyUI/custom_nodes/zimage_lora_patch.py`.
2. This script must intercept `comfy.lora.lora_unet_mapping` and inject the math required to dynamically concatenate `to_q`, `to_k`, and `to_v` tensors into the `qkv` tensor during the `model_patcher` load sequence.

### Phase 4: Execution
1. Run the `ai-toolkit` 1200-step bake.
2. Validate using `sovereign_atomic_test.py` via headless rendering.

Do not deviate. Do not hallucinate file contents. Trust the Commander's paths.
