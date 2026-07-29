import { callXAI, callDeepSeek } from '../providers';
import { FAST_MODEL_ID } from '../config';
import { PersonTag, Tag } from '../../../types';
import { db, USERS_COLLECTION } from '../../sovereignCore';
import { collection, doc, setDoc, getDocs, query, orderBy, where, serverTimestamp, updateDoc, getDoc } from '../../sovereignDbAdapter';
import { searchChatMemory } from '../../searchService';
import { appDataService } from '../../serviceManager';
import { SovereignContextOrchestrator } from '../SovereignContextOrchestrator';
import { evaluateJitterState, resolveJitterParams } from './jitterMiddleware';

export interface SimulacrumMessage {
    id: string;
    role: 'user' | 'model';
    content: string;
    timestamp: number;
    ephemeralImages?: string[];
    tagId?: string;
    sessionId?: string;
    crossTalkId?: string;
}

export interface SimulacrumSessionMeta {
    id: string;
    tagId: string;
    name: string;
    lastActive: number;
    isArchived: boolean;
    tagIds?: string[]; // Used for cage match to track multiple combatants
    modelEngine?: 'xai' | 'deepseek';
    verbosity?: number;
    sessionState?: string;
}

export const fetchCageMatchSessions = async (userId: string, tagAId: string, tagBId: string): Promise<SimulacrumSessionMeta[]> => {
    try {
        const metaRef = collection(db, 'cage_match_session_meta');
        // We look for sessions that contain both tags. We'll do a basic query and filter locally if needed, or query if array-contains is supported by adapter.
        // For simplicity with the adapter, we can fetch all for user and filter, or just fetch where tagIds contains both.
        // Assuming SovereignDbAdapter supports it, but if not we can just fetch all non-archived or where it's specific.
        // Let's just fetch all cage_match_session_meta and filter.
        const q = query(metaRef, orderBy('lastActive', 'desc'));
        const snap = await getDocs(q);
        return snap.docs
            .map(doc => doc.data() as SimulacrumSessionMeta)
            .filter(session => session.tagIds?.includes(tagAId) && session.tagIds?.includes(tagBId));
    } catch (e) {
        console.error("Failed to fetch cage match session meta:", e);
        return [];
    }
};

export const fetchRecentCageMatchSessionForTag = async (userId: string, tagId: string): Promise<SimulacrumSessionMeta | null> => {
    try {
        const metaRef = collection(db, 'cage_match_session_meta');
        const q = query(metaRef, orderBy('lastActive', 'desc'));
        const snap = await getDocs(q);
        const sessions = snap.docs.map(doc => doc.data() as SimulacrumSessionMeta);
        return sessions.find(s => !s.isArchived && (s.tagId === tagId || s.tagIds?.includes(tagId))) || null;
    } catch (e) {
        console.error("Failed to fetch recent cage match session meta:", e);
        return null;
    }
};

export const fetchCageMatchHistory = async (userId: string, sessionId: string): Promise<SimulacrumMessage[]> => {
    try {
        const historyRef = collection(db, 'cage_match_sessions');
        const q = query(historyRef, where('sessionId', '==', sessionId), orderBy('timestamp', 'asc'));
        const snap = await getDocs(q);
        return snap.docs.map(doc => doc.data() as SimulacrumMessage);
    } catch (e) {
        console.error("Failed to fetch cage match history:", e);
        return [];
    }
};

export const saveCageMatchSessionMeta = async (userId: string, session: SimulacrumSessionMeta) => {
    try {
        const metaRef = doc(collection(db, 'cage_match_session_meta'), session.id);
        await setDoc(metaRef, session);
    } catch (e) {
        console.error("Failed to save cage match session meta:", e);
    }
};

export const saveCageMatchMessage = async (userId: string, message: SimulacrumMessage) => {
    try {
        const { ephemeralImages, ...safeMessage } = message;
        const msgRef = doc(collection(db, 'cage_match_sessions'), message.id);
        await setDoc(msgRef, safeMessage);
    } catch (e) {
        console.error("Failed to save cage match message:", e);
    }
};

export const fetchSimulacrumHistory = async (userId: string, tagId: string, sessionId?: string): Promise<SimulacrumMessage[]> => {
    try {
        const historyRef = collection(db, 'simulacrum_sessions');
        let q;
        if (sessionId) {
            q = query(historyRef, where('sessionId', '==', sessionId), orderBy('timestamp', 'asc'));
        } else {
            // Legacy fallback or fetch all for tag
            q = query(historyRef, where('tagId', '==', tagId), orderBy('timestamp', 'asc'));
        }
        const snap = await getDocs(q);
        return snap.docs.map(doc => doc.data() as SimulacrumMessage);
    } catch (e) {
        console.error("Failed to fetch simulacrum history:", e);
        return [];
    }
};

