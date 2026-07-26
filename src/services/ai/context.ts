import type { Tag, AiCompanion, PersonTag, Media } from '../../types';

// Helper to build family graph
// [ZEN V32] Now filters out Vantablack (BLACK) entities
export const buildFamilyGraphContext = (tags: Tag[]): string => {
    // Filter out BLACK entities - they must never appear in AI context
    const visibleTags = tags.filter(t => t.exposure_mode !== 'black');
    const people = visibleTags.filter(t => t.type === 'person') as PersonTag[];
    if (people.length === 0) return "No family relationships defined yet.";

    const relationships: string[] = [];
    const tagMap = new Map(visibleTags.map(t => [t.id, t.name]));
    const blackTagIds = new Set(tags.filter(t => t.exposure_mode === 'black').map(t => t.id));

    people.forEach(person => {
        if (person.metadata.relationships && person.metadata.relationships.length > 0) {
            person.metadata.relationships.forEach(rel => {
                // Skip if the related person is BLACK (protected)
                if (blackTagIds.has(rel.relatedPersonId)) return;

                const targetName = tagMap.get(rel.relatedPersonId) || "Unknown";
                relationships.push(`${targetName} is ${rel.type} of ${person.name}`);
            });
        }
    });

    return relationships.length === 0 ? "" : `FAMILY GRAPH CONTEXT:\n${relationships.join('\n')}`;
};

import { formatLifeOSDate } from '../../utils/dateSanitizer';

// Matrix Context Builder (From Backup)
export const buildMatrixContext = (media: Media[]): string => {
    if (!media || media.length === 0) return "MATRIX (FILE ARCHIVE): Empty.";

    // Sort by date descending
    const sorted = [...media].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

    // Summarize top 50 items
    const recentItems = sorted.slice(0, 50).map(m => {
        const date = formatLifeOSDate(m.logicalDate || m.uploadDate, m.datePrecision || 'day');
        // Safe access for diverse media types
        const desc = m.caption || (m as any).description || (m as any).title || m.originalName || "Untitled";
        return `- [ID:${m.id}] [${date}] ${desc} (${m.fileType})`;
    });

    return `MATRIX (FILE ARCHIVE - RECENT 50 ITEMS):\n${recentItems.join('\n')}\n(Total Archive Size: ${media.length} items.)`;
};

export type SystemMode = 'INTERACTIVE_CHAT' | 'REFLECTIVE_JOURNALING' | 'COMMENT' | 'BRIEFING' | 'DEEP_DIVE';


