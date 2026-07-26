# URGENT TODO: Firebase Extraction & Sovereign API (Post-Migration)

## The Threat
The legacy Google Cloud / Firebase project `gigi-time-machine` is at risk of being deleted by Google due to pre-bankruptcy debt. If this happens, all remaining Firebase Cloud Functions (used for Google Photos ingest, AI routing, and B2 proxies) will instantly go dark, and the local Firebase CLI emulator will refuse to boot.

## The Mandate
**DO NOT ATTEMPT THIS DURING THE F:\ DRIVE PANIC DUMP.**
This extraction must only occur *after* the 1.2TB mechanical hard drive has been fully and safely migrated to B2 and the data is secured in the sovereign MongoDB. Attempting this architectural overhaul during the data rescue risks fatal data loss.

## The Extraction Plan (Sovereign API)
We will sever the final umbilical cord to Google by migrating the `functions/` directory logic into a dedicated Dockerized Node.js API hosted on the Genesis Cluster (Alpha/Beta/Gamma).

### Step 1: Inventory & Categorize
- Map all 12+ endpoints currently running in `functions/` (e.g., `proxyGooglePhoto`, `linkGooglePhotos`, `generateB2UploadUrl`).
- Determine which routes are fast/stateless (candidates for Vercel `api/` serverless functions) and which require heavy lifting (candidates for the Genesis Sovereign API).

### Step 2: Build the Sovereign API Container
- Create a lightweight Node.js/Express application to house the heavy-lifting routes.
- Deploy it via Docker to Genesis Alpha (`100.116.12.18`) so it runs 24/7 alongside the MongoDB container, ensuring zero-latency database connections.

### Step 3: Reroute the Frontend
- Update `src/services/` (like `googlePhotosService.ts`) to point to the new Tailscale IP endpoint (`http://100.116.12.18:3000/api/...`) or Vercel endpoints instead of the Firebase Cloud Functions URLs.

### Step 4: The Nuclear Option (Clean Up)
- Once the new architecture is tested and verified, completely delete `firebase.json`, `.firebaserc`, `firebaseConfig.ts`, and the entire `functions/` directory.
- Remove all `firebase` dependencies from `package.json`. 
- Google will have zero footprint in MneOS.

### Step 5: The Firebase Exorcism (Native Realtime Synapse)
*Currently, `sovereignDbAdapter.ts` is acting as a Firebase SDK "Shim" to prevent the frontend from exploding. It translates legacy `onSnapshot` calls into one-time `getDocs` fetches.*
- **Objective:** Destroy the shim. Connect the React frontend natively to the Sovereign API.
- **Backend Upgrade:** Reboot the Alpha MongoDB Docker container with the `--replSet` flag and run `rs.initiate()` to create a single-node Replica Set. This unlocks the MongoDB Oplog and true Native Change Streams.
- **Middleware:** Stand up a Socket.io or Server-Sent Events (SSE) pipeline on the Sovereign API (Port 3000).
- **Frontend Excision:** Tear out `sovereignDbAdapter.ts`. Refactor `useMatrixData.ts` to subscribe natively to the WebSocket/SSE stream. 
- **Result:** The Matrix Grid achieves 0-latency true realtime reactivity. No more polling. No more "optimistic UI" hacks for deletions. No more Firebase ghosts.
