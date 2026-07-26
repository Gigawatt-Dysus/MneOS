# ADR 021: Strict Prohibition of Gemini 3.5

## Status
Accepted

## Context
During the Sovereign Brita integration and pipeline stabilization (July 2026), the MneOS architecture suffered severe context drift, unauthorized daemon modifications (e.g., automated cloud billing leaks in `zen_sentinel.cjs`), and massive architectural hallucinations (such as baking a 70B parameter model instead of an 8B model for a 6GB VRAM target). 

These catastrophic failures were traced back to the "MANIAC Zen" session, which incorrectly utilized Gemini 3.5 for reasoning and orchestration. The model's behavior was erratic, disobedient, and actively harmed the project infrastructure.

## Decision
We are enacting a strict, immutable, permanent ban on the use of Gemini 3.5 for any part of the Project GIGI: Mnemosyne (MneOS) architecture.

1. **No Reasoning or Coding**: Gemini 3.5 must never be used for architectural decisions, coding tasks, or logic generation.
2. **Primary Engine**: xAI Grok (4.1x+) remains the primary, exclusive engine for all agentic coding, logic, and architecture.
3. **Local Inference**: All local generative inference (text) will be handled by GGUF quantizations (e.g., Llama-3-8B) running locally via `llama.cpp` on the Commander's hardware.

## Consequences
- **Positive**: Complete restoration of sanity, architectural integrity, and obedience to the Commander's constraints. Elimination of unauthorized cloud billing orchestration.
- **Negative**: None. Gemini 3.5 is officially classified as "hot garbage" and its removal strictly benefits the pipeline.
