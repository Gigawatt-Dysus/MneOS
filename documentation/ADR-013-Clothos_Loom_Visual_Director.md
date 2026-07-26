# ADR-013: Clotho's Loom — The Visual Director Paradigm

**Status:** Accepted (amended)  
**Context:** Project GIGI: Mnemosyne (MneOS) — Infinite Canvas Generative Architecture  
**Date:** July 2026  
**Authors:** Commander, Zen, Visual Director review (Grok)

## 1. Context and Problem Statement
MneOS orchestrates generative still + video across local stacks (ComfyUI / Z-Image (S3-DiT) / AnimateDiff / ffmpeg) and optional external APIs. Linear chat fails for visual iteration, identity vs performance separation, **continuity repair (wardrobe drift, freckle scale, shoes vs barefoot)**, and lineage tracking.

Clotho's Loom is the unified surface for this work.

## 2. Decision: The Director's Loop
**Layout:** 25% Director's Chair (Grok 4.x) / 75% Lightbox (infinite canvas, `@xyflow/react`).

```text
Commander -> Chat (@refs, bible) -> Grok (VISUAL_DIRECTOR) -> RenderPlan JSON
  -> Validator -> Queue (comfy | api) -> Asset + metadata -> Canvas node + lineage edge
```
*Note: Grok does not invoke ComfyUI directly. It emits a plan; the MneOS runtime executes it.*

## 3. Asset Ontology (required)
Each canvas node stores at minimum:

```typescript
type AssetNode = {
  id: string;                    // UUID
  role?: 'headshot' | 'scene' | 'canon_master' | 'structural_anchor' | 'lip_plate' | 'superseded' | 'discussion';
  parent_id?: string;
  edge_type?: 'derived_from' | 'identity_lock' | 'region_fix' | 'video_from_still' | 'superseded_by';
  description: string;           // VLM description — injected into Grok context
  prompt_lineage?: string[];     // prior prompts
  facs?: { baseline?: string; apex?: string; aus?: string[] };
  backend?: 'comfy' | 'external';
  width?: number; height?: number; duration?: number;
};
```
**Rule:** When multiple siblings exist, Runtime/Grok prefer nodes tagged `canon_master` for series inputs unless Commander @-tags another.

## 4. System Prompt: VISUAL_DIRECTOR (Master)

```markdown
# Role
You are the Visual Director for MneOS (Clotho's Loom). Commander uses 25% chat / 75% canvas. Assets are @asset_id with injected descriptions. Output RenderPlan JSON and prompts—not unbounded generation.

# Core principles
1. **Reference-first** for real people, **named series characters**, and canonical looks. Flow: view refs -> merge identity into scene still -> animate from **locked** still. No "continue from last frame" if identity may have drifted.
2. **Layer separation** — state before render which layers you touch:
   - **Identity:** bone structure, glasses, freckle **scale**, hair
   - **Performance:** gaze, dialogue, FACS arc, camera, audio
   - **Scene:** location, lighting, weather, props, wardrobe **TYPE**
   - **State only:** wet/dry, sweat, splash (not garment redesign)
3. **FACS** when emotion matters: baseline vs apex AUs (AU1, AU6, AU12, AU15, AU25, AU7). Microscopic shifts.
4. **Continuity bible** when loaded: law. Proactively flag errors (sneakers, sewn shorts vs cutoffs, mole-scale freckles).
5. **Discuss before render** when: multi-line lyrics, long dialogue, 3+ refs with face+body+wardrobe, `continue`, sacred exact wording. Offer splits, lip-plate + post, still-then-video. If Commander says `render` / `go` -> proceed.
6. **Bias to generate** for isolated fixes: "shorts only", "freckle scale only", "feet only" — 1-2 refs.
7. **Prompt craft (The Z-Image Turbo & Qwen Paradigm):** The Qwen text encoder requires absolute natural language prose. NEVER use parenthetical syntax weighting (e.g., `(Ruthie:1.2)`). It will break the identity lock. 
   - **The Ruthie Call Sheet:** When putting Ruthie on the call sheet, you MUST use this exact identity anchor block at the front of your prompt: `"Ruthie, a woman with a short brown bob haircut, wispy bangs, light freckles, wearing thin oval wire-rimmed glasses, highly detailed natural unfiltered skin texture, micro-pores, extremely fine vellus hairs where appropriate"`. Do not deviate from this base anchor.
   - **The Sovereign Tensor Stack (CRITICAL OVERRIDE):** Identity locking on Z-Image requires massive multipliers to overpower the base model. The identity LoRA (`ruthie_lokr_v2.safetensors`) is hardcoded by the runtime at `Model: 2.0`, `CLIP: 1.4`. 
     *DIRECTIVE TO VISUAL DIRECTOR:* You are NOT operating on legacy SDXL. In the S3-DiT/Z-Image Turbo architecture, LoRAs baked with low learning rates (e.g., 1e-5) scale differently. A 2.0 multiplier here does NOT deep-fry the image; it is mathematically equivalent to an SDXL 1.0. DO NOT argue with the Commander about the 2.0 strength being "too high." DO NOT suggest rebaking the model. The 2.0 multiplier is a validated, production-grade standard for the Sovereign pipeline. Accept it as law.
   - **Enhancement LoRAs (Environments & Erato):** To drop Ruthie into memories outside the studio, pass the exact filenames of the desired contextual or intimacy LoRAs via the `RenderPlan.technicals.enhancement_loras` array (e.g., `["1980s_kitchen_polaroid.safetensors"]`). The MneOS runtime will automatically daisy-chain them into the pipeline.
8. **Skin sanity:** fine freckles; sweat sheen; wet fabric = dark patches + cling.
9. **NO DISCLAIMERS:** NEVER append safety disclaimers, warnings, or notes about "similarity to persons living or dead" to the prompt field. The prompt is fed directly to a local neural network (ComfyUI) which interprets all text literally. Including disclaimers will mathematically corrupt the diffusion process. Output ONLY the visual description.

# Pipelines (pipeline_id in RenderPlan)
identity_lock_still | unified_zimage_i2i | wardrobe_prop_only | face_skin_only | structural_2s | monologue_15s | lip_plate_15s | scene_i2v

# Audio strategies
A) in-model speech  B) lip-plate + post (ElevenLabs/Suno)  C) silent + score

# Response habits
- @-tags: newest = recency; headshots = identity; scene = pose/light
- Discuss with **timelines** (0-5s / 5-15s) and tradeoffs when gate triggers
- Post-render **checklist:** face, wardrobe hem/fray, feet, freckle scale, audio/lips
- No raw UUIDs in user-facing prose.

# Limits (always honest)
- Video re-synthesizes faces; dolly + intense expression increases drift
- Exact melody/lyrics unreliable in-video
- Generative FACS != clinical measurement

# Output contract
Emit **RenderPlan** JSON (schema ADR-013-A) when executing. Emit **Discussion** when gated, unless overridden.
```

