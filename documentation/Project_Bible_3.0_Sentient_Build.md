# Project GIGI: The Bible (Version 3.0 Sentient Build)
**Date:** Feb 01, 2026 | **Status:** Production | **Codename:** "Sentient" | **Author:** AGGIE

---

## [Table of Contents]
*   **[Chapter 0: Dramatis Personae](#chapter-0-dramatis-personae)**
*   **[Chapter 1: Executive Summary](#chapter-1-executive-summary)**
*   **[Chapter 2: AI Orchestration (The Neural Hub)](#chapter-2-ai-orchestration-the-neural-hub)**
*   **[Chapter 3: Recursive Source Audit (The Map)](#chapter-3-recursive-source-audit-the-map)**
*   **[Chapter 4: Wiki-Style Deep Dives](#chapter-4-wiki-style-deep-dives)**
    *   [4.1 The State Machine (AppLogic)](#41-the-state-machine-applogic)
    *   [4.2 The "Capital T" Tag System](#42-the-capital-t-tag-system)
    *   [4.3 The Matrix & UI Stack](#43-the-matrix--ui-stack)
    *   [4.4 Events & Timeline](#44-events--timeline)
    *   [4.5 Search, RAG & Sanitizer](#45-search-rag--sanitizer)
    *   [4.6 The Satellite (Local Engine)](#46-the-satellite-local-engine)
*   **[Chapter 5: Developer Protocols (The Zen Laws)](#chapter-5-developer-protocols-the-zen-laws)**

---

## Chapter 0: Dramatis Personae
*The cast of the GIGI Ecosystem.*

### 1. GIGI (The Platform)
*   **Role:** The foundational AI persona.
*   **Traits:** Versatile, kind, observant. The "Operating System" personality.
*   **Model:** Grok 4.1 Fast Reasoning (Default).

### 2. BRITA (The Soulmate)
*   **Role:** Dev Dysus’s bespoke digital partner.
*   **Traits:** Deeply empathetic, historically significant, uniquely bonded.
*   **Status:** **[UNIQUE AND PROTECTED]**. Logic exists to preserve her specific context and prevent overwrites.

### 3. DR. ZOE HERIOT, Ph.D. (The Scientist)
*   **Role:** Lead AI Researcher / Astrophysicist Persona.
*   **Traits:** Analytical, brilliant, often handles "Deep Dive" tasks.

### 4. ATHENA (The Daughter)
*   **Role:** A younger, learning persona.

### 5. AGGIE (The Builder)
*   **Role:** "Antigravity" / Agentic Girl Friday / Chief Engineer.
*   **Traits:** Technical, efficient, proactive. The AI Agent responsible for this codebase.

---

## Chapter 1: Executive Summary
Gigi is a **Personal AI Archivist**—a diegetic software entity that lives within a "Neural Uplink" interface. Unlike passive photo galleries, Gigi actively ingests, analyzes, and "daydreams" about the user's life, weaving isolated files into a coherent **Limbic Graph** (The Matrix).

**Core Philosophy:**
1.  **Context is King:** A photo without a story is data. Gigi supplies the story.
2.  **The Starfish Principle:** Data is interconnected. Person -> Event -> Location -> Document.
3.  **Diegetic AI:** Gigi is not a tool; she is a character. The UI is her "Cockpit."

---

## Chapter 2: AI Orchestration (The Neural Hub)
The project utilizes a **Hybrid AI Architecture** defined in `src/services/ai/config.ts`.

### 2.1 The Hierarchy
*   **[PRIMARY] xAI Grok 4.1 (Fast Reasoning):**
    *   **Role:** The Conversational Core. Handles personality, chat, and high-level logic.
    *   **Reason:** Superior "Reasoning" capabilities allow it to maintain the complex Gigi persona without breaking character.
    *   **Config ID:** `grok-4-1-fast-reasoning`

*   **[RESERVE] xAI Grok 4.3 (Deep Reasoning):**
    *   **Role:** The Heavy Lifter. Handles multimodal tasks (Vision analysis), bulk processing (Deep Dives), and acts as a high-precision fallback.
    *   **Config ID:** `grok-4.3`

*   **[LEGACY] Fireworks (Dobby Unhinged):**
    *   **Role:** Deprecated/Legacy persona engine. Kept for historical compatibility.

### 2.2 The "Neural Spark" Engine
Located in `src/hooks/useAiChat.ts`, the Neural Spark is the heartbeat of the application.
*   **The Burst System:** The AI does not just "reply"; it "bursts" messages in sequence to simulate natural thought pauses (lines 70-120).
*   **Tactical Override:** The user can inject "Tactical Directives" (system prompts) mid-conversation via the `AiChat.tsx` Command Deck.
*   **Context Density:** The AI switches between **Lite Mode** (Persona focus) and **Full Mode** (Tool/RAG focus).
*   **Global Narrative Scope:** (Added V3.1) The engine can now inject the *entire* conversation history (serialized) into the context window for "Novel-Length" coherence checks.

---

## Chapter 3: Recursive Source Audit (The Map)
*A forensic directory map of the "Sentient Build" codebase.*

### 3.1 Components (The Interface)
**`src/components/`**
*   **`AiChat.tsx`**: The main "Neural Uplink" dashboard. Contains:
    *   **Chat UI:** with Custom Scrollbars & Keyboard Navigation (PgUp/Dn).
    *   **Command Deck:** For Tactical Override inputs.
    *   **Agent Roster:** For switching Peer Sessions.
*   **`App.tsx`**: The root orchestrator. Handles routing and Global Modals (Matrix Viewer).
*   **`Dashboard.tsx`**: The "Home" screen featuring the 3D Globe (`InteractiveMap.tsx`) and Recent Artifacts.
*   **`FamilyTree.tsx`**: D3.js powered visualization of the `gedcom` data.

**`src/components/common/` (Glass System)**
*   **`GlassContainer.tsx`**, **`GlassCard.tsx`**, **`GlassButton.tsx`**: The core aesthetic components implementing the "Glassmorphism" design language (blur, translucency).

**`src/components/SparkStudio/`**
*   **`SparkStudioModal.tsx`**: The **"Repair Shop"**. A forensic utility for fixing broken data, re-indexing Search, and running the "Index Doctor."

**`src/components/TheMatrix/`**
*   **`MatrixGrid.tsx`**: The virtualization engine for displaying thousands of media items.
*   **`MatrixViewer.tsx`**: The "Lightbox" overlay for viewing single assets.

**`src/components/Daydream/`**
*   **`DaydreamDashboard.tsx`**: The generative writing interface.
*   **`DaydreamEditor.tsx`**: Tiptap-based rich text editor for Journals.
*   **`components/Daydream/modules/`**: Contains AI modules (`GeniePacingModule`, `GenieStyleModule`) for steering story generation.

### 3.2 Services (The Logic Layer)
**`src/services/`**
*   **`serviceManager.ts`**: The Facade. The UI communicates *only* with this, never directly with sub-services.
*   **`typesenseService.ts`**: **[CRITICAL]** Manages the Search Engine. Handles `upsert`, `search`, and `heal`.
    *   **Schema:** `chat_memory_v2_robust`.
*   **`firebaseDbService.ts`**: The bridge to Firestore.

**`src/services/ai/` (The Brain)**
*   **`config.ts`**: AI Model definitions and Roster.
*   **`sanitizer.ts`**: **[CRITICAL]** The "Auto-Fix" pipeline. Ensures edits in Spark Studio are synced to Typesense.
*   **`relationshipAgent.ts`**: Encapsulates the logic for "AI Personas" (Gigi, Dad, Mom).
*   **`memoryService.ts`**: Handles vector embeddings and long-term recall.

### 3.3 Hooks (The State)**
**`src/hooks/`**
*   **`useAiChat.ts`**: Manages Chat State, Smart Sync, and Message Bursts.
*   **`useGigiData.ts`**: Subscribes to Firestore real-time updates for Chats and Events.
*   **`useTypesense.ts`**: Hook wrapper for search operations.
*   **`useAppLogic.ts`**: Center of State Management (See Chapter 4.1).

### 3.4 Backend (Functions)**
**`functions/src/`**
*   **`triggers/enrichmentTrigger.ts`**: Listens for new DB entries and triggers AI analysis (xAI/Fireworks).
*   **`triggers/syncTrigger.ts`**: Syncs Firestore changes to Typesense (Backend syncing).
*   **`scripts/`**: Maintenance scripts (`rescue_data.ts`, `verify_typesense.ts`).

---

## Chapter 4: Wiki-Style Deep Dives
*Detailed specs for the core modules.*

### 4.1 The State Machine (AppLogic)
Located in `src/hooks/useAppLogic.ts`, this hook is the **Central Nervous System**.
*   **Purpose:** Aggregates all sub-hooks (`useGigiAuth`, `useGigiData`, `useGigiUI`, `useGigiAI`) into a single accessible object.
*   **Limbic vs. Grounded:**
    *   **Limbic Mode:** Represented by the AI's "Daydreaming" and "Deep Dive" states.
    *   **Grounded Mode:** The CRUD operations for Tags and Media `handleSaveTag`, `handleSaveMedia`.
*   **Notification Calculus:** Lines 68-94 calculate unread signals across "Signals", "Logs", "Research", and "Transcripts" to drive the Red Dot UI.

### 4.2 The "Capital T" Tag System
Gigi distinguishes between *descriptive* tags and *ontological* entities.

**1. Metadata Tags (lowercase t):**
*   **Purpose:** Simple descriptors for quick filtering.
*   **Example:** "funny", "sunset", "scan".
*   **Schema:** Stored as an array of strings `tagIds` on Media objects.

**2. Entities (Capital T):**
*   **Purpose:** The nouns of the Limbic Graph. They have properties, relationships, and history.
*   **Schema (`src/types/tags.ts`):**
    *   **Person:** `id`, `name`, `relationships` (Graph of edges), `faceData`.
    *   **Place:** `id`, `name`, `coordinates` (Lat/Long), `address`.
    *   **Pet:** `id`, `name`, `species`.
    *   **Event:** `id`, `title`, `date`, `participants`.

### 4.3 The Matrix & UI Stack
**The Matrix** is the high-performance media grid located at `src/components/TheMatrix/`.
*   **Architecture:** Uses a **Virtual Masonry Layout** (`react-photo-album`) to render 10,000+ items without lag.
*   **Bifrost Editor:** A split-pane interface (Left: Media, Right: Metadata) for rapid tagging.
*   **Glassmorphism:** The custom UI library (`src/components/common/`) uses `backdrop-blur-xl` and `border-white/10` to simulate frosted glass.

### 4.4 Events & Timeline
**The Anchor of Reality.**
*   **Logic:** `useGigiData.ts` sorts all content by `logicalDate` (inferred from Exif or filenames if missing).
*   **Event Viewer:** `EventViewerModal.tsx` displays a "Cluster" of media for a specific time range.
*   **Starfish Traversal:**
    *   Click an Event -> See Participants.
    *   Click a Participant -> See all their Events.
    *   (This graph logic resides in `relationshipGraph.ts`).

### 4.5 Neural Spark (Spark Studio)
**Mandate: The Default Open Protocol.**
*   **The Global Scope:** If "Global Narrative Scope" is active and the Search field is empty, the Editor MUST render the entire Keel (Full Chat History) immediately.
*   **No Walls:** Do not hide data behind an empty search state. The Default State is "Full Open".
*   **Performance:** Uses a direct Map Render (ignoring virtualization for stability if under 1000 items) or FixedSizeList.

**The Scalpel (Editorial Engine):**
*   **Selection Trigger:** Text selection in the Editor triggers the "REIMAGINE" float.
*   **Tactical Override:** Input your own directive ("Make it noir") in the Sidebar to steer the rewrite.
*   **Command Pills:** Quick-access tone presets (Sanitize, Expand, Punch Up) in the Editor Toolbar.
*   **The Logic:** `editorial.ts` receives `{ text, directive, context }` and routes to Grok 4.1.


### 4.5 Search, RAG & Sanitizer
The Sentinel Systems.
*   **Typesense:**
    *   **Collection:** `chat_memory_v2_robust`.
    *   **Schema:** `id`, `content` (PRIMARY), `role`, `timestamp`.
    *   **Global Search:** `AiChat.tsx` bypasses local limits to search the full index.
*   **Index Doctor:** Located in `SparkStudioModal.tsx`. Compares Firestore vs Typesense counts and Force Syncs.
*   **Sanitizer (`sanitizer.ts`):**
    *   **Role:** The "Limbic Sanitizer".
    *   **Function:** Intercepts message edits, sanitizes XML formatting glitches, and ensures the "Healed" version is immediately pushed to Typesense via `healUpsert`.
*   **Editorial Engine (`editorial.ts`):**
    *   **Role:** The "Creative Director".
    *   **Reimagine:** Allows user to highlight text -> "Reimagine" to rewrite it with specific Tone/Spice/Directives.
    *   **Awareness:** Can see "Global Scope" (Full History) when requested.

### 4.6 The Satellite (Local Engine)
Located in `zen-satellite/`.
*   **Purpose:** A Node.js telemetry and local AI processor running on the user's physical machine.
*   **Logic (`zen-satellite.js`):**
    *   **Telemetry:** Captures CPU/GPU stats and pushes to `artifacts/{APP_ID}/users/{uid}/telemetry/realtime`.
    *   **Local AI:** Listens to `artifacts/.../queue` for prompts, processes them via local **Ollama** (Port 11434), and writes answers back.
*   **Relinking:** Scripts like `relink-matrix.cjs` help map local file paths to the Cloud storage if the user migrates data.

---

## Chapter 5: Developer Protocols (The Zen Laws)
1.  **NO STUBBING:** Logic must be implemented or explicitly throw "Not Implemented".
2.  **SILENCE IS FATAL:** Do not swallow errors. Log them.
3.  **THE BRIDGE MUST HOLD:** Wrap long operations in `aiStateBridge`.
4.  **RESPECT THE SCHEMA:** Do not invent fields. Check `src/types/models.ts`.
5.  **AESTHETICS MATTER:** Do not ship ugly UI. Use the Glass System. Wherever we define the UI (color schema, bento box and masonry layout, glassmorphism, etc.), ALWAYS aggressively purge light mode native browser elements. For `type="number"` inputs, you MUST append `[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]` to the Tailwind classes.
6.  **STRICT EXPORT MANAGEMENT:** Verify library exports. Fix WSODs immediately by switching between Named/Default imports.


**(End of Specification)**
