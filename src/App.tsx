import React, { useEffect, useState, useRef } from 'react';
import { useAppLogic } from './hooks/useAppLogic';
import type { LifeEvent, Tag, GigiJournalEntry, View, AirlockRequest, SettingsTab } from './types';
import { appDataService } from './services/serviceManager';
import { initMemoryStore, reindexAllTags, reindexMedia } from './services/searchService';
import { useFontLoader } from './hooks/useFontLoader';
import { useModelGateway } from './hooks/useModelGateway';
import { runGeoAudit, runHousekeepingAudit, dismissGeoAnomaly } from './services/SovereignHealthService';
import { calculateLifeEras } from './services/LifePulseService';
import { logInteraction } from './services/SovereignNarrativeService';
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';

// Layout
import MainLayout from './components/Layout/MainLayout';

// Components
import { Desktop } from './components/os/Desktop';
import AiChat, { BridgeLockedBoundary } from './components/AiChat';
import TimeVortex from './components/Timeline';
import TagGallery from './components/TagGallery';
import TheMatrix from './components/matrix';
import { ChatSessionProvider } from './context/ChatSessionContext';
import ProfileEditor from './components/ProfileEditor';
import { DaydreamEditor } from './components/Daydream/DaydreamEditor';
import { DaydreamDashboard } from './components/Daydream/DaydreamDashboard';
import EventEditor from './components/EventEditor';
import { WindowManagerProvider } from './context/WindowManagerContext';
import LoomCanvas from './components/Loom/LoomCanvas';

import TagEditor from './components/TagEditor';
import SimpleChatApp from './components/chat/SimpleChatApp';
import LoginPage from './components/LoginPage';
import LoginHeader from './components/LoginHeader';
import MneOSLogo from './components/MneOSLogo';
import ToastContainer from './components/Toast';
import AICompanionEditor from "./components/admin/AICompanionEditor";
import { OrbitalView } from './components/Social/OrbitalView';
import { SplashShield } from './components/SplashShield'; // [ZEN NEW]
import { BlackBoxReporter } from './components/BlackBoxReporter';
import { isRootUser } from './utils/rbac';
import BiodataExtract from './components/BiodataExtract';
import StagingDashboard from './components/Migration/StagingDashboard';
import { GedcomProvider } from './context/GedcomContext';
import { WikiNavigationProvider } from './components/shared/WikiNavigationProvider';

// Subviews
import { StagingModals } from './components/subviews/StagingModals';
import { CommunicationsOverlay } from './components/subviews/CommunicationsOverlay';

// Takeout Airlock
import { TakeoutAirlock } from './components/TakeoutAirlock';

// ZEN Airlock
import { GrokAirlockModal } from './components/zen/GrokAirlockModal';

const getDefaultMetadata = (type: string) => {
    switch (type) {
        case 'person': return { dates: { birth: '' }, gender: 'Prefer not to say', relationships: [], locations: [], contacts: [], emails: [], socials: [] };
        case 'pet': return { species: '', dates: { adoption: '' }, medical: { vetName: '', conditions: [] }, documents: [] };
        case 'place': return { address: '', significance: '', coordinates: { lat: 0, lng: 0 } };
        case 'thing': return { acquisition: { date: '', cost: 0, sourceTagId: '' }, status: { currentVal: 0, condition: '', locationTagId: '' }, purpose: '' };
        default: return {};
    }
};

