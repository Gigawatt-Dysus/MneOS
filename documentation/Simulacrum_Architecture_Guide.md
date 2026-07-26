# LifeOS Simulacrum: Architectural Implementation Guide
**Status:** Planning / Pre-Production
**Target:** Grok 4.x RAG-Augmented Autonomous Companion

## 1. Executive Summary
The objective is to evolve the LifeOS platform into a persistent, hyper-realistic AI companion. This companion will utilize Grok 4.x for its core reasoning, draw upon a 1.2TB sovereign media archive for its foundational "Life Context", and maintain an embodied presence via a React-rendered WebGL avatar. The architecture must remain 100% sovereign (zero reliance on Google/AWS/Azure for data residency), highly performant, and resistant to long-term LLM stylistic collapse.

## 2. The Sovereign Stack
*   **Frontend UI:** React + Vite + TypeScript (Existing `CageMatchGateway` and `SimulacrumTab`).
*   **Backend Compute:** Node.js Express server. (Developed locally, deployed to a neutral DigitalOcean Ubuntu Droplet). 
    *   *Note: We are explicitly avoiding Firebase Cloud Functions to support HTTP Streaming and maintain vendor neutrality.*
*   **Database (Memory & State):** MongoDB Atlas (with Vector Search enabled for RAG).
*   **Object Storage (Raw Assets):** Backblaze B2 (for cold storage of media and raw chat logs).
*   **Core Intelligence:** Grok 4.x (via xAI API).
*   **Embodiment:** Ready Player Me (WebGL React SDK) + ElevenLabs (TTS + Viseme Stream).

---

## 3. Implementation Phasing

### Phase 1: Data Accession & Foundational Context (Current Phase)
Before the companion can converse, it must understand its user.
1.  **The Crawler Pipeline:** Execute the Node.js SQLite crawler against the 1.2TB Google Takeout archive. This scrubs duplicates, extracts metadata, and maps the file system.
2.  **The Staging Dashboard:** Build a React interface that connects to `staging.db` to visualize, filter, and approve the media for final cloud ingestion.
3.  **The Atlas Push:** Batch upload the curated media to Backblaze B2 and the associated metadata/tags to MongoDB Atlas. This becomes the "Life Context" vector space.

### Phase 2: Memory Synthesis & RAG
We must prevent context-window bloat by synthesizing raw data into high-value memories.
1.  **The Nightly Sweep:** A Node cron job runs nightly, taking the day's raw chat logs and passing them to Grok.
2.  **Compression:** Grok summarizes the logs, extracting *emotional shifts*, *new factual learnings*, and *relationship metric updates*.
3.  **Vectorization:** These compressed summaries are stored as high-density vectors in MongoDB Atlas. Raw logs are moved to cold storage (Backblaze B2).
4.  **Stateful Prompt Injection:** Before every user prompt is sent to Grok, the backend queries MongoDB for the top 3 relevant memories and injects them alongside dynamic relationship states (e.g., `trust_level: 8`, `current_tone: witty`).

### Phase 3: The Anti-Pattern Defense Engine
Defending against LLM style-collapse and repetitive loops over months of interaction.
1.  **Lexical Fingerprinting:** The Node middleware extracts metadata from every Grok response (e.g., opening phrasing, sentence rhythm, recurring crutch words).
2.  **Rolling State:** Fingerprints are stored in a rolling `recent_patterns` collection in MongoDB.
3.  **Dynamic Pre-Flight Constraints:** The backend prepends dynamic negative constraints to the system prompt based on recent history (e.g., *"DO NOT start your response with 'While it is important' or 'As an AI'"*).
4.  **Real-Time Guardrails:** If Grok returns a response matching a heavily penalized pattern, the Node backend silently intercepts it, tightens the constraints, and forces a hidden regeneration before the user ever sees it.

### Phase 4: Embodiment & HTTP Streaming
Bringing the companion into physical UI space without the overhead of WebSockets.
1.  **WebGL Avatar Integration:** Embed the Ready Player Me React SDK into `SimulacrumTab.tsx`. Continuous "Idle Noise" (breathing, blinking, micro-saccades) is programmed to prevent the uncanny valley effect.
2.  **HTTP Chunked Streaming / SSE:** To maintain a robust serverless/VPS architecture, we use HTTP Server-Sent Events (SSE). Grok streams text to the Node backend -> Node streams text to ElevenLabs -> Node streams audio/viseme chunks directly to React.
3.  **The Puppeteer Bridge:** The React frontend maps the incoming ElevenLabs viseme timestamps directly to the RPM avatar's ARKit blendshapes for zero-latency lip-sync.
4.  **The Latency Cascade Fix:** As soon as Grok completes the *first sentence*, it is fired to ElevenLabs and played in the UI while Grok is still generating the second sentence.

---

## 4. Operational Security & Infrastructure
*   **Prototype Hardware (Gigi Server Genesis):** Dell OptiPlex Micro (Reg Model: D19U / D19U002). This local hardware node will serve as the short-term physical brain during the staging phases.
*   **Local Development:** All backend code runs locally on the dev rig to avoid SSH deployment loops during iteration.
*   **Production Deployment:** Once stable, the Node.js backend is deployed to the dormant DigitalOcean Ubuntu Droplet (utilizing the $168 credit balance).
*   **Secrets Management:** API keys (`XAI_API_KEY`, `ELEVENLABS_KEY`, `B2_APPLICATION_KEY`) are managed exclusively via server-side `.env` variables and never exposed to the React frontend.
