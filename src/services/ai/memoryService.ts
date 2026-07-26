// services/ai/memoryService.ts

import { searchChatMemory, indexMessage } from '../searchService';
import type { ChatMessage } from '../../types';

export const MemoryService = {

    // The "Recall" Step - Called by generators.ts
    async recallContext(userQuery: string, userId: string): Promise<string> {
        console.log(`%c[Cortex] Recalling memories for: "${userQuery}" [User: ${userId?.substring(0, 8)}]...`, 'color: cyan');

        try {
            const memories = await searchChatMemory(userQuery, userId);

            if (!memories || memories.length === 0) return "";

            // Format for the LLM
            return `\n\n[RECALLED LONG-TERM MEMORIES (Facts from the past)]\n` +
                memories.join('\n') +
                `\n[END MEMORIES]\n`;
        } catch (error) {
            console.warn("[Cortex] Memory recall encountered an issue", error);
            return "";
        }
    },

    // Real-time Indexing - Called by useAiChat.ts after a message is sent
    async remember(msg: ChatMessage, msgId: string, userId: string) {
        if (msg.role === 'system') return;
        // Fire and forget - don't block UI
        indexMessage(msg, msgId, userId).catch((err: any) => console.warn("[Cortex] Indexing failed", err));
    }
};