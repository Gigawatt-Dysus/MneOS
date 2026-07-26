import React, { useEffect, useMemo, useCallback } from 'react';
import { useAiChatBridge } from './useAiChatBridge';
import { useAiChatUI } from './hooks/useAiChatUI';
import { useNeuralPalette } from './hooks/useNeuralPalette';
import { useChatSessions } from '../../context/ChatSessionContext';
import { AiChatProps, RUBRIC_ITEMS } from './types';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ExecutiveDeck } from './ExecutiveDeck';
import { ExecutiveLibraryModal } from './ExecutiveLibraryModal';
import { NeuralAgentsSidebar } from '../ai/NeuralAgentsSidebar';
import { SparkStudioModal } from '../SparkStudio/SparkStudioModal';
import { MigrationWorkbenchModal } from './MigrationWorkbenchModal';
import { VocalHelpModal } from './parts/VocalHelpModal';
import { CognitiveOverrideModal } from './parts/CognitiveOverrideModal';
import { InputDock } from './parts/InputDock';
import { SnowflakeIcon, Volume2, VolumeX, Database, RefreshCw, Shield, Slash, Zap } from 'lucide-react';
import { AVAILABLE_MODELS } from '../../services/ai/config';
import { BridgeLockedBoundary } from './BridgeLockedBoundary';

