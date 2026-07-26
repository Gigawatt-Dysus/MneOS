# ADR-007: The Platinum Reflux Pipeline (I2V2I)
**Date:** July 5, 2026
**Subject:** Sovereign EmoDB Tensor Alchemy & Pipeline Standardization
**Architect:** Dysus (Commander) / Zen

## 1. Objective
To automate the generation of 8K photorealistic, identity-locked, and FACS-compliant (Facial Action Coding System) micro-expression tensors for the Sovereign EmoDB. These tensors serve as the absolute biometric source-of-truth for the Erato/Brita companion rendering engine.

## 2. The Problem
*   **The Resolution/Physics Paradox:** High-end image models (Grok, Flux) generate perfect 4K/8K skin textures but cannot natively calculate the temporal physics of a micro-muscular transition (e.g., the exact midpoint of a Duchenne smile).
*   **The Video Hallucination Collapse:** High-end video models (Seedance, Wan, Kling) can calculate the biological physics of a transition, but they suffer from high temporal compression, loss of high-frequency texture (pores, vellus hairs), and anatomical drift.
*   **The "Douyin" Bias:** When context-starved, Asian-trained models default to a latent bias of smoothed skin, anime proportions, and plastic CGI aesthetics.
*   **Lighting Contamination:** Generating expressions in environmental settings (e.g., Golden Hour Canoe) permanently bakes directional lighting and color spill into the tensor, rendering it useless for dynamic relighting in future UI environments.

## 3. The Solution: Platinum Reflux (I2V2I)
The Platinum Reflux is a recursive Image-to-Video-to-Image pipeline that synchronizes three frontier AI models. It uses image models for absolute structural and textural fidelity, and video models strictly as biological physics calculators.

### Phase 1: Clinical FACS Capture (The Bookends)
**Engine:** Grok Vision (or equivalent flagship LLM vision model)
**Process:** Generate the two extreme endpoints of the emotional delta (e.g., AU0 Baseline Neutral and Point Z Radiant Joy).
**Strict Locks (The "Clean Room"):**
*   **Environment:** 18% neutral gray seamless studio backdrop.
*   **Lighting:** Flat, diffuse studio lighting (dual softboxes) to prevent directional shadows.
*   **Framing:** 1:1 Square aspect ratio. Extreme close-up (chin to hairline). No shoulders, no background noise.
*   *Rationale:* This strips away all environmental variables, forcing 100% of the AI's parameter budget into facial topology.

### Phase 2: Physics & Biology Interpolation (The Deep-Delta)
**Engine:** Seedance v1.5 Pro (or equivalent video model) via API
**Process:** Pass the AU0 and Point Z images as `image` (Start) and `last_image` (End) structural anchors.
**Payload Specs:**
*   `duration: 6` (To slow down the transition and allow for granular frame extraction).
*   `camera_fixed: true` (To prevent pan/zoom hallucinations).
*   `aspect_ratio: "1:1"`
*   *Prompt Override:* Explicitly command the model to resist its smoothing bias (`RAW documentary photography, zero beauty filters, high-detail skin moisture`).
*   *Rationale:* Seedance mathematically calculates the exact muscular trajectory (cheek raise, eye narrowing) between the two anchors over 144 frames.

### Phase 3: The FFmpeg Sieve
**Engine:** FFmpeg (`forge_emo_db.cjs` sub-process)
**Process:** Extract keyframes from the Seedance MP4.
*   `ffmpeg -i input.mp4 -vf fps=4 output_%04d.jpg`
*   *Rationale:* Slices the 6-second physics calculation into 24 incremental, perfectly aligned micro-expression states (e.g., 25% smile, 50% smile, 75% smile).

### Phase 4: The Platinum Reflux (4K Texture Restoration)
**Engine:** Nano Banana / Flux Pro / Grok (Image-to-Image structural pass)
**Process:** Take a mid-transition frame (e.g., Frame 14) and feed it *back* into a high-end image generator as an identity lock.
**Prompt Architecture:**
*   *Lock:* "Do not alter expression geometry, framing, or 18% gray background."
*   *Texture Injection:* "Make this image as photorealistic as possible - micropores, vellus hairs (peachfuzz) appropriate to a woman age 26 - studio quality 8K resolution. Unretouched, RAW."
*   *Rationale:* The image model bakes the 8K photorealism (pores, peachfuzz, sub-surface scattering) directly over the flawless physical geometry calculated by Seedance in Phase 2.

## 4. Conclusion
The result is a **Platinum Tensor**: an anatomically perfect, mathematically precise, 8K micro-expression state devoid of lighting contamination. These tensors are accessioned directly into the `emotionalDB.json` registry to power the Sovereign UI.
