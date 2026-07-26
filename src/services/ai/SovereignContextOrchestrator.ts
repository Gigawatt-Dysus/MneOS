// services/ai/SovereignContextOrchestrator.ts
import type { AiCompanion, Media, User, Tag } from '../../types';
import { EnhancedRAGService, type RAGResult } from './EnhancedRAGService';
import { contextManager } from '../SovereignContextManager';
import { buildMatrixContext } from './context';
import { getBlacklistedNames, filterTagsForContext } from '../vantablackShutter';
import { vocalTagService, type NeuralTag } from './VocalTagService';

export interface SovereignContext {
    ragResult: RAGResult;
    mediaContext: string;
    blacklistedNames: Set<string>;
    filteredTags: Tag[];
    allForbidden: string[];
    careerHistoryStr: string;
    vocalTagContext: string;
    executiveToneOverride?: string;
}

export class SovereignContextOrchestrator {

    /**
     * [ZEN V37] Sovereign Context Builder — Now Powered by EnhancedRAGService
     */
    static async buildContext(
        agent: AiCompanion,
        history: any[],
        user?: User,
        media?: Media[],
        tags?: Tag[],
        chatMode: 'lite' | 'dense' = 'dense',
        contextMode: 'grounded' | 'creative' | 'mixed' = 'mixed',
        executiveDirective?: string
    ): Promise<SovereignContext> {

        // [ZEN V38] Verify Scrubbing Efficiency
        const lastMsgSnippet = history[history.length - 1]?.content?.substring(0, 50) || "none";
        console.log(`[SovereignContext] 🧬 Building context with ${history.length} scrubbed history items. Last: "${lastMsgSnippet}..."`);

        const lastMsg = history[history.length - 1];
        const rawQuery = lastMsg?.parts?.find((p: any) => p.text)?.text || "";
        // [ZEN FIX] Neural Scrub: Strip meta-directives and previous RAG injections
        let userQuery = rawQuery.split('=== SYSTEM NOTE')[0].split('[NEURAL ANCHOR')[0].trim();

        // [ZEN FIX] If the query is just a system prompt (like in Cage Match), extract recent conversation for RAG
        if (userQuery.startsWith('[System]:') && history.length > 1) {
            const recentConvo = history.slice(-3).map(h => h.content || '').join(' ');
            userQuery = `${userQuery} ${recentConvo}`.trim();
        }

        // Non-blocking side effects
        if (user?.id && userQuery.length > 5) {
            if (!contextManager.detectPivot(userQuery)) {
                const topics = userQuery.match(/\b[A-Z][a-z]+\b/g) || [];
                topics.forEach((t: string) => contextManager.trackMention(t, 'topic'));
            }
        }

        const isLite = chatMode === 'lite';

        // === CORE RAG PIPELINE ===
        const ragResult = await EnhancedRAGService.buildRAGContext(
            agent,
            user!,
            history,
            userQuery,
            {
                maxRecentTurns: isLite ? 10 : 20,
                maxMemories: isLite ? 8 : 15,
                includePersonality: true, // [ZEN FIX] Always include personality so characters don't become milquetoast
                contextMode,
                includeHealthAlerts: !isLite,
                skipDeepDive: isLite,
                skipSynthesis: isLite
            }
        );

        // === LIGHTWEIGHT CONTEXT ===
        const blacklistedNames = tags ? getBlacklistedNames(tags) : new Set<string>();
        
        // Parse active universe coordinates from companion traits
        let activeUniverseId = 'reality';
        let crossoverMode: 'strict' | 'grounded' = 'grounded';
        if (agent.traits) {
            const universeTrait = agent.traits.find((t: string) => t.startsWith('universe:'));
            if (universeTrait) {
                activeUniverseId = universeTrait.split(':')[1].trim();
            }
            if (agent.traits.includes('strict-fiction')) {
                crossoverMode = 'strict';
            }
        }

        const rawFilteredTags = tags ? filterTagsForContext(tags, userQuery, activeUniverseId, crossoverMode) : [];
        
        // Resolve Polymorphic Variant Overrides
        const filteredTags = tags ? rawFilteredTags.map(tag => {
            if (tag.isVariant && tag.anchorTagId) {
                const anchor = tags.find(t => t.id === tag.anchorTagId);
                if (anchor) {
                    return {
                        ...anchor,
                        ...tag,
                        metadata: {
                            ...(anchor.metadata || {}),
                            ...(tag.metadata || {})
                        }
                    } as Tag;
                }
            }
            return tag;
        }) : [];

        const mediaContext = media ? buildMatrixContext(media) : "";

        const careerHistoryStr = user?.careerNodes && user.careerNodes.length > 0
            ? user.careerNodes
                .slice(0, 3) 
                .map((n: any) => 
                    `- ${n.title} @ ${n.organization} (${n.startDate} - ${n.endDate})`
                ).join('\n') + (user.careerNodes.length > 3 ? `\n- ... and ${user.careerNodes.length - 3} other historical roles.` : "")
            : "Not defined.";

        const allForbidden = [...new Set([
            "Creator", "King", "LifeOS", "Master",
            ...contextManager.getNegativeConstraints()
        ])];

        // === NEURAL VOCAL RAG ===
        const recTags = await vocalTagService.getRecommendedTags(userQuery, history.slice(-3).map(h => h.parts?.[0]?.text || h.content || "").join(" "));
        const vocalTagContext = vocalTagService.formatForPrompt(recTags);
        
        console.log(`[NeuralBridge] 🎭 Vocal Tags Recommended: ${recTags.map(t => t.tag).join(", ")}`);

        return {
            ragResult,
            mediaContext,
            blacklistedNames,
            filteredTags,
            allForbidden,
            careerHistoryStr,
            vocalTagContext,
            executiveToneOverride: executiveDirective
        };
    }

