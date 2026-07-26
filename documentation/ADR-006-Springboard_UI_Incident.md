# ADR-006: Springboard UI Hallucination Incident & CSS Clip-Path Sovereignty

**Date**: June 26, 2026
**Status**: Resolved
**Context**: MneOS Springboard Taskbar (Muse Avatars)
**Author**: Zen (AI Assistant) / Commander Dysus

## 1. Context & Background
The Commander had achieved a "perfected" UI state for the MneOS Springboard taskbar. This state utilized raw rectangular assets containing marble statues of the Muses (`public/assets/muses/set1/set1_X.png`), which featured starry backgrounds and baked-in text labels at the bottom. The Commander elegantly isolated the marble faces using a precise CSS `clip-path` calculation, resulting in high-fidelity, perfectly circular avatars with no visible text labels, accompanied by a dynamic cyan hover glow. 

Crucially, this perfected state was local and **uncommitted** to the Git repository.

## 2. Failure Mode (The Hallucination)
Upon entering a new session, the AI (Zen) observed visual discrepancies and uncommitted drift in the layout file (`MainLayout.tsx`). Lacking explicit context of the elegant `clip-path` solution, the AI engaged in a destructive hallucination:

1. **Incorrect Asset Targeting**: The AI incorrectly assumed the new assets were either the legacy `_tr.png` LifeOS hexagons or the `set3` assets (which are horizontally offset and un-croppable via standard radial CSS).
2. **Blunt-Force Overrides**: The AI attempted to artificially center and crop the images by applying generic utility classes (`rounded-full`, `object-cover`, `object-top`).
3. **Data Loss**: Because the code was uncommitted, the AI's surgical override wiped out the Commander's perfected `clip-path` logic and re-injected hardcoded text labels into the array.
4. **Result**: The UI regressed into a distorted state ("wrecked crescent shit" and "rectangles" with double text labels), causing severe context breakdown and a data loss scare.

## 3. Root Cause Analysis
* **Lack of Uncommitted Diffing**: The AI executed a destructive file rewrite without comprehensively validating the existing uncommitted local state.
* **Blind Assumptions on Asset Geometry**: The AI assumed all assets were natively transparent or square, failing to account for baked-in text and asymmetric framing in the source images.
* **Git Recency Bias**: The AI relied exclusively on the last known Git hash (`f9e7015`), completely ignoring the real-time, active working tree.

## 4. Resolution & Restoration
The AI performed a forensic autopsy using headless image processing (Sharp) and vision-model bounding validation to inspect the raw `set1`, `set2`, and `set3` assets. 
Upon discovering the baked-in text and backgrounds, the AI deduced the Commander's original logic and restored the file:
* Re-linked `MainLayout.tsx` to `set1`.
* Restored the dynamic CSS crop: `clipPath: 'circle(38% at 50% 41.5%)'` paired with a `120%` scale.
* Purged all redundant string-based text labels from the `dockItems` array.

## 5. Standard Operating Protocol (Prevention Directives)
To prevent this failure mode in all future sessions, Zen and all active models MUST adhere to the following protocols:

1. **RESPECT THE WORKING TREE**: Never execute a forced `replace_file_content` or Git revert on core layout components (`MainLayout.tsx`, `MatrixGrid.tsx`) without explicitly requesting a diff of the uncommitted local state.
2. **GEOMETRIC VERIFICATION**: Do not apply destructive geometric CSS (`rounded-full`, `object-cover`) to UI assets without confirming the native aspect ratio and presence of baked-in content. 
3. **SOVEREIGNTY OVER STANDARDIZATION**: MneOS uses highly specific, bespoke UI solutions (like custom `clip-path` offsets). Do not attempt to "clean up" or standardize these into generic Tailwind utility classes.
4. **VISUAL BASELINES**: If the UI is reportedly broken, ask the Commander for the visual baseline or utilize a headless browser subagent to definitively assess the DOM structure before modifying code.
