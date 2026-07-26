import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Toast, User } from '../../types';
import { getPrimaryModelId } from '../../services/ai/config';

export const useChatState = (user: User) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const messagesRef = useRef<ChatMessage[]>([]);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const [userInput, setUserInput] = useState('');
    const burnListRef = useRef<string[]>([]);
    const [thinkingAgentId, setThinkingAgentId] = useState<string | null>(null);
    const [executiveDirective, setExecutiveDirective] = useState<string | null>(null);
    const [isCrisisMode, setIsCrisisMode] = useState(false);
    const [unreadMailCount, setUnreadMailCount] = useState(0);
    const [stagedFile, setStagedFile] = useState<{ file: File; previewUrl: string; type: 'image' | 'video' } | null>(null);
    
    const [selectedModelId, setSelectedModelId] = useState<string>(getPrimaryModelId());
    const [chatStyleMode, setChatStyleMode] = useState<'lite' | 'full'>('lite');
    const [contextMode, setContextMode] = useState<'grounded' | 'creative' | 'mixed'>('mixed');
    
    const [isMicKeyed, setIsMicKeyed] = useState(false);
    const isBurstingRef = useRef(false);
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
    const [deletedMessagesBuffer, setDeletedMessagesBuffer] = useState<(ChatMessage & { originalIndex: number })[]>([]);
    const [lastFocalPoint, setLastFocalPoint] = useState<string | null>(null);
    const [enrichmentStatus, setEnrichmentStatus] = useState<'idle' | 'active' | 'error'>('idle');
    const [isLibrarianBusy, setIsLibrarianBusy] = useState(false);
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
    const [identityPenalty, setIdentityPenalty] = useState<number>(0);
    const [isEnhancingInput, setIsEnhancingInput] = useState(false);

    const [inputProcessMode, setInputProcessMode] = useState<'enhance' | 'polish' | 'raw'>('raw');

    useEffect(() => {
        // [ZEN] Clean up legacy localStorage item to avoid state pollution
        localStorage.removeItem('gigi_input_mode');
    }, []);

    return {
        messages, setMessages, messagesRef,
        userInput, setUserInput,
        burnListRef,
        thinkingAgentId, setThinkingAgentId,
        executiveDirective, setExecutiveDirective,
        isCrisisMode, setIsCrisisMode,
        unreadMailCount, setUnreadMailCount,
        stagedFile, setStagedFile,
        selectedModelId, setSelectedModelId,
        chatStyleMode, setChatStyleMode,
        contextMode, setContextMode,
        isMicKeyed, setIsMicKeyed, isBurstingRef,
        isBulkMode, setIsBulkMode,
        selectedMsgIds, setSelectedMsgIds,
        deletedMessagesBuffer, setDeletedMessagesBuffer,
        lastFocalPoint, setLastFocalPoint,
        enrichmentStatus, setEnrichmentStatus,
        isLibrarianBusy, setIsLibrarianBusy,
        isVoiceEnabled, setIsVoiceEnabled,
        identityPenalty, setIdentityPenalty,
        isEnhancingInput, setIsEnhancingInput,
        inputProcessMode, setInputProcessMode
    };
};
