import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, User, LifeEvent, GigiJournalEntry, Tag, Comment, AiCompanion, Media } from '@/types';
import { generateAgentResponse, buildFamilyGraphContext, generateDaydreamEntry, generateDeepDiveFromQuery } from '../services/geminiService';
import { appDataService } from '../services/serviceManager';
import { uploadFile } from '../services/storageService';
import { blobToBase64 } from '../utils/fileUtils';

const MAX_FILE_SIZE_MB = 200;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface UseAiChatProps {
    user: User;
    initialMessage?: string;
    clearInitialMessage: () => void;
    chatHistory: ChatMessage[];
    onHistoryChange: (history: ChatMessage[]) => void;
    apiKeySkipped: boolean;
    events: LifeEvent[];
    tags: Tag[];
    media?: Media[];
    systemPromptPatches: Record<string, string>;
    addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    onAiUpdateTag: (tag: Tag) => Promise<{ status: string }>;
    contextTagId?: string;
}

export const useAiChat = ({
    user, initialMessage, clearInitialMessage, chatHistory, onHistoryChange,
    apiKeySkipped, events, tags, media, systemPromptPatches, addToast, onAiUpdateTag, contextTagId
}: UseAiChatProps) => {

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [thinkingAgentId, setThinkingAgentId] = useState<string | null>(null);
    const [stagedFile, setStagedFile] = useState<{ file: File; previewUrl: string; type: 'image' | 'video' } | null>(null);

    const isProcessingRef = useRef(false);
    const isInitializedRef = useRef(false);

    const primaryCompanion = user.aiCompanions.find((c: AiCompanion) => c.isPrimary) || user.aiCompanions[0];
    const activeContextTag = contextTagId ? tags.find(t => t.id === contextTagId) : null;

    const createFingerprint = useCallback((msg: ChatMessage): string => {
        // [ZEN FIX] Use ID if available
        if ((msg as any).id) return (msg as any).id;
        const contentNorm = (msg.content || '').substring(0, 100).trim().toLowerCase();
        let tsNorm = '';
        if (msg.timestamp) {
            const ts = msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp as any);
            if (!isNaN(ts.getTime())) {
                tsNorm = Math.floor(ts.getTime() / 1000).toString();
            }
        }
        return `${msg.role}|${contentNorm}|${tsNorm}`;
    }, []);

    const deduplicateMessages = useCallback((rawHistory: ChatMessage[]): ChatMessage[] => {
        const seen = new Set<string>();
        const cleaned: ChatMessage[] = [];

        for (const msg of rawHistory) {
            const fp = createFingerprint(msg);
            if (!seen.has(fp)) {
                seen.add(fp);
                const cleanMsg = { ...msg };
                if ((cleanMsg as any).base64Data) {
                    delete (cleanMsg as any).base64Data;
                }
                cleaned.push(cleanMsg);
            }
        }
        return cleaned;
    }, [createFingerprint]);

    useEffect(() => {
        if (!isInitializedRef.current && chatHistory.length > 0) {
            console.log(`[AiChat] Initializing with ${chatHistory.length} messages from parent`);
            const dedupedHistory = deduplicateMessages(chatHistory);
            setMessages(dedupedHistory);
            isInitializedRef.current = true;
        }
    }, [chatHistory, deduplicateMessages]);

    useEffect(() => {
        if (isProcessingRef.current || !isInitializedRef.current) return;

        if (chatHistory.length > messages.length) {
            console.log(`[AiChat] External sync: parent ${chatHistory.length} > local ${messages.length}`);
            const dedupedHistory = deduplicateMessages(chatHistory);
            setMessages(dedupedHistory);
        }
    }, [chatHistory.length, messages.length, deduplicateMessages, chatHistory]);

    useEffect(() => {
        if (initialMessage && !thinkingAgentId) {
            setUserInput(initialMessage);
            clearInitialMessage();
        }
    }, [initialMessage, thinkingAgentId, clearInitialMessage]);

    // --- HANDLERS ---

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE_BYTES) {
                alert(`File too large (Max ${MAX_FILE_SIZE_MB}MB).`);
                return;
            }
            const isVideo = file.type.startsWith('video/');
            setStagedFile({ file, previewUrl: URL.createObjectURL(file), type: isVideo ? 'video' : 'image' });
        }
    };

    const handleRefreshSession = () => {
        const dedupedHistory = deduplicateMessages(chatHistory);
        setMessages(dedupedHistory);
        isInitializedRef.current = true;
        addToast("Context refreshed.", "info");
    };

    const handleDeleteMessage = async (index: number) => {
        isProcessingRef.current = true;
        try {
            const newHistory = [...messages];
            newHistory.splice(index, 1);
            setMessages(newHistory);
            onHistoryChange(newHistory);
            await appDataService.saveChatHistory(user.id, newHistory);
            console.log("[Chat] Message deleted.");
        } catch (e) {
            console.error("Failed to delete", e);
            addToast("Failed to delete message.", 'error');
        } finally {
            setTimeout(() => { isProcessingRef.current = false; }, 500);
        }
    };

    // [ZEN FIX] New Edit Feature
    const handleEditMessage = async (index: number, newContent: string) => {
        isProcessingRef.current = true;
        try {
            const newHistory = [...messages];
            const oldMsg = newHistory[index];

            // Create updated message object
            newHistory[index] = {
                ...oldMsg,
                content: newContent
            };

            setMessages(newHistory);
            onHistoryChange(newHistory);

            // Save to DB (Service handles idempotent save via ID)
            await appDataService.saveChatHistory(user.id, newHistory);
            console.log(`[Chat] Message ${index} updated.`);
            addToast("Message updated.", "success");
        } catch (e) {
            console.error("Failed to edit", e);
            addToast("Failed to update message.", 'error');
        } finally {
            setTimeout(() => { isProcessingRef.current = false; }, 500);
        }
    };

    // [ZEN FIX] Ghostwriter Injector
    const injectMessage = async (message: ChatMessage) => {
        try {
            // Add to local state (sorted by timestamp later by UI usually, but push here for now)
            const newHistory = [...messages, message];

            // We rely on the parent/Effect to resort if needed, or we sort here
            newHistory.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            setMessages(newHistory);
            onHistoryChange(newHistory);

            // Save Single Message (Service handles it via ID)
            await appDataService.saveChatHistory(user.id, [message]);
            console.log("[Chat] Manual message injected.");
            return true;
        } catch (e) {
            console.error("Injection failed", e);
            return false;
        }
    };

    const handleReaction = async (index: number, emoji: string) => {
        isProcessingRef.current = true;
        try {
            const newHistory = [...messages];
            const msg = { ...newHistory[index] };
            const existing = msg.reactions || [];

            if (existing.find((r: any) => r.reactorId === user.id && r.emoji === emoji)) {
                msg.reactions = existing.filter((r: any) => !(r.reactorId === user.id && r.emoji === emoji));
            } else {
                msg.reactions = [...existing, { reactorId: user.id, reactorName: user.displayName, emoji }];
            }

            newHistory[index] = msg;
            setMessages(newHistory);
            onHistoryChange(newHistory);
            await appDataService.saveChatHistory(user.id, newHistory);
        } catch (e) {
            console.error("Reaction failed", e);
        } finally {
            setTimeout(() => { isProcessingRef.current = false; }, 500);
        }
    };

    const handleSaveToTag = async (text: string) => {
        if (!activeContextTag) return;
        const currentDesc = activeContextTag.description || '';
        if (currentDesc.includes(text)) {
            addToast("Already in tag description.", "info");
            return;
        }
        const newDesc = currentDesc ? `${currentDesc}\n\n${text}` : text;
        try {
            await onAiUpdateTag({ ...activeContextTag, description: newDesc });
            addToast(`Appended info to ${activeContextTag.name}.`, 'success');
        } catch (e) {
            addToast("Failed to update tag description.", 'error');
        }
    };

    const handleToolExecution = async (toolName: string, args: any) => {
        if (toolName === 'UPDATE_PROFILE' && args.field === 'preferredName' && args.value) {
            try {
                await appDataService.updateUserProfile(user.id, { ...user, preferredName: args.value });
                addToast(`Call me "${args.value}".`, 'success');
                return `[SYSTEM] Success. User profile updated. Preferred Name: "${args.value}".`;
            } catch (e) { return `[SYSTEM] Error updating profile: ${e}`; }
        }

        if (toolName === 'GENERATE_DAYDREAM' && args.prompt) {
            try {
                const entry = await generateDaydreamEntry(user, events, tags, media || []);
                if (!entry) throw new Error("Daydream returned null");
                await appDataService.saveGigiJournalEntry(user.id, entry);
                addToast("New Daydream entry added to Journal.", 'success');
                return `[SYSTEM] Successfully generated daydream: "${entry.title}"`;
            } catch (e) { return `[SYSTEM] Daydream failure: ${e}`; }
        }

        if (toolName === 'DEEP_DIVE' && args.query) {
            try {
                const results = await generateDeepDiveFromQuery(args.query, user, events, tags, media || []);
                return `[DEEP DIVE RESULTS]: ${results}`;
            } catch (e) { return `[SYSTEM] Deep Dive error: ${e}`; }
        }
        return null;
    };

    const processAgentTurn = async (agent: AiCompanion, currentHistory: ChatMessage[]) => {
        setThinkingAgentId(agent.id);

        try {
            const apiHistoryPromises = currentHistory.filter(m => m.role !== 'system').map(async (m) => {
                const prefix = m.role === 'user' ? `[User]: ` : `[${m.author?.name || 'Assistant'}]: `;
                const parts: any[] = [{ text: prefix + (m.content || '') }];
                const mAny = m as any;
                if (m.imageUrl && !mAny.base64Data) {
                    parts.push({ text: `[Image Attached: ${m.imageUrl}]` });
                } else if (mAny.base64Data && m.mimeType) {
                    parts.push({ inlineData: { mimeType: m.mimeType, data: mAny.base64Data } });
                }
                return { role: 'user', parts };
            });

            const apiHistory = await Promise.all(apiHistoryPromises);

            let responderPatch = systemPromptPatches[agent.id] || '';
            if (activeContextTag) {
                responderPatch += `\n\n[ACTIVE CONTEXT]: Editing Tag "${activeContextTag.name}" (${activeContextTag.type}).\nDesc: "${activeContextTag.description || ''}"`;
            }
            const combinedPatch = `${responderPatch}\n\n${buildFamilyGraphContext(tags)}`;
            const allAgentNames = user.aiCompanions.map((c: AiCompanion) => c.name);

            console.log("[AiChat] Calling AI agent:", agent.name);
            const result = (await generateAgentResponse(agent, apiHistory, allAgentNames, combinedPatch, media, user, tags)) as any;
            let responseContent = result.text || "";

            if (result.toolCalls) {
                for (const call of result.toolCalls) {
                    const toolResult = await handleToolExecution(call.name, call.args);
                    if (toolResult) responseContent += `\n\n${toolResult}`;
                }
            }

            const agentMessage: ChatMessage = {
                role: 'model',
                content: responseContent,
                author: { name: agent.name, avatarUrl: agent.avatarUrl },
                timestamp: new Date()
            };

            const finalHistory = [...currentHistory, agentMessage];
            setMessages(finalHistory);
            onHistoryChange(finalHistory);
            await appDataService.saveChatHistory(user.id, finalHistory);
            console.log("[AiChat] AI response saved. Total messages:", finalHistory.length);

        } catch (error) {
            console.error("[AiChat] Agent Error:", error);
            addToast("Agent failed to respond.", "error");
        } finally {
            setThinkingAgentId(null);
        }
    };

    const submitMessage = async (isFrozen: boolean) => {
        if (isFrozen || (!userInput.trim() && !stagedFile) || thinkingAgentId || isProcessingRef.current) {
            return;
        }

        isProcessingRef.current = true;
        const currentInput = userInput.trim();
        const currentFile = stagedFile;

        setUserInput('');
        setStagedFile(null);

        try {
            const userMessage: ChatMessage = {
                role: 'user',
                content: currentInput,
                timestamp: new Date()
            };

            if (currentFile) {
                try {
                    const fileName = currentFile.file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                    const { url, base64 } = await uploadFile(currentFile.file, user.id, `chat-${Date.now()}-${fileName}`);
                    userMessage.imageUrl = url || currentFile.previewUrl;
                    (userMessage as any).base64Data = base64 || await blobToBase64(currentFile.file);
                    userMessage.mimeType = currentFile.file.type;
                } catch (e) {
                    addToast("Upload failed.", 'error');
                    isProcessingRef.current = false;
                    return;
                }
            }

            const historyWithUserMsg = [...messages, userMessage];
            setMessages(historyWithUserMsg);
            onHistoryChange(historyWithUserMsg);
            await appDataService.saveChatHistory(user.id, historyWithUserMsg);
            console.log("[AiChat] User message saved. Total:", historyWithUserMsg.length);

            if (apiKeySkipped) {
                isProcessingRef.current = false;
                return;
            }

            let speaker = primaryCompanion;
            const lowerInput = currentInput.toLowerCase();
            const explicitMention = user.aiCompanions.find((c: AiCompanion) =>
                lowerInput.includes(`@${c.name.toLowerCase()}`)
            );
            if (explicitMention) speaker = explicitMention;

            await processAgentTurn(speaker, historyWithUserMsg);

        } catch (error) {
            console.error("[AiChat] Submit error:", error);
            addToast("Failed to send message.", "error");
        } finally {
            setTimeout(() => { isProcessingRef.current = false; }, 500);
        }
    };

    return {
        messages,
        userInput, setUserInput,
        thinkingAgentId,
        stagedFile, setStagedFile,
        activeContextTag,
        handleFileUpload,
        handleRefreshSession,
        handleDeleteMessage,
        handleEditMessage, // [ZEN FIX] Exported
        injectMessage,     // [ZEN FIX] Exported
        handleReaction,
        handleSaveToTag,
        submitMessage
    };
};