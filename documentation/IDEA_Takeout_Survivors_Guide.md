# Google Takeout Survivor's Guide (Project Idea)

## Objective
Package and open-source the "Sovereign Exodus" toolchain developed during the MneOS database migration. This guide and script toolkit will empower users to escape Google's ecosystem lock-in, which weaponizes duplicate files, flattened directory structures, and manipulated EXIF metadata to create "migration paralysis."

## The Problem: "Digital Hostage-Taking"
Google Takeout's export structure is notoriously hostile:
1. **The Hall of Mirrors:** Flattened folders cause massive duplication of thousands of microscopic code libraries (like `node_modules`), artificially inflating the archive size by hundreds of thousands of files to overwhelm standard file managers.
2. **Metadata Fraud:** Google routinely strips pristine EXIF data (GPS, Camera Model, Date Taken) from JPEG headers and relocates it to proprietary `.json` sidecar files.
3. **Zero-Padding Sabotage:** To avoid rewriting file headers, the stripped EXIF blocks are often zero-padded. This maintains the exact original byte-size of the file, completely defeating standard deduplication software that relies on file size matching.

## The Toolkit (Sovereign Exodus Framework)
We will open-source the exact 4-stage forensic pipeline used to heal the LifeOS database:

1. **The Code Sweeper (`sweep_code_trash.mjs`)**
   - An aggressive regex-based vacuum that identifies and isolates `.js`, `.json`, `.md`, `.mjs`, and `.proto` files, instantly removing the `node_modules` noise from the user's view.
   
2. **Phase 1: Cryptographic Deduplicator (`dedupe_sovereign_db.mjs`)**
   - The first pass. Uses strict Cloud ETag (MD5/SHA1) cryptographic hashing to obliterate exact byte-for-byte clones while strictly skipping any collisions to prevent data loss.
   
3. **Phase 2: The Forensic Scalpel (`dedupe_phase2.mjs`)**
   - The counter-measure to Google's zero-padding fraud and cloud multipart upload hash variance. 
   - Uses HTTP Range requests to surgically download the first 64KB (the EXIF block) of mathematically suspicious files. It generates a SHA-256 hash of *only the header* to detect structural modification, safely incinerating identical multipart uploads while preserving true EXIF variations.

4. **The Triage Router (`triage_router.mjs`)**
   - The final pass. Safely organizes the pristine, deduplicated survivors into specialized silos (`video_archive`, `documents_archive`, `screenshots_archive`) based on deep regex pattern matching.

## Notes
- *Idea generated: 2026-06-15 during the final Backblaze B2 mass deduplication phase.*
- *Next Steps: Scrub personal API keys from the `.mjs` scripts, write a public README, and publish to GitHub.*
