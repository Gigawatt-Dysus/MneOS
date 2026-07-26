import { useEffect } from 'react';
import type { UseAiChatProps } from './types';
import { useChatState } from './useChatState';
import { useChatSync } from './useChatSync';
import { useAiEngine } from './useAiEngine';
import { useChatActions } from './useChatActions';
import { useChatHandlers } from './useChatHandlers';
import { deduplicateMessages } from './utils';

const MAX_FILE_SIZE_MB = 200;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const useAiChat = (props: UseAiChatProps) => {
    const state = useChatState(props.user);
    const sync = useChatSync(
        props.user, props.chatHistory, state.messages, state.setMessages, state.messagesRef,
        state.isCrisisMode, state.setIsCrisisMode, state.setUnreadMailCount,
        state.setIsLibrarianBusy, state.setEnrichmentStatus, state.deletedMessagesBuffer,
        props.addToast, props.isDataLoading
    );

    const engine = useAiEngine(
        props.user, state.setMessages, props.onHistoryChange, state.setThinkingAgentId,
        state.setIsMicKeyed, state.isBurstingRef, state.isCrisisMode, state.setIsCrisisMode,
        state.isVoiceEnabled, state.selectedModelId, state.contextMode, state.chatStyleMode,
        props.systemPromptPatches, state.identityPenalty, state.setIdentityPenalty,
        state.burnListRef, props.addToast, props.onAiCreateTag, props.onAiUpdateTag,
        props.tags, props.media || [], props.events, props.currentSessionId
    );

    const actions = useChatActions(
        props.user, state.messages, state.setMessages, state.messagesRef, props.onHistoryChange,
        state.userInput, state.setUserInput, state.stagedFile, state.setStagedFile,
        sync.isProcessingRef, state.thinkingAgentId, state.isCrisisMode, state.unreadMailCount,
        state.setUnreadMailCount, state.deletedMessagesBuffer, state.setDeletedMessagesBuffer,
        state.contextMode, state.inputProcessMode, state.setIsEnhancingInput, props.addToast,
        engine.processAgentTurn, props.apiKeySkipped, props.tags,
        state.selectedMsgIds, state.setSelectedMsgIds, state.setIsBulkMode, props.currentSessionId
    );

    const handlers = useChatHandlers(
        props.user, state.messages, state.setMessages, props.onHistoryChange,
        state.isCrisisMode, state.isVoiceEnabled, state.setStagedFile, props.addToast,
        sync.isProcessingRef, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB
    );

    // [ZEN] Derive activeContextTag
    const activeContextTag = props.contextTagId ? props.tags.find(t => t.id === props.contextTagId) || null : null;

    // [ZEN] Local Session Handlers
    const handleRefreshSession = () => {
        state.setMessages(deduplicateMessages(props.chatHistory));
        sync.isInitializedRef.current = true;
        props.addToast("Context refreshed.", "info");
    };

    const stopBurst = () => {
        if (state.isBurstingRef.current) {
            state.isBurstingRef.current = false;
            state.setIsMicKeyed(false);
            props.addToast("Burst Interrupted", "info");
        }
    };

    const toggleBulkMode = () => {
        state.setIsBulkMode(!state.isBulkMode);
        state.setSelectedMsgIds(new Set());
    };

    const toggleMsgSelection = (id: string) => {
        const newSet = new Set(state.selectedMsgIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        state.setSelectedMsgIds(newSet);
    };

    const handleSaveToTag = async (text: string) => {
        if (!activeContextTag) return;
        const currentDesc = activeContextTag.description || '';
        if (currentDesc.includes(text)) {
            props.addToast("Already in tag description.", "info");
            return;
        }
        const newDesc = currentDesc ? `${currentDesc}\n\n${text}` : text;
        try {
            await props.onAiUpdateTag({ ...activeContextTag, description: newDesc });
            props.addToast(`Appended info to ${activeContextTag.name}.`, 'success');
        } catch (e) {
            props.addToast("Failed to update tag description.", 'error');
        }
    };

    // [ZEN] Handle Initial Message
    useEffect(() => {
        if (props.initialMessage && !state.thinkingAgentId) {
            state.setUserInput(props.initialMessage);
            props.clearInitialMessage();
        }
    }, [props.initialMessage, state.thinkingAgentId]);

    return {
        ...state,
        ...actions,
        ...handlers,
        ...engine,
        activeContextTag,
        handleRefreshSession,
        stopBurst,
        toggleBulkMode,
        toggleMsgSelection,
        handleSaveToTag,
        isProcessing: sync.isProcessingRef.current
    };
};
