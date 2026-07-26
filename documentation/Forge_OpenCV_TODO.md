# Forge Pipeline: Post-Ingestion OpenCV Pass

## The Problem
Google Takeout exports two files when a user edits an image via Google Photos:
1. `[filename].JPG` (The high-res original, uncompressed, full fidelity)
2. `[filename]-edited.JPG` (A heavily compressed, scaled-down proxy containing the user's crops and color adjustments)

During the Forge ingestion pipeline, both files are processed and ingested into MongoDB as separate media entities.

## The Solution (Post-Processing Autopilot)
Instead of interrupting the current ingestion pipeline, we will run an asynchronous, post-ingestion sweep using Python and OpenCV.

### Workflow:
1. Query MongoDB for all records where `filename LIKE '%-edited%'`.
2. Locate the parent master record (`[filename].JPG`).
3. Download both assets to a local temp directory.
4. Run OpenCV Feature Matching (SIFT/ORB) to calculate the homography/transform between the proxy and the master.
5. Extract the bounding box (X, Y, Width, Height) of the proxy relative to the master.
6. Write the crop coordinates directly into the parent master's `adjustmentStack` in MongoDB.
7. Safely delete the compressed `-edited` proxy from MongoDB and B2.

This preserves the user's original "intent" (the crop) while maintaining the absolute highest graphical fidelity of the master asset, completely non-destructively.

## Future Expansion: AI Restoration Pipeline
As an extension of the non-destructive architecture, we will implement an "AI Polish" pipeline.
This pipeline will:
1. Pull the high-res master from the sovereign cloud.
2. Run it through local AI upscaling models (e.g., Topaz Video AI, Real-ESRGAN) or colorization/restoration nodes.
3. Save the enhanced result back to the `polishLayers` schema in MongoDB.
4. Allow the LifeOS UI to seamlessly hot-swap between the raw archival master and the AI-restored polished version.

## Future Expansion: Post-Migration Ethereal State (Retiring the F: Drive)
When the bulk ingestion phase concludes and the physical `F:\` drive (the mechanical lifeboat) is decommissioned, the SSIM evaluation pipeline (`eval_pair.py`) must be decoupled from local storage.
1. Update `eval_pair.py` and the `staging_api` (`/api/forge/pair`) to accept Backblaze B2 URLs instead of local file paths.
2. Use `urllib` and `cv2.imdecode` to fetch image bytes directly from the sovereign cloud into OpenCV memory for structural comparisons.
3. This ensures the Airlock UI can natively deduplicate future net-new uploads (e.g., from mobile devices) without ever requiring physical staging infrastructure again.
