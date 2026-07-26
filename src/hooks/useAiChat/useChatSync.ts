import { useEffect, useRef } from 'react';
import { collection, getDocs, query, where, getFirestore, doc, updateDoc } from '../../services/sovereignDbAdapter';
import { getPrimaryModelId } from '../../services/ai/config';
import { librarianQueue } from '../../services/enrichmentService';
import { getEmbedding } from '../../services/ai/providers';
import { deduplicateMessages } from './utils';
import type { ChatMessage, User, Toast } from '../../types';

export const useChatSync = (
    user: User,
    chatHistory: ChatMessage[],
    messages: ChatMessage[],
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    messagesRef: React.MutableRefObject<ChatMessage[]>,
    isCrisisMode: boolean,
    setIsCrisisMode: React.Dispatch<React.SetStateAction<boolean>>,
    setUnreadMailCount: React.Dispatch<React.SetStateAction<number>>,
    setIsLibrarianBusy: React.Dispatch<React.SetStateAction<boolean>>,
    setEnrichmentStatus: React.Dispatch<React.SetStateAction<'idle' | 'active' | 'error'>>,
    deletedMessagesBuffer: any[],
    addToast: (msg: string, type: Toast['type']) => void,
    isDataLoading: boolean
) => {
    const isInitializedRef = useRef(false);
    const isProcessingRef = useRef(false);
    const healingInProgressRef = useRef<Set<string>>(new Set());
    const lastHistorySnapshotRef = useRef<string>('');
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const db = getFirestore();

    // 1. Crisis Recovery & Mailbox Sync
    useEffect(() => {
        if (!user?.id) return;
        const checkMailbox = async () => {
            const q = query(collection(db, 'users', user.id, 'neural_mailbox'), where('read', '==', false));
            const snap = await getDocs(q);
            setUnreadMailCount(snap.size);
        };
        checkMailbox();

        if (isCrisisMode) {
            const interval = setInterval(async () => {
                try {
                    const xaiKey = getPrimaryModelId();
                    if (xaiKey) {
                        setIsCrisisMode(false);
                        console.log("%c[AiChat] 💚 Neural Link Stabilized.", "color: #00ff00; font-weight: bold;");
                        clearInterval(interval);
                    }
                } catch (e) {}
            }, 60000);
            return () => clearInterval(interval);
        }
    }, [user?.id, isCrisisMode]);

    // 2. Librarian Status Subscription
    useEffect(() => {
        return librarianQueue.subscribe((status) => {
            if (status === 'busy') {
                setIsLibrarianBusy(true);
                setEnrichmentStatus('active');
            } else if (status === 'error') {
                setIsLibrarianBusy(false);
                setEnrichmentStatus('error');
            } else {
                setIsLibrarianBusy(false);
                setEnrichmentStatus('idle');
            }
        });
    }, []);

    // 3. Neural Bridge (Ghost Healing)
    useEffect(() => {
        if (!isInitializedRef.current || isProcessingRef.current) return;

        const nakedMessages = messages.filter(m => 
            m.id && !m.embedding && m.content && m.content.length > 5 && 
            !(m as any)._skipEmbedding && !healingInProgressRef.current.has(m.id) &&
            (m.source === 'email' || m.source === 'email_batch' || m.source === 'alexa')
        );

        if (nakedMessages.length > 0) {
            const healSequence = async () => {
                for (const msg of nakedMessages) {
                    const msgId = msg.id!;
                    healingInProgressRef.current.add(msgId);
                    try {
                        const vector = await getEmbedding(msg.content);
                        if (vector) {
                            await updateDoc(doc(db, 'users', user.id, 'chat_segments', msgId), { embedding: vector });
                        } else {
                            (msg as any)._skipEmbedding = true;
                        }
                    } catch (e) {
                        (msg as any)._skipEmbedding = true;
                    } finally {
                        setTimeout(() => healingInProgressRef.current.delete(msgId), 5000);
                    }
                    await new Promise(r => setTimeout(r, 100));
                }
            };
            healSequence();
        }
    }, [messages, user.id]);

    // 4. Initial Load
    useEffect(() => {
        if (!isInitializedRef.current && !isDataLoading) {
            const vaporizedIds = new Set(deletedMessagesBuffer.map(m => m.id).filter(Boolean));
            const synced = deduplicateMessages(chatHistory, vaporizedIds);
            const timelineHistory = synced.sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            setMessages(timelineHistory);
            isInitializedRef.current = true;
        }
    }, [chatHistory, isDataLoading, deletedMessagesBuffer]);

    // 5. Smart Sync
    useEffect(() => {
        if (!chatHistory || chatHistory.length === 0) return;
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        
        syncTimeoutRef.current = setTimeout(() => {
            const fullSnapshot = JSON.stringify(chatHistory.map(m => m.id));
            if (fullSnapshot === lastHistorySnapshotRef.current && !isProcessingRef.current) return;
            lastHistorySnapshotRef.current = fullSnapshot;

            const now = Date.now();
            let hasHealedAny = false;
            const auditedHistory = chatHistory.map(m => {
                const date = (m.timestamp && typeof m.timestamp === 'object' && 'toDate' in m.timestamp) 
                    ? (m.timestamp as any).toDate() : new Date(m.timestamp);
                if (date.getTime() > now + 30000) {
                    const localMsg = messagesRef.current.find((lm: ChatMessage) => lm.id === m.id);
                    const isAlreadyHealed = localMsg && new Date(localMsg.timestamp).getTime() <= now + 30000;
                    if (!isAlreadyHealed) {
                        hasHealedAny = true;
                        if (m.id) {
                            import('../../services/serviceManager').then(({ appDataService }) => {
                                appDataService.updateChatMessage(user.id, m.id!, { timestamp: new Date(), _zen_healed: true });
                            });
                        }
                    }
                    if (localMsg && isAlreadyHealed) return localMsg;
                    return { ...m, timestamp: new Date(now) };
                }
                return m;
            });

            if (isProcessingRef.current || !isInitializedRef.current) return;

            const currentIds = new Set(messagesRef.current.map((m: ChatMessage) => m.id).filter(Boolean));
            const hasNewMessages = auditedHistory.some((m: ChatMessage) => m.id && !currentIds.has(m.id));
            const hasDeletedMessages = messagesRef.current.length > auditedHistory.length;

            if (hasNewMessages || hasHealedAny || hasDeletedMessages) {
                const vaporizedIds = new Set(deletedMessagesBuffer.map(m => m.id).filter(Boolean));
                const combined = [...messagesRef.current, ...auditedHistory];
                const synced = deduplicateMessages(combined, vaporizedIds).sort((a, b) => 
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
                
                if (synced.length === messagesRef.current.length && 
                    synced.every((m: ChatMessage, i: number) => m.id === messagesRef.current[i].id)) return;

                setMessages(synced);
                if (hasHealedAny) addToast("Time Ghosts exorcised.", "success");
            }
        }, 250);

        return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
    }, [chatHistory, deletedMessagesBuffer]);

    return { isInitializedRef, isProcessingRef };
};
