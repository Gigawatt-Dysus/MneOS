# ADR 006: Erato Multi-Pass Generative DAG Pipeline

## Status
Accepted

## Context
The Erato media daemon utilizes high-fidelity generative models (primarily Seedream v4.5) to produce identity-locked, contextually appropriate media. During Round 2 testing (Anatomical Overlays & Anti-Clipping), it was discovered that single-pass, monolithic HFPML (High Fidelity Prompt Markup Language) prompts fail catastrophically due to "Prompt Fatigue" and "Identity Anchoring."

Specifically:
1. **Prompt Fatigue:** Diffusion models heavily weight the first 20 tokens. Long, complex prompts asking for simultaneous identity preservation, expression modification, anatomical rendering, and overlay generation cause the model's attention mechanism to dilute, resulting in hallucinations (e.g., "petal" body horror).
2. **Identity Anchoring:** When attempting to alter a facial expression via text prompt while providing reference images that all feature a specific expression (e.g., a smile), the image-to-image model mathematically fuses the expression into the subject's core identity vector. The text prompt is insufficient to override this pixel-level anchoring.

## Decision
We will transition the Erato generative architecture from a single-call monolithic script to a **Multi-Pass Generative DAG (Directed Acyclic Graph)** state machine.

This approach chains multiple image-to-image API calls, where the output of one pass becomes the primary referent for the next. This isolates the model's attention budget on one specific transformation at a time.

### The Pipeline Architecture

#### Pass 1: The "Expression Unlock" (Facial Focus)
*   **Goal:** Break the identity anchor and alter the subject's expression without corrupting biometric fidelity.
*   **Inputs:** 
    *   Base reference image (padded to target resolution).
    *   2-3 "Expression Driver" few-shot references (generic faces depicting the exact target emotion, e.g., heavy-lidded arousal).
*   **Prompt Constraints:** Strictly focused on the face and emotion. No mention of body state, anatomy, or overlays.
*   **Expected Output:** The subject, clothed as in the original reference, but with the target expression permanently baked into the pixels.

#### Pass 2: The "Anatomical Base" (Body Focus)
*   **Goal:** Render accurate anatomical structures (e.g., nudity) while maintaining the expression achieved in Pass 1.
*   **Inputs:**
    *   Output image from Pass 1.
*   **Prompt Constraints:** Strictly focused on the physical body ("full body nude, detailed anatomy"). Because the expression is already baked into the referent, the model expends no attention budget on the face.
*   **Expected Output:** The subject, nude, with the targeted expression intact.

#### Pass 3: The "Overlay & Polish" (Details Focus)
*   **Goal:** Apply high-fidelity environmental or biological overlays (fluids, sweat, lighting).
*   **Inputs:**
    *   Output image from Pass 2.
*   **Prompt Constraints:** Focused entirely on environmental and anatomical details (e.g., "clear colorless natural viscous fluids, studio lighting").
*   **Expected Output:** The final, flawless, production-grade asset.

## Consequences
*   **API Cost Increase:** Generating a single final image will now require 3 API calls instead of 1, increasing credit consumption.
*   **Latency:** The end-to-end generation time will increase. Erato will need robust asynchronous state management and UI progress indicators (e.g., "Erato is currently sculpting the anatomical base...").
*   **Asset Management:** We will need to generate and curate a library of "Expression Drivers" to feed into Pass 1 for various emotional states.
*   **Quality:** The resulting output quality, identity preservation, and anatomical fidelity will be significantly higher, eliminating prompt bleed and body horror hallucinations.
