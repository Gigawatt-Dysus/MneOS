# MneOS Master Tech Debt & Transition Log

This document serves as the central brain trust for all pending architectural migrations, technical debt, and system stabilizations required to finalize the transition from LifeOS to MneOS.

## 🔴 HIGH PRIORITY: Alpha Headless Server Migration
**Objective:** Convert the Genesis Cluster (Alpha) into a true, unattended Windows blade server to survive power cycles without relying on the RDP 'Dead Man's Switch'.
- [ ] **Database Migration (Native):** Rip MongoDB out of Docker, install the raw Windows MongoDB MSI on Alpha, migrate the volume data to the native filesystem, and set it as a `SYSTEM` service on boot.
- [ ] **MneOS Ignition Automation:** Refactor `master_launch.ps1` to run headless, and wrap the entire MneOS ignition sequence into a Windows Scheduled Task triggered "On System Boot" under the `SYSTEM` account.
- [ ] **Validation Test:** Pull the plug on Alpha to simulate grid failure and verify MongoDB, Vector API, and the Vite frontend become accessible via Tailscale before any physical user login.

## 🔴 A1 PRIORITY: Sovereign Backup Telemetry & Architecture Refit
**Objective:** Finalize the 3-Phase Sovereign Backup Protocol and stabilize real-time UI synchronization via a Push-Pull hybrid architecture to resolve 3G latency desyncs.
- [ ] **Alpha Active Telemetry Backup Script:** Write the final Windows Task Scheduler PowerShell script to execute the `mongodump` and codebase `.zip` lock directly to Alpha's `F:\MneOS_Mongo_Backups` array. Implement a `try/catch` validation block that fires an HTTP POST webhook (Discord/ntfy) and triggers a local `.wav` audio alert if the F: drive is dead or disconnected, preventing Backblaze from silently syncing an empty state.
- [ ] **Socket.io + React Query Hybrid Refit (TKDodo Pattern):** Rip out fragile Optimistic HTTP updates. Configure MongoDB Change Streams on Alpha to trigger Socket.io push events to the frontend. Use TanStack/React Query's `setQueryData()` to perform deterministic "Smart Cache Patching", ensuring the MneOS UI remains perfectly synced even under severe network degradation.

## PHASE 1: The Pandora Rescue & Security
- [ ] **Vault the Master Database:** Execute `mongodump` on Genesis Alpha (Node 1) for the entire 5GB `sovereign_db` and manually push the `.gz` backup to the Backblaze B2 Cold Vault.
- [ ] **Provision Beta Node:** Spin up a new Docker instance of MongoDB on Genesis Beta (Node 2) to serve as a local hot failover or testing mirror.

## PHASE 2: The Sovereign Rebrand
- [ ] **The Great Path Sweep:** Execute a global Find & Replace across all codebase files, Python scripts, batch files, and `.env` configs to transition `C:\LifeOS` to `C:\MneOS`.
- [ ] **Directory Rename:** Close the IDE, manually rename the root folder on the Victus and Genesis nodes to `MneOS`, and restart the environment.
- [ ] **Domain Alias Lock-in:** Registered `mnem-os.com` to protect the namespace and enable future brand evolution (from MneOS to MnemOS, honoring Mnemosyne). Keep as an alias for now to catch mistypes; full migration is deferred since the MneOS transition just occurred.

## PHASE 3: The Pandora Triage & Captioning
- [x] **[HIGH PRIORITY] Deduplication Run:** Executed `dedupe_sovereign_db.mjs`. The "Pioneer Tax" was calculated and purged, reducing the `pending_accessions` backlog from ~314k down to a lean 81,335 unique artifacts!
- [x] **Triage the 81k Backlog:** Executed `triage_mime_types.py` across 99,560 raw accessions, categorizing them via binary signature/extension into `IMAGE`, `VIDEO`, `TEXT`, and `AUDIO` tags.
- [ ] **[A1 PRIORITY] Execute Sovereign Visual Ingestion Archive (The PEZ Dispenser):** Fire the massive 90k+ image payload through Gemini 2.5 Pro utilizing the remaining promo credit.
  - **The 5 W's of this Architecture (Anti-Amnesia Record):**
    - **Who:** Project GIGI: Mnemosyne (MneOS)
    - **What:** Distributed PEZ Dispenser Cluster Architecture for Mass Image Captioning.
    - **Where:** Genesis Cluster (Victus, Alpha, Beta) parallel-processing Backblaze B2 assets directly into Sovereign MongoDB.
    - **When:** Pre-shutterfly ingestion phase, to drain the 90k backlog efficiently.
    - **Why:** 
      - We use Gemini 2.5 Pro to avoid bankrupting our API funds on Grok. 
      - Previous attempts using Gemini 2.5 Flash and Microsoft's models resulted in hallucinations (inventing people, missing faces, shoe fixations like "there is a walking shoe in the image, the people are going to go on a hike"). Gemini 2.5 Pro adheres strictly to the objective, non-poetic prompt structure.
      - The **PEZ System** (`claimed_by` atomic locks) is required so multiple cluster nodes can run the script simultaneously without processing the same image twice (dispensing 500 records at a time exclusively to one node).
