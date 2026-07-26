// services/vantablackShutter.ts
// [ZEN V32] Vantablack Protocol Phase 2: The Librarian's Shutter
// ================================================================
// This module is the SINGLE POINT OF TRUTH for privacy enforcement.
// It sits between raw user data and AI context, ensuring sacred entities
// never leak into creative outputs.
//
// Exposure Modes:
//   WHITE: Full access (Open to AI)
//   GREY:  Mention-only (AI sees only if user types the name)
//   BLACK: Vantablack (Fully redacted - AI is blind)

import type { Tag } from '../types';

// ================================================================
// CORE TYPES
// ================================================================

export type ExposureMode = 'white' | 'grey' | 'black';

export interface ShutterContext {
    blacklistedNames: Set<string>;
    greyNames: Set<string>;
    mentionedNames: Set<string>;
}

// ================================================================
// I. THE VANTABLACK REDACTOR
// ================================================================

/**
 * Get all entity names that are marked BLACK (Vantablack).
 * These names must NEVER be seen by the AI.
 */
export function getBlacklistedNames(tags: Tag[]): Set<string> {
    const blacklist = new Set<string>();

    for (const tag of tags) {
        if (tag.exposure_mode === 'black') {
            // Add the tag's display name
            blacklist.add(tag.name.toLowerCase());

            // If it's a person tag with aliases or nicknames, add those too
            if (tag.type === 'person' && tag.metadata) {
                const meta = tag.metadata as any;
                if (meta.nickname) blacklist.add(meta.nickname.toLowerCase());
                if (meta.aliases) {
                    for (const alias of meta.aliases) {
                        blacklist.add(alias.toLowerCase());
                    }
                }
            }
        }
    }

    console.log(`[VantablackShutter] 🔒 Blacklist loaded: ${blacklist.size} sacred names protected.`);
    return blacklist;
}

/**
 * Get all entity names that are GREY (Mention-only).
 */
export function getGreyNames(tags: Tag[]): Set<string> {
    const greylist = new Set<string>();

    for (const tag of tags) {
        if (tag.exposure_mode === 'grey') {
            greylist.add(tag.name.toLowerCase());

            if (tag.type === 'person' && tag.metadata) {
                const meta = tag.metadata as any;
                if (meta.nickname) greylist.add(meta.nickname.toLowerCase());
            }
        }
    }

    return greylist;
}

/**
 * Extract mentioned entity names from user's current prompt.
 * Used for GREY filtering logic.
 */
export function extractMentionedNames(userPrompt: string, allTagNames: Set<string>): Set<string> {
    const mentioned = new Set<string>();
    const promptLower = userPrompt.toLowerCase();

    for (const name of allTagNames) {
        // Word boundary match to avoid false positives
        const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'i');
        if (regex.test(promptLower)) {
            mentioned.add(name);
        }
    }

    return mentioned;
}

/**
 * Redact all blacklisted names from text.
 * Returns sanitized text safe for AI consumption.
 */
export function redactText(text: string, blacklistedNames: Set<string>): string {
    if (blacklistedNames.size === 0) return text;

    let sanitized = text;

    for (const name of blacklistedNames) {
        // Create case-insensitive regex with word boundaries
        const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi');
        sanitized = sanitized.replace(regex, '[REDACTED_ENTITY]');
    }

    return sanitized;
}

/**
 * Redact conversation history before sending to AI.
 * Returns a deep copy with all BLACK names scrubbed.
 */
export function redactHistory(history: any[], blacklistedNames: Set<string>): any[] {
    if (blacklistedNames.size === 0) return history;

    return history.map(msg => {
        const clone = JSON.parse(JSON.stringify(msg));

        if (clone.parts) {
            for (const part of clone.parts) {
                if (part.text) {
                    part.text = redactText(part.text, blacklistedNames);
                }
            }
        }

        // Handle content-style messages (some providers)
        if (clone.content) {
            if (typeof clone.content === 'string') {
                clone.content = redactText(clone.content, blacklistedNames);
            } else if (Array.isArray(clone.content)) {
                for (const item of clone.content) {
                    if (item.text) {
                        item.text = redactText(item.text, blacklistedNames);
                    }
                }
            }
        }

        return clone;
    });
}

// ================================================================
// II. THE GREY FILTER (Mention-Only Logic)
// ================================================================