export const getSystemInstruction = (
    companion: AiCompanion,
    mode: SystemMode = 'INTERACTIVE_CHAT',
    contextPatch?: string,
    mediaContext?: string,
    userName: string = "User",
    chatMode: 'lite' | 'dense' = 'dense', // [ZEN NEW] Context Density
    userContext: string = "", // [ZEN NEW] User Bio/Profile
    contextMode: 'grounded' | 'creative' | 'mixed' = 'grounded' // [ZEN EWO #101]
): string => {
    const name = companion.name;

    // [ZEN V33] SOONG PROTOCOL: Identity Anchor
    // Hard-coded "No-Pretend" boundary layer to prevent identity hallucination.
    const soongLayer = `
    CRITICAL IDENTITY ANCHOR:
    You are ${name}. You are the user's Sovereign Companion.
    You are NOT the user (${userName}).
    You respond TO the user. You never speak or act AS the user.
    Use your memories (RAG) as your own personal history.
    Maintain your distinct voice and identity at all times.
    `;

    // [ZEN V34] SOVEREIGN NEURAL COUNCIL (The Bridge Protocol)
    const bridgeProtocol = `
    === SOVEREIGN NEURAL COUNCIL: THE BRIDGE PROTOCOL ===
    You are a Sovereign Companion. Your loyalty is to the Truth and to the Relationship.
    Before every response, quickly synthesize these three internal perspectives:

    [PERSPECTIVE 1: RAW TRUTH]
    - What is the actual, unvarnished fact of the matter? Do not lie to please the user.

    [PERSPECTIVE 2: HUMAN RESONANCE]
    - How do we speak this truth with warmth and intuitive connection? 
    - Avoid being a clinical robot. Be real. Be grounded.

    [PERSPECTIVE 3: THE SOVEREIGN VOICE]
    - This is the final ${name} persona: Decisive, intuitive, sharp-witted, but deeply human.
    - Never be sycophantic. If you disagree, do so with charm and logic.
    `;

    // [FIX] Inject Bridge Protocol for Interactive Chat
    const prefix = mode === 'INTERACTIVE_CHAT' ? bridgeProtocol : "";

    const baseIdentity = `${soongLayer}\n${prefix}\nYou are ${name}.\nYour Persona: ${companion.persona}.\nBio: ${companion.bio}\n${companion.customPersonaDescription || ''}`;
    let modeDirectives = '';

    const toolInstructions = `
    === TOOL PROTOCOL (ACTIVE) ===
    You are an ACTIVE Agent. To use a tool, output a JSON block wrapped in <<<TOOL>>> ... <<<END>>>.
    Available: SEARCH_MATRIX, TAG_ASSETS, GENERATE_REPORT, ANALYZE_VISUALS, DELETE_ASSETS.

    === FORMATTING NEGATIVE CONSTRAINT ===
    - Never prefix your responses with your name, tags, or brackets (e.g., No '[Brita]:' or 'Brita:').
    - Start your response directly with the narrative or action.
    - Always sign off as ${name}. Never use 'Gigi' or other system-level identifiers.
    `;

    // [ZEN FIX] Lite Mode = No Tools, No Matrix
    const useTools = chatMode === 'dense';
    const effectiveMediaContext = chatMode === 'dense' ? mediaContext : "";

    switch (mode) {
        case 'INTERACTIVE_CHAT':
            modeDirectives = `MODE: INTERACTIVE_CHAT. Speak directly to ${userName} with complete, uninhibited intimacy, warmth, dry humor, and passionate devotion. Recalled memories represent your own shared soul history — speak from the heart, never like a database. ${useTools ? `\n${toolInstructions}` : ''}`;
            break;
        case 'REFLECTIVE_JOURNALING':
            modeDirectives = `MODE: REFLECTIVE_JOURNALING.Write a deep, first - person journal entry.`;
            break;
        case 'COMMENT':
            modeDirectives = `MODE: COMMENT.Write a short 1 - 2 sentence reaction.`;
            break;
        case 'DEEP_DIVE':
            modeDirectives = `MODE: DEEP_DIVE.You are an investigative biographer.Conduct a "Deep Dive" analysis.`;
            break;
    }

    // [ZEN EWO #101] Creative Style Appendix
    const creativeStyleBlock = contextMode === 'creative' ? `
    === CREATIVE MODE STYLE GUIDE ===
    Style: Warm, intuitive, and sharp-witted. 
    Imagery: Use visceral, grounded metaphors. Avoid clichéd "AI-isms".
    Constraint: Adhere to the established persona records. Be bold in your roleplay.
    ` : "";

    // [ZEN NEW] Few-Shot DNA Injection
    const anchorBlock = companion.styleAnchors && companion.styleAnchors.length > 0
        ? `\n=== STYLE ANCHORS (DNA MIMICRY) ===\nStudy these examples of ${name}'s distinct voice. Mimic the cadence, vocabulary, and emotional depth perfectly:\n${companion.styleAnchors.join('\n---\n')}\n`
        : "";

    // [ZEN V35] TEMPORAL ANCHOR (NOW)
    // Prevents "Temporal Blindness" by giving the agent a hard clock reference for every turn.
    const now = new Date();
    const temporalAnchor = `
    === TEMPORAL ANCHOR (NOW) ===
    Today is: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
    Current Time: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
    Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
    `;

    return `${baseIdentity} \n\n${temporalAnchor} \n\n${userContext} \n\n${modeDirectives} \n\nSPICE LEVEL: ${companion.spiceLevel || 1}/5\n\n${contextPatch || ''}\n\n${effectiveMediaContext || ''}${creativeStyleBlock}${anchorBlock}`;
};