import { useState, useMemo, useEffect } from 'react';
import type { CommsMessage, GigiJournalEntry, User } from '../../types';
import { VertService } from '../../services/vertService';
import type { AirlockRequest } from '../../types';

/**
 * PROPS INTERFACE
 * Standard props for the Comms logic hook.
 * Includes data arrays and CRUD/Update handlers from the main app state.
 */
interface UseCommsProps {
    messages: CommsMessage[];
    journalEntries: GigiJournalEntry[];
    onMarkAsRead: (id: string) => void;
    onUpdateEntry: (entry: GigiJournalEntry) => void;
    onDeleteEntry: (id: string) => void;
    user: User;
    initialSearchTerm?: string; // [ZEN NEW]
}

export const useCommsLogic = ({
    messages,
    journalEntries,
    onMarkAsRead,
    onUpdateEntry,
    onDeleteEntry,
    user,
    initialSearchTerm // [ZEN NEW]
}: UseCommsProps) => {

    // --- 1. CORE NAVIGATION STATE ---
    // systemMode: Toggles between Comms 'signals' (Email/SMS) and 'logs' (Personal Journals).
    const [systemMode, setSystemMode] = useState<'signals' | 'logs'>('signals');

    // activeChannel: Filters the sidebar categories (e.g., 'inbox', 'all_logs', 'research').
    const [activeChannel, setActiveChannel] = useState<string>('inbox');

    // selectedItemId: The UUID of the currently viewed Signal or Journal.
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    // --- 2. UI & FILTERING STATE ---
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // --- 3. EDITOR STATE (The "Nightstand" Logic) ---
    // isEditing: Controls the toggle between Markdown preview and the RAW textarea.
    const [isEditing, setIsEditing] = useState(false);

    // editTitle: Buffer for the entry title during a design session.
    const [editTitle, setEditTitle] = useState('');

    // editContent: Buffer for the entry body/markdown.
    const [editContent, setEditContent] = useState('');

    // editAuthor: [ZEN FIX] Explicitly tracks if the user is claiming this journal or 
    // assigning it back to the AI. Defaults to 'user' for new creation sessions.
    const [editAuthor, setEditAuthor] = useState<'user' | 'ai'>('user');

    // --- 3.5 VERTEX REQUEST STATE ---
    const [vertexRequests, setVertexRequests] = useState<AirlockRequest[]>([]);
    const [isRequestsLoading, setIsRequestsLoading] = useState(false);

    // --- 4. DATA FILTERING ENGINE ---
    // filteredItems: The refined list of items based on the active mode, channel, and search query.
    const filteredItems = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();

        // MODE: SIGNALS (Transmissions)
        if (systemMode === 'signals') {
            if (activeChannel === 'requests') {
                return vertexRequests.filter(r =>
                    r.fromName.toLowerCase().includes(lowerSearch)
                );
            }

            return messages.filter(m => {
                const matchesSearch =
                    m.subject.toLowerCase().includes(lowerSearch) ||
                    m.from.toLowerCase().includes(lowerSearch);

                // For now, we only show 'inbox' logic for Signals
                if (activeChannel === 'inbox') return matchesSearch;
                return false;
            }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }

        // MODE: LOGS (Journals)
        else {
            return journalEntries.filter(e => {
                const matchesSearch =
                    e.title.toLowerCase().includes(lowerSearch) ||
                    e.content.toLowerCase().includes(lowerSearch);

                let matchesChannel = false;
                if (activeChannel === 'all_logs') matchesChannel = true;
                if (activeChannel === 'reflections') matchesChannel = !e.type || e.type === 'reflection';
                if (activeChannel === 'research') matchesChannel = e.type === 'deep_dive';
                if (activeChannel === 'transcripts') matchesChannel = e.type === 'conversation';

                return matchesSearch && matchesChannel;
            }).sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
        }
    }, [systemMode, activeChannel, messages, journalEntries, searchTerm]);

    // selectedItem: Find the specific object needed for the CommsReader view.
    const selectedItem = useMemo(() => {
        if (!selectedItemId) return null;
        if (systemMode === 'signals') {
            if (activeChannel === 'requests') return vertexRequests.find(r => r.requestId === selectedItemId);
            return messages.find(m => m.id === selectedItemId);
        }
        return journalEntries.find(e => e.id === selectedItemId);
    }, [selectedItemId, systemMode, activeChannel, messages, journalEntries, vertexRequests]);

    // --- 5. EFFECTS ---
    // Sync the editor buffers whenever a new item is selected in Logs mode.
    useEffect(() => {
        if (selectedItem && systemMode === 'logs') {
            const entry = selectedItem as GigiJournalEntry;
            setEditTitle(entry.title);
            setEditContent(entry.content);

            // [ZEN FIX] Soft Migration: If 'author' property is missing, 
            // the legacy data is AI-generated (Gigi). Respect it here.
            setEditAuthor(entry.author || 'ai');

            // Auto-close editing when swapping selection unless we are creating new.
            setIsEditing(false);
        }
    }, [selectedItem, systemMode]);

    // Fetch Vertex Requests on mount or user change
    useEffect(() => {
        if (user && systemMode === 'signals') {
            fetchRequests();
        }
    }, [user.id, systemMode]);

    const fetchRequests = async () => {
        setIsRequestsLoading(true);
        try {
            const reqs = await VertService.getPendingRequests(user.id);
            setVertexRequests(reqs);
        } catch (error) {
            console.error("Failed to fetch vertex requests:", error);
        } finally {
            setIsRequestsLoading(false);
        }
    };

    // --- 6. HANDLERS & ACTIONS ---

    /**
     * handleModeSwitch
     * Swaps between Signals and Logs and resets the active selection.
     */
    const handleModeSwitch = (mode: 'signals' | 'logs') => {
        setSystemMode(mode);
        setActiveChannel(mode === 'signals' ? 'inbox' : 'all_logs');
        setSelectedItemId(null);
    };

    /**
     * handleCreateNewLog
     * Spawns a new Journal Entry with the 'user' author by default.
     */
    const handleCreateNewLog = () => {
        setSystemMode('logs');
        const newEntry: GigiJournalEntry = {
            id: `entry-${Date.now()}`,
            title: 'New Journal Entry',
            content: '',
            creationDate: new Date(),
            type: 'reflection',
            author: 'user', // [ZEN FIX] New creations belong to the Captain.
            relatedChatHistory: [],
            reactions: [],
            comments: [],
            read: true
        };

        onUpdateEntry(newEntry);
        setSelectedItemId(newEntry.id);
        setEditAuthor('user');
        setIsEditing(true);
        setIsMobileMenuOpen(false);
    };

    /**
     * handleSaveEdit
     * Persists the title, content, and author reassignment to the database.
     */
    const handleSaveEdit = () => {
        if (selectedItem && systemMode === 'logs') {
            const updated = {
                ...(selectedItem as GigiJournalEntry),
                title: editTitle,
                content: editContent,
                author: editAuthor // [ZEN FIX] Persist the selected owner.
            };
            onUpdateEntry(updated);
            setIsEditing(false);
        }
    };

    /**
     * handleDeleteCurrentItem
     * Nukes a single entry with a safety confirmation.
     */
    const handleDeleteCurrentItem = () => {
        if (!selectedItem) return;

        // Safety First: User confirmation prevents accidental mashing.
        if (window.confirm("Are you sure you want to delete this journal entry? This cannot be undone.")) {
            if (systemMode === 'signals') {
                console.warn("Manual deletion of encrypted signals is currently restricted.");
            } else {
                onDeleteEntry((selectedItem as GigiJournalEntry).id);
                setSelectedItemId(null);
                setIsEditing(false);
            }
        }
    };

    /**
     * handleSelectItem
     * Selects an item and marks it as read if it's an incoming signal.
     */
    const handleSelectItem = (id: string) => {
        setSelectedItemId(id);
        const item = systemMode === 'signals'
            ? messages.find(m => m.id === id)
            : journalEntries.find(e => e.id === id);

        if (item && systemMode === 'signals' && !item.read) {
            onMarkAsRead(id);
        }
    };

    return {
        // STATE
        systemMode,
        activeChannel,
        selectedItemId,
        searchTerm,
        isMobileMenuOpen,
        isEditing,
        editTitle,
        editContent,
        editAuthor,

        // DERIVED DATA
        filteredItems,
        selectedItem,

        // SETTERS (For manual UI control)
        setSystemMode,
        setActiveChannel,
        setSelectedItemId,
        setSearchTerm,
        setIsMobileMenuOpen,
        setIsEditing,
        setEditTitle,
        setEditContent,
        setEditAuthor,

        // HANDLERS
        handleModeSwitch,
        handleCreateNewLog,
        handleSaveEdit,
        handleDeleteCurrentItem,
        handleSelectItem,
        fetchRequests,
        vertexRequests,
        isRequestsLoading
    };
};