export const AiChatLayout: React.FC<AiChatProps> = (props) => {
    const bridge = useAiChatBridge(props);
    const ui = useAiChatUI();
    const palette = useNeuralPalette(bridge.userInput, bridge.setUserInput, bridge.textAreaRef);
    const { isSessionsDrawerOpen, setIsSessionsDrawerOpen } = useChatSessions();

    // [ZEN] Cognitive Override Sync
    const handleApplyOverride = (directive: string, valence: any, labels: string[]) => {
        bridge.handleDetails.handleCognitiveOverride(
            ui.overridePointId!, 
            directive, 
            valence,
            labels,
            ui.originalDraftAxiom || undefined
        );
        ui.setOverridePointId(null);
        ui.setOverrideDirective('');
        ui.setRubricSelections(new Set());
    };

    const handleRunAudit = async () => {
        ui.setIsAnalyzingBreach(true);
        try {
            const failedMsg = bridge.messages.find(m => m.id === ui.overridePointId);
            if (failedMsg) {
                const { SovereignMemoryService } = await import('../../services/ai/SovereignMemoryService');
                const draft = await SovereignMemoryService.analyzeBreach(
                    failedMsg.content, 
                    RUBRIC_ITEMS.filter(i => ui.rubricSelections.has(i.id)).map(i => i.label),
                    props.user.auditorMemex?.auditorLessons || []
                );
                ui.setOverrideDirective(draft);
                ui.setOriginalDraftAxiom(draft);
            }
        } finally { ui.setIsAnalyzingBreach(false); }
    };

    const handleExportChat = () => {
        if (!bridge.filteredMessages || bridge.filteredMessages.length === 0) {
            props.addToast('No messages to export in current view.', 'info');
            return;
        }
        
        const lines = bridge.filteredMessages.map(m => {
            const date = m.timestamp ? new Date(m.timestamp).toLocaleString() : 'Unknown Date';
            let sender = m.role === 'user' ? (props.user.displayName || props.user.firstName || 'User') : 'AI';
            if (m.author?.name) sender = m.author.name;
            return `[${date}] ${sender}:\n${m.content}`;
        });
        
        const text = lines.join('\n\n----------------------------------------\n\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const roomName = bridge.searchQuery ? `_${bridge.searchQuery}` : '';
        a.download = `Neural_Archive_Export${roomName}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        props.addToast(`Exported ${bridge.filteredMessages.length} messages.`, 'success');
    };

    return (
        <div className="flex h-full bg-[#0a0a0b] neural-arch-container">
            <NeuralAgentsSidebar
                agents={props.user.aiCompanions || []}
                onAgentSelect={() => {}}
                onInjectMessage={bridge.handleDetails.injectMessage}
                deletedMessagesBuffer={bridge.deletedMessagesBuffer}
                onRestore={bridge.handleDetails.undoDeletion}
                userId={props.user.id}
                userPresets={bridge.userPresets}
                onCompanionUpdate={bridge.handleCompanionUpdate}
                onToggleSessions={() => setIsSessionsDrawerOpen(!isSessionsDrawerOpen)}
                isSessionsOpen={isSessionsDrawerOpen}
            />

            <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden relative font-sans">
                <div className={`neural-arch-header absolute top-0 left-0 right-0 z-[100] ${(ui.isArchOpen || ui.isArchPinned) ? 'is-open' : ''}`}
                    onMouseEnter={() => ui.handleArchHover(true)}
                    onMouseLeave={() => ui.handleArchHover(false)}>
                    <ChatHeader
                        user={props.user}
                        chatMode={bridge.chatMode}
                        setChatMode={bridge.setChatMode}
                        contextMode={bridge.handleDetails.contextMode}
                        setContextMode={bridge.handleDetails.setContextMode}
                        selectedPeerSessionId={bridge.selectedPeerSessionId}
                        setSelectedPeerSessionId={bridge.setSelectedPeerSessionId}
                        onNavigate={bridge.onNavigate}
                        setIsSidebarOpen={bridge.setIsSidebarOpen}
                        isThinking={bridge.isThinking}
                        activeVert={bridge.activeVert}
                        setShowSparkStudio={bridge.setShowSparkStudio}
                        searchQuery={bridge.searchQuery}
                        setSearchQuery={bridge.setSearchQuery}
                        isSearchingGlobal={bridge.isSearchingGlobal}
                        selectedModelId={bridge.selectedModelId}
                        thinkingAgentId={bridge.thinkingAgentId}
                        hasFireworksKey={bridge.hasFireworksKey}
                        messageCount={bridge.messages.length}
                        executiveDirective={bridge.executiveDirective}
                        isBulkMode={bridge.isBulkMode}
                        toggleBulkMode={bridge.toggleBulkMode}
                        isCrisisMode={bridge.isCrisisMode}
                        unreadMailCount={bridge.unreadMailCount}
                        isVoiceEnabled={bridge.isVoiceEnabled}
                        setIsVoiceEnabled={bridge.setIsVoiceEnabled}
                        onOpenSettings={props.onOpenSettings}
                        isArchPinned={ui.isArchPinned}
                        setIsArchPinned={ui.setIsArchPinned}
                        onExportChat={handleExportChat}
                    />
                </div>

                <BridgeLockedBoundary onReset={bridge.handleDetails.handleRefreshSession} title="Neural Link Failure">
                    <MessageList
                        messages={bridge.messages}
                        filteredMessages={bridge.filteredMessages}
                        user={props.user}
                        chatMode={bridge.chatMode}
                        searchQuery={bridge.searchQuery}
                        setSearchQuery={bridge.setSearchQuery}
                        activeContextTag={bridge.activeContextTag}
                        selectedPeerSessionId={bridge.selectedPeerSessionId}
                        peerSessions={bridge.peerSessions}
                        verts={bridge.verts}
                        isThinking={bridge.isThinking}
                        thinkingAgentId={bridge.thinkingAgentId}
                        isInitialSnap={bridge.isInitialSnap}
                        isScrollSettled={bridge.isScrollSettled}
                        isShutterFading={bridge.isShutterFading}
                        chatContainerRef={bridge.chatContainerRef}
                        chatEndRef={bridge.chatEndRef}
                        onNavigate={bridge.onNavigate}
                        handleSafeDelete={bridge.handleSafeDelete}
                        handleEditMessage={bridge.handleDetails.handleEditMessage}
                        handleReaction={bridge.handleDetails.handleReaction}
                        handleSaveToTag={bridge.handleDetails.handleSaveToTag}
                        handleSaveToMatrix={bridge.handleSaveToMatrix}
                        handleSetFiction={bridge.handleDetails.handleSetFiction}
                        handlePromoteToCore={(msg) => {
                            bridge.setExecutiveDirective(prev => prev ? prev + '\n' + msg.content : msg.content);
                            bridge.setIsDeckExpanded(true);
                        }}
                        onFeedback={() => {}}
                        setIsSidebarOpen={bridge.setIsSidebarOpen}
                        setSelectedPeerSessionId={bridge.setSelectedPeerSessionId}
                        activeVert={bridge.activeVert}
                        chatStyleMode={bridge.handleDetails.chatStyleMode}
                        typingStatus={bridge.typingStatus}
                        participants={bridge.participants}
                        lastReadTimestamps={bridge.lastReadTimestamps}
                        lastFocalPoint={bridge.lastFocalPoint}
                        activeMode={bridge.handleDetails.contextMode}
                        userPresets={bridge.userPresets}
                        isBulkMode={bridge.isBulkMode}
                        selectedMsgIds={bridge.selectedMsgIds}
                        onToggleSelect={bridge.toggleMsgSelection}
                        loadMoreChat={bridge.loadMoreChat}
                        hasMoreChat={bridge.hasMoreChat}
                        onSpeak={bridge.handleSpeak}
                        onDownloadAudio={bridge.handleDownloadAudio}
                        onCognitiveOverride={(id) => ui.setOverridePointId(id)}
                        onManualDriftFlag={(msgId, reason) => {
                            const msg = bridge.messages.find(m => m.id === msgId);
                            if (msg) {
                                const agent = props.user.aiCompanions.find(c => c.name === msg.author?.name || c.id === msg.author?.name) || props.user.aiCompanions.find(c => c.isPrimary);
                                if (agent) bridge.handleDetails.executeManualDriftSlice(msgId, bridge.messages, agent, reason);
                            }
                        }}
                        onCommitSparkEdit={bridge.handleDetails.handleCommitSparkEdit}
                        tags={bridge.tags}
                    />
                </BridgeLockedBoundary>

                {ui.showDirectiveTray && (
                    <div className="w-full max-w-3xl px-4 animate-in slide-in-from-bottom-2 duration-200">
                        <ExecutiveDeck
                            executiveDirective={bridge.executiveDirective}
                            setExecutiveDirective={bridge.setExecutiveDirective}
                            isPinned={bridge.isPinned}
                            setIsPinned={bridge.setIsPinned}
                            isDeckExpanded={bridge.isDeckExpanded}
                            setIsDeckExpanded={bridge.setIsDeckExpanded}
                            userPresets={bridge.userPresets}
                            onOpenPillNamer={() => bridge.setShowPillNamer(true)}
                            onRemovePreset={bridge.removeCustom}
                        />
                    </div>
                )}

                <InputDock 
                    userInput={bridge.userInput}
                    setUserInput={bridge.setUserInput}
                    textAreaRef={bridge.textAreaRef}
                    stagedFile={bridge.stagedFile}
                    setStagedFile={bridge.setStagedFile}
                    isEnhancingInput={bridge.isEnhancingInput}
                    isThinking={bridge.isThinking}
                    chatMode={bridge.chatMode}
                    inputProcessMode={bridge.inputProcessMode}
                    setInputProcessMode={bridge.setInputProcessMode}
                    showDirectiveTray={ui.showDirectiveTray}
                    setShowDirectiveTray={ui.setShowDirectiveTray}
                    showEmojiPicker={bridge.showEmojiPicker}
                    setShowEmojiPicker={bridge.setShowEmojiPicker}
                    showFidelityPopover={ui.showFidelityPopover}
                    setShowFidelityPopover={ui.setShowFidelityPopover}
                    tagSuggestions={palette.tagSuggestions}
                    suggestionIndex={palette.suggestionIndex}
                    setSuggestionIndex={palette.setSuggestionIndex}
                    applyTag={palette.applyTag}
                    handleExecutiveSubmit={bridge.handleExecutiveSubmit}
                    handlePeerMessageSubmit={bridge.handlePeerMessageSubmit}
                    fileInputRef={bridge.fileInputRef}
                />

                {/* HIDDEN UPLOAD INPUT */}
                <input 
                    type="file" 
                    className="hidden" 
                    ref={bridge.fileInputRef} 
                    onChange={bridge.handleDetails.handleFileUpload} 
                    accept="image/*,video/*,application/pdf,.md,.json,.txt" 
                />

                {/* MODALS */}
                <VocalHelpModal 
                    isOpen={ui.showVocalHelp}
                    onClose={() => ui.setShowVocalHelp(false)}
                    vocalTags={palette.vocalTags}
                    tagSearchQuery={palette.tagSearchQuery}
                    setTagSearchQuery={palette.setTagSearchQuery}
                    onApplyTag={palette.applyTag}
                />

                <CognitiveOverrideModal 
                    overridePointId={ui.overridePointId}
                    onClose={() => ui.setOverridePointId(null)}
                    user={props.user}
                    messages={bridge.messages}
                    rubricSelections={ui.rubricSelections}
                    setRubricSelections={ui.setRubricSelections}
                    overrideDirective={ui.overrideDirective}
                    setOverrideDirective={ui.setOverrideDirective}
                    isAnalyzingBreach={ui.isAnalyzingBreach}
                    onRunAudit={handleRunAudit}
                    onApply={handleApplyOverride}
                />

                {bridge.showSparkStudio && (
                    <SparkStudioModal
                        userId={props.user.id}
                        onClose={() => bridge.setShowSparkStudio(false)}
                        addToast={props.addToast}
                        chatHistory={bridge.aiMessages}
                        onDelete={bridge.handleSafeDelete}
                        userPresets={bridge.userPresets}
                        onCommitSparkEdit={bridge.handleDetails.handleCommitSparkEdit}
                    />
                )}
                
                {ui.showMigrationWorkbench && (
                    <MigrationWorkbenchModal 
                        userId={props.user.id}
                        onClose={() => ui.setShowMigrationWorkbench(false)}
                        addToast={props.addToast}
                    />
                )}

                <ExecutiveLibraryModal
                    isOpen={bridge.showPillNamer}
                    onClose={() => bridge.setShowPillNamer(false)}
                    pillNameInput={bridge.pillNameInput}
                    setPillNameInput={bridge.setPillNameInput}
                    onSave={bridge.handleSaveCustom}
                    isSavingPill={bridge.isSavingPill}
                    executiveDirective={bridge.executiveDirective}
                />
            </div>
        </div>
    );
};
