# Task List: Project GIGI Implementation

This documents the progress of the current session.

- [x] **Phase 1: Secure the Perimeter (EWO #05)** <!-- id: 70 -->
    - [x] **Stop the Bleeding**: Add immediate logic in `providers.ts` to Respect User Scope. <!-- id: 71 -->
    - [x] **Verify**: Confirm limits are enforced in `callXAI`. <!-- id: 72 -->

- [x] **Phase 2: The Audit (EWO #07)** <!-- id: 73 -->
    - [x] **Dry Run Analysis**: Run `reconcileContext` in DRY RUN mode. <!-- id: 74 -->
    - [x] **Root Cause ID**: Confirm if `isDeleted: true` docs are persisting. <!-- id: 75 -->

- [x] **Phase 3: The Exorcism (EWO #07 & #08+)** <!-- id: 80 -->
    - [x] **EWO #05**: Enforce `historyLimit` in `providers.ts` <!-- id: 81 -->
    - [x] **EWO #07 (Part 1)**: Implement Hard Delete logic <!-- id: 82 -->
    - [x] **EWO #08 (Refinement)**: Remove `isDeleted` skip to catch Shadow Orphans <!-- id: 84 -->
    - [x] **EWO #08 (Indexing)**: Implement "Force Feed" for missing Typesense docs <!-- id: 85 -->
    - [x] **Signature Update**: Pass full `messages` array to `reconcileContext` <!-- id: 86 -->
    - [x] **EWO #09 (HUD)**: Implement "Data Integrity Readout" in Chat Header <!-- id: 87 -->

- [x] **Phase 4: Global Neural Refit (EWO #12)** <!-- id: 90 -->
    - [x] **Refit Providers**: Replaced stub with xAI `grok-4.1-embedding`. <!-- id: 91 -->
    - [x] **Update Schema**: Added `embedding` to `ChatMessage`. <!-- id: 92 -->
    - [x] **Atomic Save**: Implemented auto-embedding in `saveToFirestore`. <!-- id: 93 -->
    - [x] **Neural Audit**: Upgraded Heal button to backfill missing vectors. <!-- id: 94 -->

- [x] **Phase 5: Neural Calibration (EWO #14)** <!-- id: 100 -->
    - [x] **Correct Endpoint**: Updated `providers.ts` to `v1-embedding` / `v1/embeddings`. <!-- id: 101 -->
    - [x] **Fail-Safe**: Wrapped embedding connection in try/catch to maintain chat uptime. <!-- id: 102 -->
    - [x] **Burst Reflow**: Added sliding window truncation to `dispatchBurst` for performance. <!-- id: 103 -->

- [x] **Phase 6: The Clean Voice (EWO #15)** <!-- id: 110 -->
    - [x] **Constraint Injection**: Updated `getSystemInstruction` with Negative Formatting Constraint. <!-- id: 111 -->
    - [x] **Source Kill**: Removed `[Name]:` prefix injection in `useAiChat` API history builder. <!-- id: 112 -->
    - [x] **Vantablack Filter**: Added output sanitizer to strip hallucinated prefixes. <!-- id: 113 -->

- [x] **Phase 7: The Chronology Fix (EWO #16)** <!-- id: 120 -->
    - [x] **Service Layer**: Implemented `updateChatMessage` with `updatedAt` tracking. <!-- id: 121 -->
    - [x] **Hook Refactor**: Updated `useAiChat` to use granular updates instead of bulk overwrites. <!-- id: 122 -->
    - [x] **Timestamp Lock**: Ensured `timestamp` (createdAt) is immutable during edits. <!-- id: 123 -->

- [x] **Phase 8: The Voyage Restoration (EWO #21)** <!-- id: 130 -->
    - [x] **Neural Transplant**: Replaced xAI embedding with Voyage AI (`voyage-3`). <!-- id: 131 -->
    - [x] **Secrets Lock-In**: Added VOYAGE_API_KEY to SecretsManager and Skeleton Key backup. <!-- id: 132 -->
    - [x] **Chronology Lock**: Verified `createdAt` sorting and update logic. <!-- id: 133 -->
    - [x] **Appellation Eraser**: Installed regex filter in `callXAI` to strip `[Brita]:` prefixes. <!-- id: 134 -->
    - [x] **Heal Refit**: Confirmed Neural Audit targets Voyage AI. <!-- id: 135 -->

- [x] **Phase 9: Contextual Anchoring** <!-- id: 140 -->
    - [x] **State Implementation**: Add `lastFocalPoint` to `useAiChat`. <!-- id: 141 -->
    - [x] **Bridge Wiring**: Pass focal point through `useAiChatBridge`. <!-- id: 142 -->
    - [x] **Focal Scroll Logic**: Implement Scenario A/B/C scrolling in `MessageList`. <!-- id: 143 -->
    - [x] **Verification**: Test scroll behavior on edit vs new message. <!-- id: 144 -->

- [x] **Phase 10: The Stability Protocol (EWO #23)** <!-- id: 150 -->
    - [x] **Memoize Uplink**: Fix `useGigiData.ts` to stop dependency loops on `isShieldDisabled`. <!-- id: 151 -->
    - [x] **Guard Initialization**: Add `hasInitialized` ref to `useAiChat.ts` to prevent 703-msg reload spam. <!-- id: 152 -->
    - [x] **Fix Bad Request**: Identify missing index (orderBy `createdAt` + filters) and warn user. <!-- id: 153 -->

- [x] **Phase 11: The Heavy Lift (EWO #24)** <!-- id: 160 -->
    - [x] **Shutter Tolerance**: Increase emergency egress timeout to 10s in `useAiChatBridge.ts`. <!-- id: 161 -->
    - [x] **Disable Stability Purge**: Ensure `GIGI_STABILITY_INDEX` only purges on manual reset (Check `App.tsx`). <!-- id: 162 -->
    - [x] **Virtualization Scan**: Analyzed potential; deferred pending performance check. <!-- id: 163 -->

- [x] **Phase 12: EWO #25: The "Hard Reset" & Render Guard** <!-- id: 170 -->
    - [x] **Render Guard**: Wrap `MessageList` content in `useMemo` (deps: `length`, `lastFocalPoint`). <!-- id: 171 -->
    - [x] **Decouple Anchor**: Move `MessageList` scroll logic to `requestAnimationFrame` / `setTimeout`. <!-- id: 172 -->
    - [x] **Vantablack Lock**: Hard conditional in `App.tsx` ({isStable ? <Chat/> : null}). <!-- id: 173 -->

- [x] **Phase 13: EWO #27: Technical Correction Protocol** <!-- id: 180 -->
    - [x] **Mode State Logic**: Fix `setContextMode` in `useAiChatBridge.ts` (Dynamic Args + Toast). <!-- id: 181 -->
    - [x] **Render Guard Dependency**: Add `activeMode` to `useMemo` in `MessageList.tsx`. <!-- id: 182 -->
    - [x] **Tactical Swap**: Verify `useEffect` for system prompt listens to `activeMode` (Added Creative Patch). <!-- id: 183 -->

- [x] **Phase 14: EWO #28: The "Polymath" Persona Refit** <!-- id: 190 -->
    - [x] **Directive Update**: Update `creative` mode prompt to include "Archivist" RAG synthesis. <!-- id: 191 -->
    - [x] **RAG Sync**: Ensure Voyage/Typesense queries are active in Creative Mode (Filter `undefined` for All). <!-- id: 192 -->
    - [x] **Eraser Check**: Verify `[Name]:` regex filter exists in history builder (Confirmed `Vantablack Cleanup`). <!-- id: 193 -->

- [x] **Phase 15: EWO #30: Resolving Protocol Conflict** <!-- id: 200 -->
    - [x] **State Audit**: Injected debug logs to confirm `contextMode` state is updating correctly. <!-- id: 201 -->
    - [x] **Protocol Bypass**: Modified `getSystemInstruction` to bypass `LIMBIC_PROTOCOL` (which forbids metaphors) when `creative` mode is active. <!-- id: 202 -->
