import React from 'react';
import CommunicationsCenter from '../Comms';
import { AccessioningGateway } from '../AccessioningGateway';
import DeepDiveReporter from '../DeepDiveReporter';
import { Airlock } from '../Social/Airlock';
import AlexaLink from '../AlexaLink';
import { markMessageAsRead } from '../../services/sovereignChat';
import { appDataService } from '../../services/serviceManager';
import { VertService } from '../../services/vertService';
import type { User, View, Tag, AirlockRequest, ChatMessage, GigiJournalEntry, CommsMessage } from '../../types';

interface CommunicationsOverlayProps {
    currentView: string;
    user: User;
    messages: CommsMessage[];
    gigiJournal: GigiJournalEntry[];
    commsArchives: GigiJournalEntry[];
    setCommsArchives: React.Dispatch<React.SetStateAction<GigiJournalEntry[]>>;
    setGigiJournal: React.Dispatch<React.SetStateAction<GigiJournalEntry[]>>;
    viewData: any;
    setViewData: (data: any) => void;
    navigate: (view: View, data?: any) => void;
    
    stagedFiles: any[];
    setStagedFiles: (files: any[]) => void;
    tags: Tag[];
    settings: any;
    handleStageFiles: (files: File[]) => void;
    
    deepDiveQuery: string | null;
    events: any[];
    media: any[];
    
    airlockRequests: AirlockRequest[];
    addToast: (msg: string, type: any) => void;
}

export const CommunicationsOverlay: React.FC<CommunicationsOverlayProps> = ({
    currentView,
    user,
    messages,
    gigiJournal,
    commsArchives,
    setCommsArchives,
    setGigiJournal,
    viewData,
    setViewData,
    navigate,
    stagedFiles,
    setStagedFiles,
    tags,
    settings,
    handleStageFiles,
    deepDiveQuery,
    events,
    media,
    airlockRequests,
    addToast
}) => {
    return (
        <>
            {currentView === 'commsCenter' && (
                <CommunicationsCenter
                    messages={messages || []}
                    onMarkAsRead={(id) => {
                        if (user) markMessageAsRead(user.id, id);
                    }}
                    journalEntries={[...(gigiJournal || []), ...(commsArchives || [])]}
                    user={user}
                    initialSearchTerm={viewData?.filter}
                    onExit={() => { setViewData(null); navigate('dashboard'); }}
                    onUpdateEntry={async (entry) => {
                        const isHumanArchive = entry.type === 'conversation' || entry.source?.includes('archive');
                        
                        if (isHumanArchive) {
                            setCommsArchives(prev => {
                                const exists = prev.some(e => e.id === entry.id);
                                return exists ? prev.map(e => e.id === entry.id ? entry : e) : [...prev, entry];
                            });
                            await (appDataService as any).saveCommsArchiveEntry(user.id, entry);
                        } else {
                            setGigiJournal(prev => {
                                const exists = prev.some(e => e.id === entry.id);
                                return exists ? prev.map(e => e.id === entry.id ? entry : e) : [...prev, entry];
                            });
                            await appDataService.saveGigiJournalEntry(user.id, entry);
                        }
                    }}
                    onDeleteEntry={async (id) => {
                        const inJournal = gigiJournal.some(e => e.id === id);
                        const inArchive = commsArchives.some(e => e.id === id);

                        if (inArchive) {
                            setCommsArchives(prev => prev.filter(e => e.id !== id));
                            await (appDataService as any).deleteCommsArchiveEntry(user.id, id);
                        } else if (inJournal) {
                            setGigiJournal(prev => prev.filter(e => e.id !== id));
                            await appDataService.deleteGigiJournalEntry(user.id, id);
                        }
                    }}
                />
            )}

            {currentView === 'staging' && (
                <AccessioningGateway
                    stagedFiles={stagedFiles}
                    onClear={() => setStagedFiles([])}
                    userId={user.id}
                    user={user}
                    onNavigate={(v) => navigate(v as View)}
                    tags={tags}
                    userSettings={{
                        ...settings,
                        theme: settings.theme || 'dark'
                    }}
                    onStageFiles={handleStageFiles}
                />
            )}

            {currentView === 'deepDiveReporter' && deepDiveQuery && (
                <DeepDiveReporter
                    query={deepDiveQuery}
                    user={user}
                    events={events}
                    tags={tags}
                    media={media}
                    onClose={() => navigate('dashboard')}
                />
            )}

            {currentView === 'airlock' && (
                <Airlock
                    requests={airlockRequests}
                    onClose={() => navigate('dashboard')}
                    onAccept={async (req: AirlockRequest, valence: 1 | 2 | 3, tagId?: string) => {
                        await VertService.acceptVertRequest(req.requestId, user, valence, tagId);
                        addToast("Access Granted. Signal Locked.", "success");
                    }}
                    onReject={async (req: AirlockRequest, reason: string) => {
                        await VertService.rejectVertRequest(req.requestId, reason);
                        addToast("Signal Vented to Space.", "info");
                    }}
                    existingTags={tags}
                    user={user}
                />
            )}

            {currentView === 'alexaLink' && (
                <AlexaLink
                    user={user}
                    onNavigate={navigate}
                />
            )}
        </>
    );
};
