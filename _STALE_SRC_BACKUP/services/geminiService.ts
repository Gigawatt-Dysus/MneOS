// geminiService.ts

// --- CORE RE-EXPORTS ---
export { addApiLog, getApiLogs, clearApiLogs, notifyStatus, triggerDiegeticDelay } from './ai/logging';
export { callGemini, callXAI, callLocalLLM } from './ai/providers';
export { buildFamilyGraphContext, getSystemInstruction, buildMatrixContext } from './ai/context';
export { generateAgentResponse, generateDaydreamEntry, generateDeepDiveEntry, generateDeepDiveFromQuery, generatePeerResponse } from './ai/generators';
export { analyzeVisuals } from './ai/vision';

// --- AUXILIARY STUBS ---
import { generateAgentResponse } from './ai/generators';
import type { User, LifeEvent, Tag, Media, GigiJournalEntry, Comment, AiCompanion } from '@/types';

export const generateWelcomeMessage = async (user: User): Promise<string> => {
    try {
        const companion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
        const response = await generateAgentResponse(companion, [{ role: 'user', parts: [{ text: `Generate a warm, short welcome message for ${user.firstName}.` }] }], []);
        return response.text || `Welcome back, ${user.firstName}!`;
    } catch (error) { return `Welcome back, ${user.firstName}!`; }
};

export const generateMemoryPrompt = async (events: LifeEvent[], _tags: Tag[], _media: Media[], user: User): Promise<string> => {
    try {
        const recentEvents = events.slice(0, 5).map(e => e.title).join(", ");
        const prompt = `Based on recent events (${recentEvents}), ask a question to spark a new memory.`;
        const companion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
        const response = await generateAgentResponse(companion, [{ role: 'user', parts: [{ text: prompt }] }], []);
        return response.text || "What's a memory that's been on your mind lately?";
    } catch (error) { return "What's a memory that's been on your mind lately?"; }
};

export const generateAiCommentResponse = async (entry: GigiJournalEntry, latestComment: Comment, user: User, forceResponder?: AiCompanion): Promise<Comment | null> => {
    let responder = forceResponder || user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
    try {
        const context = `ENTRY: ${entry.title}\n${entry.content}\nCOMMENT: ${latestComment.authorName}: ${latestComment.content}`;
        const response = await generateAgentResponse(responder, [{ role: 'user', parts: [{ text: context }] }], []);
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
        const response = await generateAgentResponse(zoe, [{ role: 'user', parts: [{ text: `Analyze deepy: "${topic}"` }] }], []);
        return { insight: response.text || "The inner voice is silent." };
    } catch (e) { return { insight: "The inner voice is silent." }; }
};

export const generateForcedJournalEntry = async (user: User, topic: string | null, isChapter: boolean): Promise<{ title: string, content: string }> => {
    const companion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
    const prompt = `Write a ${isChapter ? "chapter-length" : "standard"} journal entry ${topic ? `about "${topic}"` : "reflecting on the user's life"}.`;
    const response = await generateAgentResponse(companion, [{ role: 'user', parts: [{ text: prompt }] }], []);
    const text = response.text || "";
    const lines = text.split('\n');
    return { title: lines[0].replace('Title:', '').trim() || "Entry", content: lines.slice(1).join('\n').trim() };
};

export const generateWelcomeBackMessage = (user: User): string => {
    const hours = new Date().getHours();
    return `${hours < 12 ? "Good morning" : hours < 18 ? "Good afternoon" : "Good evening"}, ${user.firstName}.`;
};

// Prefixed unused params with _ to silence warnings
export const simulateDigestEmail = async (_user: User, _events: LifeEvent[], _journal: GigiJournalEntry[]) => { return { subject: `Weekly Digest`, body: `Hello...` }; };
export const simulateCompanionSms = async (_user: User, _events: LifeEvent[], _tags: Tag[]) => { return { body: `Hey...` }; };