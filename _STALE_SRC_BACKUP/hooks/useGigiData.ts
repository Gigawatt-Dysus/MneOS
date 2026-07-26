import { useState, useCallback, useEffect, useRef } from 'react';
import { 
    collection, 
    onSnapshot, 
    query,      
    orderBy,    
    limit       
} from 'firebase/firestore'; 
import { db, isFirebaseConfigured } from '../firebaseConfig';
import type { User, LifeEvent, Tag, Media, GigiJournalEntry, ChatMessage, Comment as AppComment, AiCompanion } from '@/types';
import { appDataService } from '../services/serviceManager';
import { generateAiCommentResponse } from '../services/geminiService';
import { convertTimestampsToDates } from '../services/firebaseDbService'; 

export const useGigiData = (user: User | null, addToast: (msg: string, type: 'success' | 'error' | 'info') => void) => {
    
    // --- STATE ---
    const [events, setEvents] = useState<LifeEvent[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [media, setMedia] = useState<Media[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [gigiJournal, setGigiJournal] = useState<GigiJournalEntry[]>([]);
    
    // Stream Status for UI Visuals ("Temporal Variance Detected")
    const [streamStatus, setStreamStatus] = useState<'idle' | 'receiving'>('idle');
    const streamTimeoutRef = useRef<any>(null);

    const triggerStreamPulse = () => {
        setStreamStatus('receiving');
        if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
        streamTimeoutRef.current = setTimeout(() => setStreamStatus('idle'), 2000);
    };

    // --- REAL-TIME LISTENERS (The Neural Uplink) ---
    useEffect(() => {
        if (!user || !isFirebaseConfigured()) return;

        console.log(`[Data Uplink] 📡 Establishing real-time connection for ${user.id}...`);

        // 1. Events Listener
        const eventsUnsub = onSnapshot(collection(db, 'users', user.id, 'events'), (snapshot) => {
            const loaded = snapshot.docs.map(doc => convertTimestampsToDates({ id: doc.id, ...doc.data() }) as LifeEvent);
            loaded.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setEvents(loaded);
            triggerStreamPulse();
        });

        // 2. Tags Listener
        const tagsUnsub = onSnapshot(collection(db, 'users', user.id, 'tags'), (snapshot) => {
            const loaded = snapshot.docs.map(doc => convertTimestampsToDates({ id: doc.id, ...doc.data() }) as Tag);
            setTags(loaded);
            triggerStreamPulse();
        });

        // 3. Media Listener (CRITICAL for Artifacts List)
        const mediaUnsub = onSnapshot(collection(db, 'users', user.id, 'media'), (snapshot) => {
            const loaded = snapshot.docs.map(doc => convertTimestampsToDates({ id: doc.id, ...doc.data() }) as Media);
            loaded.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
            setMedia(loaded);
            triggerStreamPulse();
        });

        // 4. Journal Listener
        const journalUnsub = onSnapshot(collection(db, 'users', user.id, 'gigiJournal'), (snapshot) => {
            const loaded = snapshot.docs.map(doc => convertTimestampsToDates({ id: doc.id, ...doc.data() }) as GigiJournalEntry);
            loaded.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
            setGigiJournal(loaded);
        });

        // 5. [FIXED] Chat History Listener - Cleanup Guard Active
        const chatQuery = query(
            collection(db, 'users', user.id, 'chat_segments'),
            orderBy('timestamp', 'desc'),
            limit(500)
        );

        const chatUnsub = onSnapshot(chatQuery, (snapshot) => {
            if (!snapshot.empty) {
                const messages = snapshot.docs
                    .map(doc => convertTimestampsToDates(doc.data()) as ChatMessage)
                    .reverse();
                
                // Directly replace state to prevent duplicate rendering
                setChatHistory(messages);
            } else {
                console.log("[Data Uplink] New chat segments empty. Checking legacy...");
                appDataService.getChatHistory(user.id).then(legacy => {
                    if (legacy && legacy.length > 0) {
                        setChatHistory(legacy.slice(-50)); 
                    }
                });
            }
        });

        return () => {
            console.log("[Data Uplink] 🔌 Disconnecting all GIGI listeners...");
            eventsUnsub();
            tagsUnsub();
            mediaUnsub();
            journalUnsub();
            chatUnsub(); //
        };
    }, [user?.id]); 

    // --- LEGACY LOADER (For Local Mode or Initial Fetch) ---
    const loadUserData = useCallback(async (userId: string) => {
        if (isFirebaseConfigured()) return;

        try {
            const [loadedEvents, loadedTags, loadedMedia, loadedChat, loadedJournal] = await Promise.all([
                appDataService.getAllEvents(userId),
                appDataService.getAllTags(userId),
                appDataService.getAllMedia(userId),
                appDataService.getChatHistory(userId),
                appDataService.getGigiJournal(userId)
            ]);
            setEvents(loadedEvents);
            setTags(loadedTags);
            setMedia(loadedMedia);
            setChatHistory(loadedChat);
            setGigiJournal(loadedJournal);
        } catch (e) {
            console.error("Error loading data", e);
            addToast("Failed to load data.", "error");
        }
    }, [addToast]);

    // --- CRUD HANDLERS ---

    const handleSaveEvent = async (event: LifeEvent) => {
        if (!user) return;
        await appDataService.saveEvent(user.id, event);
        if (!isFirebaseConfigured()) loadUserData(user.id);
        addToast("Event saved.", "success");
    };

    const handleEventComment = async (eventId: string, commentText: string) => {
        if (!user) return;
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        const newComment: AppComment = {
            id: `comment-${Date.now()}`,
            authorId: user.id,
            authorName: user.displayName || user.firstName,
            authorAvatarUrl: user.profilePictureUrl,
            content: commentText,
            timestamp: new Date()
        };

        const updatedEvent = { ...event, comments: [...(event.comments || []), newComment] };
        
        await appDataService.saveEvent(user.id, updatedEvent);
        if (!isFirebaseConfigured()) loadUserData(user.id);
        addToast("Comment added.", "success");
    };

    const handleSaveTag = async (tag: Tag, isSilent: boolean = false, navigate?: (path: string) => void, refreshCallback?: () => void) => {
        if (!user) return;
        await appDataService.saveTag(user.id, tag);
        
        if (refreshCallback) refreshCallback();
        if (!isFirebaseConfigured()) loadUserData(user.id);

        if (!isSilent) {
            if (navigate) navigate('tags');
            addToast("Tag saved.", "success");
        }
    };

    const handleSaveMedia = async (mediaItem: Media) => {
        if (!user) return;
        await appDataService.saveMedia(user.id, mediaItem);
        if (!isFirebaseConfigured()) loadUserData(user.id);
    };

    const handleDeleteMedia = async (id: string) => {
        if (!user) return;
        try {
            await appDataService.deleteMedia(user.id, id);
            addToast("Asset deleted.", "success");
            if (!isFirebaseConfigured()) loadUserData(user.id);
        } catch (e) {
            console.error("Failed to delete media", e);
            addToast("Failed to delete asset.", 'error');
        }
    };

    const handleJournalComment = async (entryId: string, commentText: string) => {
        if (!user) return;

        const newComment: AppComment = {
            id: `comment-${Date.now()}`,
            authorId: user.id,
            authorName: user.displayName || user.firstName,
            authorAvatarUrl: user.profilePictureUrl,
            content: commentText,
            timestamp: new Date()
        };

        const entryIndex = gigiJournal.findIndex(e => e.id === entryId);
        if (entryIndex === -1) return;
        
        const entryToSave = { ...gigiJournal[entryIndex], comments: [...(gigiJournal[entryIndex].comments || []), newComment] };
        await appDataService.saveGigiJournalEntry(user.id, entryToSave);

        // UI Thinking Indicator
        const thinkingId = `thinking-${Date.now()}`;
        const primary: AiCompanion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];

        const thinkingComment: AppComment = {
            id: thinkingId,
            authorId: 'ai-thinking',
            authorName: primary.name, 
            authorAvatarUrl: primary.avatarUrl,
            content: 'Thinking...', 
            timestamp: new Date()
        };

        setGigiJournal(prev => prev.map(entry => {
            if (entry.id === entryId) {
                return { ...entry, comments: [...(entry.comments || []), thinkingComment] };
            }
            return entry;
        }));

        generateAiCommentResponse(entryToSave, newComment, user)
            .then(async (aiResponse) => {
                if (aiResponse) {
                    const entryWithAi = { ...entryToSave, comments: [...(entryToSave.comments || []), aiResponse] };
                    await appDataService.saveGigiJournalEntry(user.id, entryWithAi);
                } else {
                     if (!isFirebaseConfigured()) loadUserData(user.id);
                }
            })
            .catch(e => {
                console.error("AI Comment failed", e);
            });
    };

    return {
        events, setEvents,
        tags, setTags,
        media, setMedia,
        chatHistory, setChatHistory,
        gigiJournal, setGigiJournal,
        loadUserData,
        handleSaveEvent,
        handleEventComment,
        handleSaveTag,
        handleSaveMedia,
        handleDeleteMedia,
        handleJournalComment,
        streamStatus 
    };
};