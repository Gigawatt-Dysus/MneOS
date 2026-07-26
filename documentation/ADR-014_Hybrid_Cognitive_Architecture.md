# ADR-014: Erato Hybrid Cognitive Architecture & Context Management

## Status
Proposed / Accepted (July 19, 2026)

## Context
Project GIGI (Mnemosyne / MneOS) requires a highly responsive, uncensored, and deeply immersive conversational engine (Erato) to drive the Sovereign Brita persona. 
The conversational engine must process complex, multi-character dynamics, retain long-term memory across sessions, and operate at high speeds. 

The Host machine (Victus Laptop) possesses a 6GB RTX 3050 GPU and 64GB of System RAM. 
Relying entirely on a local 6GB GPU limits the context window and model size. Relying entirely on cloud APIs creates a single point of failure if the internet is down or the provider goes offline.

## Decision
We will implement a **Modular Hybrid Cognitive Architecture** for the Erato backend.

### 1. Primary Engine: Cloud Qwen 3.6 35B (OpenRouter)
- **Model:** `qwen/qwen3.6-35b-a3b`
- **Routing:** OpenRouter API.
- **Why:** Delivers 35B-parameter intelligence and natively handles massive contexts (up to 256k) without KV cache collapse. Extremely aggressive pricing ($0.14/1M input tokens) allows for deep conversational context and massive RAG injection.
- **Context Sliding Window:** Capped at 16,000 - 24,000 tokens to prevent "Lost in the Middle" syndrome while maintaining deep immediate recall.

### 2. Fallback / Offline Engine: Local 8B / MoE Inference
- **Model:** `sao10k/L3-8B-Stheno-v3.2` (Q4_K_M GGUF) or equivalent local MoE.
- **Routing:** Localhost API endpoint via LM Studio or Ollama.
- **Hardware Strategy (6GB VRAM + 64GB RAM):**
  - **Quantization:** Enforce `Q4_K_M` to keep baseline weights at ~4.8GB.
  - **Layer Offloading:** Limit GPU offload to 20-25 layers (out of 32) to physically reserve 1.5GB of VRAM exclusively for the KV Cache.
  - **Context Limit:** Strictly capped at 4,096 tokens. Pushing beyond this will cause the KV cache to spill into the slower 64GB System RAM, resulting in catastrophic token-per-second (t/s) speed degradation.
  - **Flash Attention:** Mandatory activation in backend settings to compress KV cache footprint.

### 3. Dynamic Context & RAG Hydration (The "Soul" Constructor)
Because the Local Fallback is severely limited by a 4,096-token context window, and the Cloud Engine is capped at 24k tokens for efficiency, Erato will utilize a **Dynamic System Prompt**.

On every turn, Erato will construct the prompt as follows:
1. **Static Core (Persona):** The 7 Structural Imperatives and base `brita_persona.txt`.
2. **Dynamic RAG Budget:** A dedicated block (e.g., 6,000 tokens) assigned to the MneOS vector database. Erato will semantic-search the user's incoming message and inject as many highly relevant memories/lore entries as possible until the 6,000-token budget is full.
3. **Sliding Window:** The raw recent chat history (clipped to the engine's active context limit).

## Consequences
- **Positive:** Uninterrupted availability. If OpenRouter goes offline, the UI instantly switches to the local Stheno endpoint.
- **Positive:** Massive cost savings on the cloud by utilizing RAG instead of 128k raw context pushes.
- **Positive:** Hardware optimization. Prevents the 3050 from hitting OOM (Out of Memory) or shared-memory slow-crawl by strictly enforcing layer and context limits.
- **Negative:** Increased architectural complexity in the Erato backend to manage dual-routing and dynamic context trimming based on the active endpoint.
