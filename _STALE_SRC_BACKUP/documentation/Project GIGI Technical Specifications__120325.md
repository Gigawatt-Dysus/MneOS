Project GIGI: Technical Specification & Architectural Blueprint
Version: 2.0 (The "Restoration" Build) Date: December 2025 Status: Beta Candidate

1. Executive Summary (Product Vision)
Gigi is not just a photo gallery; it is a Personal AI Archivist. The application's core mandate is to ingest raw digital artifacts (photos, videos, documents) and use AI to weave them into a coherent narrative (The Timeline & Journal). It bridges the gap between "File Storage" and "Digital Memory."

Core Philosophy
Context is King: A photo without a date or description is just data. Gigi's job is to extract, infer, or hallucinate (creatively) the context.

The "Starfish" Principle: Data is not linear. An event connects to a person, who connects to a place, which connects to a document. The AI traverses these links to "Daydream."

Diegetic AI: The AI is not a chatbot tool; it is a character (The Archivist) that lives inside the software. It pulses, thinks, and writes journals while the user is away.

2. System Architecture
2.1 Tech Stack
Frontend: React 18 (Vite), TypeScript, Tailwind CSS.

Backend / Persistence: Firebase (Firestore, Auth, Storage).

AI Engine (The Brain): Hybrid System.

xAI (Grok): Primary conversational engine (Personality, Chat).

Google Gemini (Pro/Flash): Heavy lifting (Vision analysis, Deep Dives, bulk processing).

Local State: IndexedDB (via idb) for "Data Rescue" buffers and Staging.

2.2 Directory Structure (The Anatomy)
/src/components: UI Views.

TheMatrix/: The Media Gallery subsystem (Toolbar, Grid, Viewer).

StagingArea.tsx: The "Ellis Island" for incoming files.

/src/services: The Logic Layer.

serviceManager.ts: The Facade pattern. App.tsx talks to this, not raw Firebase.

geminiService.ts: The Bridge. Exports AI functions to the UI.

/src/services/ai/: The Brain (Modularized).

generators.ts: Core prompt logic (Daydreams, Deep Dives).

vision.ts: Image analysis.

providers.ts: Raw API calls to xAI/Google.

config.ts: Model routing.

3. Core Modules & Functionality
3.1 The Matrix (Media Management)
Concept: A high-performance masonry grid for viewing thousands of assets.

Key Components:

MatrixGrid: Uses react-photo-album for virtualized masonry layout.

MatrixViewer: A createPortal overlay (Z-Index 10000) implementing a Lightbox with Deep Zoom.

Tagging System (Strict Typing):

Entities (Capital T): Person, Pet, Place, Thing, Event. Managed via TaggingPanel.

Context Pills (lowercase t): Descriptors (e.g., "funny", "sunset"). Managed via InfoPanel.

Logic: Uses a "Fork-on-Use" pattern. The app suggests from a read-only GLOBAL_CONTEXT_TAGS list. If used, the tag is cloned to the User's database.

3.2 The Staging Area (Ingestion Workflow)
Problem: Uploading directly to the timeline creates clutter.

Solution:

User clicks "Upload" in Matrix.

Files are intercepted and stored in App.tsx state (stagedFiles).

User is routed to StagingArea view.

User reviews/captions files.

User clicks "Commit" -> Data moves to Firebase.

3.3 The Brain (AI Integration)
The Bridge (aiStateBridge.ts): A Pub/Sub mechanism. When generators.ts starts work, it fires a signal. Header.tsx listens and animates the Avatar pulse.

Daydreaming:

Trigger: Idle timer (15m) or manual.

Logic: Selects a random Event -> "Starfish" traversal (finds related media/tags) -> Generates a Journal Entry.

Output: Returns JSON with title, content, and relatedEventId.

Deep Dive:

Trigger: User query or "Reporter Mode".

Logic: Gathers context from allEvents and allTags based on year/keywords. Uses Gemini Pro for high-reasoning analysis.

4. Data Dictionary (Schema)
4.1 Media (The Asset)
TypeScript

interface Media {
  id: string;
  url: string;           // Full size
  thumbnailUrls: { ... } // Optimized sizes for Grid
  forensics: {           // The Archivist's notes
      exifDate: string;
      inferredDate: string;
      flaggedReason: 'date_mismatch' | null;
  };
  tagIds: string[];      // Links to Tag Collection
}
4.2 Tag ( The Entity)
TypeScript

interface Tag {
  type: 'person' | 'pet' | 'place' | 'context'; // Discriminator
  metadata: { ... } // Schema varies by type
}
Context Tags: Simple labels. metadata: { isSystem: boolean }.

Entity Tags: Complex. metadata contains relationships, coordinates, birthdates.

5. Developer Protocols (The "Zen" Laws)
Any developer (Human or AI) working on this codebase must adhere to:

NO STUBBING: Never define a function signature and leave the body empty (e.g., return {}). If logic is unknown, throw an Error or log a "Not Implemented" warning visible to the user.

NO COMPACTING: Do not remove comments or "optimize" code length at the expense of readability.

SILENCE IS FATAL: Do not prefix variables with _ just to satisfy the compiler unless the logic truly demands ignoring that data. If an error exists, fix the root cause.

THE BRIDGE MUST HOLD: Any AI generation must wrap its execution in aiStateBridge.setThinking(true) / (false). The UI depends on this heartbeat.

PORTAL SAFETY: All Modals/Overlays (Matrix Panels) must use ReactDOM.createPortal and stopPropagation to avoid Z-Index traps in the main view.

6. Known "Dark Matter" (To Be Built)
Simulation Logic: simulateDigestEmail currently returns static text. Needs AI wiring.

Upload Service: The actual file upload logic in StagingArea is currently simulated with a timeout. Needs firebase/storage integration.

Thumbnail Generation: Currently assumed to be handled by Cloud Functions (Extension). If local, logic needs to be added.