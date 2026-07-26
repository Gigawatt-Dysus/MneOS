# Feature Backlog: Sliding Window Vision Burst Sequencing

## Overview
A structural optimization algorithm designed to drastically reduce API inference costs and declutter the Sovereign Matrix UI when processing burst photography or contiguous chronological series (e.g., 15 photos of a birthday cake).

## The Problem
Currently, if a sequence of orphaned or un-captioned images sits chronologically adjacent to each other, passing them individually to a Vision Model (Grok/Gemini) incurs massive token costs. The LLM generates near-identical, expensive descriptions for every single frame, which then pollutes the Matrix Grid and RAG vector searches with nearly identical entries.

## The Solution: Sliding Window + PIL Contact Sheet
Instead of treating each image as an isolated event, we establish a relational "Master/Child" burst sequence using a sliding window algorithm.

### Phase 1: Local Proxy Construction
1. Identify a chronological sequence of images (`DSC_001`, `DSC_002`, `DSC_003`).
2. Use Python (`PIL`) locally to stitch the three images horizontally into a single, low-resolution "contact sheet" proxy.

### Phase 2: Single-Token LLM Inference
1. Transmit the single 3-panel contact sheet to the Vision API.
2. Prompt: *"You are analyzing a 3-panel chronological contact sheet. Does the image in Panel 2 (center) belong to the same sequence/event as Panel 1 (left) and Panel 3 (right)? Respond with ONLY CONFIDENT_YES or NO."*

### Phase 3: The Sliding Window
1. If **YES**: `DSC_001` is marked as the `seriesMasterId`. The window slides right to `[DSC_002, DSC_003, DSC_004]`.
2. Process repeats until the Vision API returns **NO**.
3. When a **NO** is triggered, the sequence is severed. The next image becomes a new Master.

### Phase 4: Database & UI Schema
- **Master Image:** Receives the heavy, high-cost semantic description from the Vision API.
- **Child Images:** Do *not* receive unique descriptions. Their DB record receives a `seriesMasterId` pointer to the Master, and a description placeholder: *"Frame X of Y in series. See Master."*
- **Matrix UI:** Collapses the burst into a single "Stack" or "Accordion" component to clean up the timeline.
- **EXIF Healing:** If the child image is missing dates, it inherits the cloned temporal metadata of the Master.

## Conclusion
This architecture reduces API token payload by over 66% for burst events, prevents RAG vector poisoning, and creates a pristine UI experience.