- [ ] **Accession to the Matrix:** Manually (or via script) review the newly captioned items and execute the final move from `pending_accessions` to the permanent `media` collection.

## PHASE 4: The Pointer Architecture & Cloud Mirror
- [ ] **B2 Pointer Refactor:** Rewrite the ingestion pipeline so that heavy `base64Data` binary payloads are permanently stored in Backblaze B2, leaving only a lightweight "Pointer" (URL) in MongoDB.
- [ ] **Atlas Cloud Mirroring:** Spin up the Atlas M0 Free Tier `MneOS-Cluster` and establish a sync ONLY for the lightweight `media`, `events`, and `journals` collections, staying safely under the 512MB limit.
- [ ] **Database Rename (Tech Debt):** Rename the physical MongoDB database and Atlas deployment from `LifeOS` to `MneOS` once the migration dust settles.

## PHASE 5: Exorcising Firebase (The Final Cut)
*(Inherited from `URGENT_TODO_Firebase_Extraction.md`)*
- [ ] **Sovereign API Migration:** Migrate the legacy `functions/` endpoints (Google Photos ingest, B2 Proxy generators) to a local Express/Node.js API hosted in a Docker container on Genesis Alpha/Beta.
- [ ] **The Nuclear Option:** Delete `firebase.json`, completely remove the `functions/` directory, and strip all Firebase CLI dependencies from `package.json`.

## PHASE 6: UI, Usability & Matrix Refactoring
- [ ] **[A1 PRIORITY] Director's Cut vs. Raw Dailies Toggle:** Implement a toolbar toggle to switch the Matrix timeline between `logicalDate` (the user-curated, narrative truth) and `rawExifDate` (the strict, physical machine truth).
- [ ] **[HIGH PRIORITY] Promote to Timeline (Matrix to Vortex):** Implement bulk-action functionality allowing selected media to be promoted directly into a Vortex event. Architecture:
  - Select 1+ artifacts.
  - "Add to Existing Vortex Event" (launches picker) or "Create New Vortex Event" (launches title prompt).
  - Include an option to allow AI to generate the Vortex event title/description based on the semantic vectors of the selected artifacts.
- [ ] **Refactor Settings Menu & Tooling Navigation:** The Settings modal requires a major overhaul and redesign to improve UX. Existing tabs are cluttered; Legacy tools (Tag Surgeon, Avatar Janitor, etc.) need proper hierarchical organization.
  - **CRITICAL DEBT**: Surface a link or dedicated management portal for the **Takeout Airlock / Forge Inspector**. It is currently an orphaned, hidden route (`/takeout-airlock`) that is too easily forgotten!
- [ ] **Genesis Waveform UI Aesthetics:** Design an animated, pulsing, mist-covered Genesis Device aesthetic (using pure CSS/SVG/WebGL). Integrate a 'detonation waveform' animation for loading states, UI boot sequences, or when locking semantic targets in the Forensic Tagger.

## PHASE 7: The Synthesizer & Content Export Engine (Euterpe & Thalia)
- [ ] **The Euterpe Sequence (Curated AI Slideshows):** Build a "Render Scene" export engine for Vortex Events that dynamically stitches artifacts into video slideshows. Crucially, the pacing, transitions, and narrative text overlays are driven by the AI's semantic understanding of the event, avoiding algorithmic sociopathy.
  - *Audio Integration:* Allow users to select public domain/licensed music clips or ping a frontier music-generation API (e.g., Suno/Udio) to compose an original score that matches the emotional tone of the Vortex script.
  - *Export Format:* Output raw MP4s or social-ready formats so the user retains complete agency over when and how their memories are published to external platforms.
