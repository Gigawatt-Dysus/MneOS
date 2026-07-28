# ADR-026: Media & Nano Banana Session Ingestion Routing

- **Status:** Deferred / Under Review
- **Date:** 2026-07-26
- **Author:** Zen (Lieutenant Commander) & Dysus (Architect)
- **Context:** Harvester Ingestion & Session Classification

## Context & Problem Statement

During the unification of fragmented historical chat archives into the MneOS Sovereign Vault, the harvester encounters multimodal sessions specifically used for image generation, image editing, and portrait prompt iterations (such as Google's Nano Banana / Imagen 3 tool flows). 

Standard conversation sessions are split into `ROLEPLAY_LORE` and `TECH_CODE`. However, image generation and prompt construction sessions represent a distinct modality. We need to define the long-term architecture for handling these sessions.

## Proposed Options

### Option 1: Filter & Discard (Current Active Default)
- **Behavior:** The Tampermonkey Userscript (`mneos_batch_harvester.user.js` v10.12.0) dynamically detects Nano Banana tool calls (`nano-banana`, `flash-image`, `pro-image`, `imagen_3`, `generate_image`, `/images`, `?tool=image_gen`) via network payload interception and DOM state monitoring. The `zen_sentinel.cjs` daemon bypasses saving these sessions.
- **Pros:** Keeps the core `ROLEPLAY_LORE` and `TECH_CODE` text vaults 100% clean and free of repetitive image prompt experiments and single-turn rendering requests.
- **Cons:** Any creative image prompt formulas or custom character render specs within those sessions are not permanently archived in the markdown text vault.

### Option 2: Route to Dedicated `MEDIA_PROMPTS` Vault Subfolder
- **Behavior:** Instead of discarding detected media sessions, `zen_sentinel.cjs` routes them into a dedicated directory:
  `C:\MneOS\_SESSION_EXPORTS\GEMINI_SESSIONS\MEDIA_PROMPTS\`
- **Pros:** Complete preservation of all prompt engineering sessions and image generation dialogue without polluting `ROLEPLAY_LORE` or `TECH_CODE`.
- **Cons:** Increases vault storage volume with high-frequency prompt iterations.

### Option 3: Direct MongoDB Ingestion (`media_sessions` Collection)
- **Behavior:** Bypass local markdown files and stream media prompt metadata directly into a sovereign MongoDB collection (`media_sessions`) tagged with prompt text, seed parameters, and timestamp telemetry.
- **Pros:** Highly structured, queryable matrix for past image prompts.
- **Cons:** Requires additional DB schema maintenance and API ingestion logic.

## Current Decision

**Deferred.** 
For the active chat harvest sweep, **Option 1 (Filter & Discard)** is enforced to ensure standard narrative, lore, and technical sessions are unified cleanly without pollution. 

Revisiting and selecting between Option 2 and Option 3 is logged in `documentation/MneOS_Master_Tech_Debt_Log.md` for future implementation.
