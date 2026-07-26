import React, { useMemo } from 'react';
import type { CommsMessage, GigiJournalEntry, User } from '../../types';
import { useCommsLogic } from './useCommsLogic';
import { CommsHeader } from './CommsHeader';
import { CommsSidebar } from './CommsSidebar';
import { CommsList } from './CommsList';
import { CommsReader } from './CommsReader';

interface CommunicationsCenterProps {
    messages: CommsMessage[];
    onMarkAsRead: (id: string) => void;
    journalEntries: GigiJournalEntry[];
    user: User;
    onUpdateEntry: (entry: GigiJournalEntry) => void;
    onDeleteEntry: (id: string) => void;
    onExit?: () => void;
    initialSearchTerm?: string; // [ZEN NEW]
}

const CommunicationsCenter: React.FC<CommunicationsCenterProps> = (props) => {
    // 1. Hook into the refined Comms logic
    const logic = useCommsLogic(props);

    // 2. Compute dynamic counters for all navigation buckets
    const counts = useMemo(() => {
        return {
            inbox: props.messages.filter(m => !m.read).length,
            sent: props.messages.filter(m => m.from === props.user.id).length,
            encrypted: props.messages.filter(m => m.encrypted).length,
            all_logs: props.journalEntries.length,
            reflections: props.journalEntries.filter(e => !e.type || e.type === 'reflection').length,
            research: props.journalEntries.filter(e => e.type === 'deep_dive').length,
            transcripts: props.journalEntries.filter(e => e.type === 'conversation').length,
            requests: logic.vertexRequests.length
        };
    }, [props.messages, props.journalEntries, props.user.id]);

    return (
        <div className="h-full flex flex-col bg-black/20 backdrop-blur-md overflow-hidden relative">

            {/* Control Header */}
            <CommsHeader
                systemMode={logic.systemMode}
                searchTerm={logic.searchTerm}
                isMobileMenuOpen={logic.isMobileMenuOpen}
                onToggleMobileMenu={() => logic.setIsMobileMenuOpen(!logic.isMobileMenuOpen)}
                onModeSwitch={logic.handleModeSwitch}
                onSearchChange={logic.setSearchTerm}
                onCreateNew={logic.handleCreateNewLog}
                onExit={props.onExit} // [ZEN NEW]
            />

            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0 relative">

                {/* Navigation Sidebar */}
                <CommsSidebar
                    systemMode={logic.systemMode}
                    activeChannel={logic.activeChannel}
                    onChannelSelect={logic.setActiveChannel}
                    onModeSwitch={logic.handleModeSwitch}
                    isMobileOpen={logic.isMobileMenuOpen}
                    onCloseMobile={() => logic.setIsMobileMenuOpen(false)}
                    counts={counts}
                />

                {/* Records List */}
                <CommsList
                    items={logic.filteredItems}
                    systemMode={logic.systemMode}
                    selectedItemId={logic.selectedItemId}
                    onSelectItem={logic.handleSelectItem}
                    onEditItem={(id) => {
                        logic.handleSelectItem(id);
                        if (logic.systemMode === 'logs') logic.setIsEditing(true);
                    }}
                />

                {/* Active Reader & Editor */}
                <CommsReader
                    selectedItem={logic.selectedItem as any}
                    systemMode={logic.systemMode}
                    user={props.user}
                    isEditing={logic.isEditing}
                    editTitle={logic.editTitle}
                    editContent={logic.editContent}
                    editAuthor={logic.editAuthor}
                    onSetEditAuthor={logic.setEditAuthor}
                    onSetEditTitle={logic.setEditTitle}
                    onSetEditContent={logic.setEditContent}
                    onSave={logic.handleSaveEdit}
                    onEdit={() => logic.setIsEditing(true)}
                    onDelete={logic.handleDeleteCurrentItem}
                    onBack={() => { logic.setSelectedItemId(null); logic.setIsEditing(false); }}
                    onRefreshRequests={logic.fetchRequests}
                />

            </div>
        </div>
    );
};

export default CommunicationsCenter;