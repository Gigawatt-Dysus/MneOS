# Sovereign "Enhance+" Architecture

## Overview
The "Enhance+" pipeline is a two-tiered, lazy-loaded photo enhancement architecture for the LifeOS platform. It is designed to replace Google's automated `-edited` generation with a sovereign, local, non-destructive pipeline. To prevent processing bottlenecks on datasets scaling into the tens of thousands of images, the pipeline completely decouples image enhancement from the core ingestion factory, moving the computational load strictly to the presentation layer (Timeline UI).

## Core Directives
1. **Zero Wasted Compute:** Never run an AI/Tensor model on a photo unless explicitly requested by the user.
2. **Non-Destructive Defaults:** The Single Source of Truth (SSOT) is always the raw, untouched original file.
3. **Lazy Execution:** Enhancements are processed "as you pass through the Matrix" (on-demand in the UI), not batch processed during ingestion.

---

## Architectural Tiers

### Tier 1: The "Magic Wand" (The Math Pass)
- **Trigger:** User clicks a ✨ Wand icon on an image card in the React Timeline.
- **Engine:** Node.js (via `sharp` or lightweight OpenCV binding).
- **Process:** Instantaneous mathematical operations: Histogram Equalization, CLAHE (Contrast Limited Adaptive Histogram Equalization), White Balance correction, Gamma shifts.
- **Latency:** ~100-200 milliseconds.
- **Outcome:** 
  - **👍 Thumbs Up:** The UI applies the parameters, saves a JSON config array to MongoDB, and potentially overwrites the SSOT (or renders non-destructively via CSS filters/on-the-fly rendering).
  - **👎 Thumbs Down:** Reverts to original. The UI detects the rejection and triggers the escalation prompt: *"LifeOS AI Enhance?"*

### Tier 2: "Enhance+" (The Heavy Guns)
- **Trigger:** User rejects Tier 1 and authorizes the GPU pass.
- **Engine:** Python FastAPI backend leveraging local Tensor models on the RTX 3050.
- **Models:** 
  - *Zero-DCE* (for extreme low-light recovery).
  - *Real-ESRGAN* (for super-resolution and noise removal).
- **Process:** The UI card locks with a `[Processing...]` spinner. The image is passed to the VRAM. The neural net generates a deeply restored variant.
- **Latency:** ~5-15 seconds.
- **Outcome:** The generated variant is returned. The UI exposes parameter sliders (Opacity, Denoise strength) so the user can manually dial in the final 10% if the AI pushed it slightly too far. Once approved, the new master is saved to the ledger.

---

## Technical Requirements

1. **Python API Bridge:** 
   We need a fast, non-blocking API (FastAPI) to sit alongside `victus_ai_sweeper.py`. It will wait idly for on-demand requests from the React frontend, spin up the models, and return the tensors.
2. **React UI State Management:** 
   The image cards must handle transient states (`Original`, `Tier 1 Preview`, `Tier 2 Loading`, `Tier 2 Tweak Modal`).
3. **Storage Strategy:** 
   To save space, Tier 1 should ideally store mathematical *parameters* (e.g., `brightness: 1.2`) rather than duplicating the JPG. Tier 2, however, fundamentally altering the pixels, will require generating and saving a physical `[OriginalHash]-sovereign-enhanced.webp` variant to the local SSD/B2.

## Next Steps
This plan remains dormant until the primary Google Takeout ingestion queue is 100% clear and validated.
