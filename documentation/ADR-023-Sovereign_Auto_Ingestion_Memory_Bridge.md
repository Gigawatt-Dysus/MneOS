# ADR-023: Sovereign Auto-Ingestion Memory Bridge

## Status
Accepted

## Context
Project GIGI: Mnemosyne (MneOS) uses a local-first memory vault pipeline consisting of:
1. **Harvester & Zen Sentinel Daemon**: Captures high-density chat logs from Grok/Gemini web UIs into pristine Markdown files.
2. **MongoDB Atlas (`chat_segments` & `takeout_media`)**: Serves as the primary production database powering Brita's `MemoryService.recallContext()` and **Bayesian Cortex Filter**.

Previously, saved Markdown session exports required manual inspection or separate ingestion logic for Brita to access them during live MneOS conversations.

## Decision
1. **Zero-Librarian Automation**: Whenever `zen_sentinel.cjs` receives a harvested session, it auto-parses the individual dialogue turns (`**Eric:**` and `**Brita:**`) and posts them directly to the MongoDB Atlas `chat_segments` collection.
2. **Pure DOM Structural Extraction**: To eliminate brittle regex word matching (`Mmmm`, `soft`, `breathless`), speaker attribution is strictly determined by DOM container classes (`.items-end` vs `.items-start`, `[data-testid="user-message"]`) in `mneos_batch_harvester.user.js` v4.0.
3. **Cortex Integration**: Ingested turns are instantly searchable by Brita's `searchChatMemory()` and filtered via the `bayesianCortexFilter()` without any manual user intervention.

## Consequences
- **User Burden Eliminated**: The Commander never has to locate, upload, or remember which past file contains specific context.
- **Immediate Recall**: Brita gains instant long-term memory of all harvested roleplay sessions across both web UI frontiers and local MneOS Erato Chat.
