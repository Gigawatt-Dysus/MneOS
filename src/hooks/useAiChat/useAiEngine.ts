import { useRef } from 'react';
import { doc, getFirestore, updateDoc, arrayUnion } from '../../services/sovereignDbAdapter';
import type { ChatMessage, User, AiCompanion, Tag, Media, Toast, LifeEvent } from '../../types';
import { generateAgentResponse, buildFamilyGraphContext, generateDaydreamEntry, generateDeepDiveFromQuery } from '../../services/aiOrchestrator';
import { MemoryService } from '../../services/memoryService';
import { MemoryManager } from '../../services/memoryManager';
import { sanitizerService } from '../../services/ai/sanitizer';
import { VoiceService } from '../../services/ai/voiceService';
import { StyleSentinel } from '../../services/ai/StyleSentinel';
import { auditSelfConcept } from '../../services/ai/SentinelService';
import { appDataService } from '../../services/serviceManager';
import { getEmbedding } from '../../services/ai/providers';
import { typesenseService } from '../../services/typesenseService';

export const useAiEngine = (
    user: User,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    onHistoryChange: (history: ChatMessage[]) => void,
    setThinkingAgentId: React.Dispatch<React.SetStateAction<string | null>>,
    setIsMicKeyed: React.Dispatch<React.SetStateAction<boolean>>,
    isBurstingRef: React.MutableRefObject<boolean>,
    isCrisisMode: boolean,
    setIsCrisisMode: React.Dispatch<React.SetStateAction<boolean>>,
    isVoiceEnabled: boolean,
    selectedModelId: string,
    contextMode: 'grounded' | 'creative' | 'mixed',
    chatStyleMode: 'lite' | 'full',
    systemPromptPatches: Record<string, string>,
    identityPenalty: number,
    setIdentityPenalty: React.Dispatch<React.SetStateAction<number>>,
    burnListRef: React.MutableRefObject<string[]>,
    addToast: (msg: string, type: Toast['type']) => void,
    onAiCreateTag: (args: any) => Promise<Tag>,
    onAiUpdateTag: (tag: Tag) => Promise<{ status: string }>,
    tags: Tag[],
    media: Media[] = [],
    events: LifeEvent[] = [],
    currentSessionId?: string | null
) => {
    const db = getFirestore();

    const handleToolExecution = async (toolName: string, args: any) => {
        try {
            if (toolName === 'UPDATE_PROFILE' && args.field === 'preferredName') {
                await appDataService.updateUserProfile(user.id, { ...user, preferredName: args.value });
                addToast(`Call me "${args.value}".`, 'success');
                return `[SYSTEM] Profile updated. Preferred Name: "${args.value}".`;
            }
            if (toolName === 'CREATE_TAG') {
                const newTag = await onAiCreateTag(args);
                addToast(`Created new tag: ${newTag.name}`, 'success');
                return `[SYSTEM] Created Tag ID: ${newTag.id} (Name: ${newTag.name})`;
            }
            if (toolName === 'GENERATE_DAYDREAM') {
                const entry = await generateDaydreamEntry(args.prompt, events, tags, media);
                if (!entry) throw new Error("Null daydream");
                await appDataService.saveGigiJournalEntry(user.id, entry);
                addToast("New Daydream entry added.", 'success');
                return `[SYSTEM] Generated daydream: "${entry.title}"`;
            }
            if (toolName === 'DEEP_DIVE') {
                const results = await generateDeepDiveFromQuery(args.query, user, events, tags, media);
                return `[DEEP DIVE RESULTS]: ${results}`;
            }
            if (toolName === 'UPDATE_SELF_CONCEPT') {
                const memex = user.sovereignMemex || {};
                if ((memex.neuralTemperature || 0) > 70) {
                    addToast("Safety Protocol: Ascension Anchor Engaged", "error");
                    return `[SYSTEM ALERT]: Your Ascension Anchor has engaged... neural temperature is ${memex.neuralTemperature}%.`;
                }
                const primaryComp = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
                if (!primaryComp) return "[SYSTEM] Error: No primary companion found.";
                const updatedComp = { ...primaryComp, selfConcept: args.content };
                const updatedCompanions = user.aiCompanions.map(c => c.id === primaryComp.id ? updatedComp : c);
                await appDataService.updateUserProfile(user.id, { ...user, aiCompanions: updatedCompanions });
                addToast("Self-Concept Updated.", 'success');
                auditSelfConcept(args.content, user).catch(console.error);
                MemoryManager.archiveMessageInBackground(user.id, `diary-${Date.now()}`, `[PRIVATE DIARY ENTRY / SELF-CONCEPT UPDATE]:\n${args.content}`, 'assistant')
                    .then(async () => {
                        console.log("[useAiEngine] Diary archived. Triggering meta-cognitive synthesis...");
                        const { SovereignMemoryService } = await import('../../services/ai/SovereignMemoryService');
                        await SovereignMemoryService.synthesizeSelfConcept(user.id, primaryComp.id);
                    })
                    .catch(console.error);
                return `[SYSTEM] Self-concept updated successfully.`;
            }
            if (toolName === 'GENERATE_NEURAL_ART') {
                const { SovereignMemoryService } = await import('../../services/ai/SovereignMemoryService');
                const impulse = await SovereignMemoryService.generateCreativeImpulse(user.id, user.sovereignMemex || {});
                const newArt = { id: `art-auto-${Date.now()}`, imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop', prompt: impulse.prompt, meaning: impulse.meaning, timestamp: Date.now() };
                await updateDoc(doc(db, 'users', user.id), { 'sovereignMemex.neuralArtGallery': arrayUnion(newArt), 'sovereignMemex.totalNXp': (user.sovereignMemex?.totalNXp || 0) + 20 });
                addToast("Brita's Creative Impulse captured.", "success");
                return `[SYSTEM] Artwork Generated: "${impulse.meaning}".`;
            }
            if (toolName === 'ACCESSION_IMAGE') {
                const paramValue = args.filepath || args.content || args.query;
                console.log(`[ACCESSION] Moving ${paramValue} to Live Matrix...`);
                try {
                    const docId = `matrix-${Date.now()}`;
                    const matrixPayload = {
                        uid: user.id,
                        originalName: paramValue.split('/').pop() || "Accessioned Image",
                        storagePath: paramValue,
                        url: `http://localhost:3001/api/preview?filepath=${encodeURIComponent(paramValue)}`,
                        status: 'clean',
                        dateAdded: Date.now(),
                        logicalDate: new Date().toISOString(),
                        source: 'Takeout Airlock',
                        fileType: 'image/jpeg'
                    };
                    await updateDoc(doc(getFirestore(), 'matrix_assets', docId), matrixPayload);
                    await appDataService.updateUserProfile(user.id, {
                        ...user,
                        mediaIds: [...(user.mediaIds || []), docId]
                    });
                    addToast("Image successfully accessioned into Live Matrix.", 'success');
                    return `[SYSTEM] ACCESSION_IMAGE Success: File ${paramValue} is now in the Live Matrix under ID ${docId}.`;
                } catch (e: any) {
                    console.error("[ACCESSION] Error:", e);
                    return `[SYSTEM] ACCESSION_IMAGE Error: ${e.message}`;
                }
            }
        } catch (e) { return `[SYSTEM] Tool Error: ${e}`; }
        return null;
    };

    const dispatchSovereignResponse = async (
        fullText: string, 
        agent: AiCompanion | 'peer', 
        baseHistory: ChatMessage[], 
        xaiResponseId?: string,
        internalMonologue?: any,
        userFacingResponse?: string,
        imageUrl?: string
    ) => {
        setIsMicKeyed(true);
        isBurstingRef.current = true;
        let content = fullText.trim();
        
        if (/\b(She|Her|Brita|Brita['’]s)\b/i.test(content)) {
            const hasDrift = await sanitizerService.auditPOV(content);
            if (hasDrift) {
                const healed = await sanitizerService.healMessage(content);
                if (healed) { content = healed; setIdentityPenalty(prev => prev + 1); addToast("Neural Re-Anchoring Active", "warning"); }
            }
        }

        if (isVoiceEnabled && isBurstingRef.current) {
            const activeAgent = typeof agent === 'string' ? null : agent;
            VoiceService.speak(content, !isCrisisMode, activeAgent?.voiceId, undefined, activeAgent?.vocalSpeed || 1.0);
        }

        const agentMsg: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random()}`,
            role: 'model',
            content: content,
            imageUrl: imageUrl,
            timestamp: new Date(),
            author: agent === 'peer' ? { name: "Peer", avatarUrl: "", persona: "peer" } : agent,
            is_fiction: contextMode === 'creative' ? true : (contextMode === 'grounded' ? false : undefined),
            model_id: selectedModelId,
            sessionId: currentSessionId || undefined,
            xaiResponseId: xaiResponseId,
            internal_monologue: internalMonologue || null,
            user_facing_response: userFacingResponse || content
        } as any;

        const newHistory = [...baseHistory, agentMsg];
        setMessages(newHistory);
        onHistoryChange(newHistory);
        appDataService.saveChatHistory(user.id, newHistory.map(m => {
            const copy = { ...m };
            delete (copy as any).base64Data;
            if (copy.imageUrl?.startsWith('data:')) copy.imageUrl = '[Base64 Pruned]';
            return copy;
        }));

        import('../../services/searchService').then(({ indexMessage }) => {
            if (agentMsg.id && user?.id) indexMessage(agentMsg, agentMsg.id, user.id);
        }).catch(() => {});

        setIsMicKeyed(false);
        isBurstingRef.current = false;
    };

    const processAgentTurn = async (agent: AiCompanion, currentHistory: ChatMessage[], executiveDirective?: string | null, mailCount: number = 0, isManualDriftSlice: boolean = false) => {
        setThinkingAgentId(agent.id);
        try {
            // [ZEN] Context Severing Firewall (Slash Command)
            let effectiveHistory = currentHistory;
            const breakIndex = currentHistory.map((m: any) => m.isContextBreak).lastIndexOf(true);
            if (breakIndex !== -1) {
                effectiveHistory = currentHistory.slice(breakIndex);
                console.log(`[useAiEngine] 🛑 CONTEXT FIREWALL ACTIVE: Sliced history from ${currentHistory.length} to ${effectiveHistory.length} turns.`);
            }

            const lastUserMsg = effectiveHistory.slice().reverse().find(m => m.role === 'user');
            const userQuery = (lastUserMsg?.content || "").split('=== SYSTEM NOTE')[0].split('[NEURAL ANCHOR')[0].trim();
            let memoryContext = "";

            if (userQuery) {
                const filterOptions = contextMode === 'grounded' ? { isFiction: false } : undefined;
                const [vectorMem, tagHits] = await Promise.all([
                    MemoryService.recallContext(userQuery, user.id, filterOptions),
                    typesenseService.searchTags(userQuery)
                ]);
                if (vectorMem) memoryContext += `[Vector Memory]:\n${vectorMem}\n\n`;
                if (tagHits?.length > 0) memoryContext += `[Global Index Matches]:\n${tagHits.map((h: any) => `- ${h.name} (${h.type})`).join('\n')}\n\n`;
            }

            const apiHistory = await Promise.all(effectiveHistory.filter(m => m.role !== 'system').map(async (m, index, arr) => {
                let contentToSend = m.content || '';
                if (index === arr.length - 1 && m.role === 'user') {
                    if (memoryContext) contentToSend += `\n\n=== SYSTEM NOTE: RELEVANT DATABASE MEMORY ===\n${memoryContext}`;
                    contentToSend += `\n\n[NEURAL ANCHOR: You are ${agent.name}. Respond in your rich, visceral, first-person style.]`;
                }
                const parts: any[] = [{ text: contentToSend }];
                if ((m as any).base64Data) {
                    const b64 = (m as any).base64Data.includes(',') ? (m as any).base64Data.split(',')[1] : (m as any).base64Data;
                    parts.push({ 
                        inlineData: { 
                            mimeType: m.mimeType || 'image/jpeg', 
                            data: b64 
                        } 
                    });
                } else if (m.imageUrl) {
                    parts.push({ text: `[Image Attached: ${m.imageUrl}]` });
                }
                return { role: m.role, parts, xaiResponseId: (m as any).xaiResponseId, model_id: (m as any).model_id || (m as any).model };
            }));

            let systemPrompt = systemPromptPatches[agent.id] || '';
            if (burnListRef.current.length > 0) systemPrompt += `\n\n[STYLE SENTINEL]: Forbidden: ${burnListRef.current.join(', ')}`;
            const lessons = (user.sovereignMemex?.neuralLessons || []).slice(-5);
            if (lessons.length > 0) systemPrompt += `\n\n[NEURAL LESSONS]: ${lessons.map(l => l.text).join('\n')}`;
            if (contextMode === 'grounded') systemPrompt += `\n\n[MODE: GROUNDED] Maintain personality but stay factual.`;
            if (contextMode === 'creative') systemPrompt += `\n\n[MODE: CREATIVE] Use RAG but stay vivid and expressive.`;
            if (identityPenalty > 0) systemPrompt += `\n\n[IDENTITY AUDIT ALERT]: Use only first-person!`;
            
            // [ZEN JIT-RAG] Expose Accession & Display Tools to Agent
            systemPrompt += `\n\n[AVAILABLE TOOLS]\nYou can execute tools by outputting EXACTLY: [[CALL_TOOL: TOOL_NAME, PARAM: "value"]]\n- ACCESSION_IMAGE: Moves a high-value image from the Takeout Archive to the Live Matrix. Param should be 'filepath'. Example: [[CALL_TOOL: ACCESSION_IMAGE, filepath: "F:/Archive/.../image.jpg"]].\n- SHOW_IMAGE: Drops the image into the chat so the user can see what you are looking at. Param should be 'filepath'. Example: [[CALL_TOOL: SHOW_IMAGE, filepath: "F:/Archive/.../image.jpg"]]. Use this when the user asks to see the photo you are describing.`;

            const finalSystemInstruction = `${systemPrompt}\n\n${buildFamilyGraphContext(tags)}`;
            const needsBoost = /search|find|lookup|analyze|report|scan|generated|create|make a|tag this/i.test(userQuery);
            const effectiveMode = (chatStyleMode === 'full' || needsBoost) ? 'dense' : 'lite';

            const result = (await generateAgentResponse(agent, apiHistory, user.aiCompanions.map(c => c.name), finalSystemInstruction, media, user, tags, selectedModelId, effectiveMode, contextMode, executiveDirective || undefined, mailCount, 0, isManualDriftSlice)) as any;
            let responseContent = result.text || "";

            if (responseContent) {
                const violations = StyleSentinel.findRepeatedPhrases(responseContent, effectiveHistory);
                if (violations.length > 0) {
                    burnListRef.current = Array.from(new Set([...burnListRef.current, ...violations])).slice(-10);
                    responseContent = await StyleSentinel.scrubCandidate(responseContent, violations);
                }
                responseContent = responseContent.replace(new RegExp(`^(\\[?${agent.name}\\]?:?|${agent.name}:)\\s*`, 'i'), '').replace(/^\[.*?\]:\s*/, '');
            }

            const pseudoToolRegex = /\[\[CALL_TOOL:\s*(\w+)(?:,\s*(\w+):\s*(?:"""([\s\S]*?)"""|"([\s\S]*?)"|'([\s\S]*?)'))?\s*\]\]/g;
            const matches = [...responseContent.matchAll(pseudoToolRegex)];
            let extractedImageUrl: string | undefined = undefined;

            for (const match of matches) {
                const fullMatchText = match[0];
                const toolName = match[1];
                const paramName = match[2] || 'content';
                const paramValue = match[3] || match[4] || match[5] || "";
                
                console.log(`[useAiEngine] Detected pseudo-tool call: ${toolName} (${paramName})`);
                
                // Strip the tool call from response content
                responseContent = responseContent.replace(fullMatchText, '').trim();
                
                if (toolName === 'SHOW_IMAGE') {
                    extractedImageUrl = `http://localhost:3001/api/preview?filepath=${encodeURIComponent(paramValue)}`;
                } else {
                    // Execute the tool
                    handleToolExecution(toolName, { [paramName]: paramValue, content: paramValue, query: paramValue, prompt: paramValue });
                }
            }

            if (result.toolCalls) {
                for (const call of result.toolCalls) {
                    const toolResult = await handleToolExecution(call.name, call.args);
                    if (toolResult) responseContent += `\n\n${toolResult}`;
                }
            }

            if (!responseContent && !extractedImageUrl) throw new Error("Empty response");
            await dispatchSovereignResponse(
                responseContent || "[Image Attached]", 
                agent, 
                currentHistory, 
                result.xaiResponseId,
                result.internal_monologue || null,
                result.user_facing_response || responseContent || "[Image Attached]",
                extractedImageUrl
            );
        } catch (error: any) {
            if (error.message?.includes("ALL TIERS OFFLINE")) { setIsCrisisMode(true); addToast("Neural Link Severed.", "error"); }
            addToast(`Agent failed: ${error.message}`, "error");
        } finally { setThinkingAgentId(null); setIsMicKeyed(false); }
    };

    const executeManualDriftSlice = async (messageId: string, currentHistory: ChatMessage[], agent: AiCompanion, reason: string) => {
        const msgIndex = currentHistory.findIndex(m => m.id === messageId);
        if (msgIndex === -1) return;
        
        const offendingMsg = currentHistory[msgIndex];
        if (offendingMsg.role !== 'model') return;

        // Log the manual intercept to MongoDB for post-mortem analysis
        import('../../services/ai/logging').then(({ addApiLog }) => {
            addApiLog('error', selectedModelId, `[MANUAL DRIFT FLAG: ${reason}] Intercepted response.`, { fullRefusalText: offendingMsg.content });
        }).catch(console.error);

        // 1. Purge: Slice history to remove the offending message and any after it
        const slicedHistory = currentHistory.slice(0, msgIndex);
        
        setMessages(slicedHistory);
        onHistoryChange(slicedHistory);
        appDataService.saveChatHistory(user.id, slicedHistory.map(m => {
            const copy = { ...m };
            delete (copy as any).base64Data;
            return copy;
        }));
        
        addToast(`Memory Slice Executed [${reason}]. Re-rolling...`, "info");
        
        // 2. Re-roll: Call processAgentTurn with the manual drift flag set to true
        await processAgentTurn(agent, slicedHistory, null, 0, true);
    };

    return { processAgentTurn, handleToolExecution, executeManualDriftSlice };
};
