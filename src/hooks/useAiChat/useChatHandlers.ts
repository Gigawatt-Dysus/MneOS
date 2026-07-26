import { useCallback } from 'react';
import { getFirestore, doc, updateDoc } from '../../services/sovereignDbAdapter';
import type { ChatMessage, User, Toast, Media, AiCompanion } from '../../types';
import { typesenseService } from '../../services/typesenseService';
import { VoiceService } from '../../services/ai/voiceService';

export const useChatHandlers = (
    user: User,
    messages: ChatMessage[],
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    onHistoryChange: (history: ChatMessage[]) => void,
    isCrisisMode: boolean,
    isVoiceEnabled: boolean,
    setStagedFile: React.Dispatch<React.SetStateAction<any>>,
    addToast: (msg: string, type: Toast['type']) => void,
    isProcessingRef: React.MutableRefObject<boolean>,
    MAX_FILE_SIZE_BYTES: number,
    MAX_FILE_SIZE_MB: number
) => {
    const handleSetFiction = async (msg: ChatMessage, status: boolean) => {
        const index = messages.findIndex(m => m.id === msg.id);
        if (index === -1) return;
        const newHistory = [...messages];
        newHistory[index] = { ...newHistory[index], fiction: status, is_fiction: status } as any;
        setMessages(newHistory);
        onHistoryChange(newHistory);
        try {
            if (msg.id) {
                const db = getFirestore();
                updateDoc(doc(db, "users", user.id, "chat_segments", msg.id), { fiction: status, is_fiction: status }).catch(console.error);
                await typesenseService.setFictionStatus(msg.id, status);
                addToast(status ? "Context: Creative" : "Context: Grounded", "info");
            }
        } catch (e) { console.error("Failed to update fiction status", e); }
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
        } catch (e) { console.error("Reaction failed", e); }
        finally { setTimeout(() => { isProcessingRef.current = false; }, 500); }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE_BYTES) {
                alert(`File too large (Max ${MAX_FILE_SIZE_MB}MB).`);
                return;
            }
            const isVideo = file.type.startsWith('video/');
            const isDocument = file.name.endsWith('.pdf') || file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.json') || file.type.startsWith('application/') || file.type.startsWith('text/');
            const type = isVideo ? 'video' : isDocument ? 'document' : 'image';
            setStagedFile({ file, previewUrl: URL.createObjectURL(file), type });
        }
    };

    const handleSpeak = useCallback((text: string, voiceId?: string, modelId?: string, companionId?: string, isUser: boolean = false) => {
        const agent = user.aiCompanions.find(c => c.id === companionId) || user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
        const speed = agent?.vocalSpeed || 1.0;
        const finalContent = agent?.voiceTag ? `${agent.voiceTag} ${text}` : text;
        VoiceService.speak(finalContent, !isCrisisMode, voiceId, modelId, speed, isUser);
    }, [isCrisisMode, user.aiCompanions]);

    const handleDownloadAudio = useCallback((text: string, voiceId?: string, modelId?: string, companionId?: string, isUser: boolean = false) => {
        console.log(`[useAiChat] 📣 Neural Archive Signal Emitted: "${text.substring(0, 30)}..."`);
        const agent = user.aiCompanions.find(c => c.id === companionId) || 
                      user.aiCompanions.find(c => c.voiceId === voiceId) || 
                      user.aiCompanions.find(c => c.isPrimary) || 
                      user.aiCompanions[0];
        const speed = agent?.vocalSpeed || 1.0;
        const finalContent = agent?.voiceTag ? `${agent.voiceTag} ${text}` : text;
        VoiceService.download(finalContent, !isCrisisMode, voiceId, modelId, speed, isUser);
    }, [isCrisisMode, user.aiCompanions]);

    const handleCompanionUpdate = useCallback(async (updatedCompanion: AiCompanion) => {
        if (!user?.id) return;
        try {
            const db = getFirestore();
            const userDocRef = doc(db, 'users', user.id);
            const updatedCompanions = user.aiCompanions.map(c => 
                c.id === updatedCompanion.id ? updatedCompanion : c
            );
            await updateDoc(userDocRef, { aiCompanions: updatedCompanions });
            addToast(`Neural profile for ${updatedCompanion.name} synchronized.`, 'success');
        } catch (err: any) {
            console.error("[NeuralBridge] Companion update failed:", err);
            addToast(`Vocal synchronization failed: ${err.message}`, 'error');
        }
    }, [user?.id, user?.aiCompanions, addToast]);

    return { handleSetFiction, handleReaction, handleFileUpload, handleSpeak, handleDownloadAudio, handleCompanionUpdate };
};
