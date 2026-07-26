# ADR-009: Local ComfyUI Arsenal & Tooling
Date: 2026-06-30
Context: MneOS Sovereign Generative Pipeline

## Context & Decision
Following the successful extraction of the generative AI pipeline from ephemeral cloud providers (RunPod Serverless) to local hardware (Victus RTX 3050), a deterministic, node-based Directed Acyclic Graph (DAG) architecture was established using ComfyUI.

This document serves as the canonical record for the primary generative nodes required to maintain God-Mode over the Erato/Muse asset creation pipeline. These modules enable precise, anatomical, and stylistic control over the final rendered assets.

## The Arsenal

### 1. Impact Pack (FaceDetailer)
* **Function:** Automated facial restorative generation.
* **Mechanism:** Utilizes a YOLO (You Only Look Once) object detection model to scan the generated image, isolate the facial bounding box, crop it, run a localized, high-resolution Stable Diffusion (img2img) pass specifically on the face, and seamlessly composite it back into the frame.
* **Use Case:** Fixing "nightmare fuel" hallucinations (e.g., extra teeth, fused tongues, distorted eyes) without requiring manual masking or external Photoshop labor.

### 2. ControlNet (OpenPose / Canny / Depth)
* **Function:** Geometric and structural anchoring.
* **Mechanism:** Extracts a structural map from a reference image (e.g., a skeletal "stick figure" via OpenPose, edge outlines via Canny, or a Z-depth map) and forces the latent diffusion process to strictly adhere to that geometry.
* **Use Case:** When a framegrab possesses the perfect physical pose or action, but the environment, lighting, or character model is incorrect. ControlNet locks the pose, allowing the prompt to freely alter the rest of the scene.

### 3. IPAdapter (Image Prompt Adapter)
* **Function:** Stylistic and lighting transfer.
* **Mechanism:** Bypasses text-based prompting by injecting the cross-attention layers of the model with the visual features of a reference image. 
* **Use Case:** Imprinting the exact cinematic lighting, color grading, or specific artistic style of a reference image onto the generation without strictly cloning the subject's identity (which is handled separately by ReActor).

### 4. 4x-UltraSharp (Upscaler)
* **Function:** Photorealistic upscaling and texture retention.
* **Mechanism:** An ESRGAN-based upscaler trained specifically for photographic fidelity.
* **Use Case:** Upscaling 720p or 1080p framegrabs while retaining high-frequency details such as skin pores, freckles, and specular reflections (e.g., on glasses or fluids). Integrated directly into the `erato_forge.cjs` automated pipeline.

### 5. AnimateDiff
* **Function:** Native Video Generation.
* **Mechanism:** Injects temporal attention layers into standard Stable Diffusion checkpoints, allowing the generation of consistent, short-form (2-4 second) video loops.
* **Use Case:** Converting static, identity-swapped framegrabs into animated loops directly within the sovereign ComfyUI node graph.

## Implementation Notes
All modules can be installed via the **ComfyUI Manager** custom node. The `.pth` or `.safetensors` model weights must be deposited into their respective directory targets (`/models/controlnet`, `/models/upscale_models`, etc.) to be exposed to the loader nodes.
