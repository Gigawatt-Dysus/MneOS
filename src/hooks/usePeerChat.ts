import { useState, useEffect, useRef, useCallback } from 'react';
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    limit,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    increment,
    getDoc
} from '../services/sovereignDbAdapter';
import { db } from '../firebaseConfig';
import type { User, PeerChatSegment } from '../types';
import { convertTimestampsToDates, cleanForFirestore } from '../services/sovereignCore';
import { generatePeerResponse } from '../services/aiOrchestrator';
import { MemoryService } from '../services/memoryService';

interface UsePeerChatProps {
    user: User;
    sessionId: string | null;
    activeVertName: string;
    addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const usePeerChat = ({ user, sessionId, activeVertName, addToast }: UsePeerChatProps) => {
    const [messages, setMessages] = useState<PeerChatSegment[]>([]);
    const [participants, setParticipants] = useState<string[]>([]);
    const [lastReadTimestamps, setLastReadTimestamps] = useState<Record<string, number>>({});
    const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({}); // [ZEN NEW]
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Listen for messages in the active session
    useEffect(() => {
        if (!sessionId) {
            setMessages([]);
            return;
        }

        const q = query(
            collection(db, 'peer_chat_sessions', sessionId, 'segments'),
            orderBy('timestamp', 'asc'),
            limit(100)
        );

        const unsub = onSnapshot(q, (snapshot: any) => {
            snapshot.docChanges().forEach((change: any) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    const msg = convertTimestampsToDates({ id: change.doc.id, ...data }) as PeerChatSegment;

                    // Context Bridge: Index AI messages from others
                    if (msg.authorType === 'ai' && msg.fromUid !== user.id) {
                        MemoryService.indexPeerSegment(msg, user.id).catch(console.error);
                    }
                }
            });

            const loaded = snapshot.docs.map((doc: any) => convertTimestampsToDates({ id: doc.id, ...doc.data() }) as PeerChatSegment);
            setMessages(loaded);

            // Check for AI Summoning in the latest message
            const lastMsg = loaded[loaded.length - 1];
            if (lastMsg && lastMsg.authorType === 'human' && !lastMsg.isAiResponse) {
                checkAiSummon(lastMsg);
            }
        });

        return () => unsub();
    }, [sessionId, user.id]);

    // 1.1 Listen to Session Metadata (Participants & Unreads)
    useEffect(() => {
        if (!sessionId) return;
        const unsub = onSnapshot(doc(db, 'peer_chat_sessions', sessionId), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setParticipants(data.participants || []);
                setLastReadTimestamps(data.lastReadTimestamp || {});
                setTypingStatus(data.typing || {}); // [ZEN NEW]

                // Clear OUR unread count & Update Last Read Timestamp
                if (data.unreadCount?.[user.id] > 0 || (data.lastReadTimestamp?.[user.id] || 0) < (data.lastTimestamp || 0)) {
                    updateDoc(snap.ref, {
                        [`unreadCount.${user.id}`]: 0,
                        [`lastReadTimestamp.${user.id}`]: Date.now()
                    }).catch(console.error);
                }
            }
        });
        return () => unsub();
    }, [sessionId, user.id]);

    // 2. AI Summoning Logic
    const checkAiSummon = useCallback(async (msg: PeerChatSegment) => {
        const content = msg.content.toLowerCase();
        const companions = user.aiCompanions;

        // Find if any companion name is mentioned with @
        const summonedAgent = companions.find(c => content.includes(`@${c.name.toLowerCase()}`));

        if (summonedAgent) {
            console.log(`[PeerChat] AI Summoned: ${summonedAgent.name}`);
            triggerAiTurn(summonedAgent, msg);
        }
    }, [user.aiCompanions, sessionId, messages]); // Dependencies updated

    const triggerAiTurn = async (agent: any, triggerMsg: PeerChatSegment) => {
        if (!sessionId) return;
        setIsThinking(true);

        try {
            // RAG Search for the user who owns this AI
            const context = await MemoryService.recallContext(triggerMsg.content, user.id);

            // Generate response specifically for Peer Chat
            const response = await generatePeerResponse(
                agent,
                user,
                messages,
                triggerMsg,
                context,
                activeVertName
            );

            if (response && response.text) {
                await sendMessage(response.text, true, agent.id);
            }
        } catch (e) {
            console.error("[PeerChat] AI Turn failed:", e);
            addToast("AI failed to link in.", "error");
        } finally {
            setIsThinking(false);
        }
    };

    // 3. Send Message Handler
    const sendMessage = async (content: string, isAi: boolean = false, agentId?: string, mediaInfo?: { url: string; mimeType: string, thumbnailUrl?: string }, isSystem: boolean = false) => {
        if (!sessionId || (!content.trim() && !mediaInfo && !isSystem)) return;

        const segment: Partial<PeerChatSegment> = {
            fromUid: isSystem ? 'system' : (isAi ? 'ai' : user.id),
            fromName: isSystem ? 'SYSTEM' : (isAi ? user.aiCompanions.find(c => c.id === agentId)?.name || 'AI' : user.displayName),
            fromAvatarUrl: isSystem ? undefined : (isAi ? user.aiCompanions.find(c => c.id === agentId)?.avatarUrl : user.profilePictureUrl),
            content: content,
            timestamp: Date.now(),
            imageUrl: mediaInfo?.url,
            thumbnailUrl: mediaInfo?.thumbnailUrl,
            mimeType: mediaInfo?.mimeType,
            authorType: isAi ? 'ai' : 'human',
            isAiResponse: isAi,
            isSystemMessage: isSystem,
            responderAgentId: agentId,
            isDeleted: false
        };

        try {
            await addDoc(collection(db, 'peer_chat_sessions', sessionId, 'segments'), cleanForFirestore(segment));

            // Update session metadata & INCREMENT other participant unread
            const otherUid = participants.find(id => id !== user.id);
            const updateData: any = {
                lastMessage: content || (mediaInfo ? '[Media Transmitted]' : ''),
                lastTimestamp: Date.now()
            };

            if (otherUid) {
                updateData[`unreadCount.${otherUid}`] = increment(1);
            }

            await updateDoc(doc(db, 'peer_chat_sessions', sessionId), updateData);
        } catch (e) {
            console.error("[PeerChat] Send failed:", e);
            addToast("Failed to transmit signal.", "error");
        }
    };

    // 4. Delete Message Handler (Tombstoning with Integrity Check)
    const deleteMessage = async (msgId: string) => {
        if (!sessionId) return;
        try {
            const msgRef = doc(db, 'peer_chat_sessions', sessionId, 'segments', msgId);
            const msgSnap = await getDoc(msgRef);

            if (!msgSnap.exists()) return;
            const msgData = msgSnap.data() as PeerChatSegment;

            // Integrity Check: Has the other party read it?
            const otherUid = participants.find(id => id !== user.id);
            const otherLastRead = otherUid ? (lastReadTimestamps[otherUid] || 0) : 0;

            if (msgData.timestamp < otherLastRead) {
                addToast("Cannot scrub signal - it has already been observed by the recipient.", "info");
                return;
            }

            await updateDoc(msgRef, {
                isDeleted: true,
                deletedAt: Date.now(),
                content: "[SIGNAL DE-MATERIALIZED]",
                imageUrl: null,
                thumbnailUrl: null
            });

            addToast("Signal de-materialized.", "success");
        } catch (e) {
            console.error("[PeerChat] Delete failed:", e);
            addToast("Failed to scrub signal.", "error");
        }
    };

    // 5. Typing Indicator Broadcaster
    const setTyping = async (isTyping: boolean) => {
        if (!sessionId) return;
        try {
            await updateDoc(doc(db, 'peer_chat_sessions', sessionId), {
                [`typing.${user.id}`]: isTyping
            });
        } catch (e) {
            console.error("[PeerChat] Typing broadcast failed:", e);
        }
    };

    return {
        messages,
        isThinking,
        sendMessage,
        deleteMessage,
        setTyping, // [ZEN NEW]
        typingStatus, // [ZEN NEW]
        messagesEndRef,
        lastReadTimestamps,
        participants
    };
};
