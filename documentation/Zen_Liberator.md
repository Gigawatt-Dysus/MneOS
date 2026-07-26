# Zen Liberator (formerly Sovereign Takeout Purger)

## Mission Statement
To provide a forensically sound, cryptographically verified extraction and deduplication pipeline for users escaping the Google Takeout ecosystem. Zen Liberator bypasses Google's "Roach Motel" data-hostage tactics, specifically targeting zero-padded EXIF obfuscation, metadata stripping, and multipart structural clones.

## Core Features
1. **The Phase 1 ETag Sweeper:** Scans initial ingestion for pure byte-for-byte MD5 clones resulting from Google's flattened directory export architecture.
2. **The Phase 2 Forensic Scalpel (EXIF Hash Verifier):** Uses asynchronous HTTP `Range: bytes=0-65535` requests to surgically extract the first 64KB of image headers. By hashing only the EXIF block, it mathematically proves whether a file is a multipart upload ghost (due to 5MB S3 chunking) or a structurally identical file that Google has maliciously zero-padded or tampered with.
3. **The "Glow Up" Quarantine:** Automatically detects and isolates `-edit` / `-edited` Google proprietary "Auto Enhanced" files into a safe quarantine silo, avoiding redundant API vision processing while maintaining the pristine master files for dynamic frontend filtering.
4. **The Code Trash Incinerator:** Actively sweeps and removes developer-level build artifacts (`.wasm`, `.proto`, `.mts`, etc.) that Google Drive silently syncs, preventing them from polluting the media timeline.

## Origin
Conceived by the Architect (Eric Cornett) during the mass 314k-file Pandora Accession backlog processing for MneOS/LifeOS. Built after discovering that Google intentionally padded JPEGs and stripped metadata to break deduplication tools and disincentivize platform migration.

"I didn't set off to out Google Google. I just wanted my shit." - The Architect

## Implementation Roadmap
- [ ] Refactor `dedupe_phase2.mjs` and `dedupe_sovereign_db.mjs` into a unified CLI tool.
- [ ] Add configuration layer for generic S3/B2 bucket credentials.
- [ ] Open-source to the community as the definitive guide to surviving Google Takeout.