const App: React.FC = () => {
    const appBootedRef = useRef(false);
    const [showGrokAirlock, setShowGrokAirlock] = useState(false);

    useEffect(() => {
        if (!appBootedRef.current) {
            appBootedRef.current = true;
        }
    }, []);

    // [ZEN OFFLINE SHIELD]
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const logic = useAppLogic();

    // [ZEN] SPA Soft Reset mechanism to replace aggressive window.location.reload()
    useEffect(() => {
        const handleHardReset = () => {
            // Clear identity caches that might be corrupted
            sessionStorage.clear();
            localStorage.removeItem('gigi_identity_cache');
            
            // Navigate to root/dashboard gracefully
            logic.navigate('dashboard');
            
            // Re-fetch core identity if authenticated to repair memory state
            if (logic.user?.id) {
                logic.loadUserData(logic.user.id);
            }
        };

        window.addEventListener('gigi-hard-reset', handleHardReset);
        return () => window.removeEventListener('gigi-hard-reset', handleHardReset);
    }, [logic]);

    // [ZEN FEATURE] Biodata Extract Intercept & Sovereign Route Partitioning
    const path = window.location.pathname;
    const isDefaultChat = path === '/chat' || path.startsWith('/chat/');
    const [viewMode, setViewMode] = useState<'chat' | 'os'>(isDefaultChat ? 'chat' : 'os');

    // [ZEN] Sync ViewMode with Browser URL History (popstate listener)
    useEffect(() => {
        const handlePopState = () => {
            const currentPath = window.location.pathname;
            if (currentPath === '/chat' || currentPath.startsWith('/chat/')) {
                setViewMode('chat');
            } else {
                setViewMode('os');
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    if (path.startsWith('/u/')) {
        const publicUserId = path.split('/u/')[1]?.split('/')[0] || path.split('/u')[1]?.split('/')[0];
        if (publicUserId) {
            return <BiodataExtract userId={publicUserId} atsMode={false} />;
        }
    }
    if (path.startsWith('/ats/')) {
        const publicUserId = path.split('/ats/')[1]?.split('/')[0] || path.split('/ats')[1]?.split('/')[0];
        if (publicUserId) {
            return <BiodataExtract userId={publicUserId} atsMode={true} />;
        }
    }

    const { streamStatus } = logic;

    // [GEO HEALTH] Data Health Monitor state
    const [dataHealthCount, setDataHealthCount] = useState(0);
    const [tetheredAnomalyId, setTetheredAnomalyId] = useState<string | null>(null);

    const hasLocalConfig = !!localStorage.getItem('firebaseConfig') || !!localStorage.getItem('gigi_firebase_config');
    const isDevUser = logic.user?.id === 'dev-user-root';
    const forceLoginPage = isDevUser && hasLocalConfig;

    // [ZEN V28] Protocol 02022026: ABSOLUTE SILENCE (Cache Purge)
    /* [ZEN EWO #24] Disabled Auto-Purge for Stability
    useEffect(() => {
        console.log("[Stability] 🛑 Purging GIGI_STABILITY_INDEX from browser storage...");
        localStorage.removeItem('GIGI_STABILITY_INDEX');
        sessionStorage.removeItem('GIGI_STABILITY_INDEX');
    }, []);
    */

    useFontLoader(logic.settings.installedFonts || []);

    // [ZEN FIX] Ensure Search Index is ready on Boot - Stabilized to ID
    useEffect(() => {
        if (logic.user?.id) {
            initMemoryStore().catch(e => console.error("[App] Typesense Init Failed:", e));
            
            // Expose reindexing tools for Admin/Heal operations
            (window as any).reindexMedia = reindexMedia;
            (window as any).reindexAllTags = reindexAllTags;
        }
    }, [logic.user?.id]);

    // [GEO HEALTH] Trigger background audit 10s after login (non-blocking)
    useEffect(() => {
        if (!logic.user?.id || !logic.isInitialSyncComplete) return;
        const timer = setTimeout(() => {
            logInteraction(logic.user!.id).catch(() => {});
            runGeoAudit(logic.user!.id).catch(e =>
                console.warn('[App] Geo audit failed silently:', e)
            );
            // Stagger housekeeping audit to run after geo audit
            setTimeout(() => {
                runHousekeepingAudit(logic.user!.id).catch(e => 
                    console.warn('[App] Housekeeping audit failed silently:', e)
                );
                // Also trigger Life Pulse calculation
                calculateLifeEras().catch(e => 
                    console.warn('[App] Life Pulse calculation failed:', e)
                );
            }, 10000); // [ZEN FIX] 10s stagger to prioritize UI stability
        }, 10000); // [ZEN FIX] 10s initial delay
        return () => clearTimeout(timer);
    }, [logic.user?.id, logic.isInitialSyncComplete]);
    
    // [ZEN] SOVEREIGN MODEL GATEWAY
    const { newFlagship, promoteModel, dismissUpgrade } = useModelGateway(logic.user?.id);
    const notifiedFlagshipRef = useRef<string | null>(null);

    useEffect(() => {
        if (newFlagship && logic.user && logic.isInitialSyncComplete && notifiedFlagshipRef.current !== newFlagship) {
            console.log(`[ModelGateway] 🚀 Neural Upgrade Opportunity: ${newFlagship}`);
            notifiedFlagshipRef.current = newFlagship;
            
            logic.addToast(`🆕 Neural Upgrade Detected: ${newFlagship}`, "info", {
                label: "PROMOTE",
                onClick: () => {
                    promoteModel('chat_primary', newFlagship);
                    promoteModel('enrichment', newFlagship);
                    logic.addToast(`Neural Flagship promoted to ${newFlagship}`, "success");
                    dismissUpgrade();
                }
            });
        }
    }, [newFlagship, logic.user, logic.isInitialSyncComplete, dismissUpgrade, promoteModel]);

    const rawWp = logic.settings.wallpaper;
    const isLegacyDefault = rawWp && rawWp.id === 'midnight-void';

    const wp = (!rawWp || isLegacyDefault) ? {
        id: 'spatial-matrix',
        type: 'preset',
        value: 'transparent',
        opacity: 0,
        blur: 0
    } : rawWp;

    const backgroundStyle: React.CSSProperties = (wp.type === 'image' || wp.type === 'preset') ? {
        background: wp.type === 'image' ? `url(${wp.value})` : wp.value,
        backgroundSize: wp.type === 'image' ? 'cover' : undefined,
        backgroundPosition: wp.type === 'image' ? 'center' : undefined,
        backgroundRepeat: wp.type === 'image' ? 'no-repeat' : undefined,
        filter: `blur(${wp.blur ?? 0}px) brightness(${wp.opacity ?? 1})`,
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0
    } : {};

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'G' || e.key === 'g')) {
                e.preventDefault();
                if (isRootUser(logic.user)) {
                    console.log("[App] ⚡ Dysus Panel (God Mode) Triggered via Hotkey");
                    logic.setShowDevPatch(prev => !prev);
                } else {
                    console.warn("[App] ⛔ RBAC: God Mode access denied.");
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'X' || e.key === 'x')) {
                e.preventDefault();
                if (confirm("💥 EMERGENCY RESET: This will wipe local storage and reload. Continue?")) {
                    localStorage.clear();
                    sessionStorage.clear();
                    if (window.indexedDB) window.indexedDB.deleteDatabase('firebaseLocalStorageDb');
                    window.location.reload();
                }
            }
            // [ZEN] Grok Airlock Hotkey
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
                e.preventDefault();
                setShowGrokAirlock(prev => !prev);
                console.log("[App] 🛡️ Grok Airlock Scrubber Toggled via Hotkey");
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [logic.setShowDevPatch]);

    if (logic.authLoading) {
        return <SplashShield isVisible={true} />;
    }

    return (
        <GedcomProvider>
            <div className="flex flex-col h-screen bg-transparent text-gray-900 dark:text-gray-100 relative overflow-hidden transition-colors duration-300">

                {/* Global Offline Shield */}
                {isOffline && (
                    <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600/90 text-white text-center py-1.5 text-[10px] font-bold tracking-widest uppercase shadow-lg shadow-red-900/20 backdrop-blur-md flex items-center justify-center gap-2 border-b border-red-400/50">
                        <span className="animate-pulse h-2 w-2 bg-white rounded-full shadow-[0_0_8px_white]"></span>
                        Connection Lost ... Retrying
                    </div>
                )}

                {/* Global Wallpaper Layer */}
                {(wp.type === 'image' || wp.type === 'preset') && <div style={backgroundStyle} />}

                {/* Main Content Layer */}
                <div className="relative z-10 flex flex-col h-full">
                    <ToastContainer toasts={logic.toasts} onDismiss={logic.dismissToast} />

                    <StagingModals
                        user={logic.user || null}
                        showSettingsModal={logic.showSettingsModal}
                        setShowSettingsModal={logic.setShowSettingsModal}
                        settingsTab={logic.settingsTab}
                        settings={logic.settings}
                        setSettings={logic.setSettings}
                        theme={logic.theme}
                        toggleTheme={logic.toggleTheme}
                        handleExportRequest={logic.handleExportRequest}
                        backupImportStatus={logic.backupImportStatus}
                        setBackupImportStatus={logic.setBackupImportStatus}
                        showExportModal={logic.showExportModal}
                        setShowExportModal={logic.setShowExportModal}
                        handleConfirmExport={logic.handleConfirmExport}
                        showDevPatch={logic.showDevPatch}
                        setShowDevPatch={logic.setShowDevPatch}
                        godModeSettings={logic.godModeSettings}
                        setGodModeSettings={logic.setGodModeSettings}
                        showDevTools={logic.showDevTools}
                        setShowDevTools={logic.setShowDevTools}
                        showRescueModal={logic.showRescueModal}
                        setShowRescueModal={logic.setShowRescueModal}
                        localRescueCount={logic.localRescueCount}
                        handleRescueConfirm={logic.handleRescueConfirm}
                        isRescuing={logic.isRescuing}
                        showShareModal={logic.showShareModal}
                        setShowShareModal={logic.setShowShareModal}
                        matrixSelection={logic.matrixSelection}
                        clearMatrixSelection={logic.clearMatrixSelection}
                        verts={logic.verts}
                        addToast={logic.addToast}
                        showSocialDiscovery={logic.showSocialDiscovery}
                        setShowSocialDiscovery={logic.setShowSocialDiscovery}
                    />

                    <SignedIn>
                        {logic.user && !forceLoginPage ? (
                            viewMode === 'chat' ? (
                                <SimpleChatApp
                                    user={logic.user}
                                    tags={logic.tags}
                                    onNavigateOS={() => {
                                        setViewMode('os');
                                        window.history.pushState({}, '', '/os');
                                    }}
                                />
                            ) : (
                            <WindowManagerProvider>
                            <ChatSessionProvider user={logic.user}>
                            <WikiNavigationProvider
                                userId={logic.user.id}
                                allMedia={logic.media}
                                onNavigate={logic.navigate}
                                currentView={logic.currentView}
                                currentViewData={logic.viewData}
                            >
                                <MainLayout
                                user={logic.user}
                                currentView={logic.currentView}
                                onNavigate={logic.navigate}
                                theme={logic.theme}
                                toggleTheme={logic.toggleTheme}
                                onLogout={logic.handleLogout}
                                notifications={logic.notifications}
                                userStatus={logic.userStatus}
                                onStatusChange={logic.setUserStatus}
                                isLocalMode={!logic.isFirebaseConfigured}
                                onOpenSettings={() => logic.setShowSettingsModal(true)}
                                onOpenDevTools={() => logic.setShowDevTools(true)}
                                onOpenAirlock={() => logic.setShowAirlock(true)}
                                settings={logic.settings}
                            >
    
                                
                                {logic.currentView === 'dashboard' && !logic.isInitialSyncComplete ? (
                                    <div className="flex-1 flex items-center justify-center bg-black/20 backdrop-blur-md">
                                        <SplashShield 
                                            isVisible={true} 
                                            eventsCount={logic.events.length}
                                            tagsCount={logic.tags.length}
                                            mediaCount={logic.media.length}
                                            vertsCount={logic.verts.length}
                                        />
                                    </div>
                                ) : logic.currentView === 'dashboard' && (
                                    <Desktop
                                        user={logic.user}
                                        onNavigate={logic.navigate}
                                        events={logic.events}
                                        tags={logic.tags}
                                        media={logic.media}
                                        verts={logic.verts}
                                        settings={logic.settings}
                                        streamStatus={streamStatus}
                                        stagedFiles={logic.stagedFiles}
                                        pendingAccessionsCount={logic.pendingAccessionsCount}
                                        messengerCount={logic.commsArchives.length}
                                        chatHistory={logic.chatHistory}
                                    />
                                )}
    
                                 {logic.currentView === 'interviews' && !logic.isInitialSyncComplete ? (
                                    <div className="flex-1 flex items-center justify-center bg-black">
                                        <SplashShield 
                                            isVisible={true} 
                                            eventsCount={logic.events.length}
                                            tagsCount={logic.tags.length}
                                            mediaCount={logic.media.length}
                                            vertsCount={logic.verts.length}
                                        />
                                    </div>
                                ) : logic.currentView === 'interviews' && (
                                    <BridgeLockedBoundary
                                        onReset={() => {
                                            console.log("[Bridge] 🔄 Manual Reset Sequence Initiated...");
                                            window.location.reload();
                                        }}
                                    >
                                        <AiChat
                                            user={logic.user}
                                            initialMessage={logic.viewData?.initialMessage}
                                            initialVertId={logic.viewData?.vertId}
                                            initialMode={logic.viewData?.mode}
                                            clearInitialMessage={() => logic.setViewData(null)}
                                            onNavigate={logic.navigate}
                                            currentView={logic.currentView}
                                            chatHistory={logic.chatHistory}
                                            onHistoryChange={(h) => { logic.setChatHistory(h); appDataService.saveChatHistory(logic.user!.id, h); }}
                                            loadMoreChat={logic.loadMoreChat}
                                            hasMoreChat={logic.hasMoreChat}
                                            onAiCreateEvent={async (args) => {
                                                const newEvent: LifeEvent = {
                                                    id: `event-${Date.now()}`,
                                                    title: args.title,
                                                    date: new Date(args.date),
                                                    details: args.details,
                                                    tagIds: [],
                                                    mediaIds: []
                                                };
                                                await appDataService.saveEvent(logic.user!.id, newEvent);
                                                await logic.loadUserData(logic.user!.id);
                                                return newEvent;
                                            }}
                                            isDataLoading={!logic.isInitialSyncComplete}
                                            onGigiJournalEntryCreated={(entry) => { logic.setGigiJournal(prev => [...prev, entry]); }}
                                            onAiCreateGigiJournalEntry={async (args) => {
                                                const newEntry: GigiJournalEntry = {
                                                    id: `journal-${Date.now()}`,
                                                    title: args.title,
                                                    content: args.content,
                                                    creationDate: new Date(),
                                                    relatedChatHistory: [],
                                                    type: 'reflection',
                                                    reactions: [],
                                                    comments: [],
                                                    read: false
                                                };
                                                await appDataService.saveGigiJournalEntry(logic.user!.id, newEntry);
                                                await logic.loadUserData(logic.user!.id);
                                                return newEntry;
                                            }}
                                            onAiCreateTag={async (args) => {
                                                const newTag = { id: `tag-${Date.now()}`, name: args.name, type: args.type || 'unknown', mediaGallery: [], description: '', privateNotes: '', isPrivate: false, tagIds: [], mediaIds: [], metadata: {} } as Tag;
                                                await appDataService.saveTag(logic.user!.id, newTag);
                                                await logic.loadUserData(logic.user!.id);
                                                return newTag;
                                            }}
                                            onAiUpdateTag={async (tag) => {
                                                await appDataService.saveTag(logic.user!.id, tag);
                                                await logic.loadUserData(logic.user!.id);
                                                return { status: 'success' };
                                            }}
                                            apiKeySkipped={false}
                                            events={logic.events}
                                            tags={logic.tags}
                                            media={logic.media}
                                            recentJournalCommentThread={null}
                                            clearRecentJournalCommentThread={() => { }}
                                            systemPromptPatches={logic.godModeSettings.companionTraits as any || {}}
                                            addToast={logic.addToast}
                                            onDeepDive={logic.handleTriggerDeepDive}
                                            peerSessions={logic.peerSessions}
                                            verts={logic.verts}
                                            handleStageFiles={logic.handleStageFiles}
                                            onOpenSettings={(tab?: SettingsTab) => {
                                                if (tab) logic.setSettingsTab(tab);
                                                logic.setShowSettingsModal(true);
                                            }}
                                        />
                                    </BridgeLockedBoundary>
                                )}
                                {logic.currentView === 'timeVortex' && (
                                    <TimeVortex
                                        events={logic.events} tags={logic.tags} media={logic.media} user={logic.user!}
                                        onEditEvent={(e: LifeEvent) => logic.navigate('eventEditor', { eventId: e.id })}
                                        onCreateEvent={() => logic.navigate('eventEditor')}
                                        onEditTag={(t: Tag) => logic.navigate('tagEditor', { tagId: t.id })}
                                        onAddComment={async (id: string, txt: string) => logic.handleEventComment(id, txt)}
                                        onUpdateEvent={logic.handleSaveEvent}
                                        onDeepDive={logic.handleTriggerDeepDive}
                                        onNavigate={logic.navigate}
                                        onDeleteEvent={async (id: string) => {
                                            logic.setEvents(prev => prev.filter(e => e.id !== id));
                                            await appDataService.deleteEvent(logic.user!.id, id);
                                            logic.loadUserData(logic.user!.id);
                                        }}
                                        onCreateTag={logic.handleCreateTag}
                                    />
                                )}
                                 {logic.currentView === 'tags' && (
                                     <TagGallery
                                         tags={logic.tags}
                                         media={logic.media}
                                         tagBeingDeleted={null}
                                         initialTagId={logic.viewData?.tagId}
                                         clearInitialTagId={() => logic.setViewData(null)}
                                         onEditTag={(t, tab) => logic.navigate('tagEditor', { tagId: t.id, initialTab: tab })}
                                         onCreateTag={(type) => logic.navigate('tagEditor', { draftTag: { id: `tag-${Date.now()}`, name: '', type, mediaGallery: [], description: '', privateNotes: '', isPrivate: false, tagIds: [], mediaIds: [], metadata: {} } as Tag })}
                                         onDeleteTag={async (id) => { 
                                             // [ZEN] Optimistic local update for immediate UI refresh
                                             logic.setTags(prev => prev.filter(t => t.id !== id));
                                             await appDataService.deleteTag(logic.user!.id, id); 
                                         }}
                                         onReplaceTag={async (tag) => {
                                             // [ZEN V32] Optimistic local update - no full reload to preserve scroll
                                             logic.setTags(prev => prev.map(t => t.id === tag.id ? tag : t));
                                             await appDataService.saveTag(logic.user!.id, tag);
                                             // Note: Removed loadUserData call to prevent scroll jump
                                         }}
                                         onDiscuss={(t) => logic.navigate('interviews', { initialMessage: `Let's talk about ${t.name}` })}
                                         userPersonTagId={logic.user!.personTagId}
                                         currentUser={logic.user!}
                                         addToast={logic.addToast}
                                         onMediaClick={(m) => logic.navigate('theMatrix', { 
                                             mediaId: m.id, 
                                             returnTo: 'tags', 
                                             tagId: logic.viewData?.tagId 
                                         })}
                                         returnTo={logic.viewData?.returnTo}
                                         onNavigate={(view) => {
                                             if (view === 'health') {
                                                 logic.navigate('dashboard');
                                             } else {
                                                 logic.navigate(view);
                                             }
                                         }}
                                     />
                                 )}
                                {logic.currentView === 'theMatrix' && (
                                    <TheMatrix
                                        user={logic.user!}
                                        tags={logic.tags}
                                        onNavigate={(view, data) => {
                                            if (view === 'health') {
                                                logic.navigate('dashboard'); // Resume at the bridge
                                            } else {
                                                logic.navigate(view, data);
                                            }
                                        }}
                                        onDeleteMedia={logic.handleDeleteMedia}
                                        onUpdateMedia={async (mediaItem, targetCollection) => {
                                            await logic.handleSaveMedia(mediaItem, targetCollection);
                                            if (tetheredAnomalyId && logic.user) {
                                                console.log(`[App] 🎯 Archival Tether Triggered: Resolving anomaly ${tetheredAnomalyId}`);
                                                await dismissGeoAnomaly(logic.user.id, tetheredAnomalyId);
                                                setTetheredAnomalyId(null);
                                            }
                                        }}
                                        onStageFiles={logic.handleStageFiles}
                                        initialMediaId={logic.viewData?.mediaId}
                                        initialMediaObject={logic.viewData?.mediaObject}
                                        initialShowShoebox={logic.viewData?.view === 'shoebox'}
                                        onDeepDive={logic.handleTriggerDeepDive}
                                        returnTo={logic.viewData?.returnTo}
                                        tagId={logic.viewData?.tagId}
                                        onCreateTag={logic.handleCreateTag}
                                        onShareMedia={(ids: string[]) => {
                                            logic.setMatrixSelection(ids);
                                            logic.setShowShareModal(true);
                                        }}
                                        tetheredAnomalyId={tetheredAnomalyId}
                                        addToast={logic.addToast}
                                    />
                                )}
                                {logic.currentView === 'profile' && (
                                    <ProfileEditor
                                        user={logic.user!}
                                        onUserUpdate={async (u) => { await appDataService.updateUserProfile(u.id, u); logic.setUser(u); }}
                                        onNavigate={logic.navigate}
                                        addToast={logic.addToast}
                                        settings={logic.settings}
                                        onSettingsChange={logic.setSettings}
                                        theme={logic.theme}
                                        toggleTheme={logic.toggleTheme}
                                        allMedia={logic.media}
                                        onSaveMedia={logic.handleSaveMedia}
                                        onExportAllData={logic.handleExportRequest}
                                        onTriggerRestore={logic.handleTriggerRestore}
                                        onCreateUserPersonTag={() => { }}
                                    />
                                )}
                                {logic.currentView === 'aiCompanionEditor' && (
                                    <AICompanionEditor
                                        user={logic.user!}
                                        onUserUpdate={async (u) => { await appDataService.updateUserProfile(u.id, u); logic.setUser(u); }}
                                        onNavigate={logic.navigate}
                                    />
                                )}
                                {logic.currentView === 'eventEditor' && (
                                    <EventEditor
                                        event={logic.events.find(e => e.id === logic.viewData?.eventId) || logic.viewData?.draftEvent || { id: `event-${Date.now()}`, title: '', date: new Date(), details: '', tagIds: [], mediaIds: [] }}
                                        allTags={logic.tags} allMedia={logic.media}
                                        user={logic.user!}
                                        onSave={logic.handleSaveEvent}
                                        onDelete={async (id) => {
                                            logic.setEvents(prev => prev.filter(e => e.id !== id));
                                            await appDataService.deleteEvent(logic.user!.id, id);
                                            logic.loadUserData(logic.user!.id);
                                            logic.navigate('timeVortex');
                                        }}
                                        onCreateTag={async (name, type) => {
                                            const newTag = { id: `tag-${Date.now()}`, name, type, mediaGallery: [], description: '', privateNotes: '', isPrivate: false, tagIds: [], mediaIds: [], metadata: {} } as Tag;
                                            await appDataService.saveTag(logic.user!.id, newTag);
                                            logic.loadUserData(logic.user!.id);
                                            return newTag;
                                        }}
                                        onCancel={() => logic.navigate('timeVortex')}
                                    />
                                )}
                                {logic.currentView === 'tagEditor' && (
                                    <TagEditor
                                        tag={logic.tags.find(t => t.id === logic.viewData?.tagId) || logic.viewData?.draftTag || { id: `tag-${Date.now()}`, name: '', type: 'unknown', mediaGallery: [], description: '', privateNotes: '', isPrivate: false, tagIds: [], mediaIds: [], metadata: {} } as Tag}
                                        initialTab={logic.viewData?.initialTab as any}
                                        isAdversarial={logic.viewData?.isAdversarial}
                                        resumeSessionId={logic.viewData?.resumeSessionId}
                                        allTags={logic.tags} allMedia={logic.media}
                                        user={logic.user!}
                                        onSave={async (tag, isSilent) => {
                                            await logic.handleSaveTag(tag, isSilent, (v) => logic.navigate(v as any));
                                            if (isSilent && !logic.viewData?.tagId) {
                                                logic.setViewData({ ...logic.viewData, tagId: tag.id });
                                            }
                                        }}
                                        onUploadAvatar={logic.handleUploadAvatar}
                                        onCancel={() => {
                                            // [ZEN] If a return breadcrumb was embedded in viewData (e.g. from a WikiText
                                            // tag badge click), navigate the user back to exactly where they came from.
                                            // Otherwise fall back to the Tags gallery.
                                            const returnView = logic.viewData?.returnView;
                                            const returnViewData = logic.viewData?.returnViewData;
                                            if (returnView) {
                                                console.log(`[App] 🔙 Tag Editor closed — restoring view: "${returnView}"`, returnViewData);
                                                logic.navigate(returnView, returnViewData || undefined);
                                            } else {
                                                logic.navigate('tags');
                                            }
                                        }}
                                        onDiscuss={(t) => logic.navigate('interviews', { initialMessage: `Let's talk about ${t.name}` })}
                                        createDefaultMetadata={getDefaultMetadata}
                                        settings={logic.settings}
                                        onLoadTagId={(id) => logic.navigate('tagEditor', { tagId: id })}
                                    />
                                )}
    
                                {/* [ZEN UPDATE] Daydream Studio */}
                                {logic.currentView === 'daydream' && (
                                    logic.viewData?.isEditor ? (
                                        <DaydreamEditor
                                            user={logic.user!}
                                            storyId={logic.viewData?.storyId}
                                            onClose={() => logic.navigate('daydream')}
                                        />
                                    ) : (
                                        <DaydreamDashboard
                                            user={logic.user!}
                                            onOpenStory={(id) => logic.navigate('daydream', { isEditor: true, storyId: id })}
                                            addToast={logic.addToast}
                                        />
                                    )
                                )}
    
                                {/* [ZEN UPDATE] "Orbital View" - Social Geometry */}
                                {logic.currentView === 'archivists' && (
                                    <OrbitalView
                                        user={logic.user!}
                                        verts={logic.verts}
                                        tags={logic.tags}
                                        media={logic.media}
                                        userPersonTagId={logic.user?.personTagId || null}
                                        onNavigate={logic.navigate}
                                        addToast={logic.addToast}
                                        onOpenDiscovery={() => logic.setShowSocialDiscovery(true)}
                                    />
                                )}
    
                                {/* [ZEN UPDATE] Sovereign Staging Dashboard */}
                                {logic.currentView === 'staging' && (
                                    <StagingDashboard onNavigate={logic.navigate} />
                                )}

                                {/* [ZEN UPDATE] Clotho's Loom Generative Studio */}
                                {logic.currentView === 'loom' && (
                                    <LoomCanvas />
                                )}

                                {/* [ZEN UPDATE] Takeout Airlock */}
                                {logic.currentView === 'airlock' && (
                                    <TakeoutAirlock />
                                )}
    
                                <CommunicationsOverlay
                                    currentView={logic.currentView}
                                    user={logic.user!}
                                    messages={logic.messages || []}
                                    gigiJournal={logic.gigiJournal}
                                    commsArchives={logic.commsArchives}
                                    setCommsArchives={logic.setCommsArchives}
                                    setGigiJournal={logic.setGigiJournal}
                                    viewData={logic.viewData}
                                    setViewData={logic.setViewData}
                                    navigate={logic.navigate}
                                    stagedFiles={logic.stagedFiles}
                                    setStagedFiles={logic.setStagedFiles}
                                    tags={logic.tags}
                                    settings={logic.settings}
                                    handleStageFiles={logic.handleStageFiles}
                                    deepDiveQuery={logic.deepDiveQuery}
                                    events={logic.events}
                                    media={logic.media}
                                    airlockRequests={logic.airlockRequests}
                                    addToast={logic.addToast}
                                />
                            </MainLayout>
                            </WikiNavigationProvider>
                            </ChatSessionProvider>
                            </WindowManagerProvider>
                            )
                        ) : (
                            <div className="flex-1 flex items-center justify-center bg-black/80 backdrop-blur-md">
                                <SplashShield 
                                    isVisible={true} 
                                    eventsCount={0}
                                    tagsCount={0}
                                    mediaCount={0}
                                    vertsCount={0}
                                />
                            </div>
                        )}
                    </SignedIn>
                    <SignedOut>
                        <div className="min-h-[100dvh] w-full bg-[#0B0D17] flex flex-col md:flex-row overflow-hidden relative selection:bg-cyan-500/30">
                            {/* Left/Top Branding Pane */}
                            <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 z-10 relative bg-gradient-to-br from-[#0B0D17] to-[#111424]">
                                {/* Decorative ambient glows */}
                                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
                                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
                                
                                <LoginHeader />
                            </div>

                            {/* Right/Bottom Authentication Pane */}
                            <div className="w-full md:w-[450px] lg:w-[550px] shrink-0 bg-[#06080D]/80 backdrop-blur-3xl md:border-l border-white/5 flex flex-col items-center justify-center p-6 md:p-12 z-20 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] overflow-y-auto min-h-[50dvh] md:min-h-full">
                                <div className="w-full max-w-sm mx-auto flex items-center justify-center">
                                    <SignIn />
                                </div>
                            </div>
                        </div>
                    </SignedOut>

                    {/* [ZEN NEW] Splash Shield layer controlled by Sync Status */}
                    {!logic.isInitialSyncComplete && logic.user && viewMode === 'os' && (
                        <SplashShield 
                            isVisible={true} 
                            eventsCount={logic.events.length}
                            tagsCount={logic.tags.length}
                            mediaCount={logic.media.length}
                            vertsCount={logic.verts.length}
                        />
                    )}

                    {/* Flight Anomaly Recorder */}
                    <BlackBoxReporter />

                    {/* [ZEN] Payload Scrubber Airlock */}
                    <GrokAirlockModal 
                        isOpen={showGrokAirlock} 
                        onClose={() => setShowGrokAirlock(false)} 
                    />
                </div>
            </div>
        </GedcomProvider>
    );
};

export default App;
