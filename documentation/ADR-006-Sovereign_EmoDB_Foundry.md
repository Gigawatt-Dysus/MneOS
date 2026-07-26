# ADR-006: Sovereign EmoDB Foundry & Platinum Reflux Pipeline

## 1. Executive Summary
The goal is to fully automate the population of the MneOS `emotionalDB` tensor map without manual data entry or cropping. We require pristine, photorealistic, clinically safe facial keyframes (Tensors) to serve as Image-to-Image / Image-to-Video structural anchors for uncensored local/RunPod generation (e.g., Seedance).

By utilizing God-tier photorealistic models (Grok Vision/Imagine Agent) for the safe, SFW facial expressions, we decouple the structural training from the NSFW rendering, completely bypassing censorship constraints while achieving APA-level extreme granularity in micro-expressions.

## 2. The Multistage Distillation Concept
We treat emotionography as a multistage distillation column. We boil away contextual noise, static frames, and artifacts to isolate the absolute, unalloyed essence of a micro-expression.

1. **Stage 1 (Kinetic Distillation):** FFmpeg Scene Delta sieves out static frames, extracting only the volatile "tweens" (transitional micro-movements).
2. **Stage 2 (Facial Distillation):** The Auto-Guillotine crops perfectly centered 512x512 facial bounding boxes, discarding background noise.
3. **Stage 3 (FACS Distillation):** The Grok Vision "Sorting Hat" categorizes the cropped faces against the 200+ vectors in `emotionalDB.json`.
4. **Stage 4 (The Tensor Lock):** The purified asset is permanently accessioned to the identity's `tensorMap`.

---

## 3. Pipeline A: The Synthetic Miner (Platinum Reflux Loop)
This pipeline generates new EmoDB assets from scratch using synthetic generation.

*   **Step 1: The Base Distillation (Gold):** A prompt is sent to Grok/Gemini (e.g., "Ruthie transitioning from a subtle smirk to a radiant laugh"). 
*   **Step 2: The Alchemy (Platinum Reflux):** The best resulting image (the "Gold" frame) is fed *back* into the Grok Imagine Agent as an Image-to-Image/Video referent. The prompt is pushed for extreme granular detail (e.g., "Use this structural baseline. Add a 0.2-second eyelid tremor and sub-surface moisture"). 
*   **Step 3: The Sieve:** The resulting output is passed to Pipeline B for extraction and sorting.

---

## 4. Pipeline B: The Autonomous Sorter (The Extractor Daemon)
This is the `forge_emo_db.cjs` backend daemon. It takes *any* video or image sequence (from Pipeline A, Infinite Canvas, or real-world footage) and autonomous slots the frames into the database.

*   **Step 1: FFmpeg Scene Delta:** The video hits the `/api/extract` script. Using FFmpeg I-Frame delta analysis (pixel-level motion thresholds), it ignores static frames and only writes the 5-8 transitional "tween" frames to disk.
*   **Step 2: The Auto-Guillotine:** A lightweight Python/Node daemon (OpenCV/MediaPipe) scans the extracted frames, locates the facial landmarks, calculates a bounding box (+20% padding), and automatically crops a perfect 512x512 tensor. No manual image editing allowed.
*   **Step 3: The Grok Sorting Hat:** The 512x512 crops are sent to the Grok Vision API along with a minified version of `emotionalDB.json` (Minor Valence keys + FACS triggers). Grok Vision scores the frames and determines their exact structural match (e.g., "Awestruckly Reverent").
*   **Step 4: Accession:** The daemon automatically uploads the 512x512 tensors to the B2 silo and performs an atomic `$findOneAndUpdate` on the target `PersonTag` to inject the asset URLs directly into the correct `tensorMap` slots.

## 5. Required Daemon Components to Build Next
1.  **`auto_crop_faces.cjs`**: The MediaPipe/OpenCV script for the Auto-Guillotine step.
2.  **`forge_emo_db.cjs`**: The master orchestrator that chains FFmpeg Delta -> Auto-Crop -> Grok Vision API -> MongoDB Accession.

*Status: Architecture Locked. Ready for Code Implementation.*
