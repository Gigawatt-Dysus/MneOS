# MneOS Architectural Anomaly Report: The Pandora Backlog

## 1. Metadata & Ownership
* **System Component:** `pending_accessions` (MongoDB) & `staging.db` (SQLite)
* **Date Discovered:** June 14, 2026
* **Status:** QUARANTINED & AWAITING TRIAGE
* **Severity:** Tier 1 (Critical Archival Data)

## 2. The Anomaly
The `pending_accessions` MongoDB collection has ballooned to **4.5 GB**. 
It currently holds **314,830 documents**. 
By comparison, the fully processed, permanent Sovereign Identity (the Matrix, media, events, and journals) is only ~402 MB and easily fits on the Atlas Free Tier.

## 3. The Root Cause (The Sweeper Bug)
During a previous execution of the local `victus_ai_sweeper.py` script across the 50TB JBOD and F:\ drive, the script successfully vacuumed up 314,830 raw files and pushed them into the MongoDB staging queue. 

**However, the script suffered a silent ingestion failure:** It failed to append the `type` or `fileType` string to the vast majority of the documents.
* Items with `type: "IMAGE"`: **1,862**
* Items with NO type assigned: **312,968**

## 4. The Symptom
The Gemini 2.5 Flash captioning script (`Gemini_Captions_Generator_fixed.py`) is explicitly programmed to query only for `type: "IMAGE"`. Therefore, it has been completely ignoring the 312,968 unclassified files. They are invisible to the AI pipeline.

## 5. The Architecture (The Logistics Flow)
* **`staging.db` (1 GB SQLite):** The File System Airlock. Sits locally in `C:\MneOS`. Holds 113,000 vector BLOBs and SSIM scores to prevent the sweeper from infinitely re-hashing the 50TB hard drives. **NEVER DELETE THIS.**
* **`pending_accessions` (4.5 GB MongoDB):** The AI Waiting Room. Holds the 314,000 raw files (including their heavy `base64Data`) waiting for Gemini/Grok to caption and classify them. **NEVER DELETE THIS.**
* **Mongo Atlas (402 MB Cloud):** The Hot Failover. Holds ONLY the fully processed `media` and identity. `pending_accessions` must be blacklisted from syncing to Atlas to avoid exorbitant Flex tier fees.

## 6. The Sovereign Directive
The 312,968 unclassified items are NOT trash. They are the raw, unpolished history of the MneOS identity. They likely contain tens of thousands of images, chat logs, and videos mixed with system temp files.

**IMMEDIATE ACTION REQUIRED:**
1. A complete `mongodump` of the local Genesis Alpha database must be executed.
2. The dump must be compressed and vaulted into Backblaze B2 (The Cold Vault) before any remediation is attempted on the queue.
3. Once safe, a triage script must be written to iterate through the 312,968 undocumented items, identify their MIME types based on binary signatures or extensions, and properly tag them as `IMAGE`, `VIDEO`, or `TEXT` so the AI pipelines can finally see them.
