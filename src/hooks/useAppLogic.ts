import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useGigiAuth } from './useGigiAuth';
import { useGigiNavigation } from './useGigiNavigation';
import { useGigiUI } from './useGigiUI';
import { useGigiData } from './useGigiData';
import { useGigiAI } from './useGigiAI';
import { appDataService } from '../services/serviceManager';
import type { LifeEvent, Tag, GigiJournalEntry, CommsMessage } from '../types';

export const useAppLogic = () => {
    // [STABILITY-SYNC-V2] Forced Re-Transpilation to purge Zombie Hooks
    const auth = useGigiAuth();
    const nav = useGigiNavigation();
    const ui = useGigiUI(auth.user, auth.isFirebaseConfigured, auth.settingsInitializedRef, nav.theme, nav.setTheme);
    const {
        showShareModal, setShowShareModal,
        showSocialDiscovery, setShowSocialDiscovery,
        matrixSelection, setMatrixSelection,
        addToast, dismissToast,
    } = ui;
    const data = useGigiData(auth.user, ui.addToast);

    const idleTimerRef = useRef<any>(null);
    // [ZEN BEAT COP] Declared here (top of hook) to preserve hook order — Rules of Hooks
    const bootSweepFiredRef = useRef(false);

    const ai = useGigiAI(
        auth.user,
        data.events,
        data.tags,
        data.media,
        ui.settings,
        ui.userStatus,
        ui.setUserStatus,
        ui.addToast,
        data.setGigiJournal,
        idleTimerRef
    );

    // [ZEN OPTIMIZATION] Stable Activity Handler
    useEffect(() => {
        const activityHandler = ai.handleActivity;
        window.addEventListener('mousemove', activityHandler);
        window.addEventListener('keypress', activityHandler);
        activityHandler();

        const handleStatusToast = (e: CustomEvent<string>) => {
            ui.addToast(e.detail, 'info');
        };
        window.addEventListener('gigi-status-toast', handleStatusToast as EventListener);

        const handleNavigateGateway = () => {
            nav.navigate('staging');
        };
        window.addEventListener('navigate-gateway', handleNavigateGateway);

        return () => {
            window.removeEventListener('mousemove', activityHandler);
            window.removeEventListener('keypress', activityHandler);
            window.removeEventListener('gigi-status-toast', handleStatusToast as EventListener);
            window.removeEventListener('navigate-gateway', handleNavigateGateway);
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, [ai.handleActivity, ui.addToast]);

    // [ZEN SOVEREIGN] Data hydration is handled by the boot sequence in useGigiData.
    // The old loadUserData call has been removed — sovereignDbQuery fires on user?.id change.

    // [ZEN BEAT COP] Boot-Time Violation Sweep
    // MatrixGrid's render-triggered healing only catches assets that appear in the gallery.
    // Avatars and off-screen assets never render there, so they need a separate sweep.
    // Runs once after isInitialSyncComplete flips true — queues all violators through the
    // existing FIFO Beat Cop queue in processBeatCopQueue.
    useEffect(() => {
        // [ZEN] Boot-Time Violation Sweep disabled to prevent IDE/Browser freezing
        // until queue handling is batched and staggered.
        /*
        if (!data.isInitialSyncComplete || bootSweepFiredRef.current || !auth.user) return;
        
        const violators = data.media.filter(m =>
            m.thumbnailUrls?.small === 'WIREFRAME_PLACEHOLDER' ||
            m.thumbnailUrls?.medium === 'WIREFRAME_PLACEHOLDER' ||
            m.thumbnailUrls?.large === 'WIREFRAME_PLACEHOLDER'
        );

        if (violators.length === 0) return;

        bootSweepFiredRef.current = true;
        console.log(`[BeatCop] 🔍 Boot sweep found ${violators.length} violator(s) off the grid — queuing for healing.`);

        violators.forEach(violator => {
            ui.healMediaViolator(violator)
                .then(healed => {
                    data.setMedia(prev => prev.map(m => m.id === healed.id ? healed : m));
                    console.log(`[BeatCop] ✅ Boot sweep healed: ${healed.id}`);
                })
                .catch(err => {
                    console.error(`[BeatCop] ❌ Boot sweep failed on ${violator.id}:`, err);
                });
        });
        */
    }, [data.isInitialSyncComplete, auth.user?.id]);


    // [ZEN OPTIMIZATION] Memoized Notification Calculator
    // This prevents triggering a state update if the actual numbers haven't changed.
    const notificationTally = useMemo(() => {
        if (!auth.user) return null;

        const unreadSignals = data.messages.filter(m => !m.read).length;
        const unreadLogs = data.gigiJournal.filter(e => (!e.type || e.type === 'reflection') && !e.read).length;
        const unreadResearch = data.gigiJournal.filter(e => e.type === 'deep_dive' && !e.read).length;
        const unreadTranscripts = data.gigiJournal.filter(e => e.type === 'conversation' && !e.read).length;

        const pendingAirlockCount = data.airlockRequests.length;
        const totalPeerUnread = data.peerSessions.reduce((acc, session) => {
            return acc + (session.unreadCount?.[auth.user!.id] || 0);
        }, 0);

        const totalUnreadComms = unreadSignals + unreadLogs + unreadResearch + unreadTranscripts;

        return {
            commsCenter: totalUnreadComms,
            gigiJournal: 0,
            airlockRequests: pendingAirlockCount,
            interviews: totalPeerUnread,
            comms: {
                signals: unreadSignals,
                logs: unreadLogs,
                research: unreadResearch,
                transcripts: unreadTranscripts
            }
        };
    }, [data.gigiJournal, data.messages, data.airlockRequests, data.peerSessions, auth.user?.id]);

    useEffect(() => {
        if (notificationTally) {
            ui.setNotifications(prev => {
                // Deep equality check to prevent unneeded re-renders of the entire App
                if (JSON.stringify(prev) === JSON.stringify(notificationTally)) return prev;
                return notificationTally as any;
            });
        }
    }, [notificationTally]);

    const handleStageFiles = useCallback((files: File[]) => {
        ui.handleStageFiles(files);
        nav.navigate('staging');
    }, [ui, nav]);

    // [ZEN OPTIMIZATION] Memoize the massive return object to protect the App tree
    return useMemo(() => ({
        user: auth.user, setUser: auth.setUser, authLoading: auth.authLoading, showAuth: auth.showAuth, setShowAuth: auth.setShowAuth, handleLogin: auth.handleLogin, handleLogout: auth.handleLogout, isFirebaseConfigured: auth.isFirebaseConfigured,
        authError: auth.authError, setAuthError: auth.setAuthError,
        currentView: nav.currentView, viewData: nav.viewData, setViewData: nav.setViewData, theme: nav.theme, toggleTheme: nav.theme === 'light' ? () => nav.setTheme('dark') : () => nav.setTheme('light'), navigate: nav.navigate,
        toasts: ui.toasts, notifications: ui.notifications, userStatus: ui.userStatus, setUserStatus: ui.setUserStatus, backupImportStatus: ui.backupImportStatus, setBackupImportStatus: ui.setBackupImportStatus, stagedFiles: ui.stagedFiles, setStagedFiles: ui.setStagedFiles,
        showExportModal: ui.showExportModal, setShowExportModal: ui.setShowExportModal, showRescueModal: ui.showRescueModal, setShowRescueModal: ui.setShowRescueModal, localRescueCount: ui.localRescueCount, isRescuing: ui.isRescuing,
        showDevPatch: ui.showDevPatch, setShowDevPatch: ui.setShowDevPatch, showSettingsModal: ui.showSettingsModal, setShowSettingsModal: ui.setShowSettingsModal,
        settingsTab: ui.settingsTab, setSettingsTab: ui.setSettingsTab,
        showDevTools: ui.showDevTools, setShowDevTools: ui.setShowDevTools,
        onOpenAirlock: () => nav.navigate('airlock'),
        setShowAirlock: (val: boolean) => { if (val) nav.navigate('airlock'); },
        appResetToken: ui.appResetToken, godModeSettings: ui.godModeSettings, setGodModeSettings: ui.setGodModeSettings, settings: ui.settings, setSettings: ui.setSettings,
        addToast: ui.addToast, dismissToast: ui.dismissToast, handleExportRequest: ui.handleExportRequest, handleTriggerRestore: ui.handleTriggerRestore, handleConfirmExport: ui.handleConfirmExport,
        handleStageFiles: handleStageFiles,
        handleRescueConfirm: async () => { const success = await ui.handleRescueConfirm(); if (success && auth.user) data.loadUserData(auth.user.id); },
        handleUploadAvatar: async (blob: Blob) => {
            const result = await ui.handleUploadAvatar(blob);
            if (result && result.media) {
                data.setMedia(prev => {
                    const exists = prev.some(m => m.id === result.id);
                    if (exists) return prev.map(m => m.id === result.id ? result.media : m);
                    return [result.media, ...prev];
                });
            }
            return result?.id || "";
        },
        events: data.events, setEvents: data.setEvents, tags: data.tags, setTags: data.setTags, media: data.media, setMedia: data.setMedia, chatHistory: data.chatHistory, setChatHistory: data.setChatHistory, gigiJournal: data.gigiJournal, setGigiJournal: data.setGigiJournal,
        airlockRequests: data.airlockRequests,
        messages: data.messages, setMessages: data.setMessages,
        commsArchives: data.commsArchives, setCommsArchives: data.setCommsArchives,
        isInitialSyncComplete: data.isInitialSyncComplete,
        loadUserData: data.loadUserData, handleSaveEvent: data.handleSaveEvent, handleEventComment: data.handleEventComment, handleSaveTag: data.handleSaveTag, handleSaveMedia: data.handleSaveMedia, handleDeleteMedia: data.handleDeleteMedia, handleJournalComment: data.handleJournalComment,
        onDataImported: () => { ui.setAppResetToken(p => p + 1); if (auth.user) data.loadUserData(auth.user.id); },
        streamStatus: data.streamStatus,
        verts: data.verts,
        peerSessions: data.peerSessions,
        showShareModal: ui.showShareModal,
        setShowShareModal: ui.setShowShareModal,
        showSocialDiscovery: ui.showSocialDiscovery,
        setShowSocialDiscovery: ui.setShowSocialDiscovery,
        isGigiThinking: ai.isGigiThinking, deepDiveQuery: ai.deepDiveQuery, setDeepDiveQuery: ai.setDeepDiveQuery, handleTriggerDeepDive: ai.handleTriggerDeepDive,
        matrixSelection: ui.matrixSelection, setMatrixSelection: ui.setMatrixSelection,
        clearMatrixSelection: () => ui.setMatrixSelection([]),
        // [ZEN V34]
        loadMoreChat: data.loadMoreChat,
        hasMoreChat: data.hasMoreChat,
        handleCreateTag: data.handleCreateTag,
        pendingAccessionsCount: data.pendingAccessionsCount
    }), [
        auth.user, auth.authLoading, auth.showAuth, auth.isFirebaseConfigured, auth.authError, auth.setAuthError,
        nav.currentView, nav.viewData, nav.theme, nav.navigate,
        ui.toasts, ui.notifications, ui.userStatus, ui.backupImportStatus, ui.stagedFiles, ui.showExportModal, ui.showRescueModal, ui.localRescueCount, ui.isRescuing, ui.showDevPatch, ui.showSettingsModal, ui.settingsTab, ui.showDevTools, ui.appResetToken, ui.godModeSettings, ui.settings, ui.matrixSelection,
        data.events, data.tags, data.media, data.chatHistory, data.gigiJournal, data.commsArchives, data.airlockRequests, data.messages, data.isInitialSyncComplete, data.streamStatus, data.verts, data.peerSessions,
        data.loadMoreChat, data.hasMoreChat, // [ZEN V34]
        data.pendingAccessionsCount,
        ai.isGigiThinking, ai.deepDiveQuery, handleStageFiles
    ]);
};