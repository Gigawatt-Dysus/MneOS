# Runbook: Genesis Cluster Onboarding & Database Operations

## 1. Metadata & Ownership
* **Service Name:** Genesis Cluster Network & Sovereign Database
* **Owner/Team:** Architect (Eric Cornett) / Project GIGI Platform Engineering
* **Criticality:** Tier 1 (Mission Critical)
* **Target Audience:** New Human Developers and AI Coding Partners (e.g., Zen, Grok)

## 2. System Overview & Architecture
* **Purpose:** This onboarding runbook provides the foundational network topology required to access the distributed Genesis Cluster. It outlines the strict IP routing rules and provides the operational steps for starting, stopping, and accessing the central MongoDB (`sovereign_db`) hosted on Alpha.
* **Architecture Rules for AI Partners:** This codebase does NOT use Google Firestore. All Firebase SDK calls are intercepted by `sovereignDbAdapter.ts` and routed to the MongoDB instance on Genesis Alpha.
* **Dependencies:** Relies on Tailscale Mesh Network for immutable routing, avoiding local DHCP conflicts.

### The Genesis Cluster Topology
The headless Genesis servers must ALWAYS be accessed via their immutable Tailscale IPs when working remotely or to bypass local router issues. 

* **Gigi-Genesis-Alpha (GGA)** (Active Master / MongoDB Host)
  * Immutable Tailscale IP: `100.116.12.18`
  * Real (Local LAN) IP: `192.168.40.219`
* **Gigi-Genesis-Beta (GGB)**
  * Immutable Tailscale IP: `100.65.97.113`
  * Real (Local LAN) IP: `192.168.40.43`
* **Gigi-Genesis-Gamma (GGC)**
  * Immutable Tailscale IP: `100.105.114.31`
  * Real (Local LAN) IP: `192.168.40.28`

## 3. Step-by-Step Operations (The Core)
> **Prerequisites:** You are operating from the primary dev rig (Victus). Tailscale must be actively running on the host machine. 

### Step 1: Connecting to Genesis Alpha
To manage the database, you must Remote Desktop into Alpha. Always prefer the Tailscale IP.
```powershell
# Open Windows Run (Win + R) or PowerShell and execute:
mstsc /v:100.116.12.18
```

### Step 2: Verifying the Docker Engine
Once logged into Genesis Alpha, open PowerShell as Administrator. Verify the Docker daemon is responding before attempting database operations:
```powershell
docker info
```
*(If the command times out, launch "Docker Desktop" manually from the Windows Start Menu and wait 60 seconds).*

### Step 3: Execution — Starting Sovereign DB
Start the Sovereign database container. 
> **AI CONTEXT SAFETY RULE:** NEVER attempt to mount the `F:\` drive (the shared JBOD array / Seagate Rescue drive) in GGA's Docker-compose. Due to Docker on Windows, Alpha cannot handle heavy physical storage mounts to external USB arrays.

Run this command on Alpha:
```powershell
docker start sovereign_db
```

### Step 4: Execution — Stopping Sovereign DB
If the server requires a reboot or Docker needs updating, gracefully stop the database to prevent BSON journal corruption. 
```powershell
docker stop sovereign_db
```

## 4. Verification & Health Checks
* From the Victus dev rig, verify that the database is reachable over the Tailscale network:
```powershell
Test-NetConnection -ComputerName 100.116.12.18 -Port 27017
```
* Expected response: `TcpTestSucceeded : True`
* To check the internal logs of the container on Alpha:
```powershell
docker logs --tail 50 sovereign_db
```

## 5. Rollback Plan
If you cannot reach `100.116.12.18` via Tailscale:
1. Verify Tailscale is running on the Victus rig.
2. Attempt to connect via the Local LAN IP as a fallback:
```powershell
mstsc /v:192.168.40.219
```
3. If the `sovereign_db` container crashes upon startup, do not repeatedly force restart. Check the logs (`docker logs sovereign_db`). If the database is corrupted, consult `Runbook-MongoDB-Backup.md` to drop the database and restore from the `F:\` Lifeboat drive.
