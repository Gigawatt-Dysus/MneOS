import { useRef, useEffect, useCallback } from 'react';
import { useGigiAuth } from './useGigiAuth';
import { useGigiNavigation } from './useGigiNavigation';
import { useGigiUI } from './useGigiUI';
import { useGigiData } from './useGigiData';
import { useGigiAI } from './useGigiAI';
import { appDataService } from '../services/serviceManager';
import type { LifeEvent, Tag, GigiJournalEntry } from '@/types';

export const useAppLogic = () => {
    const auth = useGigiAuth();
    const nav = useGigiNavigation();
    const ui = useGigiUI(auth.user, auth.isFirebaseConfigured, auth.settingsInitializedRef, nav.theme, nav.setTheme);
    const data = useGigiData(auth.user, ui.addToast);

    const idleTimerRef = useRef<any>(null);
    
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

    useEffect(() => {
        window.addEventListener('mousemove', ai.handleActivity);
        window.addEventListener('keypress', ai.handleActivity);
        ai.handleActivity(); 

        const handleStatusToast = (e: CustomEvent<string>) => {
            ui.addToast(e.detail, 'info');
        };
        window.addEventListener('gigi-status-toast', handleStatusToast as EventListener);

        return () => {
            window.removeEventListener('mousemove', ai.handleActivity);
            window.removeEventListener('keypress', ai.handleActivity);
            window.removeEventListener('gigi-status-toast', handleStatusToast as EventListener);
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, [ai.handleActivity, ui.addToast]);

    useEffect(() => {
        if (auth.user) {
            data.loadUserData(auth.user.id);
        }
    }, [auth.user?.id]); 

    // LIVE NOTIFICATION SYNC
    useEffect(() => {
        const unreadJournalCount = data.gigiJournal.filter(entry => !entry.read).length;
        
        ui.setNotifications(prev => ({
            ...prev,
            gigiJournal: unreadJournalCount
        }));
    }, [data.gigiJournal]);

    // [ZEN FIX] Wrapper to ensure uploads redirect to Staging Area
    const handleStageFiles = useCallback((files: File[]) => {
        ui.handleStageFiles(files);
        nav.navigate('staging');
    }, [ui, nav]);

    return {
        // Auth
        user: auth.user, setUser: auth.setUser, authLoading: auth.authLoading, showAuth: auth.showAuth, setShowAuth: auth.setShowAuth, handleLogin: auth.handleLogin, handleLogout: auth.handleLogout, isFirebaseConfigured: auth.isFirebaseConfigured,
        // Nav
        currentView: nav.currentView, viewData: nav.viewData, setViewData: nav.setViewData, theme: nav.theme, toggleTheme: nav.toggleTheme, navigate: nav.navigate,
        // UI
        toasts: ui.toasts, notifications: ui.notifications, userStatus: ui.userStatus, setUserStatus: ui.setUserStatus, backupImportStatus: ui.backupImportStatus, setBackupImportStatus: ui.setBackupImportStatus, stagedFiles: ui.stagedFiles, setStagedFiles: ui.setStagedFiles,
        showExportModal: ui.showExportModal, setShowExportModal: ui.setShowExportModal, showRescueModal: ui.showRescueModal, setShowRescueModal: ui.setShowRescueModal, localRescueCount: ui.localRescueCount, isRescuing: ui.isRescuing,
        showDevPatch: ui.showDevPatch, setShowDevPatch: ui.setShowDevPatch, showSettingsModal: ui.showSettingsModal, setShowSettingsModal: ui.setShowSettingsModal, showDevTools: ui.showDevTools, setShowDevTools: ui.setShowDevTools,
        appResetToken: ui.appResetToken, godModeSettings: ui.godModeSettings, setGodModeSettings: ui.setGodModeSettings, settings: ui.settings, setSettings: ui.setSettings,
        addToast: ui.addToast, dismissToast: ui.dismissToast, handleExportRequest: ui.handleExportRequest, handleTriggerRestore: ui.handleTriggerRestore, handleConfirmExport: ui.handleConfirmExport, 
        
        // [ZEN FIX] Use the wrapper instead of the direct UI handler
        handleStageFiles: handleStageFiles,
        
        handleRescueConfirm: async () => { const success = await ui.handleRescueConfirm(); if (success && auth.user) data.loadUserData(auth.user.id); },
        handleUploadAvatar: ui.handleUploadAvatar,
        // Data
        events: data.events, setEvents: data.setEvents, tags: data.tags, setTags: data.setTags, media: data.media, setMedia: data.setMedia, chatHistory: data.chatHistory, setChatHistory: data.setChatHistory, gigiJournal: data.gigiJournal, setGigiJournal: data.setGigiJournal,
        loadUserData: data.loadUserData, handleSaveEvent: data.handleSaveEvent, handleEventComment: data.handleEventComment, handleSaveTag: data.handleSaveTag, handleSaveMedia: data.handleSaveMedia, handleDeleteMedia: data.handleDeleteMedia, handleJournalComment: data.handleJournalComment,
        onDataImported: () => { ui.setAppResetToken(p => p + 1); if (auth.user) data.loadUserData(auth.user.id); },
        
        streamStatus: data.streamStatus,

        // AI
        isGigiThinking: ai.isGigiThinking, deepDiveQuery: ai.deepDiveQuery, setDeepDiveQuery: ai.setDeepDiveQuery, handleTriggerDeepDive: ai.handleTriggerDeepDive,
    };
};