import type { ChatMessage, User, LifeEvent, Tag, AiCompanion, Media, Toast } from '../../types';

export interface UseAiChatProps {
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
    addToast: (msg: string, type: Toast['type'], action?: Toast['action']) => void;
    onAiCreateTag: (args: any) => Promise<Tag>;
    onAiUpdateTag: (tag: Tag) => Promise<{ status: string }>;
    contextTagId?: string;
    isDataLoading: boolean;
    currentSessionId?: string | null;
}

export interface ChatState {
    messages: ChatMessage[];
    userInput: string;
    thinkingAgentId: string | null;
    executiveDirective: string | null;
    isCrisisMode: boolean;
    unreadMailCount: number;
    stagedFile: { file: File; previewUrl: string; type: 'image' | 'video' } | null;
    selectedModelId: string;
    chatStyleMode: 'lite' | 'full';
    contextMode: 'grounded' | 'creative' | 'mixed';
    isMicKeyed: boolean;
    isBulkMode: boolean;
    selectedMsgIds: Set<string>;
    deletedMessagesBuffer: (ChatMessage & { originalIndex: number })[];
    lastFocalPoint: string | null;
    enrichmentStatus: 'idle' | 'active' | 'error';
    isLibrarianBusy: boolean;
    isVoiceEnabled: boolean;
    identityPenalty: number;
    inputProcessMode: 'enhance' | 'polish' | 'raw';
    isEnhancingInput: boolean;
}
