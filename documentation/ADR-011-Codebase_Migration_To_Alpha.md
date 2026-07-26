# ADR-011: Codebase Migration to Alpha & Tailscale Thin-Client Architecture

**Date:** 2026-07-03
**Status:** Proposed / Pending Implementation
**Author:** Zen / Commander Dysus
**Context:** Remote Field Operations (Chesapeake Bay deployment)

## Context & Problem Statement
During remote operations tethered via a 17-mile 5G hotspot from Victus, the MneOS UI and local development environment (`npm run dev`) suffered from severe network degradation. Because the backend (`api/sovereignDbWrite` and `api/sovereignDbQuery`) executes locally on Victus but connects to the cloud-hosted MongoDB Atlas over this unstable 5G link, standard 5-second driver timeouts resulted in fatal 500 Internal Server Errors, disconnecting the application from its data layer.

While a tactical fix was deployed (increasing `serverSelectionTimeoutMS` to 30s), running the physical codebase on a mobile/roaming node violates the principle of a Sovereign Data Core. The Genesis Cluster (Alpha) was designed to act as the central anchor for MneOS, providing uninterruptible power, a hardlined network connection, and colocation with the local AI model infrastructure.

## Decision
We will physically migrate the MneOS development repository and Node.js execution environment off the mobile Victus machine and permanently host it on the Alpha (Genesis) node. 

**The new workflow will be a "Tailscale Thin-Client Architecture":**
1. **Code Execution:** The Vite dev server (`npm run dev`), the backend Express routes, and the local MongoDB drivers will run directly on Alpha.
2. **Network Stability:** Alpha's hardlined connection will interact with MongoDB Atlas (and eventually a fully local MongoDB daemon), eliminating 5G packet loss timeouts.
3. **Remote Development (Antigravity):** The Commander will access the MneOS codebase from Victus (or any other roaming node) via a Tailscale-mapped network drive (mapped as `C:\` or a dedicated letter). 
4. **AI Symbiosis:** Zen (Antigravity) will operate on Victus, reading and writing files over the Tailscale mapped drive as if they were local, while the actual execution and network heavy-lifting occurs natively on Alpha.

## Consequences
* **Positive:** Complete elimination of local client-side network dependencies for database routing. The 5G connection only needs to transmit keystrokes and basic HTTP requests to Alpha, rather than maintaining stateful MongoDB driver sockets.
* **Positive:** True centralization of the project. A single source of truth resides on Alpha, preventing codebase drift across multiple laptops/travel devices.
* **Negative/Risk:** If the Tailscale network goes down, the mapped drive drops, severing Zen's ability to edit the codebase. 

## Implementation Notes (Next Steps)
1. Commit and push the final state of the Victus codebase to Git.
2. Pull the codebase onto Alpha and run `npm install`.
3. Map the Alpha project directory as a network drive on Victus over the Tailscale IP (`100.x.x.x`).
4. Reconfigure Antigravity workspace paths on Victus to target the mapped network drive.
