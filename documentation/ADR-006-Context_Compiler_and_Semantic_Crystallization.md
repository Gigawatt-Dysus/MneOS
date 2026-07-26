# ADR-006: Semantic Crystallization and Context Compilation

**Date:** 2026-06-24
**Status:** Accepted
**Architect:** Commander Dysus / Zen

## Context & The "Interpretative Drift" Problem
When feeding historical logs, narratives, and contextual metadata into frontier LLM Chat Engines (like Grok-4.3 or Gemini), standard RAG architectures pull raw text and pass it directly into the context window at generation time. This introduces a fatal flaw: **Interpretative Drift**.

Due to fluctuations in temperature sampling, prompt structure, and attention degradation over massive context lengths, the LLM will interpret the exact same 5,000-word prose differently on Tuesday than it did on Monday. Furthermore, sequential text causes the attention heads to blur causality (the "Man Bites Dog" inversion) and wastes thousands of tokens on redundant linguistic filler (stop words, duplicate vision tags).

Initially, we considered creating a new `MneTag` class to package these "Context Nuggets." However, this led to structural bloat and replicated the existing Tag ontology.

## Decision
We are moving away from runtime narrative interpretation and shifting to **Compile-Time Semantic Crystallization**. 

1. **The Universal Directive:**
   Instead of a dedicated "MneTag", we have promoted `aiDirective?: string` and `compiledContext?: string` to the `BaseTag` interface. Every Tag (Person, Place, Event, Concept) in MneOS is now inherently an AI Context Nugget. 

2. **The Context Compiler (DAG / Timeline Log):**
   We have built `contextCompiler.ts`. When a Tag is requested to compile (or saves), it sweeps all attached `mediaIds`. Instead of outputting prose, it deterministically structures the data into a **Directed Acyclic Graph (DAG)** or an **Anchor-Based Interval Timeline** (`[t=2026-06-15]: Event`).

3. **Unique Entity Cloud (Token Deduplication):**
   All Azure Vision tags, keywords, and OCR extractions across all media attached to the Tag are mathematically flattened into a Javascript `Set`. This strips out duplicate tokens entirely. If "SeaWorld" appears in 50 photos, it burns only 1 token in the context prompt.

4. **Rolling Crystallization (The SSOT):**
   The compiled JSON/DAG matrix is saved natively into the Tag document (`tag.compiledContext`). When Erato (Chat) encounters a `@mention` for the Tag, it bypasses the database media loops and directly injects this pre-compiled, mathematically unshifting block into the prompt.

## Consequences
* **Positive:** Infinite Context scaling. Zero API cost for visual metadata processing during chat. Un-invertible causal logic that forces the LLM to understand exact timelines without narrative hallucination. The memory is physically "anchored."
* **Positive:** Token arbitrage. A 5,000-word historical event is compressed into a ~200 token semantic logic block.
* **Negative:** Requires an explicit compile step when a Tag's media or narrative significantly changes.

## Future Expansion: Visual Caching (The 3D Matrix)
As frontier Vision Models mature, this compilation pipeline is architected to eventually bypass text altogether. The server will draw the State-Transition Matrix as a physical 2D Image (or 3D Voxel Graph) and pass the image URL directly to the Vision LLM, taking advantage of flat-rate image tile pricing for virtually infinite context injection.

*Ref: "A caveman confronted by a tricorder." — Captain Varley*