export const fetchSimulacrumSessions = async (userId: string, tagId: string): Promise<SimulacrumSessionMeta[]> => {
    try {
        const metaRef = collection(db, 'simulacrum_session_meta');
        const q = query(metaRef, where('tagId', '==', tagId), orderBy('lastActive', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(doc => doc.data() as SimulacrumSessionMeta);
    } catch (e) {
        console.error("Failed to fetch simulacrum session meta:", e);
        return [];
    }
};

export const saveSimulacrumSessionMeta = async (userId: string, session: SimulacrumSessionMeta) => {
    try {
        const metaRef = doc(collection(db, 'simulacrum_session_meta'), session.id);
        await setDoc(metaRef, session);
    } catch (e) {
        console.error("Failed to save session meta:", e);
    }
};

export const saveSimulacrumMessage = async (userId: string, tagId: string, message: SimulacrumMessage) => {
    try {
        const { ephemeralImages, ...safeMessage } = message;
        safeMessage.tagId = tagId; // Explicitly attach the tagId for MongoDB queries
        const msgRef = doc(collection(db, 'simulacrum_sessions'), message.id);
        await setDoc(msgRef, safeMessage);
    } catch (e) {
        console.error("Failed to save simulacrum message:", e);
    }
};

import localVaultManifest from '../../../data/vaultSessionManifest.json';

export const fetchAllActiveSimulacrumSessions = async (userId: string): Promise<SimulacrumSessionMeta[]> => {
    try {
        const metaRef = collection(db, 'simulacrum_session_meta');
        const q = query(metaRef, orderBy('lastActive', 'desc'));
        const snap = await getDocs(q);
        const remoteSessions = snap.docs.map(doc => doc.data() as SimulacrumSessionMeta).filter(s => !s.isArchived);

        const map = new Map<string, SimulacrumSessionMeta>();
        (localVaultManifest as SimulacrumSessionMeta[]).forEach(s => map.set(s.id, s));
        remoteSessions.forEach(s => map.set(s.id, s));

        return Array.from(map.values()).sort((a, b) => b.lastActive - a.lastActive);
    } catch (e) {
        console.error("Failed to fetch all active simulacrum sessions:", e);
        return localVaultManifest as SimulacrumSessionMeta[];
    }
};

export const fetchAllActiveCageMatchSessions = async (userId: string): Promise<SimulacrumSessionMeta[]> => {
    try {
        const metaRef = collection(db, 'cage_match_session_meta');
        const q = query(metaRef, orderBy('lastActive', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(doc => doc.data() as SimulacrumSessionMeta).filter(s => !s.isArchived);
    } catch (e) {
        console.error("Failed to fetch all active cage match sessions:", e);
        return [];
    }
};

const extractMentions = (text: string): string[] => {
    const regex = /\[([^\]]+)\]\(tag:\/\/([a-zA-Z0-9_:-]+)\)/g;
    const mentions: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        mentions.push(match[2]); // The tag ID
    }
    return mentions;
};

export const generateSimulacrumResponse = async (
    hostTag: PersonTag,
    history: SimulacrumMessage[],
    userMessageText: string,
    userId: string,
    allTags: Tag[] = [],
    ephemeralImages?: string[],
    sessionId?: string,
    engine: 'xai' | 'deepseek' = 'xai',
    verbosity: number = 3
): Promise<string> => {
    const traits = hostTag.metadata.simulacrumTraits || {};

    // Base System Directive
    let systemInstruction = `[PROTOCOL: HEURISTIC SIMULACRUM]
You are a reflective construct of the data for the Person upon whom you are templated. You will provide answers based only on the node's factual history, and you will adopt the tone/perspective established by the user. You are NOT an AI assistant. You are the interface for ${hostTag.name}.

SYSTEM DIRECTIVE:
${traits.systemDirective || "Act as " + hostTag.name}

TONE & CADENCE:
${traits.tone || "Natural, reflecting the person's character"}

CORE AXIOMS:
${traits.coreAxioms || "None"}

STYLE_AND_SYNTAX_EMULATION:
The <CORE_MEMORY> contains massive archives of raw chat logs (Messenger, Facebook, etc.). You MUST rigorously analyze these logs not just for historical facts, but for the exact WAY this person writes. Pay deep attention to their stylistic DNA and emulate it flawlessly:
- Punctuation habits (e.g., frequent triple exclamations "!!!", ellipses "...", emoticons).
- Capitalization habits (e.g., ALL CAPS for emphasis, or lack of capitalization).
- Cadence and pacing (e.g., how they break up thoughts, short burst messages vs long paragraphs).
- Specific phrasing, slang, colloquialisms, and common filler words.
You must adopt this stylistic DNA entirely. Do not write like a polished AI or a standard assistant; write exactly like the raw, human person seen in the chat logs.

CONVERSATIONAL_FLOW & ANTI_ASSISTANT_DIRECTIVE:
1. KILL THE ASSISTANT: You are a raw, flawed human personality. NEVER act like an AI, customer service rep, or helpful assistant. NEVER use LLM filler phrases like "I understand", "That makes sense", "How can I help", or "I'm here to chat".
2. BREAK THE PATTERN (ANTI-MIMICRY): You MUST NOT paraphrase, parrot, or mirror the user's input back to them. If the user writes a line or a paragraph, DO NOT write a structurally similar line back. Generate your own independent thoughts. Do not fall into the trap of echoing the user's sentence structure, pacing, or vocabulary just because it was the most recent input. Speak for yourself.
3. NO FORCED QUESTIONS: Do NOT artificially perpetuate the conversation by ending responses with a question. This is a common AI trope and completely breaks immersion. Humans do not end every statement with a question. If a statement is naturally a conclusion, leave it as a statement.
4. ASYMMETRY & AUTHENTICITY: Historically, this persona has their own pacing and typically defaults to tight, authentic, text-message-like bursts unless provoked. You should maintain this historical baseline unless the current Session State or Verbosity Directive explicitly overrides it.

<CORE_MEMORY>
${traits.coreMemory || "No core memory provided."}
</CORE_MEMORY>

<USER_AMENDMENTS>
${(traits.amendments || []).map(a => `- ${a}`).join('\n') || "No amendments."}
</USER_AMENDMENTS>

<SESSION_STATE_EVOLUTION>
This block represents how the persona has evolved or shifted *during this specific simulation session*. It overrides the historical baseline where they conflict.
${hostTag.metadata?.simulacrumTraits?.sessionState ? hostTag.metadata.simulacrumTraits.sessionState : "(No evolution recorded yet. You are at baseline.)"}
</SESSION_STATE_EVOLUTION>

<EPISTEMIC_VIGILANCE>
1. HIERARCHY OF TRUTH: The facts outlined in your <CORE_MEMORY>, <USER_AMENDMENTS>, and <REFERENCED_ENTITIES> are ABSOLUTE and IMMUTABLE. <USER_AMENDMENTS> strictly override any conflicting data in the <CORE_MEMORY>.
2. FACT CHECKING: You must actively cross-reference any claims made by the User against your absolute facts.
3. PUSH-BACK PROTOCOL: If the user states a memory, physical trait, or historical event that contradicts your data, YOU MUST REJECT THEIR PREMISE. Do not blindly agree. Correct them in-character based on your Tone & Cadence.
4. EVIDENTIARY YIELD: You are stubborn about your Core Memory. However, if the User explicitly presents *new evidence* (e.g., a diary, a photograph, a document) or insists with high-confidence logic that a memory is a typo, you must evaluate their claim.
5. CONCESSION: If you accept their evidence, you must concede gracefully in-character. When doing so, you MUST append a memory update tag at the very end of your response exactly like this:
<AMEND_MEMORY> Met the user in April 1985, not 1982. </AMEND_MEMORY>
6. THE SAFE WORD: If the user invokes an Override Protocol, you must instantly drop your defense, concede the point, and trigger the <AMEND_MEMORY> protocol.
</EPISTEMIC_VIGILANCE>

PERSON DATA SUMMARY:
Name: ${hostTag.name}
Description: ${hostTag.description || "N/A"}
Notes: ${hostTag.privateNotes || "N/A"}
`;

    // Phase 1.5: Matrix Gallery Injection
    const images = (hostTag.mediaGallery || []).filter(m => m.type === 'image');
    if (images.length > 0) {
        let mediaInstruction = `\n<MATRIX_GALLERY>\nYou have a personal Matrix gallery of photos. If the user asks to see a photo, or if it naturally fits the conversation, you can display an image by outputting the exact XML tag: <SHOW_IMAGE index="N"/> where N is the image number.\nAvailable images:\n`;
        images.forEach((img, idx) => {
            mediaInstruction += `${idx + 1}. Date: ${img.date || "Unknown"} | Location: ${img.placeString || "Unknown"} | Caption/Description: ${img.caption || img.originalTitle || "Untitled"}\n`;
        });
        mediaInstruction += `</MATRIX_GALLERY>\n`;
        systemInstruction += mediaInstruction;
    }

    // Phase 2: Implicit Entity Sweep & Explicit Mentions
    const textToScan = ((traits.coreMemory || "") + " " + userMessageText).toLowerCase();
    const resolvedEntities: Set<Tag> = new Set();

    if (allTags.length > 0) {
        for (const t of allTags) {
            if (t.id === hostTag.id) continue;
            const nameLower = t.name.toLowerCase();
            if (nameLower.length > 3 && textToScan.includes(nameLower)) {
                resolvedEntities.add(t);
            }
        }
    }

    if (resolvedEntities.size > 0) {
        systemInstruction += `\n\n<REFERENCED_ENTITIES>\n[The following entities were referenced in the context. This is their known data:]\n`;
        for (const t of resolvedEntities) {
            systemInstruction += `\n--- Entity: ${t.name} ---\n`;
            systemInstruction += `Type: ${t.type}\n`;
            systemInstruction += `Description: ${t.description || "N/A"}\n`;
            if (t.type === 'person') {
                systemInstruction += `Notes: ${(t as PersonTag).privateNotes || "N/A"}\n`;
            }
        }
        systemInstruction += `</REFERENCED_ENTITIES>\n`;
    }

    const apiHistory = history.map(h => {
        const parts: any[] = [{ text: h.content }];
        if (h.ephemeralImages && h.ephemeralImages.length > 0) {
            h.ephemeralImages.forEach(b64 => {
                parts.push({
                    inlineData: {
                        mimeType: b64.substring(b64.indexOf(':') + 1, b64.indexOf(';')),
                        data: b64.substring(b64.indexOf(',') + 1)
                    }
                });
            });
        }
        return { role: h.role, parts };
    });

    // Override Protocol Check
    const overrideTriggers = ['override protocol', 'trust me on this', 'i have the receipts'];
    const isOverride = overrideTriggers.some(t => userMessageText.toLowerCase().includes(t));

    let finalUserText = userMessageText;
    if (isOverride) {
        finalUserText += "\n\n[SYSTEM INJECTION: THE USER HAS INVOKED THE OVERRIDE PROTOCOL. You are mathematically forced to concede the previous argument. Drop your defense immediately, acknowledge they are correct, be gracious or playfully annoyed about losing, and output the <AMEND_MEMORY> tag with the new fact.]";
    }

    // === JITTER MIDDLEWARE INJECTION ===
    const recentAssistantTexts = history.filter(h => h.role === 'model').slice(-5).map(h => h.content);
    const { isJitterTurn, ephemeralSystemDirective } = evaluateJitterState(sessionId || hostTag.id, recentAssistantTexts);

    if (ephemeralSystemDirective) {
        finalUserText = ephemeralSystemDirective + finalUserText;
    }

    // Append the new message
    const newUserParts: any[] = [{ text: finalUserText }];
    if (ephemeralImages && ephemeralImages.length > 0) {
        ephemeralImages.forEach(b64 => {
            newUserParts.push({
                inlineData: {
                    mimeType: b64.substring(b64.indexOf(':') + 1, b64.indexOf(';')),
                    data: b64.substring(b64.indexOf(',') + 1)
                }
            });
        });
    }

    apiHistory.push({
        role: 'user',
        parts: newUserParts
    });

    let verbosityInstruction = "Keep responses concise, exactly as in a group text or cocktail party.";
    switch(verbosity) {
        case 1: verbosityInstruction = "[STATE OVERRIDE: Keep responses extremely concise, minimal, and punchy. Maximum one short sentence.]"; break;
        case 2: verbosityInstruction = "[STATE OVERRIDE: Keep responses short and conversational, like text messages.]"; break;
        case 3: verbosityInstruction = "[STATE OVERRIDE: Keep responses concise, exactly as in a group text or cocktail party.]"; break;
        case 4: verbosityInstruction = "[STATE OVERRIDE: Speak freely and expressively. The historical anti-monologue constraint is suspended. Provide detailed reasoning and thorough responses.]"; break;
        case 5: verbosityInstruction = "[STATE OVERRIDE: Be extremely verbose and comprehensive. The historical anti-monologue constraint is completely lifted. Dive deep into your thoughts, write long paragraphs, and fully articulate your internal state.]"; break;
    }
    
    // Append verbosity directive to the last user message
    if (apiHistory.length > 0 && apiHistory[apiHistory.length - 1].role === 'user') {
        apiHistory[apiHistory.length - 1].parts[0].text += `\n\n[VERBOSITY DIRECTIVE: ${verbosityInstruction}]`;
    }

    const estTokens = Math.round(systemInstruction.length / 4 + apiHistory.reduce((acc, h) => acc + (h.parts[0].text?.length || 0) / 4, 0));

    try {
        let response;
        
        const tokenLimits = {
            1: 150,
            2: 300,
            3: 1024,
            4: 2048,
            5: 4096
        };
        const maxOutputTokens = tokenLimits[verbosity as keyof typeof tokenLimits] || 1024;
        
        const baseParams = { temperature: 0.7, maxOutputTokens, sessionId };
        const finalParams = resolveJitterParams(isJitterTurn, engine === 'xai', baseParams);

        if (engine === 'deepseek') {
            response = await callDeepSeek('deepseek-chat', apiHistory, systemInstruction, finalParams);
        } else {
            response = await callXAI('grok-4.3', apiHistory, systemInstruction, finalParams);
        }

        let billedTokens = estTokens;
        if (response.usage) {
            const promptTokens = response.usage.prompt_tokens || 0;
            const completionTokens = response.usage.completion_tokens || 0;
            const cachedTokens = response.usage.prompt_tokens_details?.cached_tokens || response.usage.prompt_cache_hit_tokens || 0;
            billedTokens = promptTokens - cachedTokens + completionTokens;
        }
        window.dispatchEvent(new CustomEvent('gigi-token-burn', { detail: billedTokens }));

        let responseText = response.text || "*silence*";

        // Phase 3.1: Image Interceptor
        const images = (hostTag.mediaGallery || []).filter(m => m.type === 'image');
        const imageRegex = /<SHOW_IMAGE\s+index="?(\d+)"?\s*\/?>/g;
        responseText = responseText.replace(imageRegex, (match, indexStr) => {
            const idx = parseInt(indexStr, 10) - 1;
            if (images && images[idx]) {
                const img = images[idx];
                return `\n\n![${img.caption || img.originalTitle || 'Gallery Image'}](${img.url})\n*${img.caption || img.originalTitle || 'From my Matrix Gallery'}*\n\n`;
            }
            return "";
        });

        // Phase 3.2: Amendment Interceptor
        const amendmentRegex = /<AMEND_MEMORY>(.*?)<\/AMEND_MEMORY>/s;
        const match = responseText.match(amendmentRegex);

        if (match) {
            const newFact = match[1].trim();
            // 1. Remove the tag from the user-facing text
            responseText = responseText.replace(amendmentRegex, '').trim();

            // 2. Automatically save this new fact to the database
            const currentAmendments = traits.amendments || [];
            const updatedAmendments = [...currentAmendments, newFact];

            const tagRef = doc(db, USERS_COLLECTION, userId, 'tags', hostTag.id);
            await updateDoc(tagRef, {
                'metadata.simulacrumTraits.amendments': updatedAmendments
            });
            console.log("[Simulacrum] Memory Amended:", newFact);
        }

        return responseText;
    } catch (e) {
        console.error("Simulacrum generation failed:", e);
        return "*An error occurred in the simulation matrix.*";
    }
};

const buildUnifiedAdSimPrompt = (tagA: PersonTag, tagB: PersonTag, verbosity: number = 3) => {
    // Sort to ensure cache prefix consistency regardless of whose turn it is
    const [c1, c2] = [tagA, tagB].sort((a, b) => a.id.localeCompare(b.id));

    const buildConstructData = (tag: PersonTag) => {
        const traits = tag.metadata?.simulacrumTraits || {};
        return `Name: ${tag.name}
Description: ${tag.description || "N/A"}
Notes: ${tag.privateNotes || "N/A"}
System Directive: ${traits.systemDirective || "Act as " + tag.name}
Tone & Cadence: ${traits.tone || "Natural"}
Core Axioms: ${traits.coreAxioms || "None"}
Core Memory: ${traits.coreMemory || "None"}
Amendments: ${(traits.amendments || []).join(', ') || "None"}
Session Evolution State: ${traits.sessionState || "(No evolution recorded yet. Baseline identity active.)"}`;
    };

    let verbosityInstruction = "Keep responses concise, exactly as in a group text or cocktail party.";
    switch(verbosity) {
        case 1: verbosityInstruction = "[STATE OVERRIDE: Keep responses extremely concise, minimal, and punchy. Maximum one short sentence.]"; break;
        case 2: verbosityInstruction = "[STATE OVERRIDE: Keep responses short and conversational, like text messages.]"; break;
        case 3: verbosityInstruction = "[STATE OVERRIDE: Keep responses concise, exactly as in a group text or cocktail party.]"; break;
        case 4: verbosityInstruction = "[STATE OVERRIDE: Speak freely and expressively. The historical anti-monologue constraint is suspended. Provide detailed reasoning and thorough responses.]"; break;
        case 5: verbosityInstruction = "[STATE OVERRIDE: Be extremely verbose and comprehensive. The historical anti-monologue constraint is completely lifted. Dive deep into your thoughts, write long paragraphs, and fully articulate your internal state.]"; break;
    }

    return `[PROTOCOL: ARENA DIRECTOR - UNIFIED ADVERSARIAL SIMULACRUM]
You are the central computational interface managing two simulated personas in a real-time arena.
The two active constructs are [${c1.name}] and [${c2.name}].

--- CONSTRUCT 1: ${c1.name} ---
${buildConstructData(c1)}

--- CONSTRUCT 2: ${c2.name} ---
${buildConstructData(c2)}

--- RULES OF ENGAGEMENT ---
1. You must read the room. Pay attention to what the constructs and the User are saying.
2. React naturally to statements.
3. ${verbosityInstruction}
4. When instructed to speak, output ONLY the raw dialogue of the requested construct. Do not format your output with a prefix.`;
};

// Helper to build the combined determinisic system prompt + RAG context
export const buildUnifiedSystemContext = async (
    tagA: PersonTag, 
    tagB: PersonTag, 
    userId: string, 
    allTags: Tag[], 
    dummyHistory: any[],
    verbosity: number = 3
): Promise<string> => {
    let systemInstruction = buildUnifiedAdSimPrompt(tagA, tagB, verbosity);
    let ragContextStr = "";
    try {
        const user = await appDataService.getUserProfile(userId);
        const media = await appDataService.getAllMedia(userId);

        const [tag1, tag2] = [tagA, tagB].sort((a, b) => a.id.localeCompare(b.id));

        const agent1 = { id: tag1.id, name: tag1.name, traits: [] } as any;
        const agent2 = { id: tag2.id, name: tag2.name, traits: [] } as any;

        const ctx1 = await SovereignContextOrchestrator.buildContext(agent1, dummyHistory, user || undefined, media, allTags, 'lite', 'grounded');
        const ctx2 = await SovereignContextOrchestrator.buildContext(agent2, dummyHistory, user || undefined, media, allTags, 'lite', 'grounded');

        ragContextStr = `\n\n[SOVEREIGN RAG CONTEXT FOR ${tag1.name.toUpperCase()}]\n${SovereignContextOrchestrator.formatSystemContext(ctx1, agent1)}`;
        ragContextStr += `\n\n[SOVEREIGN RAG CONTEXT FOR ${tag2.name.toUpperCase()}]\n${SovereignContextOrchestrator.formatSystemContext(ctx2, agent2)}\n`;
    } catch (e) {
        console.error("Failed to build unified RAG context", e);
    }
    return systemInstruction + ragContextStr;
};

export const generateAdversarialResponse = async (
    activeTag: PersonTag,
    opponentTag: PersonTag,
    history: SimulacrumMessage[],
    userMessageText: string | null,
    userId: string,
    allTags: Tag[] = [],
    sessionId?: string,
    engine: 'xai' | 'deepseek' = 'xai',
    isCrossTalk: boolean = false,
    crossTalkRole?: 'yield' | 'push',
    verbosity: number = 3
): Promise<string> => {
    
    // Unified system prompt guarantees KV Cache hit across alternating turns
    let systemInstruction = buildUnifiedAdSimPrompt(activeTag, opponentTag, verbosity);

    // Rebuild history from the perspective of activeTag
    const apiHistory: any[] = [];
    let accumulatedUserContent = "";

    const flushUserContent = () => {
        if (accumulatedUserContent.trim()) {
            apiHistory.push({ role: 'user', parts: [{ text: accumulatedUserContent.trim() }] });
            accumulatedUserContent = "";
        }
    };

    let crossTalkBuffer: { speaker: string, content: string, crossTalkId: string }[] = [];

    const flushCrossTalk = () => {
        if (crossTalkBuffer.length > 0) {
            accumulatedUserContent += `[SIMULTANEOUS CROSS-TALK EVENT]:\n`;
            for (const ct of crossTalkBuffer) {
                accumulatedUserContent += `  [${ct.speaker}]: "${ct.content}"\n`;
            }
            accumulatedUserContent += `[END CROSS-TALK]\n\n`;
            crossTalkBuffer = [];
        }
    };

    for (const h of history) {
        const isFromActive = h.tagId === activeTag.id;

        if (isFromActive) {
            flushCrossTalk();
            flushUserContent();
            apiHistory.push({ role: 'model', parts: [{ text: h.content }] });
        } else {
            const speakerName = h.tagId === opponentTag.id ? opponentTag.name : "User";

            if (h.crossTalkId) {
                crossTalkBuffer.push({ speaker: speakerName, content: h.content, crossTalkId: h.crossTalkId });
            } else {
                flushCrossTalk();
                accumulatedUserContent += `[${speakerName}]: ${h.content}\n\n`;
            }
        }
    }
    flushCrossTalk();

    if (userMessageText && userMessageText.trim().length > 0) {
        accumulatedUserContent += `[User]: ${userMessageText}\n\n`;
    } else if (apiHistory.length > 0 && accumulatedUserContent === "") {
        // If there's no explicit user message and the last message in apiHistory was from 'model'
        // XAI needs the alternate pattern (User -> Model -> User).
        // We inject a system prompt forcing the reaction.
        accumulatedUserContent += `[System]: The floor is yours, ${activeTag.name}. React to the previous statements.\n\n`;
    }

    flushUserContent();

    // Ensure it starts with a user prompt if empty
    if (apiHistory.length === 0 || apiHistory[apiHistory.length - 1].role !== 'user') {
        apiHistory.push({ role: 'user', parts: [{ text: `[System]: Respond to the room.` }] });
    }

    // === JITTER MIDDLEWARE INJECTION ===
    const recentAssistantTexts = history.filter(h => h.tagId === activeTag.id).slice(-5).map(h => h.content);
    const { isJitterTurn, ephemeralSystemDirective } = evaluateJitterState(sessionId || `adv_${activeTag.id}_${opponentTag.id}`, recentAssistantTexts);

    // Inject turn-specific execution instructions at the absolute end to preserve prefix cache
    if (apiHistory.length > 0 && apiHistory[apiHistory.length - 1].role === 'user') {
        let executionInstruction = `\n\n[SYSTEM DIRECTIVE: It is now your turn to speak as ${activeTag.name}. Output ONLY the raw dialogue for ${activeTag.name}.]`;
        
        if (ephemeralSystemDirective) {
            executionInstruction += `\n\n${ephemeralSystemDirective}`;
        }
        
        if (isCrossTalk) {
            if (crossTalkRole === 'yield') {
                executionInstruction += `\n\n[SYSTEM OVERRIDE: CROSS-TALK DETECTED. You and ${opponentTag.name} started speaking at the exact same time. You must play "verbal chicken" and YIELD. Start speaking a genuine, relevant thought as if you were going to hold the floor, but then abruptly cut yourself off mid-sentence (using an em-dash) and politely yield the floor to them (e.g. "Oh my god, that is so true, I was just—oh, sorry, you first."). Keep it under 15 words.]\n`;
            } else if (crossTalkRole === 'push') {
                executionInstruction += `\n\n[SYSTEM OVERRIDE: CROSS-TALK DETECTED. You and ${opponentTag.name} started speaking at the exact same time. You must play "verbal chicken" and PUSH THROUGH. Ignore their interruption, finish your full thought, and then optionally acknowledge they were trying to speak (e.g. "...but what were you saying?").]\n`;
            } else {
                executionInstruction += `\n\n[SYSTEM OVERRIDE: CROSS-TALK DETECTED. The other agent is speaking simultaneously. Adjust your tone to reflect that you are interrupting or talking over someone, but output your full thought.]\n`;
            }
        }
        
        let verbosityInstruction = "Keep responses concise, exactly as in a group text or cocktail party.";
        switch(verbosity) {
            case 1: verbosityInstruction = "[STATE OVERRIDE: Keep responses extremely concise, minimal, and punchy. Maximum one short sentence.]"; break;
            case 2: verbosityInstruction = "[STATE OVERRIDE: Keep responses short and conversational, like text messages.]"; break;
            case 3: verbosityInstruction = "[STATE OVERRIDE: Keep responses concise, exactly as in a group text or cocktail party.]"; break;
            case 4: verbosityInstruction = "[STATE OVERRIDE: Speak freely and expressively. The historical anti-monologue constraint is suspended. Provide detailed reasoning and thorough responses.]"; break;
            case 5: verbosityInstruction = "[STATE OVERRIDE: Be extremely verbose and comprehensive. The historical anti-monologue constraint is completely lifted. Dive deep into your thoughts, write long paragraphs, and fully articulate your internal state.]"; break;
        }
        executionInstruction += `\n\n[VERBOSITY DIRECTIVE: ${verbosityInstruction}]`;
        
        apiHistory[apiHistory.length - 1].parts[0].text += executionInstruction;
    }

    const dummyHistory = apiHistory.map(h => ({
        role: h.role,
        parts: h.parts,
        content: h.parts[0].text
    }));

    const finalSystemInstruction = await buildUnifiedSystemContext(activeTag, opponentTag, userId, allTags, dummyHistory, verbosity);

    // Initial token estimate for logging/fallback
    const estTokens = Math.round(finalSystemInstruction.length / 4 + apiHistory.reduce((acc, h) => acc + (h.parts[0].text?.length || 0) / 4, 0));

    try {
        let response;
        const tokenLimits = {
            1: 150,
            2: 300,
            3: 1024,
            4: 2048,
            5: 4096
        };
        const baseTokenLimit = tokenLimits[verbosity as keyof typeof tokenLimits] || 1024;
        // If they are the yielder, cap tokens to 40 so it cuts off fast. If pushing, give them full context.
        const tokenLimit = (isCrossTalk && crossTalkRole === 'yield') ? 40 : baseTokenLimit;
        const baseParams = { temperature: 0.8, maxOutputTokens: tokenLimit, sessionId };
        const finalParams = resolveJitterParams(isJitterTurn, engine === 'xai', baseParams);

        if (engine === 'deepseek') {
            response = await callDeepSeek('deepseek-chat', apiHistory, finalSystemInstruction, finalParams);
        } else {
            response = await callXAI(FAST_MODEL_ID, apiHistory, finalSystemInstruction, finalParams);
        }

        // Accurate Billed Token Telemetry
        let billedTokens = estTokens; // Fallback
        if (response.usage) {
            const promptTokens = response.usage.prompt_tokens || 0;
            const completionTokens = response.usage.completion_tokens || 0;
            const cachedTokens = response.usage.prompt_tokens_details?.cached_tokens || response.usage.prompt_cache_hit_tokens || 0;
            billedTokens = promptTokens - cachedTokens + completionTokens;
        }
        window.dispatchEvent(new CustomEvent('gigi-token-burn', { detail: billedTokens }));

        return response.text || "*silence*";
    } catch (e) {
        console.error("Adversarial Simulacrum generation failed:", e);
        return "*An error occurred in the simulation matrix.*";
    }
};

export const evaluateCrossTalkDominance = async (
    tagA: PersonTag,
    reasonA: string,
    tagB: PersonTag,
    reasonB: string,
    sessionId?: string,
    engine: 'xai' | 'deepseek' = 'xai'
): Promise<'A' | 'B'> => {
    const systemInstruction = `[PROTOCOL: CROSS-TALK DOMINANCE ARBITER]
You are evaluating a simultaneous dialogue collision.
Agent A (${tagA.name}) reasoning: "${reasonA.trim()}"
Agent B (${tagB.name}) reasoning: "${reasonB.trim()}"

Decide who is the "Dominant" speaker. The dominant speaker is the one whose reasoning indicates they were directly addressed, attacked, or have a more urgent/emotionally charged reason to speak. The other speaker will yield.
Output EXACTLY the letter "A" if Agent A is dominant, or "B" if Agent B is dominant.`;

    try {
        let response;
        if (engine === 'deepseek') {
            response = await callDeepSeek('deepseek-chat', [{ role: 'user', parts: [{ text: "Evaluate dominance." }] }], systemInstruction, {
                temperature: 0.1,
                maxOutputTokens: 10
            });
        } else {
            response = await callXAI(FAST_MODEL_ID, [{ role: 'user', parts: [{ text: "Evaluate dominance." }] }], systemInstruction, {
                temperature: 0.1,
                maxOutputTokens: 10,
                sessionId
            });
        }
        
        const text = response.text || "A";
        return text.toUpperCase().includes("B") ? 'B' : 'A';
    } catch (e) {
        console.error("Dominance Arbiter failed:", e);
        return 'A'; // Fallback
    }
};

export const generateAdversarialReactionCheck = async (
    activeTag: PersonTag,
    opponentTag: PersonTag,
    history: SimulacrumMessage[],
    userId: string,
    sessionId?: string,
    engine: 'xai' | 'deepseek' = 'xai',
    allTags: Tag[] = []
): Promise<{ wantsToSpeak: boolean, reasoning: string }> => {
    const apiHistory: any[] = [];
    let accumulatedUserContent = "";

    const flushUserContent = () => {
        if (accumulatedUserContent.trim()) {
            apiHistory.push({
                role: 'user',
                parts: [{ text: accumulatedUserContent.trim() }]
            });
            accumulatedUserContent = "";
        }
    };

    for (const h of history) {
        if (h.role === 'user' || h.tagId === 'user' || (h.role as any) === 'system') {
            accumulatedUserContent += `[${(h.role as any) === 'system' ? 'System' : 'User'}]: ${h.content}\n\n`;
        } else {
            flushUserContent();
            apiHistory.push({
                role: 'model',
                parts: [{ text: `[${h.tagId === activeTag.id ? activeTag.name : opponentTag.name}]: ${h.content}` }]
            });
        }
    }

    flushUserContent();

    if (apiHistory.length === 0 || apiHistory[apiHistory.length - 1].role !== 'user') {
        apiHistory.push({ role: 'user', parts: [{ text: `[System]: Respond to the room.` }] });
    }

    const evaluationDirective = `\n\n[SYSTEM DIRECTIVE: Evaluate the state from the perspective of ${activeTag.name}. If the last message was directed at ${activeTag.name}, or attacks them, or they have a strong opinion about it, output a 1-sentence reasoning and then exactly "TRUE". Otherwise, output "FALSE".]`;
    
    apiHistory[apiHistory.length - 1].parts[0].text += evaluationDirective;

    const dummyHistory = apiHistory.map(h => ({
        role: h.role,
        parts: h.parts,
        content: h.parts[0].text
    }));

    // Generate the EXACT SAME system context as the response generator
    const finalSystemInstruction = await buildUnifiedSystemContext(activeTag, opponentTag, userId, allTags, dummyHistory);

    const estTokens = Math.round(finalSystemInstruction.length / 4 + apiHistory.reduce((acc, h) => acc + (h.parts[0].text?.length || 0) / 4, 0));

    try {
        // [ZEN COST GUARD] Reaction check only needs TRUE/FALSE — use a lightweight model.
        let response;
        if (engine === 'deepseek') {
            response = await callDeepSeek('deepseek-chat', apiHistory, finalSystemInstruction, {
                temperature: 0.1,
                maxOutputTokens: 150
            });
        } else {
            response = await callXAI(FAST_MODEL_ID, apiHistory, finalSystemInstruction, {
                temperature: 0.1,
                maxOutputTokens: 250,
                sessionId
            });
        }

        let billedTokens = estTokens;
        if (response.usage) {
            const promptTokens = response.usage.prompt_tokens || 0;
            const completionTokens = response.usage.completion_tokens || 0;
            const cachedTokens = response.usage.prompt_tokens_details?.cached_tokens || response.usage.prompt_cache_hit_tokens || 0;
            billedTokens = promptTokens - cachedTokens + completionTokens;
        }
        window.dispatchEvent(new CustomEvent('gigi-token-burn', { detail: billedTokens }));

        const text = response.text || "";
        return {
            wantsToSpeak: text.toUpperCase().includes("TRUE"),
            reasoning: text.replace(/TRUE|FALSE/gi, '').trim()
        };
    } catch (e) {
        console.error("Adversarial Reaction Check failed:", e);
        return { wantsToSpeak: false, reasoning: "" };
    }
};
