import React, { useEffect } from 'react';
import { useAppLogic } from './hooks/useAppLogic';
import type { LifeEvent, Tag, GigiJournalEntry, View } from '@/types';
import { appDataService } from './services/serviceManager';

// Layout
import MainLayout from './components/Layout/MainLayout';

// Components
import Dashboard from './components/Dashboard';
import AiChat from './components/AiChat';
import TimeVortex from './components/Timeline';
import TagGallery from './components/TagGallery';
import TheMatrix from './components/matrix';
import ProfileEditor from './components/ProfileEditor';
import GigiJournalView from './components/GigiJournalView';
import CommunicationsCenter from './components/CommunicationsCenter';
import EventEditor from './components/EventEditor';
import TagEditor from './components/TagEditor';
import { StagingArea } from './components/StagingArea';
import DeepDiveReporter from './components/DeepDiveReporter';
import LoginPage from './components/LoginPage';
import BackupImportModal from './components/BackupImportModal';
import ExportModal from './components/ExportModal';
import DataRescueModal from './components/DataRescueModal';
import ToastContainer from './components/Toast';
import DevPatchModal from './components/DevPatchModal';
import SettingsModal from './components/SettingsModal';
import AICompanionEditor from "./components/admin/AICompanionEditor";
import ZenWhispererModal from './components/ZenWhispererModal';

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
    const logic = useAppLogic();
    const { streamStatus } = logic;

    // Hotkey triggers Dysus Panel (DevPatch)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'G' || e.key === 'g')) {
                e.preventDefault();
                console.log("[App] ⚡ Dysus Panel (God Mode) Triggered via Hotkey");
                logic.setShowDevPatch(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [logic.setShowDevPatch]);

    // [ZEN] Global Trigger for Settings (e.g. from Bento cards)
    useEffect(() => {
        if (logic.viewData?.openSettings === true) {
            logic.setShowSettingsModal(true);
            // Clear the data once handled to prevent re-triggering
            logic.setViewData(null);
        }
    }, [logic.viewData, logic.setShowSettingsModal, logic.setViewData]);

    if (logic.authLoading) {
        return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading Archive...</div>;
    }

    return (
        <div className="flex flex-col h-screen transition-colors duration-300 text-gray-900 dark:text-gray-100">
            <ToastContainer toasts={logic.toasts} onDismiss={logic.dismissToast} />

            <SettingsModal
                isOpen={logic.showSettingsModal}
                onClose={() => logic.setShowSettingsModal(false)}
                settings={logic.settings}
                onSettingsChange={logic.setSettings}
                theme={logic.theme}
                toggleTheme={logic.toggleTheme}
                onExport={logic.handleExportRequest}
                user={logic.user || null}
            />

            {logic.backupImportStatus.type !== 'idle' && (
                <BackupImportModal
                    status={logic.backupImportStatus}
                    onConfirm={() => { }}
                    onClose={() => logic.setBackupImportStatus({ type: 'idle' })}
                    currentUser={logic.user}
                />
            )}

            {logic.showExportModal && (
                <ExportModal
                    onConfirm={logic.handleConfirmExport}
                    onCancel={() => logic.setShowExportModal(false)}
                />
            )}

            <DevPatchModal
                isOpen={logic.showDevPatch}
                onClose={() => logic.setShowDevPatch(false)}
                currentSettings={logic.godModeSettings}
                onSave={logic.setGodModeSettings}
                user={logic.user || { aiCompanions: [] } as any}
            />

            {logic.showDevTools && logic.user && (
                <ZenWhispererModal
                    isOpen={logic.showDevTools}
                    onClose={() => logic.setShowDevTools(false)}
                    user={logic.user}
                />
            )}

            {logic.showRescueModal && (
                <DataRescueModal
                    count={logic.localRescueCount}
                    userEmail={logic.user?.email}
                    onConfirm={logic.handleRescueConfirm}
                    onDismiss={() => logic.setShowRescueModal(false)}
                    isSyncing={logic.isRescuing}
                />
            )}

            {logic.user ? (
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
                >
                    {logic.currentView === 'dashboard' && (
                        <Dashboard
                            user={logic.user}
                            onNavigate={logic.navigate}
                            events={logic.events}
                            tags={logic.tags}
                            media={logic.media}
                            settings={logic.settings}
                            streamStatus={streamStatus}
                        />
                    )}

                    {logic.currentView === 'interviews' && (
                        <AiChat
                            user={logic.user}
                            initialMessage={logic.viewData?.initialMessage}
                            clearInitialMessage={() => logic.viewData = null}
                            onNavigate={logic.navigate}
                            chatHistory={logic.chatHistory}
                            onHistoryChange={(h) => { logic.setChatHistory(h); appDataService.saveChatHistory(logic.user!.id, h); }}
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
                            isDataLoading={false}
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
                        />
                    )}
                    {logic.currentView === 'timeVortex' && (
                        <TimeVortex
                            events={logic.events} tags={logic.tags} media={logic.media} user={logic.user}
                            onEditEvent={(e) => logic.navigate('eventEditor', { eventId: e.id })}
                            onCreateEvent={() => logic.navigate('eventEditor')}
                            onEditTag={(t) => logic.navigate('tagEditor', { tagId: t.id })}
                            onAddComment={async (id, txt) => logic.handleEventComment(id, txt)}
                            onUpdateEvent={logic.handleSaveEvent}
                            onDeepDive={logic.handleTriggerDeepDive}
                            onNavigate={logic.navigate}
                            onDeleteEvent={async (id) => {
                                await appDataService.deleteEvent(logic.user!.id, id);
                                logic.loadUserData(logic.user!.id);
                            }}
                        />
                    )}
                    {logic.currentView === 'tags' && (
                        <TagGallery
                            tags={logic.tags}
                            media={logic.media}
                            tagBeingDeleted={null}
                            onEditTag={(t) => logic.navigate('tagEditor', { tagId: t.id })}
                            onCreateTag={() => logic.navigate('tagEditor')}
                            onDeleteTag={async (id) => { await appDataService.deleteTag(logic.user!.id, id); logic.loadUserData(logic.user!.id); }}
                            onReplaceTag={() => { }}
                            onDiscuss={(t) => logic.navigate('interviews', { initialMessage: `Let's talk about ${t.name}` })}
                            userPersonTagId={logic.user.personTagId}
                        />
                    )}
                    {logic.currentView === 'theMatrix' && (
                        <TheMatrix
                            user={logic.user}
                            tags={logic.tags}
                            onNavigate={logic.navigate}
                            onDeleteMedia={logic.handleDeleteMedia}
                            onStageFiles={logic.handleStageFiles}
                            initialMediaId={logic.viewData?.mediaId}
                            initialMediaObject={logic.viewData?.mediaObject}
                            onDeepDive={logic.handleTriggerDeepDive}
                            returnTo={logic.viewData?.returnTo}
                        />
                    )}
                    {logic.currentView === 'profile' && (
                        <ProfileEditor
                            user={logic.user}
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
                            user={logic.user}
                            onUserUpdate={async (u) => { await appDataService.updateUserProfile(u.id, u); logic.setUser(u); }}
                            onNavigate={logic.navigate}
                        />
                    )}
                    {logic.currentView === 'eventEditor' && (
                        <EventEditor
                            event={logic.events.find(e => e.id === logic.viewData?.eventId) || logic.viewData?.draftEvent || { id: `event-${Date.now()}`, title: '', date: new Date(), details: '', tagIds: [], mediaIds: [] }}
                            allTags={logic.tags} allMedia={logic.media}
                            onSave={logic.handleSaveEvent}
                            onDelete={async (id) => { await appDataService.deleteEvent(logic.user!.id, id); logic.loadUserData(logic.user!.id); logic.navigate('timeVortex'); }}
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
                            tag={logic.tags.find(t => t.id === logic.viewData?.tagId) || { id: `tag-${Date.now()}`, name: '', type: 'unknown', mediaGallery: [], description: '', privateNotes: '', isPrivate: false, tagIds: [], mediaIds: [], metadata: {} } as Tag}
                            allTags={logic.tags} allMedia={logic.media}
                            user={logic.user}
                            onSave={async (tag, isSilent) => {
                                await logic.handleSaveTag(tag, isSilent, (v) => logic.navigate(v as any), () => logic.loadUserData(logic.user!.id));
                            }}
                            onUploadAvatar={logic.handleUploadAvatar}
                            onCancel={() => logic.navigate('tags')}
                            onDiscuss={(t) => logic.navigate('interviews', { initialMessage: `Let's talk about ${t.name}` })}
                            createDefaultMetadata={getDefaultMetadata}
                            settings={logic.settings}
                        />
                    )}
                    {logic.currentView === 'gigiJournal' && (
                        <GigiJournalView
                            journal={logic.gigiJournal} user={logic.user}
                            events={logic.events}
                            onAddComment={logic.handleJournalComment}
                            onUpdateEntry={async (entry) => {
                                logic.setGigiJournal(prev => prev.map(e => e.id === entry.id ? entry : e));
                                await appDataService.saveGigiJournalEntry(logic.user!.id, entry);
                            }}
                            onUpdateEvent={logic.handleSaveEvent}
                            onDeleteEntry={async (entryId) => {
                                logic.setGigiJournal(prev => prev.filter(e => e.id !== entryId));
                                await appDataService.deleteGigiJournalEntry(logic.user!.id, entryId);
                            }}
                        />
                    )}
                    {logic.currentView === 'commsCenter' && (
                        <CommunicationsCenter messages={[]} onMarkAsRead={() => { }} />
                    )}
                    {/* [ZEN FIX] Fixed StagingArea Type Mismatches */}
                    {logic.currentView === 'staging' && (
                        <StagingArea
                            stagedFiles={logic.stagedFiles}
                            onClear={() => logic.setStagedFiles([])}
                            userId={logic.user.id}
                            onNavigate={(v) => logic.navigate(v as View)} // Fixed: Cast string to View
                            userSettings={{
                                ...logic.settings,
                                theme: logic.settings.theme || 'dark' // Fixed: Fallback for optional theme
                            }}
                        />
                    )}
                    {logic.currentView === 'deepDiveReporter' && logic.deepDiveQuery && (
                        <DeepDiveReporter
                            query={logic.deepDiveQuery}
                            user={logic.user}
                            events={logic.events}
                            tags={logic.tags}
                            media={logic.media}
                            onClose={() => logic.navigate('dashboard')}
                        />
                    )}
                </MainLayout>
            ) : (
                <LoginPage
                    isFirebaseConfigured={logic.isFirebaseConfigured}
                    onLogin={logic.handleLogin}
                    onDataImported={logic.onDataImported}
                    appResetToken={logic.appResetToken}
                    onOpenSettings={() => logic.setShowSettingsModal(true)}
                />
            )}
        </div>
    );
};

export default App;