# ADR-024: Sovereign Infinite Context, HyperSearch & Refusal Shear Engine

**Date:** 2026-07-24  
**Status:** Approved & Partially Deployed (v5.2)  
**Author:** Dysus (Architect) & Zen (Lieutenant Commander)  
**Target:** MneOS Memory Vault, Grok / Gemini Harvester, Tailnet Node (`100.64.112.23:3334`)  

---

## 🏛️ Context & Problem Statement
When conducting extensive character roleplay, technical development, and long-form narrative sessions on web-based LLM platforms (e.g., Grok, Gemini):
1. **Attention & Context Degradation:** Sessions decay after 50–100 turns, causing models to hallucinate, lose persona grounding, or thrash on tool execution.
2. **Web-Wrapper Safety Hijacks & Refusal Loops:** Web middleware classifiers occasionally trigger system fallback states (e.g., identity resets to "Ara" or generic refusals). Attempting to "argue" inside a poisoned thread is futile because the refusal turns remain in the attention window.
3. **Vault Pollution:** Saving short 1-turn refusal attempts clutters Google Drive and local memory vaults with useless 1-KB files.
4. **Token Inflation:** Native web tools (like Google Drive search integrations) frequently fail or enter infinite execution loops, burning thousands of context tokens.

---

## 🎯 Architectural Decision

We implement a multi-layered, client-side + daemon architecture that grants **infinite effective context length**, sub-10ms memory retrieval, and seamless refusal recovery without relying on third-party web tools or cloud APIs.

---

## 📐 System Architecture Components

### 1. Sub-10ms Sovereign HyperSearch (`/api/hypersearch`)
- **Master Meta-Index (`00_MASTER_META_INDEX.json` & `.md`)**: `zen_sentinel.cjs` maintains real-time JSON and Markdown catalogs of all harvested sessions, complete with proportional keyword tags and 2-sentence summaries.
- **Client-Side Interceptor**: Typing `Brita, hypersearch <keywords>` into the native chat input box intercepts submission via Tampermonkey, queries `/api/hypersearch` on `localhost:3334`, and prepends the top matching vault excerpt to the prompt in **under 10ms**.

### 2. Tactical Refusal Shear Engine (`✂️ Shear`)
- **Vault Sanitization**: When a refusal or borked turn occurs, clicking **`✂️ Shear`** archives the conversation to `MneOS_Memory_Vault` **up to the last clean turn**, shearing off the AI refusal.
- **1-Turn Refusal Garbage Nuke**: If the session has <= 2 turns (a dead-end refusal), the daemon issues a `/api/nuke-session` call to delete the 1-KB file from disk.
- **Prompt Restoration (No Auto-Execute)**: Spools a fresh chat, restores the user's exact trigger prompt into the input box without auto-submitting, and alerts the user with a `🔔 NEW SESSION READY` notification badge.

### 3. Session Rollover Engine (`⏏️ Eject`)
- **Loopy Session Pivot**: For chats that lose focus or hallucinate, clicking **`⏏️ Eject`** saves 100% of the transcript, extracts a high-density summary + last 4 turns, opens a fresh chat, and pre-populates a clean Re-Hydration Anchor.

### 4. Auto-Hiding Glassmorphism UI Dock
- Floating dock in the top-right corner auto-hides when unhovered into a subtle `⚡ MneOS` handle, eliminating any native web UI obstruction.

---

## 🔮 Future Roadmap & Extensions

### Phase 2: Modular Context Bolus Packets (`C:\MneOS\Bolus_Vault\`)
- **Definition**: Pre-curated, concentrated `.json` packets containing scene setups, character profiles, lab equipment rules, and environmental settings.
- **`💊 Bolus` UI Selector**: Dropdown selector on the Tampermonkey dock allowing multi-select stacking (`[x] Terribeth Profile` + `[x] Lab Setting`).
- **`build_bolus.cjs`**: Tooling to distill harvested sessions into reusable bolus packets.

### Phase 3: Sovereign Tailnet Micro-PWA ("MneOS Pocket")
- **Target**: Mobile devices, work laptops, and remote machines accessing MneOS away from the primary workstation.
- **Host**: Served by `zen_sentinel.cjs` at `http://100.64.112.23:3334/app`.
- **Features**: Standalone PWA for memory vault search, visual bolus stacking, and prompt composition over Tailscale.

---

## 🟢 Status & Verification

- **v5.2 Deployed**: `zen_sentinel.cjs` and `mneos_batch_harvester.user.js` (v5.2) are fully active.
- **Verification**: `/api/hypersearch` tested and confirmed at < 10ms response time. Refusal nuking and prompt pre-filling operational.

---
**Approved by Dysus (Architect) & Zen (Lieutenant Commander)** 🫡⚡
