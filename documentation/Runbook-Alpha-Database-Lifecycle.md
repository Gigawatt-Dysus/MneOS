# Sovereign Database Lifecycle Runbook: Genesis Alpha Start/Stop Procedures

## 1. Metadata & Ownership
* **Service Name:** Sovereign DB Lifecycle (MongoDB on Genesis Alpha)
* **Owner/Team:** Architect (Eric Cornett) / Project GIGI Platform Engineering
* **Criticality:** Tier 1 (Mission Critical)

## 2. System Overview & Architecture
* **Purpose:** This process dictates the safe startup and graceful shutdown sequences for the primary database node (`sovereign_db`) hosted on Gigi-Genesis-Alpha. Proper shutdown prevents database journal corruption, and correct startup ensures the LifeOS development environment has a healthy backend.
* **Diagram Link:** Genesis Network Topology (Victus Dev Rig -> Tailscale `100.116.12.18` -> Genesis Alpha Docker Host)
* **Dependencies:** Relies on Windows 11 Pro Remote Desktop, an active Tailscale mesh connection, and Docker Engine/Desktop running on Genesis Alpha.

## 3. Step-by-Step Operations (The Core)
> **Prerequisites:** You must have Remote Desktop (RDP) access to Genesis Alpha. Tailscale must be active on both the Victus rig and Alpha.

### Step 1: Connecting to Genesis Alpha
Log into the headless Alpha server via Remote Desktop using its immutable Tailscale IP:
```powershell
mstsc /v:100.116.12.18
```
*(If Tailscale is offline, fallback to the Local LAN IP: `192.168.40.219`)*

### Step 2: Verification of Docker Engine
Once logged into Alpha, open PowerShell as Administrator and verify the Docker daemon is responding:
```powershell
docker info
```
*(If this command fails, manually launch "Docker Desktop" from the Windows Start Menu and wait 30-60 seconds for the engine to fully initialize).*

### Step 3: Execution — Starting the Database
Start the Sovereign database container. 

> **CRITICAL SAFETY WARNING:** Never attempt to mount the `F:\` drive (the Seagate Mechanical Lifeboat / Scratch Drive) directly inside GGA's Docker configuration or `docker-compose.yml`.

Run this command to initialize the database:
```powershell
docker start sovereign_db
```

### Step 4: Execution — Stopping the Database
When performing hardware maintenance, rebooting Alpha, or updating Docker, you must gracefully stop the database to flush writes and prevent BSON corruption. Do not just reboot the server while the container is active.
```powershell
docker stop sovereign_db
```

## 4. Verification & Health Checks
* After starting the container, verify its live status and check for clean initialization logs:
```powershell
docker ps --filter "name=sovereign_db"
docker logs --tail 50 sovereign_db
```
* **Expected response:** The container status should show `Up` and the logs should end with a message indicating it is ready to accept connections (e.g., `Waiting for connections on port 27017`).
* You can also perform a ping test from your Victus dev rig:
```powershell
Test-NetConnection -ComputerName 100.116.12.18 -Port 27017
```

## 5. Rollback Plan
If the container fails to start, enters a reboot loop, or becomes unresponsive:
1. Immediately pull the diagnostic logs to identify if there is a journal lock or storage issue:
```powershell
docker logs sovereign_db
```
2. If the container is hung, force a restart of the Docker Engine service, or perform a hard restart of the container:
```powershell
docker restart sovereign_db
```
3. If the database is corrupted beyond repair, leave the container stopped and refer to the `Runbook-MongoDB-Backup.md` to execute a `mongorestore` protocol from the `F:\` drive lifeboat array.
