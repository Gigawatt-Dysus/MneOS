# MneOS Infrastructure Map

## GENESIS CLUSTER NETWORK TOPOLOGY

The headless Genesis servers must be accessed via their immutable Tailscale IPs to bypass local DHCP/router issues.

- **Gigi-Genesis-Alpha (GGA):** Tailscale IP `100.116.12.18` (Local LAN: `192.168.40.219`)
- **Gigi-Genesis-Beta (GGB):** Tailscale IP `100.65.97.113` (Local LAN: `192.168.40.43`)
- **Gigi-Genesis-Gamma (GGC):** Tailscale IP `100.105.114.31` (Local LAN: `192.168.40.28`)
- **Gigi-Genesis-Delta (GGD):** Tailscale IP [TBD] [Local LAN: TBD] -- DELTA IS A FUTURE EXPANSION, A PLANNED "HEAVY" GPU SERVER AWAITING FUNDING.
- **Gigi-Genesis-Epsilon (GGE):** Tailscale IP [TBD] [Local LAN: TBD] -- EPSILON IS A FUTURE EXPANSION, A 2ND PLANNED "HEAVY" GPU SERVER AWAITING FUNDING.

## HARDWARE & PHYSICAL TOPOLOGY (ANTI-AMNESIA)

To prevent LLM context-loss between nodes, explicitly memorize the physical locations of hardware:

- **VICTUS (The Commander):** 
  - Physical Location: Davenport, FL. Operating out of a modded dresser command center underneath a 70" Samsung TV repurposed as a massive 4k monitor. (Note: The water table here prevents basements).
  - This is the primary dev rig for Eric. It is a 2025 HP Victus gaming laptop with a built-in Nvidia 3050 GPU 6GB consumer "card", 128GB RAM DD5 SODIMM 5200 RAM and 500GB SSD (severly space limited currently due to a 32GB Windows static pagefile. It runs Windows 11 Pro.
  - `launch.ps1`, Vite Frontend, and Vercel run here to "start" the dev workspace.
 
- **GGA (Genesis Alpha):** 
  - This is a headless 2025 Dell server running Windows 11 Pro
  - **Accessed via Remote Desktop.
  - **Accessible via Windows sharing on Tailscale
  - **The `sovereign_db` Docker MongoDB container lives ONLY here.**
  - **The `F:\` drive (4GB Seagate Mechanical Lifeboat / Scratch Drive) is physically attached to Alpha and shared with the entire Genesis cluster including the dev rig Victus.**
  - **The JBOD array (~50TB removable USB consumer drives) is physically attached to Alpha and shared with the entire Genesis cluster including the dev rig Victus.**
  - **Due to Docker, Alpha cannot run heavy work**
  - NEVER attempt to mount `F:\` in GGA's docker-compose.
  - This node is the active master for the dual-write database architecture.

## THE ATOMIC PEZ DISPENSER SWARM

The MneOS infrastructure utilizes a highly parallelized "Swarm" architecture for mass database processing (like thumbnail generation or metadata extraction).
- **The Hardware:** The Genesis Cluster (Victus, Alpha, Beta, Gamma) shares a 1Gbps Tailscale LAN. Alpha holds the Master MongoDB and the physical `F:\` scratch drive. The other nodes map `F:\` over Tailscale.
- **The Protocol:** When running mass data scripts (e.g., `mass_heal_swarm.cjs`), the script is executed simultaneously on multiple machines. 
- **The Lock:** The scripts use an atomic `$findOneAndUpdate` operation to set a `processing_lock: NODE_ID`. This is the "Pez Dispenser" pattern. It prevents collisions by ensuring each node pops exactly one unique record off the queue at a time.
- **The Rule:** Never write standard serial `for-loops` for database-wide operations. Always structure them to utilize the Swarm / Pez Dispenser lock so the Commander can scale the job horizontally across the Genesis Cluster over his 1Gbps symmetric fiber.
