// aiOrchestrator.ts
// [PROJECT GIGI] - Sovereign AI Orchestration Service
// Formerly geminiService.ts - Fully migrated to xAI/Grok architecture.

// --- CORE RE-EXPORTS ---
export { addApiLog, getApiLogs, clearApiLogs, notifyStatus, triggerDiegeticDelay } from './ai/logging';
export { callXAI, callLocalLLM, callOpenRouter, generateImageWithGrok, generateVideoWithGrok, pollVideoTask, extendVideoWithGrok } from './ai/providers';
export { buildFamilyGraphContext, getSystemInstruction, buildMatrixContext } from './ai/context';
export { generateAgentResponse, generateDaydreamEntry, generateDeepDiveEntry, generateDeepDiveFromQuery, generateDaydreamContinuation, generateWritingCritique } from './ai/generators';
export { generateGedcomEnrichmentProposal } from './ai/generators/gedcomEnrichment'; 
export { analyzeVisuals, suggestPolishPreset, inferTagVisualProfile, synthesizeRenderNarrative } from './ai/vision';
export { correctSpatialAnomaly, generateTemporalInquiry } from './ai/spatial';

// --- AUXILIARY ORCHESTRATION ---
import { generateAgentResponse } from './ai/generators';
import { callXAI } from './ai/providers'; 
import type { User, LifeEvent, Tag, Media, GigiJournalEntry, Comment, AiCompanion, PeerChatSegment } from '../types';

export const generateWelcomeMessage = async (user: User): Promise<string> => {
    try {
        const companion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
        const response = await generateAgentResponse(companion, [{ role: 'user', parts: [{ text: `Generate a warm, short welcome message for ${user.firstName}.` }] }], [], "", [], user, []);
        return response.text || `Welcome back, ${user.firstName}!`;
    } catch (error) { return `Welcome back, ${user.firstName}!`; }
};

export const generateMemoryPrompt = async (events: LifeEvent[], _tags: Tag[], _media: Media[], user: User): Promise<string> => {
    try {
        const recentEvents = events.slice(0, 5).map(e => e.title).join(", ");
        const prompt = `Based on recent events (${recentEvents}), ask a question to spark a new memory.`;
        const companion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
        const response = await generateAgentResponse(companion, [{ role: 'user', parts: [{ text: prompt }] }], [], "", [], user, []);
        return response.text || "What's a memory that's been on your mind lately?";
    } catch (error) { return "What's a memory that's been on your mind lately?"; }
};

export const generateAiCommentResponse = async (entry: GigiJournalEntry, latestComment: Comment, user: User, forceResponder?: AiCompanion): Promise<Comment | null> => {
    let responder = forceResponder || user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
    try {
        const context = `ENTRY: ${entry.title}\n${entry.content}\nCOMMENT: ${latestComment.authorName}: ${latestComment.content}`;
        const response = await generateAgentResponse(responder, [{ role: 'user', parts: [{ text: context }] }], [], "", [], user, []);
        if (!response.text) return null;
        return {
            id: `comment-ai-${Date.now()}`,
            authorId: responder.id,
            authorName: responder.name,
            authorAvatarUrl: responder.avatarUrl,
            content: response.text,
            timestamp: new Date()
        };
    } catch (error) { return null; }
};

export const consultInnerVoice = async (topic: string, user: User): Promise<{ insight: string }> => {
    const zoe = user.aiCompanions.find(c => !c.isPrimary) || { name: "Inner Voice", persona: "custom", bio: "Wise observer", id: 'zoe', avatarUrl: '' } as AiCompanion;
    try {
        const response = await generateAgentResponse(zoe, [{ role: 'user', parts: [{ text: `Analyze deepy: "${topic}"` }] }], [], "", [], user, []);
        return { insight: response.text || "The inner voice is silent." };
    } catch (e) { return { insight: "The inner voice is silent." }; }
};

