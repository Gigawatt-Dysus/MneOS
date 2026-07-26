# Sovereign Blueprint: ZIB Dataset Culler (Parameterized Identity)

## Objective
To fully automate the curation, sterilization, and captioning of a Golden Master LoKr dataset from a massive pool of raw renders. The pipeline leverages Grok Vision to enforce **Biometric Decoupling** (for the face) and **Parameterized Tagging** (for the body) while ensuring the dataset is properly sorted for **Aspect Ratio Bucketing (ARB)**.

## Architectural Paradigm

### 1. The Dual-Folder ARB Structure
To prevent "Viewport Locking" (the UNET learning that the trigger word means a giant head filling the frame), the dataset must retain its original spatial context (close-ups vs. full-body shots). The script will automatically sort winning images into two distinct physical directories:
* `F:\ZIB_Dataset_Bake\datasets\ruthie_close_up`
* `F:\ZIB_Dataset_Bake\datasets\ruthie_full_body`

This allows the AI-Toolkit to process vertical and horizontal images optimally at native 1024-megapixel densities without destructive cropping.

### 2. Parameterized Tagging via Grok Vision
The script forces the Grok API to act as a clinical anatomical parser.
* **The Rule:** The caption MUST NOT describe facial features (eye color, hair color, jawline). The base token `Ruthie_v4` will absorb the facial geometry entirely.
* **The Exception:** The caption MUST describe the physical body build (skin tone, breast size, overall build). By explicitly tagging the body, the UNET untangles the face from the body, granting God-mode control at inference time (e.g., prompting `Ruthie_v4, pregnant, tanned skin`).

### 3. The Guillotine Sort
The script will process all images, scoring them from 1 to 10 based on photometric variety, lighting, and lack of AI artifacts. It will mathematically sort the manifest and slice off only the absolute top 25 images, discarding the rest to prevent overtraining the Z-Image-Base (ZIB) model.

## Execution Flow
1. **Ingest:** Iterate through `G:\...[Meta Renders]`.
2. **Encode:** Convert `.webp` / `.jpg` to Base64.
3. **Payload:** Send to Grok Vision API with strict JSON-formatting system prompt.
4. **Parse:** Extract `"score"`, `"classification"`, and `"caption"`.
5. **Sort:** Rank by score descending.
6. **Export:** Copy top 25 to the mapped `F:` drive vault and write the corresponding `.txt` sidecars.

## Required Environment
* `XAI_API_KEY` configured in local environment.
* `F:` drive mapped securely to Genesis Alpha node via Tailscale.
