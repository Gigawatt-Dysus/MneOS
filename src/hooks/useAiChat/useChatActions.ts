import { useRef } from 'react';
import { getFirestore, doc, updateDoc, deleteDoc, writeBatch, serverTimestamp, addDoc, collection } from '../../services/sovereignDbAdapter';
import type { ChatMessage, User, AiCompanion, Toast, GigiJournalEntry, Tag } from '../../types';
import { appDataService } from '../../services/serviceManager';
import { MemoryManager } from '../../services/memoryManager';
import { typesenseService } from '../../services/typesenseService';
import { uploadFile } from '../../services/storageService';
import { blobToBase64 } from '../../utils/fileUtils';
import { cleanProse } from './utils';

export const useChatActions = (
    user: User,
    messages: ChatMessage[],
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    messagesRef: React.MutableRefObject<ChatMessage[]>,
    onHistoryChange: (history: ChatMessage[]) => void,
    userInput: string,
    setUserInput: React.Dispatch<React.SetStateAction<string>>,
    stagedFile: any,
    setStagedFile: React.Dispatch<React.SetStateAction<any>>,
    isProcessingRef: React.MutableRefObject<boolean>,
    thinkingAgentId: string | null,
    isCrisisMode: boolean,
    unreadMailCount: number,
    setUnreadMailCount: React.Dispatch<React.SetStateAction<number>>,
    deletedMessagesBuffer: any[],
    setDeletedMessagesBuffer: React.Dispatch<React.SetStateAction<any[]>>,
    contextMode: string,
    inputProcessMode: string,
    setIsEnhancingInput: React.Dispatch<React.SetStateAction<boolean>>,
    addToast: (msg: string, type: Toast['type'], action?: any) => void,
    processAgentTurn: (agent: AiCompanion, history: ChatMessage[], directive?: string | null, mailCount?: number) => Promise<void>,
    apiKeySkipped: boolean,
    tags: Tag[],
    selectedMsgIds: Set<string>,
    setSelectedMsgIds: React.Dispatch<React.SetStateAction<Set<string>>>,
    setIsBulkMode: React.Dispatch<React.SetStateAction<boolean>>,
    currentSessionId?: string | null
) => {
    const db = getFirestore();

    const submitMessage = async (isFrozen: boolean, executiveDirective?: string) => {
        if (isFrozen || (!userInput.trim() && !stagedFile) || thinkingAgentId || isProcessingRef.current) return;
        isProcessingRef.current = true;
        const currentInput = userInput.trim();
        const msgId = `msg-${Date.now()}`;
        setUserInput('');
        setStagedFile(null);

        try {
            let processedInput = currentInput;
            let isContextBreak = false;
            if (currentInput.toLowerCase().startsWith('/new_topic:') || currentInput.toLowerCase().startsWith('/focus:')) {
                processedInput = currentInput.replace(/^\/(new_topic|focus):\s*/i, '').trim();
                isContextBreak = true;
                addToast("Context Severed. New Epoch Initiated.", "info");
            }

            if (inputProcessMode === 'polish') processedInput = cleanProse(processedInput);
            else if (inputProcessMode === 'enhance' && processedInput.length > 3) {
                setIsEnhancingInput(true);
                try {
                    const { rewriteMessage, analyzeStyle } = await import('../../services/ai/editorial');
                    const style = await analyzeStyle(currentInput, messages.filter(m => m.role === 'user').slice(-6));
                    processedInput = await rewriteMessage({ ...style, text: currentInput, authorRole: 'user', chatHistory: messages.slice(-6), executiveDirective }, (await import('../../services/ai/config')).getPrimaryModelId());
                    addToast("Signal Synchronized.", "success");
                } catch (e) { processedInput = cleanProse(currentInput); }
                finally { setIsEnhancingInput(false); }
            }

            if (isCrisisMode) {
                await addDoc(collection(db, 'users', user.id, 'neural_mailbox'), { content: processedInput, timestamp: serverTimestamp(), read: false, type: 'outage_memo' });
                setUnreadMailCount(prev => prev + 1);
            }

            const userMessage: ChatMessage = { 
                id: msgId, 
                role: 'user', 
                content: processedInput, 
                timestamp: new Date(),
                isContextBreak: isContextBreak,
                sessionId: currentSessionId || undefined
            } as any;
            if (stagedFile) {
                const { url, base64 } = await uploadFile(stagedFile.file, user.id, `chat-${Date.now()}-${stagedFile.file.name}`);
                userMessage.imageUrl = url;
                (userMessage as any).base64Data = base64;
                userMessage.mimeType = stagedFile.file.type;
            }

            const historyWithUserMsg = [...messages, userMessage];
            setMessages(historyWithUserMsg);
            onHistoryChange(historyWithUserMsg);
            await appDataService.saveChatHistory(user.id, historyWithUserMsg.map(m => {
                const copy = { ...m };
                delete (copy as any).base64Data;
                return copy;
            }));

            if (currentInput) {
                setTimeout(() => MemoryManager.archiveMessageInBackground(user.id, msgId, currentInput, 'user'), 0);
            }

            if (!apiKeySkipped) {
                const speaker = currentInput.toLowerCase().includes(`@${user.aiCompanions[1]?.name.toLowerCase()}`) ? user.aiCompanions[1] : (user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0]);
                await processAgentTurn(speaker as any, historyWithUserMsg, executiveDirective, unreadMailCount);
            }
        } catch (error) { addToast("Failed to send message.", "error"); }
        finally { setTimeout(() => { isProcessingRef.current = false; }, 500); }
    };

    const handleDeleteMessage = async (index: number) => {
        isProcessingRef.current = true;
        try {
            const msg = messages[index];
            const msgId = (msg as any).id;
            if (msgId) {
                await updateDoc(doc(db, 'users', user.id, 'chat_segments', msgId), { isDeleted: true, deletedAt: Date.now() });
                typesenseService.deleteChatMessage(msgId);
                setDeletedMessagesBuffer(prev => [...prev, { ...msg, originalIndex: index }].slice(-10));
                const newHistory = [...messages];
                newHistory.splice(index, 1);
                setMessages(newHistory);
                onHistoryChange(newHistory);
                addToast("Signal Vaporized.", "warning", { label: "UNDO", onClick: () => undoDeletion() });
            }
        } catch (e) { addToast("Failed to delete message.", 'error'); }
        finally { setTimeout(() => { isProcessingRef.current = false; }, 500); }
    };

    const undoDeletion = async () => {
        if (deletedMessagesBuffer.length === 0) return;
        isProcessingRef.current = true;
        try {
            const restoredMsg = deletedMessagesBuffer[deletedMessagesBuffer.length - 1];
            if ((restoredMsg as any).id) {
                await updateDoc(doc(db, 'users', user.id, 'chat_segments', (restoredMsg as any).id), { isDeleted: false, deletedAt: null });
                const newHistory = [...messages];
                newHistory.splice(restoredMsg.originalIndex, 0, restoredMsg);
                setMessages(newHistory);
                onHistoryChange(newHistory);
                setDeletedMessagesBuffer(prev => prev.slice(0, -1));
                addToast("Signal Restored.", "success");
            }
        } catch (e) { addToast("Restoration failed.", "error"); }
        finally { setTimeout(() => { isProcessingRef.current = false; }, 500); }
    };

    const handleVaultChat = async (scope: string, n?: number) => {
        if (messages.length === 0) return;
        let targets = messages;
        if (scope === '24h') targets = messages.filter(m => new Date(m.timestamp).getTime() > Date.now() - 86400000);
        else if (scope === 'lastN' && n) targets = messages.slice(-n);

        const markdown = `# Neural Transcript\n\n${targets.map(m => `**${m.role === 'user' ? 'Eric' : (m.author?.name || 'AI')}**: ${m.content}`).join('\n\n')}`;
        const newEntry: GigiJournalEntry = { id: `vault-${Date.now()}`, title: `Transcript (${targets.length} msgs)`, content: markdown, creationDate: new Date(), type: 'conversation', read: true, reactions: [], comments: [], relatedChatHistory: [] };
        await appDataService.saveGigiJournalEntry(user.id, newEntry);
        addToast(`Vaulted ${targets.length} messages.`, "success");
    };

    const handleEditMessage = async (index: number, newContent: string) => {
        isProcessingRef.current = true;
        try {
            const msgToEdit = messages[index];
            const newHistory = [...messages];
            newHistory[index] = { ...msgToEdit, content: newContent, _manually_edited: true };
            setMessages(newHistory);
            onHistoryChange(newHistory);

            let msgId = (msgToEdit as any).id;
            if (msgId) {
                typesenseService.updateChatMessage(msgId, newContent);
                await appDataService.updateChatMessage(user.id, msgId, { content: newContent, _manually_edited: true });
                addToast("Message updated.", "success");
            }
        } catch (e) { console.error("Edit failed", e); }
        finally { setTimeout(() => { isProcessingRef.current = false; }, 500); }
    };

    const handleCognitiveOverride = async (pruneAfterId: string, directiveText: string, valence: 'reward' | 'penalty' | 'validation' = 'penalty', categories?: string[], originalDraftAxiom?: string) => {
        isProcessingRef.current = true;
        addToast(`Initiating Forensic Audit...`, "info");
        try {
            const index = messages.findIndex(m => m.id === pruneAfterId);
            if (index === -1) return;
            const failedContent = messages[index].content;
            const newHistory = messages.slice(0, index + 1);
            const messagesToDelete = messages.slice(index + 1);

            const batch = writeBatch(db);
            for (const msg of messagesToDelete) {
                if (msg.id) batch.update(doc(db, 'users', user.id, 'chat_segments', msg.id), { isDeleted: true, deletedAt: Date.now() });
            }
            await batch.commit();
            setMessages(newHistory);
            onHistoryChange(newHistory);

            const { SovereignMemoryService } = await import('../../services/ai/SovereignMemoryService');
            await SovereignMemoryService.forgeCoreDirective(user.id, directiveText, valence === 'validation' ? 'penalty' : valence, failedContent, categories);
            addToast("Timeline pruned and Rule established.", "success");

            const lastMsg = newHistory[newHistory.length - 1];
            if (lastMsg.role === 'user') {
                const speaker = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
                await processAgentTurn(speaker, newHistory, null, unreadMailCount);
            }
        } catch(e) { addToast("Override failed.", "error"); }
        finally { isProcessingRef.current = false; }
    };

    const injectMessage = async (message: ChatMessage) => {
        try {
            const newHistory = [...messages, message];
            // [ZEN FIX] Chronos Injection: Prioritize Original Creation Time
            newHistory.sort((a, b) =>
                new Date((a as any).createdAt || a.timestamp).getTime() - new Date((b as any).createdAt || b.timestamp).getTime()
            );
            setMessages(newHistory);
            onHistoryChange(newHistory);
            await appDataService.saveChatHistory(user.id, newHistory.map(m => {
                const copy = { ...m };
                delete (copy as any).base64Data;
                return copy;
            }));
            return true;
        } catch (e) { return false; }
    };

    const handleBulkDelete = async () => {
        if (selectedMsgIds.size === 0) return;
        const count = selectedMsgIds.size;
        console.log(`[AiChat] 🛡️ Initializing Mass Vaporization for ${count} signals...`);
        addToast(`Vaporizing ${count} signals...`, 'info');

        const newHistory = [...messagesRef.current]; // Use ref for latest
        const idsArray = Array.from(selectedMsgIds);
        const deletedMsgs: (ChatMessage & { originalIndex: number })[] = [];

        try {
            const batch = writeBatch(db);
            const typesenseDeletions: Promise<any>[] = [];
            
            for (const id of idsArray) {
                const index = newHistory.findIndex(m => (m as any).id === id);
                if (index !== -1) {
                    const msg = newHistory[index];
                    deletedMsgs.push({ ...msg, originalIndex: index });
                    
                    // Firestore soft delete
                    console.log(`[AiChat] Queuing Firestore delete: ${id}`);
                    const docRef = doc(db, 'users', user.id, 'chat_segments', id);
                    batch.update(docRef, { 
                        isDeleted: true,
                        deletedAt: Date.now(),
                        updatedAt: serverTimestamp()
                    });

                    // Typesense purge (queue promise)
                    typesenseDeletions.push(typesenseService.deleteChatMessage(id));
                } else {
                    console.warn(`[AiChat] Message ID ${id} not found in current history buffer.`);
                }
            }

            console.log(`[AiChat] Committing Firestore batch...`);
            await batch.commit();
            console.log(`[AiChat] Firestore batch committed. Syncing Typesense...`);
            
            await Promise.all(typesenseDeletions);
            console.log(`[AiChat] Typesense purge complete.`);

            // Local state update
            const filteredHistory = newHistory.filter(m => !selectedMsgIds.has((m as any).id));
            setMessages(filteredHistory);
            onHistoryChange(filteredHistory);
            
            // Add to buffer for Vortex protection
            setDeletedMessagesBuffer(prev => [...prev, ...deletedMsgs]);

            addToast(`Vaporized ${count} signals. Neural path cleaned.`, 'success');
            console.log(`[AiChat] ✅ Mass Vaporization Successful.`);
            setSelectedMsgIds(new Set());
            setIsBulkMode(false);

        } catch (error) {
            console.error("[AiChat] 🚨 Bulk Delete Failed:", error);
            addToast("Mass vaporization failed. Check link status.", "error");
        }
    };

    const handleBulkSetFiction = async (status: boolean) => {
        if (selectedMsgIds.size === 0) return;
        addToast(`Updating ${selectedMsgIds.size} messages...`, 'info');

        const newHistory = [...messages];
        let updateCount = 0;

        for (const id of Array.from(selectedMsgIds)) {
            const index = newHistory.findIndex(m => (m as any).id === id);
            if (index !== -1) {
                newHistory[index] = { ...newHistory[index], fiction: status } as any;
                updateCount++;
                typesenseService.setFictionStatus(id, status);
            }
        }

        if (updateCount > 0) {
            setMessages(newHistory);
            onHistoryChange(newHistory);
            await appDataService.saveChatHistory(user.id, newHistory.map(m => {
                const copy = { ...m };
                delete (copy as any).base64Data;
                return copy;
            }));
            addToast(`Updated ${updateCount} messages via Historian's Brush.`, 'success');
            setSelectedMsgIds(new Set());
            setIsBulkMode(false);
        }
    };

    const handleCommitSparkEdit = async (messageId: string, originalText: string, editedText: string) => {
        const index = messages.findIndex(m => m.id === messageId);
        if (index === -1) return;
        
        await handleEditMessage(index, editedText);

        // Background Harvester
        try {
            const { SovereignMemoryService } = await import('../../services/ai/SovereignMemoryService');
            await SovereignMemoryService.harvestDiffDirective(user.id, originalText, editedText);
        } catch (e) {
            console.warn("[AiChat] Harvester failed", e);
        }
    };

    return {
        submitMessage,
        handleDeleteMessage,
        undoDeletion,
        handleVaultChat,
        handleEditMessage,
        handleCognitiveOverride,
        injectMessage,
        handleBulkDelete,
        handleBulkSetFiction,
        handleCommitSparkEdit
    };
};