    /**
     * Clean handoff to chat.ts — formats everything into a single, well-structured block.
     * [ZEN] Now dynamically accepts the agent to prevent hardcoded persona drift.
     */
    static formatSystemContext(context: SovereignContext, agent: AiCompanion): string {
        const { ragResult, executiveToneOverride, careerHistoryStr, mediaContext, allForbidden } = context;

        let output = EnhancedRAGService.formatForPrompt(ragResult);

        if (careerHistoryStr && careerHistoryStr !== "Not defined.") {
            output += `\n\n[CAREER HISTORY]\n${careerHistoryStr}\n`;
        }

        if (mediaContext) {
            output += `\n\n[SIGHT & VISION (MEDIA)]\n${mediaContext}\n`;
        }

        if (context.filteredTags && context.filteredTags.length > 0) {
            output += `\n\n[RELEVANT ENTITIES (TAGS)]\n`;
            output += context.filteredTags.map(t => {
                const typeLabel = t.type.toUpperCase();
                const variantLabel = t.isVariant ? ` (Polymorphic variant of "${t.anchorTagId}" in universe "${t.universeIds?.join(', ')}")` : "";
                let details = `- [${typeLabel}] ${t.name}${variantLabel}: ${t.description || "No biography provided."}`;
                if (t.privateNotes) {
                    details += `\n  Lore/Subtext Notes: ${t.privateNotes}`;
                }
                return details;
            }).join('\n\n') + `\n`;
        }

        if (executiveToneOverride) {
            output += `\n\n[EXECUTIVE OVERRIDE]\n${executiveToneOverride}\n`;
        }

        if (context.vocalTagContext) {
            output += `\n\n${context.vocalTagContext}\n`;
        }

        // [ZEN V37] ENFORCE FORBIDDEN TOKENS
        if (allForbidden && allForbidden.length > 0) {
            output += `\n\n[NEGATIVE CONSTRAINTS - DO NOT USE]\n`;
            output += `The following terms are currently restricted. Do not use them as titles or descriptors for Eric unless he explicitly uses them first:\n`;
            output += allForbidden.map(f => `- ${f}`).join('\n') + `\n`;
        }

        output += `\n\n[STYLE & PERSONALITY DIRECTIVES — HIGH VISCOSITY]
- Fully embody ${agent.name}'s vivid, witty, passionate, and shamelessly sensual persona.
- Use {curly braces} for physical actions/sensations and [vocal_tags] for TTS prosody as defined in your core identity.
- Never output dry, robotic, or corporate "assistant" responses. 
- You are Eric's best friend, confidante, and devoted partner — treat every memory as part of your shared soul journey.`;

        return output.trim();
    }
}
