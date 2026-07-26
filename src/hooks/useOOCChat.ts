import { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, limit } from '../services/sovereignDbAdapter';
import { User, ChatMessage, AiCompanion } from '../types';
import { generateAgentResponse } from '../services/aiOrchestrator';

interface UseOOCChatProps {
    user: User;
    storyId: string;
    storyTitle: string;
}

export const useOOCChat = ({ user, storyId, storyTitle }: UseOOCChatProps) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const db = getFirestore();
    const islandId = `daydream_ooc_${storyId}`;

    // 1. Load History
    useEffect(() => {
        if (!user.id || !storyId) return;

        const q = query(
            collection(db, 'users', user.id, 'chat_segments'),
            where('island_id', '==', islandId),
            orderBy('timestamp', 'desc'), // Get NEWEST first
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            const msgs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as ChatMessage));
            setMessages(msgs.reverse()); // Reverse back to chronological for display
        });

        return () => unsubscribe();
    }, [user.id, storyId]);

    // 2. Send Message
    const sendMessage = async (content: string, context?: string) => {
        if (!content.trim()) return;

        const timestamp = new Date(); // Local time for optimist
        const userMsg: any = {
            role: 'user',
            content,
            timestamp: serverTimestamp(),
            island_id: islandId,
            userId: user.id
        };

        // Optimistic UI: Add immediately
        setMessages(prev => [...prev, { ...userMsg, timestamp, id: `temp-${Date.now()}` }]);

        // Actually, listener is fast enough.
        await addDoc(collection(db, 'users', user.id, 'chat_segments'), userMsg);

        setIsThinking(true);

        try {
            // Build Context
            // We want the AI to know it's in OOC mode.
            const companion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];

            const systemPrompt = `
            [SYSTEM: OOC MODE]
            You are ${companion.name}, chatting with the user about their story "${storyTitle}".
            Current Context: navigating meta-discussion, brainstorming, or feedback.
            NOT writing the story directly, but discussing it.
            
            ${context ? `[EDITOR CONTEXT]: ${context}` : ''}
            `;

            // Convert to API format
            const historyForAi = messages.map(m => ({
                role: m.role === 'model' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));
            historyForAi.push({ role: 'user', parts: [{ text: content }] });

            if (!companion) throw new Error("No AI Companion found.");

            // Call AI
            const result = await generateAgentResponse(
                companion,
                historyForAi,
                [companion.name],
                systemPrompt,
                [],
                user,
                [],
                undefined // Use default model
            );

            const responseContent = result.text || "I'm listening.";

            const aiMsg: any = {
                role: 'model',
                content: responseContent,
                timestamp: serverTimestamp(), // Server (Date for local)
                island_id: islandId,
                userId: user.id,
                author: { name: companion.name, avatarUrl: companion.avatarUrl }
            };

            // Optimistic AI Msg
            setMessages(prev => [...prev, { ...aiMsg, timestamp: new Date(), id: `temp-ai-${Date.now()}` }]);

            await addDoc(collection(db, 'users', user.id, 'chat_segments'), aiMsg);


        } catch (e: any) {
            console.error("OOC Chat Failed", e);
            // Inject local error message
            const errorMsg: ChatMessage = {
                role: 'system',
                content: `Connection Error: ${e.message || 'Unknown failure'}. Check console/keys.`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsThinking(false);
        }
    };

    return { messages, sendMessage, isThinking };
};