- [ ] **RAG-Prompted Synthetic B-Roll:** Provide an option to utilize the rich semantic vectors of an event to prompt frontier video/image models (Sora, Runway, Midjourney) to generate stylized interstitial transition clips or "dream-state" B-roll to fill gaps in the timeline.
- [ ] **The Thalia Protocol (Meme Generator):** Given MneOS's deep contextual understanding of the user's life and inside jokes (via the chat vectors), build a feature to synthesize hyper-personalized, context-aware memes from Matrix artifacts.

## PHASE 8: Sovereign Vision & Forensic Tagger AI
- [ ] **Automated Pre-Flight Vector Tagging:** When launching the Forensic Visual Tagger (or during bulk RAG ingestion), run a local or API-driven vision inference pass:
  1. Generate boundary boxes and semantic vectors for all detected faces/objects in the image.
  2. **Intra-frame Twin Check:** Compare vectors of all faces *within the same image*. If any two faces share >98% similarity, automatically abort auto-tagging for that image and flag for manual Human-in-the-Loop (HITL) review.
  3. **Global Inference:** If the Twin Check passes, compare vectors against the known `Tags` database.
  4. If confidence > 80%, automatically pre-tag the face (drawing the boundary and assigning the name).
  5. If confidence is low or none found, default to standard manual tagging workflow, allowing the user to draw the boundaries themselves.

## PHASE 9: The Dreamscape Muse Studio (The Holodeck)
- [ ] **Clotho's Loom (Synthetic Generation):** The ultimate synthesis of the MneOS architecture. A dedicated studio module where the user can direct personalized, photorealistic "synthetic memories" or dream-state narratives.
  - **The Actors (Vectors):** Utilize the verified array of semantic identity vectors (from Phase 8) as deterministic "Character Seeds" for frontier video/image models. This ensures the generated entities look exactly like the real people, pets, or objects from the user's life.
  - **The Score (Euterpe):** Prompt audio/music generation models to dynamically score the generated sequence based on the emotional valence and context of the memory.
  - **The Timeline (Clio):** Anchor these synthetic dreamscapes within the historical chronology of the Time Vortex, allowing the user to fill in gaps in their physical media archive with hyper-accurate, AI-rendered reconstructions of their own past.

## PHASE 10: Spatial UX Architecture (The Great Hall)
- [ ] **The Vestibule (WebGL/Three.js):** Transition the premium-tier navigation from a static 2D dashboard to a fully immersive 3D walkable environment.
  - *The Architecture:* A dimly lit, atmospheric marble hall illuminated by shafts of cosmic starlight filtering through a central oculus.
  - *The Muses:* Interactive marble statues of Calliope, Clio, Erato, Euterpe, and others flanking the hall. Approaching/interacting with a specific Muse teleports the user into her respective functional "chamber" (e.g., Erato for chat, Clio for the Time Vortex).
  - *The Titaness:* The towering, central statue of Mnemosyne anchoring the hall, representing the core sovereign memory database. Approaching her grants access to root-level system configurations or the Master Matrix.
  - *Visual Reference:* `C:\MneOS\public\assets\Mnemosyne Avatars\Great Hall of Statues.jpg`

## PHASE 11: The Sovereign Digital Immune System (Tombstones & Necromancy)
- [ ] **The Great Retro-Hash (Backfill Script):** Write a Python utility to iterate over the entire existing `media` and `pending_accessions` collections, stream the binary from B2, generate the SHA-256 fingerprint, and backfill the `signature_id` field. This is a mandatory prerequisite for the immune system to function on legacy data.
- [ ] **Cryptographic Tombstone Ledger:** Replace basic deletion with a SHA-256 fingerprinting system. When an asset is deleted, its hash and intent telemetry (Reason, Annotations) are logged into the `sovereign_quarantine_signatures` collection to prevent accidental re-ingestion of duplicates or unwanted files.
- [ ] **Radioactive Autoban Protocol:** Implement a `isRadioactive` toggle on deletion. Any future ingest pipeline scanning a file matching a radioactive hash drops the binary at the perimeter (Zero-Trust) without prompting the user.
- [ ] **Necromancy (Quarantine Locker):** Build a power-user UI to view the Quarantine Ledger, read the historical context of deletions, and manually lift the hex (unban) if the user needs to resurrect a radioactive asset (e.g., for legal evidence).

