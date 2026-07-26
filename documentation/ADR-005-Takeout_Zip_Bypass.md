# ADR-005: Google Takeout Zip Stream Rescue

**Status:** Active / Pending Implementation

## 1. The Incident (Context)
During the initial extraction of the 50GB Google Takeout `.zip` archives to the `F:\` drive, Windows silently skipped 4,129 physical `.jpg` payloads due to the `MAX_PATH` (260-character) limitation. However, the associated `.json` sidecars were extracted, successfully accessioned into MongoDB, and synced to Backblaze B2. Because the individual `.jpg` files never existed on `F:\`, they were never synced to B2, leaving thousands of "Ghost" records in the database.

## 2. The Failed Solution (Hallucination Warning)
Previous AI sessions hallucinated a solution, assuming that running `fetch(record.url)` against Backblaze B2 would bypass the local file system limit. This was a logical failure. If a file never existed on `F:\`, it was never uploaded to B2. `fetch()` will return a `404 Not Found`.

## 3. The Executable Architecture (The Zip-Stream Bypass)
To rescue the 4,129 trapped files without triggering Windows path limits, we must bypass the OS file system entirely by operating in memory. Future Zen sessions MUST build the `zip_rescue.cjs` script using the following architecture:

1. **Target:** Identify the exact 50GB `.zip` files resting on the local storage array.
2. **Query:** Pull the `originalName` of all records in MongoDB where `thumbnail_metadata_healed === true` and `processing_error` exists.
3. **In-Memory Streaming:** Use a Node.js library (like `node-stream-zip` or `yauzl`) to read the internal zip manifest. 
4. **Buffer Extraction:** When a missing file is located inside the zip, stream its bytes directly into a Node `Buffer`. DO NOT write it to disk.
5. **Processing:** Pass the Buffer directly to `sharp()` to execute the Holy Grail rotation (stripping EXIF).
6. **Upload & Heal:** Upload the resulting WebP thumbnail to Backblaze B2 via the `S3Client`, and update the MongoDB record to clear the error.
