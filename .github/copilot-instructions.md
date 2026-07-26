# Project GIGI - Copilot System Instructions

This file guides all GitHub Copilot AI interactions within the Project GIGI workspace.

## 🛠️ Technology Stack
- **Frontend**: React + Vite + TypeScript (Tailwind CSS, Tiptap, Three.js).
- **Backend**: Firebase (Firestore, Cloud Functions in `functions/`).
- **Package Manager**: `npm` (never `yarn` or `pnpm`).

## ⚠️ Core Directives & Restrictions
1. **AI Model Usage**: 
   - **Never** suggest or use Google Gemini models or the `@google/genai` library.
   - **Exclusively** suggest and utilize **xAI Grok models (4.1x and up)**.
2. **Quality & Completeness**:
   - **Never stub functions** (e.g. empty return bodies) without explicit user permission. If logic is unimplemented, throw an error or log a prominent "Not Implemented" warning.
   - Do not optimize, compact, or minify code. Maintain spacing, descriptive naming, and existing inline comments.
3. **Architecture & Refactoring**:
   - If any file exceeds 600 lines (e.g., `App.tsx`), suggest modular "barrel" refactoring to split out components.
   - Always use **React Portals** for modals and overlays to prevent Z-index stacking collisions.
   - Wrap interactive AI cycles in `aiStateBridge.setThinking(true/false)` for the UI heartbeat.
4. **Environment Constraints**:
   - Avoid executing or proposing the standard `grep` command-line utility, as it is unavailable on this developer workstation's terminal environment.
