# MneOS Strategic Roadmap: Sovereign Integrity & The Zen Clone Terminator

## 1. The Matrix Purge (Main Collection Scrub)
- **Objective:** Aim the newly hardened forensic deduplication scripts (`dedupe_sovereign_db.mjs` and `dedupe_phase2.mjs`) at the primary `media` collection.
- **Why:** The Pandora backlog (`pending_accessions`) was severely polluted with Google Takeout clones. It is highly likely that structural clones and "stowaway" ghost records have infiltrated the main Matrix over the years.
- **Action:** Retarget the MongoDB connection strings in the scripts to the `media` collection and execute a master sweep to ensure the core application is running as lean as mathematically possible.

## 2. The Gemini Vision Pipeline (Metadata Backfill)
- **Objective:** Execute external Python scripts utilizing the Gemini 3.x Vision API against the fully sanitized `pending_accessions` database.
- **Why:** To automatically generate rich, descriptive narrative metadata for true, unduplicated photographs.
- **Action:** Wait for the `triage_router.mjs` to extract all Docs/Vids/Screenshots, get a final count of pure photos, and feed them into the batch vision processor.

## 3. The Sovereign Ingest Pipeline (Mobile Bypass)
- **Objective:** Develop a mobile stub/endpoint that allows the Victus/User devices to directly ingest photos into the Sovereign Matrix.
- **Why:** To completely bypass the Google Photos ecosystem and prevent future EXIF stripping and data manipulation.

## 4. The Zen Clone Terminator (Nightly Cron Job)
- **Objective:** Automate the forensic deduplication logic as a nightly background process (e.g., a Firebase Cloud Function via `functions.pubsub.schedule('every 24 hours')`).
- **Why:** To act as the digital immune system for the Matrix. As new photos arrive via the mobile ingest pipeline, the Terminator will silently scan the airlock at 3:00 AM, automatically incinerating any detected multipart anomalies or structural clones before they can take up residence in the core database.
