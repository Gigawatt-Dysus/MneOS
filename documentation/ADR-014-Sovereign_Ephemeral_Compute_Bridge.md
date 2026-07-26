# ADR-014: Sovereign Ephemeral Compute Bridge (Vast.ai)

## 1. Context and Problem Statement
MneOS requires high-fidelity, photorealistic asset generation utilizing the 12-billion parameter Flux architecture and complex ComfyUI workflows (such as the Auto Masking Hand Fixer). However, the system faces severe hardware and environmental constraints as of July 2026:
*   **Local Hardware Ceiling:** The primary rig possesses only 6GB of VRAM and 20GB of free SSD space, rendering local Flux execution impossible without critical OS instability.
*   **Corporate Censorship:** Managed serverless providers (e.g., FAL.ai) have instituted strict NSFW filters ("SNOFS"), completely breaking our Biometric Decoupling and authorized explicit pipelines.
*   **Cloud GPU Famine:** Standard cloud providers (RunPod) are suffering massive GPU shortages, leading to hours-long queues for compute allocation.

## 2. Decision: Ephemeral IaaS Routing via Vast.ai
We will bypass corporate censorship and queues by directly renting decentralized raw iron on the **Vast.ai** spot market. MneOS will act as an autonomous compute broker, dynamically spinning up an RTX 4090 or RTX 5090 instance only when a session is active, and aggressively tearing it down upon inactivity to protect the monthly budget ceiling ($50/month).

## 3. Architecture & UX Lifecycle

### 3.1 The Iron Market Modal (Initialization)
Upon launching Clotho's Loom, MneOS will query the Vast.ai `/bundles` API to fetch live market rates for verified RTX 4090/5090 GPUs.
*   The UI will display a hacker-chic terminal modal listing available hardware, datacenter locations, download speeds (critical for B2 injection), and hourly rates.
*   The system will automatically calculate and display the **Projected Session Cost** (Hourly Rate × 5 hours).
*   A "Commander's Choice" algorithm will highlight the optimal node based on the intersection of price, gigabit internet speed, and geographic proximity. The Architect can manually override or click to accept.

### 3.2 B2 Injection & Cold Start
Upon selecting a node, MneOS issues a `create_instance` API call to Vast.ai. 
*   The payload will specify a lightweight Docker image pre-configured for ComfyUI.
*   The payload will include an `onstart` bash script utilizing `aria2c`. 
*   Upon boot, the script will rapidly download the Sovereign Flux Payload (~16GB containing the Flux models, T5 encoders, custom HandFixer nodes, and the Ruthie LoRA) from a private Backblaze B2 bucket into the container's RAM/Disk.
*   Once the ComfyUI API is responsive, the IP and mapped port are passed back to the Loom UI.

### 3.3 Financial Telemetry & The Guillotine Protocol
To ensure the $50/month budget is strictly enforced, the Loom UI will feature live financial telemetry and aggressive auto-termination.
*   **Live HUD:** The upper right corner of the Loom will display a ticking counter: `[🟢 LEASE ACTIVE] | Uptime: 00:14:23 | Session Cost: $0.43`.
*   **10-Minute Idle Toast:** If no render commands are issued for 10 minutes, a non-intrusive toast warns: *"Warning: GPU Lease expiring in 5 minutes due to inactivity."*
*   **13-Minute Idle Modal:** At 13 minutes, a critical modal hijacks the UI: *"⚠️ Lease termination imminent in 119s."* It will display the final accumulated session cost and offer a `[Keep Alive]` override button.
*   **Termination:** At 15 minutes of inactivity, MneOS issues the `destroy_instance` REST call to Vast.ai, terminating the lease and resetting the Loom UI back to the Iron Market.

## 4. Consequences & Trade-offs
*   **Pros:** Total freedom from corporate censorship. Infinite hardware scalability. Eradicates the necessity of upgrading local hardware. Deeply economical (~$1.75 per 5-hour heavy session).
*   **Cons:** The initial B2 injection cold-start will take approximately 4 to 6 minutes upon the very first render request of a session.

## 5. Security & Identity Integration
*   The connection to the Vast.ai ComfyUI container is direct. The API endpoint (`http://<vast-ip>:<mapped-port>/prompt`) will act as a drop-in replacement for `127.0.0.1:8188`.
*   The Ruthie LoRA is securely injected into the ephemeral container and wiped from the host machine upon termination, maintaining biometric sovereignty.
