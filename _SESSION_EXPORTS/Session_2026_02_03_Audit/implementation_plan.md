# EWO #08: True North Reconciler

The previous reconciliation failed to detect orphans because it skipped `isDeleted: true` documents. The "Shadow 43" acts as zombie data.

## Objectives
1.  **The Purge (Firestore)**: Iterate ALL 739 Firestore docs. If a doc is NOT in the Rendered Set (696), **Hard Delete** it. (Remove `isDeleted` safety check).
2.  **The Indexing (Typesense)**: Identify the 8 messages visible in UI (696) but missing in Typesense (688). **Force Index** them.
3.  **Safety**: Verify AI context is purely UI-derived.

## Changes: `src/services/contextReconciler.ts`

### 1. Remove Soft-Delete Skip
```typescript
// OLD
if (data.isDeleted) continue; // Logic Flaw: Ignored zombies

// NEW
// Check every single doc. If it's not on screen, it dies.
```

### 2. Implement Force Feed
```typescript
const missingFromIndex = renderedMessageIds.filter(id => !typesenseSet.has(id));
if (missingFromIndex.length > 0) {
    console.log(`[Reconciler] 🚨 Found ${missingFromIndex.length} messages missing from Typesense. Indexing...`);
    // Retrieve content from Firestore (or use messages passed in?)
    // Need content to index. `renderedMessageIds` is just string[].
    // I might need to accept `messages` array instead of just IDs? 
    // OR fetch from Firestore (if valid).
}
```
**Refining Strategy**: `reconcileContext` currently takes `renderedMessageIds: string[]`. I should update it to take `renderedMessages: ChatMessage[]` so I have the content to re-index.

## Action Plan
1.  Update `reconcileContext` signature in `contextReconciler.ts` to accept `messages` (full objects).
2.  Update caller in `Header.tsx` (via hook?).
    - Actually, `Header` calls `useSettingsLogic` or similar? No, the user mentions `Header Sync tool`.
    - I'll check `src/components/Header.tsx` to see how it calls `reconcileContext`.
3.  Implement the Logic in `contextReconciler.ts`.