## PHASE 12: WDE Shell Architecture (Web Desktop Environment)
- [ ] **Dynamic Icon & Grid Scaling (Desktop Settings):** Implement global `iconScale` multipliers synced to a Settings menu (Thalia). Calculate the grid grid logic dynamically (e.g., 120x140 multiplied by scaling factor) so users can customize desktop layout density.
- [ ] **Window Controls Standardization:** Finalize the top-right OS window buttons across all `react-rnd` implementations.
  - **Minimize:** Keep context alive in background, hide window.
  - **Maximize / Restore:** Snapshot window geometries, expand to `100vw`/`100vh` bounds locked at `0,0`, swap icon.
  - **Close:** Hard kill the context slice in `WindowManagerContext`.
- [ ] **Window Decoration Customization (Skinning Engine):** Introduce CSS variable theming mapped to the `<Window />` component. Allow users to hot-swap between glassmorphic, terminal/cyberpunk neon, or retro Windows 95 aesthetics via the Settings modal.
- [ ] **The Power-User Pathbar:** Embed a breadcrumb navigation bar beneath window titles. Example: `<user> / mnemosyne / vortex / 1967-09-28`. Add future support to make this an `<input>` field for CLI-style absolute path jumping.
- [ ] **Dynamic AI Wallpaper Integration (Grok Imagine API):** Wire up a direct integration with Grok Vision/Imagine inside Erato (the Chat engine). Users can converse with their AI companion (e.g., Brita) and ask her to "whip up a new desktop wallpaper fitting our mood." The API payload will generate the asset, fetch it, and apply it directly as the MneOS `MainLayout` background in real-time.

## KNOWN ENVIRONMENTAL ANOMALIES (MneOS Rig)
- **Windows Terminal Ghost Tooltip:** A persistent, oversized "Close" tooltip permanently stuck on the screen is an orphaned Aura rendering handle from Windows Terminal, not Chromium or Explorer. 
  - *Fix:* Bring Windows Terminal to the front, hover over any active tab's 'X' button to trigger a buffer redraw, or close and restart the Terminal instance.

## PHASE 13: QA & Testing Backlog (Week of June 18-25, 2026)
### 1. WDE Shell Architecture (`Desktop.tsx`, `Window.tsx`, `WindowManagerContext.tsx`)
- [ ] **Z-Index & Focus:** Verify that clicking background windows properly brings them to the front and updates the taskbar active state.
- [ ] **Bounds Clipping:** Ensure `react-rnd` drag boundaries don't allow windows to get permanently trapped off-screen under the taskbar.

### 2. Matrix Stabilization & Asset Rotation
- [ ] **The Holy Grail Re-Bake:** Verify the `forceRebakeOrientation` logic permanently sets thumbnail rotation via `sharp` and strips EXIF data so the browser doesn't double-rotate the image.
- [ ] **Masonry Alignment:** Ensure masonry layout correctly reads the new absolute height/width values of the healed images without CSS object-fit clipping.

### 3. Contextual Edit (CtxEd) & Tag Detail Modal
- [ ] **Draft Persistence:** Confirm that editing the AI's output in the `WikiTagEditor` correctly persists as a draft before final approval.
- [ ] **Sovereign Override:** Verify that placing a factual constraint in the "Sovereign Context Layer" successfully overrides hallucinated output from the Grok/Gemini vision pipelines on re-roll.

### 4. Timeslide Portal & Timeline Modules
- [ ] **Hover Blocking:** Confirm the toggle in `TimeslidePortal` successfully prevents the modal from blocking Matrix grid interactions on accidental hover.
- [ ] **QuickDateEditor Persistence:** Verify that dates modified via the `QuickDateEditor` correctly sync down to the `media` and `pending_accessions` collections.

### 5. Takeout Zip Memory Stream Rescue
- [ ] **MAX_PATH Bypass:** Validate that `zip_rescue.cjs` successfully piped the trapped 4,129 images from B2 straight to memory without hitting the Windows 260-character path limit, and correctly logged them into the database.
