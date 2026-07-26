# Sovereign Database Backup Runbook: MongoDB Full Archive

## 1. Metadata & Ownership
* **Service Name:** Sovereign Database (MongoDB instance on Genesis Alpha)
* **Owner/Team:** Architect (Eric Cornett) / Project GIGI Platform Engineering
* **Criticality:** Tier 1 (Mission Critical)

## 2. System Overview & Architecture
* **Purpose:** This service maintains the physical survival of the `LifeOS` database (including the massive `media` and `pending_accessions` collections). This process ensures recovery from AI-hallucination data contamination, hardware thrashing, or Docker container failure by taking a hard snapshot.
* **Diagram Link:** Genesis Network Topology (Victus Dev Rig -> Tailscale `100.116.12.18` -> Gigi-Genesis-Alpha -> F:\ Lifeboat Array)
* **Dependencies:** Relies on the `sovereign_db` Docker container running on Genesis Alpha, Tailscale network connectivity, and the `F:\MneOS_Mongo_Backups` mapped network drive.

## 3. Step-by-Step Operations (The 3-Phase Core)
> **Prerequisites:** Do NOT run this dump to the Victus `C:\` drive to prevent thrashing the system SSD. Ensure the Genesis Alpha array is mapped to `F:\` on your local rig, and that the portable MongoDB Database Tools are installed in `C:\MneOS\.tools\`.

### Phase 1: Local Database Snapshot (Alpha F:)
Verify the database is actively responding over the Tailscale IP before attempting a dump:
```powershell
Test-NetConnection -ComputerName 100.116.12.18 -Port 27017
```
Execute the portable `mongodump.exe` from your local `.tools` directory, targeting the Tailscale IP and piping the BSON output directly to the mapped `F:\MneOS_Mongo_Backups` drive on Alpha.

```powershell
& "C:\MneOS\.tools\mongodb-database-tools-windows-x86_64-100.10.0\bin\mongodump.exe" --uri="mongodb://zen:<db_password>@100.116.12.18:27017/LifeOS?authSource=admin" --out="F:\MneOS_Mongo_Backups\db_dump_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
```

### Phase 2: Codebase Lock (Victus)
Before proceeding with major architectural changes, secure the codebase.
1. **Version Control:** Commit and push the current state to the private repository.
```powershell
cd C:\MneOS
git add .
git commit -m "Pre-Architecture Lock Snapshot"
git push
```
2. **Bare-Metal Zip Archive:** Zip the root directory (excluding `node_modules` and `.git`) and copy it to the Alpha array for physical redundancy. This ensures you do not lose `.env.local` keys, infrastructure scripts, or the API proxy itself.
```powershell
# Using 7-Zip (recommended for speed/exclusions) or fallback to a robust PowerShell script
# Exclude node_modules, .git, dist, and artifacts
& "C:\Program Files\7-Zip\7z.exe" a -tzip "F:\MneOS_Mongo_Backups\codebase_archives\mneos_src_$(Get-Date -Format 'yyyyMMdd_HHmmss').zip" "C:\MneOS\*" -xr!node_modules -xr!.git -xr!dist -xr!scratch
```
*(Note: If 7-Zip is not installed, use Git bash or write a custom PS script. `Compress-Archive` cannot natively handle complex exclusion trees).*

### Phase 3: Offsite Vault (Backblaze Snapshot)
* **CRITICAL ARCHITECTURAL WARNING:** Backblaze Personal Backup **does NOT** back up mapped network drives. 
* **Action:** 
  - If the Backblaze agent is running on **Alpha**, `F:\` is a local drive and will be backed up automatically.
  - If the Backblaze agent is running on **Victus**, it will silently ignore `F:\`. You must use `b2 sync` or `rclone` to push the data from Victus to a Backblaze B2 bucket. Verify your agent topography before assuming safety.

## 4. Verification & Health Checks
* Verify the backup was successful by checking the output directory on the Alpha F: drive:
```powershell
Get-ChildItem -Path "F:\MneOS_Mongo_Backups\" -Directory | Sort-Object CreationTime -Descending | Select-Object -First 1 | Get-ChildItem
```
* Expected response: You should see a `LifeOS` folder containing files like `pending_accessions.bson`, `pending_accessions.metadata.json`, `media.bson`, etc.

## 5. Rollback Plan
If verification fails, or if you need to restore the database from a catastrophic event, execute a restoration from the most recent known-good backup located on the Alpha F: drive using the portable `mongorestore` tool:

```powershell
& "C:\MneOS\.tools\mongodb-database-tools-windows-x86_64-100.10.0\bin\mongorestore.exe" --uri="mongodb://zen:<db_password>@100.116.12.18:27017/?authSource=admin" --drop "F:\MneOS_Mongo_Backups\[target_backup_folder]\LifeOS"
```
> **Warning:** The `--drop` flag will completely wipe the existing collections in the database before restoring the archive. Only use this during an emergency bare-metal recovery.