export const generateForcedJournalEntry = async (user: User, topic: string | null, isChapter: boolean): Promise<{ title: string, content: string }> => {
    const companion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
    const prompt = `Write a ${isChapter ? "chapter-length" : "standard"} journal entry ${topic ? `about "${topic}"` : "reflecting on the user's life"}.`;
    const response = await generateAgentResponse(companion, [{ role: 'user', parts: [{ text: prompt }] }], [], "", [], user, []);
    const text = response.text || "";
    const lines = text.split('\n');
    return { title: lines[0].replace('Title:', '').trim() || "Entry", content: lines.slice(1).join('\n').trim() };
};

export const generateWelcomeBackMessage = (user: User): string => {
    const hours = new Date().getHours();
    return `${hours < 12 ? "Good morning" : hours < 18 ? "Good afternoon" : "Good evening"}, ${user.firstName}.`;
};

export const simulateDigestEmail = async (_user: User, _events: LifeEvent[], _journal: GigiJournalEntry[]) => { return { subject: `Weekly Digest`, body: `Hello...` }; };
export const simulateCompanionSms = async (_user: User, _events: LifeEvent[], _tags: Tag[]) => { return { body: `Hey...` }; };

export const generatePeerResponse = async (
    agent: AiCompanion,
    user: User,
    history: PeerChatSegment[],
    triggerMsg: PeerChatSegment,
    ragContext: string,
    friendName: string
): Promise<{ text: string }> => {
    const prompt = `
    [PROTOCOL: PEER CHAT LINK-IN]
    You are ${agent.name}, the user's AI Companion. You have been summoned by ${triggerMsg.fromName} in a private chat with ${user.firstName}.
    
    FRIEND NAME: ${friendName}
    TRIGGER MESSAGE: "${triggerMsg.content}"
    
    [RAG CONTEXT FROM ${user.firstName}'S VAULT]:
    ${ragContext}
    
    TASK:
    Respond to the conversation naturally using your persona. If the RAG context contains relevant artifacts or memories, reference them to assist. 
    Keep it concise and conversational.
    `;

    const apiHistory = history.map(h => ({
        role: h.authorType === 'human' ? 'user' : 'model',
        parts: [{ text: `[${h.fromName}]: ${h.content}` }]
    }));

    try {
        const response = await generateAgentResponse(agent, apiHistory, [], prompt, [], user, []);
        return { text: response.text || "" };
    } catch (e) {
        console.error("Peer response generation failed", e);
        return { text: "" };
    }
};

export const parseCareerBiomass = async (biomass: string, user: User): Promise<any[]> => {
    const prompt = `You are an enterprise ATS metadata extractor. Parse the following unstructured resume/career text into a strict JSON array representing chronological milestones. 
    
    Return a JSON object with a single root key "careerNodes" containing an array of node objects. Each node object must have:
    - "id": a unique string (e.g. "job-1")
    - "type": "job", "education", or "goal"
    - "title": The job title, degree name, etc.
    - "organization": The company, institution, etc.
    - "startDate": e.g., "Jan 2018"
    - "endDate": e.g., "Present" or "Dec 2022"
    - "bullets": An array of strings outlining responsibilities/achievements (max 4).
    
    RETURN EXCLUSIVELY RAW VALID JSON. NO MARKDOWN Wrappers.
    
    USER RAW BIOMASS:
    ${biomass}`;

    try {
        const response = await callXAI("grok-4.3", [{ role: 'user', parts: [{ text: `USER RAW BIOMASS:\n${biomass}` }] }], prompt, {
            temperature: 0.1,
            maxOutputTokens: 8192
        });

        let text = response.text || "";
        const parsed = JSON.parse(text);
        let normalizedNodes: any[] = [];

        if (Array.isArray(parsed)) {
            normalizedNodes = parsed;
        } else if (parsed.careerNodes) {
            normalizedNodes = parsed.careerNodes;
        } else {
            if (parsed.experience && Array.isArray(parsed.experience)) {
                parsed.experience.forEach((job: any, i: number) => {
                    const rawBullets = job.responsibilities || job.description || [];
                    const safeBullets = Array.isArray(rawBullets) ? rawBullets : [rawBullets];
                    normalizedNodes.push({
                        id: `job-${i}`,
                        type: 'job',
                        title: job.title || 'Unknown Role',
                        organization: job.company || job.organization || 'Unknown Company',
                        startDate: job.dates ? job.dates.split('-')[0]?.trim() : (job.start_date || 'Unknown'),
                        endDate: job.dates && job.dates.includes('-') ? job.dates.split('-')[1]?.trim() : (job.end_date || job.dates || 'Present'),
                        bullets: safeBullets
                    });
                });
            }
            if (parsed.education && Array.isArray(parsed.education)) {
                parsed.education.forEach((edu: any, i: number) => {
                    normalizedNodes.push({
                        id: `edu-${i}`,
                        type: 'education',
                        title: edu.degree || edu.degrees?.join(', ') || 'Degree',
                        organization: edu.institution || edu.school || 'Unknown Institution',
                        startDate: '',
                        endDate: edu.graduation_date || edu.year || 'Unknown',
                        bullets: edu.gpa ? [`GPA: ${edu.gpa}`] : []
                    });
                });
            }
            const objective = parsed.objective || parsed.personal_information?.objective;
            if (objective) {
                normalizedNodes.push({
                    id: 'goal-1',
                    type: 'goal',
                    title: 'Professional Objective',
                    organization: parsed.personal_information?.name || 'Self',
                    startDate: new Date().getFullYear().toString(),
                    endDate: 'Future',
                    bullets: [objective]
                });
            }
        }
        return normalizedNodes;
    } catch (e) {
        console.error("ATS Parsing Engine Failed:", e);
        throw new Error("Failed to parse biomass into nodes.");
    }
};