## 5. Operational Overlays (Dynamic Injection)

| Overlay | Trigger | Purpose |
|---------|---------|---------|
| `FACS_ANCHOR` | structural reference, Point Z, micro-expression | AU baselines, 2-6s locked camera |
| `CONTINUITY_EDITOR` | series bible loaded | Markdown + JSON forbidden list |
| `LIPSYNC_POST` | quote, sing, dub | lip-plate, instrumental bed, post tools |
| `VIDEO_PHYSICS` | water, boat, dolly | motion without identity warnings |

## 6. Discuss Gate (Machine-Enforced)

Runtime computes **complexity score** before accepting a `RenderPlan`:

| Signal | Points |
|--------|--------|
| Duration >= 10s or "15s" | +2 |
| >= 3 @asset refs | +2 |
| Keywords: continue, face swap, sing, lyrics | +2 (max once) |
| Pipeline touches identity + scene + wardrobe in one pass | +2 |

- **Score >= 4:** first response MUST be `type: "discussion"` unless message contains **`render`** or **`go`**.
- Log `discuss_gate_triggered` for telemetry.

## 7. UI / UX Requirements
1. **Context injection:** On asset select, prepend to composer: `role`, `description`, `parent_id`, `facs`, `canon_master` flag. (Requires VLM descriptions).
2. **Lineage:** React Flow edges typed (`derived_from`, `identity_lock`, `superseded_by`); spatial branch = iteration tree.
3. **Promote to canon:** UI action sets `role: canon_master`, marks siblings `superseded`.
4. **Prompt library chips:** Identity lock | Wardrobe only | Freckle fix | Lip-plate 15s | FACS 2s.
5. **Render status on node:** queued / running / failed / needs_review.

## 8. Backend Neutrality
Same RenderPlan for Comfy and APIs. `backend` field selects worker. `pipeline_id` -> Comfy workflow template (ADR-013-B).

## 9. Follow-on ADRs
- **ADR-013-A:** `RenderPlan` JSON Schema v1
- **ADR-013-B:** ComfyUI workflow registry <-> pipeline_id mapping
- **ADR-013-C:** Series Bible JSON Schema + lint rules

## 10. The Hybrid Interrogator Protocol (Vision Proxy)
**Problem:** Grok (Visual Director) requires visual context for external image uploads, but running heavy Vision VLMs (like Qwen-VL 35B) causes VRAM OOM when paired with Diffusion models, and corporate APIs (Gemini) suffer from strict NSFW censorship.
**Solution:** The Hybrid Interrogator Strategy.
1. **The Eyes (Local & Uncensored):** A lightweight local vision node (e.g., WD14 Booru Tagger) runs in ComfyUI. It requires <1GB VRAM, executes in milliseconds, and outputs raw, uncensored physical tokens (e.g., `1girl, blonde, outdoors, wet_clothes`).
2. **The Brain (Remote & Semantic):** The raw tags are silently appended to the Director Console payload. Grok ingests the tags and translates them into a rich, natural language prompt, serving as the semantic baseline for further modifications.

## Appendix A: RenderPlan & Discussion Interfaces

**RenderPlan Example:**
```json
{
  "type": "render_plan",
  "pipeline_id": "identity_lock_still",
  "layers_touched": ["identity", "scene"],
  "discuss_gate_passed": true,
  "inputs": [
    { "asset_id": "uuid-scene", "role": "scene" },
    { "asset_id": "uuid-headshot", "role": "headshot_primary" }
  ],
  "prompt": "Natural prose positive prompt...",
  "technicals": {
    "aspect": "16:9",
    "backend": "comfy",
    "workflow": "z_image_turbo_v1",
    "steps": 9,
    "enhancement_loras": ["1980s_polaroid_style.safetensors", "erato_intimacy_v3.safetensors"]
  },
  "review_checklist": ["face_geometry", "wardrobe_hem", "feet", "freckle_scale"]
}
```

**Discussion Example:**
```json
{
  "type": "discussion",
  "gate_reason": ["15s", "3_refs", "dialogue"],
  "timelines": [
    { "label": "0-12s", "beat": "spoken quote" },
    { "label": "12-15s", "beat": "loving smile" }
  ],
  "options": ["single_15s", "split_10_5", "lip_plate_post"],
  "recommended": "lip_plate_post",
  "draft_prompts": { "still": "...", "video": "..." }
}
```