/**
 * Filter tags for context inclusion based on exposure mode and Multiverse isolation.
 * - WHITE: Always included
 * - GREY: Only if mentioned in user prompt
 * - BLACK: Never included
 */
export function filterTagsForContext(
    tags: Tag[],
    userPrompt: string,
    activeUniverseId?: string,
    crossoverMode: 'strict' | 'grounded' = 'grounded'
): Tag[] {
    // 1. Enforce Multiverse Universe Sandboxing & Crossover Overlays
    const activeVariantAnchors = new Set<string>();
    const universeFiltered = tags.filter(tag => {
        const tagUniverseIds = tag.universeIds || ['reality'];
        const isFictional = tag.isFiction || false;

        // Standard Reality Mode: Strictly exclude all fictional lore tags
        if (!activeUniverseId || activeUniverseId === 'reality') {
            return !isFictional;
        }

        // Creative / Roleplay sandboxed universes
        const matchesUniverse = tagUniverseIds.includes(activeUniverseId);
        if (crossoverMode === 'strict') {
            return matchesUniverse;
        } else {
            // Grounded Crossover: Include this universe's tags OR real-world memories.
            // If this is a variant, flag its anchor to be suppressed (polymorphic override).
            const isRealityTag = !isFictional || tagUniverseIds.includes('reality');
            const allowed = matchesUniverse || isRealityTag;
            if (allowed && tag.isVariant && tag.anchorTagId) {
                activeVariantAnchors.add(tag.anchorTagId);
            }
            return allowed;
        }
    });

    // Strip out real-world anchor tags that are currently being overridden by active variants
    const resolvedTags = universeFiltered.filter(tag => !activeVariantAnchors.has(tag.id));

    // 2. Perform exposure mode (White / Grey / Black) filtering
    const allNames = new Set(resolvedTags.map(t => t.name.toLowerCase()));
    const mentioned = extractMentionedNames(userPrompt, allNames);

    return resolvedTags.filter(tag => {
        const mode = tag.exposure_mode || 'white';
        const nameLower = tag.name.toLowerCase();

        switch (mode) {
            case 'black':
                // Vantablack: Never leak
                return false;
            case 'grey':
                // Mention-only: Only if explicitly typed by user
                return mentioned.has(nameLower);
            case 'white':
            default:
                // Open: Always include in prompt context
                return true;
        }
    });
}

// ================================================================
// III. THE OUTBOUND AUDIT (Post-Generation Safety Check)
// ================================================================

/**
 * Audit AI response for leaked sacred names.
 * This is the LAST LINE OF DEFENSE before text hits the screen.
 * 
 * @returns Sanitized response with any leaked names replaced
 */
export function auditResponse(
    responseText: string,
    blacklistedNames: Set<string>
): { text: string; leaksDetected: string[] } {
    const leaksDetected: string[] = [];

    if (blacklistedNames.size === 0) {
        return { text: responseText, leaksDetected };
    }

    let sanitized = responseText;

    for (const name of blacklistedNames) {
        const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi');
        const matches = sanitized.match(regex);

        if (matches && matches.length > 0) {
            console.warn(`[VantablackShutter] ⚠️ LEAK DETECTED: AI hallucinated "${name}" — SCRUBBING.`);
            leaksDetected.push(name);
            sanitized = sanitized.replace(regex, '[PROTECTED]');
        }
    }

    if (leaksDetected.length > 0) {
        console.log(`[VantablackShutter] 🛡️ Outbound audit caught ${leaksDetected.length} leaked entities.`);
    }

    return { text: sanitized, leaksDetected };
}

// ================================================================
// IV. SHUTTER CONTEXT BUILDER
// ================================================================

/**
 * Build a complete shutter context for a conversation turn.
 * This is the main entry point for integrating with chat.ts.
 */
export function buildShutterContext(
    tags: Tag[],
    userPrompt: string
): ShutterContext {
    const blacklistedNames = getBlacklistedNames(tags);
    const greyNames = getGreyNames(tags);
    const allTagNames = new Set([...blacklistedNames, ...greyNames]);
    const mentionedNames = extractMentionedNames(userPrompt, allTagNames);

    return {
        blacklistedNames,
        greyNames,
        mentionedNames
    };
}

// ================================================================
// HELPERS
// ================================================================

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