export const generatePreInterviewMatrix = async (user: User): Promise<{ question: string, reason: string, contextTag?: string }[]> => {
    const prompt = `You are a HR Director. Review the candidate history. Identify 5 behavioral questions for a pre-screen interview.
    
    Candidates Name: ${user.firstName} ${user.lastName}
    Career History: ${JSON.stringify(user.careerNodes || [])}

    Return strict JSON matching this structure:
    [
      { "question": "Question", "reason": "Reason", "contextTag": "Tag" }
    ]
    RETURN EXCLUSIVELY RAW VALID JSON.`;

    try {
        const response = await callXAI("grok-4.3", [{ role: 'user', parts: [{ text: "Evaluate candidate profile." }] }], prompt, {
            temperature: 0.1,
            maxOutputTokens: 4096
        });
        const parsed = JSON.parse(response.text || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error("Interview Matrix Extraction Failed:", e);
        return [];
    }
};

export const generateExperiencePitch = async (
    node: any, 
    userBio: string, 
    visitorContext: { name?: string, title?: string, company?: string, targetRole?: string },
    user: User
): Promise<string> => {
    const prompt = `
    [PROTOCOL: EMISSARY BRIEFING]
    You are the Agentic Emissary for ${user.firstName} ${user.lastName}.
    
    VISITOR: ${visitorContext.name || 'Professional Recruiter'}
    TARGET ROLE: ${visitorContext.targetRole || 'their open position'}
    
    NODE: ${node.title} at ${node.organization}
    BIO: ${userBio}
    
    MISSION: Provide a clinical, precise, and executive-grade analysis of this specific role. No hyperbole. Skip greetings.
    `;

    try {
        const response = await callXAI("grok-4.3", [{ role: 'user', parts: [{ text: prompt }] }], "", {
            temperature: 0.3,
            maxOutputTokens: 4096
        });
        return response.text || "Assessment initialized...";
    } catch (e: any) {
        console.error("[Emissary] Generation Failed:", e);
        return "I apologize, but my executive analysis of this role is currently delayed.";
    }
};

export const generateTailoredResumeContent = async (
    user: User, 
    visitorRole?: string
): Promise<{ headline: string, summary: string }> => {
    const prompt = `
    Synthesize an ATS headline and executive summary for ${user.firstName} ${user.lastName}.
    Role: ${visitorRole || 'Universal'}
    
    RETURN EXCLUSIVELY RAW VALID JSON:
    { "headline": "Headline", "summary": "Summary" }
    `;

    try {
        const response = await callXAI("grok-4.3", [{ role: 'user', parts: [{ text: prompt }] }], "", {
            temperature: 0.2,
            maxOutputTokens: 2048
        });
        const parsed = JSON.parse(response.text || "{}");
        return {
            headline: parsed.headline || `${user.firstName} ${user.lastName}`,
            summary: parsed.summary || (user.biography || "Experience summary.")
        };
    } catch (e) {
        console.error("Resume tailoring failed:", e);
        return { headline: `${user.firstName} ${user.lastName}`, summary: user.biography || "" };
    }
};

export const sparkleAssetDescription = async (text: string, user: User, customDirective?: string, originalBaseline?: string): Promise<string> => {
    console.log("[aiOrchestrator] sparkleAssetDescription called with text:", `"${text}"`, "user:", user?.firstName);
    if (!text || text.trim() === '') {
        console.warn("[aiOrchestrator] Text is empty or whitespace. Returning immediately.");
        return text;
    }
    
    const basePrompt = customDirective 
        ? `You are an AI assistant helping ${user.firstName} write media descriptions for their LifeOS. Rewrite the description strictly following this instruction: "${customDirective}". Preserve all personal names, voice, and markdown hyperlinks. Output ONLY the polished caption with no intro, outro, or quotes.`
        : `Take this hasty media description and elevate it into evocative prose for ${user.firstName}'s LifeOS. Preserve voice and hyperlinks. Polished caption only.`;
        
    const prompt = `${basePrompt}
    
    ${originalBaseline && originalBaseline.trim() !== '' && originalBaseline.trim() !== text.trim() ? `ORIGINAL RAW DESCRIPTION (use this as the true content source): "${originalBaseline}"\n` : ''}
    CURRENT DESCRIPTION TEXT (which might contain flowery language or edits to rewrite): "${text}"
    `;

    console.log("[aiOrchestrator] Built Grok Prompt:\n", prompt);

    try {
        console.log("[aiOrchestrator] Invoking callXAI...");
        const response = await callXAI("grok-4.3", [{ role: 'user', parts: [{ text: prompt }] }], "", { temperature: 0.4 });
        console.log("[aiOrchestrator] callXAI returned response text:", `"${response.text}"`);
        return response.text?.trim() || text;
    } catch (e) {
        console.error("[aiOrchestrator] Sparkle Failed inside try-catch block:", e);
        throw e;
    }
};

/**
 * [ZEN] Neural Reconciliation: Fuzzy Name Matching
 * Identifies if an extracted name from a social import matches an existing Person Tag.
 */
export const reconcileVertexPersona = async (extractedName: string, existingPeople: Tag[]): Promise<{ matchId?: string, confidence: number, reasoning: string }> => {
    if (!extractedName || existingPeople.length === 0) return { confidence: 0, reasoning: "No context provided." };

    const personList = existingPeople.map(p => {
        const meta = p.metadata as any; // Cast for union property access
        return {
            id: p.id,
            name: p.name,
            nickname: meta?.nickname || meta?.nickName,
            middleName: meta?.middleName
        };
    });

    const prompt = `
    [PROTOCOL: NEURAL RECONCILIATION]
    An event from a social import mentions a person: "${extractedName}".
    
    EXISTING PEOPLE IN THE MATRIX:
    ${JSON.stringify(personList)}
    
    TASK:
    Identify if "${extractedName}" is likely one of the existing people. 
    Consider middle names, nicknames (e.g. Alex for Alexander), and common naming variations.
    
    RETURN RAW JSON ONLY:
    { "matchId": "tag-id", "confidence": 0.95, "reasoning": "Brief explanation of the link..." }
    `;

    try {
        const response = await callXAI("grok-4.3", [{ role: 'user', parts: [{ text: "Reconcile identity." }] }], prompt, { temperature: 0.1 });
        const parsed = JSON.parse(response.text || "{}");
        return {
            matchId: parsed.matchId,
            confidence: parsed.confidence || 0,
            reasoning: parsed.reasoning || "No reasoning provided."
        };
    } catch (e) {
        console.error("Neural Reconciliation Failed:", e);
        return { confidence: 0, reasoning: "AI Failure." };
    }
};
