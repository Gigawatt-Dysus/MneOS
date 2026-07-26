import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { User, LifeEvent, Tag, Media, GigiJournalEntry, ChatMessage, Comment as AppComment, AiCompanion, AirlockRequest, Vert, PeerChatSession, CommsMessage } from '../types';
import { appDataService } from '../services/serviceManager';
import { typesenseService } from '../services/typesenseService';
import { generateAiCommentResponse } from '../services/aiOrchestrator';
import { healGhostMessages } from '../services/sovereignChat'; // [ZEN] Should also be excised eventually
import { httpsCallable } from '../services/apiClient';
import { useSovereignSocket } from './useSovereignSocket';

// [ZEN OPTIMIZATION] High-Performance Document Processor
// Prevents recursive date conversion of the entire archive on every minor sync.
const useDifferentialSync = () => {
    const cache = useRef(new Map<string, any>());
    
    // [ZEN SOVEREIGN] Accepts plain MongoDB record objects { id, ...fields }
    return useCallback((docs: any[]) => {
        return docs.map(doc => {
            const id = doc.id;
            // Plain MongoDB records — no .data() shim needed
            const { id: _id, ...rawData } = doc;
            
            // Generate a stability key based on ID and a shallow hash of the content/status
            const ts = rawData.updatedAt || rawData.timestamp;
            const tsKey = ts ? (ts.toMillis ? ts.toMillis() : new Date(ts).getTime()) : 'static';
            const contentHash = `${id}_${tsKey}_${rawData.isDeleted || 'false'}_${rawData.deletedAt || '0'}`;
            
            if (cache.current.has(contentHash)) {
                return cache.current.get(contentHash);
            }
            
            // [ZEN SLIMMING] Strip legacy "Olden Days" base64 blobs to recover RAM
            // We only keep base64 if the item is explicitly 'provisional' (staging)
            if (rawData.status !== 'provisional') {
                delete rawData.base64Data;
                delete rawData.preview; // Also strip large preview strings if present
            }

            // [ZEN] Timestamps are already ISO strings from MongoDB API, standardizing parsing
            const processed = { id, ...rawData };
            
            // Rehydrate string dates
            if (processed.date) processed.date = new Date(processed.date);
            if (processed.uploadDate) processed.uploadDate = new Date(processed.uploadDate);
            if (processed.creationDate) processed.creationDate = new Date(processed.creationDate);
            if (processed.timestamp) processed.timestamp = new Date(processed.timestamp);

            cache.current.set(contentHash, processed);
            
            // Cleanup cache to prevent memory growth (cap at 5000 items)
            if (cache.current.size > 5000) {
                const firstKey = cache.current.keys().next().value;
                if (firstKey) cache.current.delete(firstKey);
            }
            
            return processed;
        });
    }, []);
};

export const useGigiData = (user: User | null, addToast: (msg: string, type: 'success' | 'error' | 'info') => void) => {
    const [events, setEvents] = useState<LifeEvent[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [media, setMedia] = useState<Media[]>([]);
    const [historyHistory, setHistoryHistory] = useState<ChatMessage[]>([]); // [ZEN V34]
    const [liveHistory, setLiveHistory] = useState<ChatMessage[]>([]); // [ZEN V34]
    const [gigiJournal, setGigiJournal] = useState<GigiJournalEntry[]>([]);
    const [commsArchives, setCommsArchives] = useState<GigiJournalEntry[]>([]); // [ZEN] Sovereign Human Logs
    const [messages, setMessages] = useState<CommsMessage[]>([]);
    const [airlockRequests, setAirlockRequests] = useState<AirlockRequest[]>([]);
    const [verts, setVerts] = useState<Vert[]>([]);
    const [peerSessions, setPeerSessions] = useState<PeerChatSession[]>([]);
    const [pendingAccessionsCount, setPendingAccessionsCount] = useState(0);

    const [isInitialSyncComplete, setIsInitialSyncComplete] = useState(false);
    const isInitialSyncCompleteRef = useRef(false);
    const syncStartTime = useRef(Date.now());
    const sessionCutoff = useRef(new Date().toISOString()); // [ZEN V34]
    const processDocs = useDifferentialSync();

    // [ZEN OPTIMIZATION] Stable Sorted Projections (Moved to top for Hook Order Stability)
    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [events]);

    const sortedMedia = useMemo(() => {
        return [...media].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    }, [media]);

    // [ZEN V34] Neural Merge: Combine History and Live streams
    const chatHistory = useMemo(() => {
        return [...historyHistory, ...liveHistory];
    }, [historyHistory, liveHistory]);

    const setChatHistory = useCallback((fullHistory: ChatMessage[]) => {
        const cutoffTime = new Date(sessionCutoff.current).getTime();
        const history = fullHistory.filter(m => {
            const t = m.timestamp ? new Date(m.timestamp).getTime() : 0;
            return t <= cutoffTime;
        });
        const live = fullHistory.filter(m => {
            const t = m.timestamp ? new Date(m.timestamp).getTime() : 0;
            return t > cutoffTime;
        });
        setHistoryHistory(history);
        setLiveHistory(live);
    }, []);

    const syncChecklist = useRef({
        events: false,
        tags: false,
        media: false,
        journal: false,
        commsArchives: false, // [ZEN NEW]
        chat: false,
        transmissions: false,
        verts: false,
        pendingAccessions: false
    });

    const checkSyncStatus = useCallback(() => {
        if (isInitialSyncCompleteRef.current) return;
        const { events, tags, media, journal, chat, transmissions, verts, pendingAccessions } = syncChecklist.current;

        if (events && tags && media && journal && chat && transmissions && verts && pendingAccessions) {
            const elapsed = Date.now() - syncStartTime.current;
            const remaining = Math.max(0, 800 - elapsed); // [ZEN OPTIMIZATION] Reduced from 3000ms to 800ms

            setTimeout(() => {
                if (!isInitialSyncCompleteRef.current) {
                    isInitialSyncCompleteRef.current = true;
                    setIsInitialSyncComplete(true);
                }
            }, remaining);
        }
    }, []);

    // Stream Status
    const [streamStatus, setStreamStatus] = useState<'idle' | 'receiving'>('idle');
    const streamTimeoutRef = useRef<any>(null);

    // [ZEN V34] Pagination State
    const [chatLimit, setChatLimit] = useState(5000); // [ZEN V35] Maximum archival depth for high-velocity users
    const [hasMoreChat, setHasMoreChat] = useState(true);

    const loadMoreChat = useCallback(() => {
        setChatLimit(prev => prev + 200);
    }, []);

    // [ZEN OPTIMIZATION] Stable Pulse Handler
    // Recreating this was causing infinite subscription thrashing.
    const triggerStreamPulse = useCallback(() => {
        setStreamStatus('receiving');
        if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
        streamTimeoutRef.current = setTimeout(() => setStreamStatus('idle'), 2000);
    }, []);

    const fetchSovereignData = useCallback(async () => {
        if (!user || user.id === 'dev-user-root') return;
        try {
            const sovereignQuery = httpsCallable(null, 'sovereignDbQuery');
            
            // Fetch All Data Collections
            const [eventsRes, tagsRes, mediaRes, journalRes, commsRes, transRes, chatRes, vertsRes, pendingRes] = await Promise.all([
                sovereignQuery({ collectionName: 'events', userId: user.id }),
                sovereignQuery({ collectionName: 'tags', userId: user.id }),
                sovereignQuery({ collectionName: 'media', userId: user.id }),
                sovereignQuery({ collectionName: 'gigiJournal', userId: user.id }),
                sovereignQuery({ collectionName: 'communication_archives', userId: user.id }),
                sovereignQuery({ collectionName: 'transmissions', userId: user.id }),
                sovereignQuery({ collectionName: 'chat_segments', userId: user.id }),
                sovereignQuery({ collectionName: 'verts', userId: user.id }),
                sovereignQuery({ collectionName: 'pending_accessions', userId: user.id, operation: 'count' })
            ]);

            // Process Core Data
            if (eventsRes.data) {
                setEvents(processDocs(eventsRes.data) as LifeEvent[]);
                syncChecklist.current.events = true;
            }
            if (tagsRes.data) {
                setTags(processDocs(tagsRes.data) as Tag[]);
                syncChecklist.current.tags = true;
            }
            if (mediaRes.data) {
                const loaded = processDocs(mediaRes.data) as Media[];
                
                // [ZEN] BEAT COP PIPELINE: Data Intercept Layer
                // No blanket exemptions — avatars and standard media are both ticketed.
                // The worker branches internally on isAvatar for variant sizing.
                const sanitizedMedia = loaded.map(media => {
                    if (media.fileType && media.fileType.startsWith('image/')) {
                        const hasVariants = media.thumbnailUrls && media.thumbnailUrls.small && media.thumbnailUrls.medium && media.thumbnailUrls.large;
                        if (!hasVariants && media.url) {
                            // Apply Wireframe placeholder, preserving absolute geometry
                            return {
                                ...media,
                                thumbnailUrls: {
                                    ...media.thumbnailUrls,
                                    small: 'WIREFRAME_PLACEHOLDER',
                                    medium: 'WIREFRAME_PLACEHOLDER',
                                    large: 'WIREFRAME_PLACEHOLDER'
                                }
                            } as Media;
                        }
                    }
                    return media;
                });

                setMedia(sanitizedMedia);
                syncChecklist.current.media = true;
            }
            if (journalRes.data) {
                const loaded = processDocs(journalRes.data) as GigiJournalEntry[];
                loaded.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
                setGigiJournal(loaded);
                syncChecklist.current.journal = true;
            }
            if (commsRes.data) {
                const loaded = processDocs(commsRes.data) as GigiJournalEntry[];
                loaded.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
                setCommsArchives(loaded);
                syncChecklist.current.commsArchives = true;
            }
            if (transRes.data) {
                const loaded = processDocs(transRes.data) as CommsMessage[];
                loaded.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setMessages(loaded);
                syncChecklist.current.transmissions = true;
            }

            if (chatRes.data) {
                const loadedChat = (processDocs(chatRes.data) as ChatMessage[])
                    .filter(m => !m.isDeleted && !m.content?.includes("[SYSTEM] Email Webhook Heartbeat"));
                
                const sortedChat = loadedChat.sort((a, b) => {
                    const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return tA - tB;
                });

                const cutoffTime = new Date(sessionCutoff.current).getTime();
                const history = sortedChat.filter(m => {
                    const t = m.timestamp ? new Date(m.timestamp).getTime() : 0;
                    return t <= cutoffTime;
                });
                const live = sortedChat.filter(m => {
                    const t = m.timestamp ? new Date(m.timestamp).getTime() : 0;
                    return t > cutoffTime;
                });
                
                setHistoryHistory(history);
                setLiveHistory(live);
                syncChecklist.current.chat = true;
            }

            if (vertsRes.data) {
                setVerts(processDocs(vertsRes.data) as Vert[]);
                syncChecklist.current.verts = true;
            }

            if (pendingRes.data !== undefined && pendingRes.data !== null) {
                setPendingAccessionsCount(typeof pendingRes.data === 'number' ? pendingRes.data : (Array.isArray(pendingRes.data) ? pendingRes.data.length : 0));
                syncChecklist.current.pendingAccessions = true;
            }

            checkSyncStatus();
            triggerStreamPulse();

        } catch (err) {
            console.error("[DataSync] Sovereign Sync Error:", err);
        }
    }, [user?.id, checkSyncStatus, triggerStreamPulse, processDocs]);

    // [ZEN HYBRID ARCHITECTURE] Surgical State Injection
    const handleSurgicalSync = useCallback(async (collectionName: string) => {
        if (!user || user.id === 'dev-user-root') return;
        const sovereignQuery = httpsCallable(null, 'sovereignDbQuery');
        try {
            console.log(`[DataSync] ⚡ Executing surgical fetch for mutated collection: ${collectionName}`);
            const res = await sovereignQuery({ collectionName, userId: user.id });
            if (!res.data) return;

            if (collectionName === 'events') setEvents(processDocs(res.data) as LifeEvent[]);
            else if (collectionName === 'tags') setTags(processDocs(res.data) as Tag[]);
            else if (collectionName === 'media') setMedia(processDocs(res.data) as Media[]);
            else if (collectionName === 'gigiJournal') {
                const loaded = processDocs(res.data) as GigiJournalEntry[];
                loaded.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
                setGigiJournal(loaded);
            }
            else if (collectionName === 'communication_archives') {
                const loaded = processDocs(res.data) as GigiJournalEntry[];
                loaded.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
                setCommsArchives(loaded);
            }
            else if (collectionName === 'verts') setVerts(processDocs(res.data) as Vert[]);
        } catch (e) {
            console.error(`[DataSync] Surgical sync failed for ${collectionName}:`, e);
        }
    }, [user?.id, processDocs]);

    // Attach to Sovereign Matrix WebSocket Gateway
    useSovereignSocket(user?.id, useCallback((collection, operation, docId) => {
        // Trigger the visual UI stream pulse (the green radar blip)
        triggerStreamPulse();
        // Fire surgical fetch to heal UI state without mass polling
        const SUPPORTED = ['events', 'tags', 'media', 'gigiJournal', 'communication_archives', 'verts'];
        if (SUPPORTED.includes(collection)) {
            handleSurgicalSync(collection);
        }
    }, [triggerStreamPulse, handleSurgicalSync]));

    useEffect(() => {
        if (!user || user.id === 'dev-user-root') {
            return;
        }

        // [ZEN OPTIMIZATION] Concurrent Boot Stream Protocol
        const bootTimer = setTimeout(() => {
            if (!isInitialSyncCompleteRef.current) {
                isInitialSyncCompleteRef.current = true;
                setIsInitialSyncComplete(true);
            }
        }, 60000); 

        fetchSovereignData();

        return () => {
            clearTimeout(bootTimer);
        };
    }, [user?.id, fetchSovereignData, triggerStreamPulse]);

    const loadUserData = useCallback(async (_userId: string) => {
        console.log('[DataSync] loadUserData called — refetching sovereign MongoDB data...');
        await fetchSovereignData();
    }, [fetchSovereignData]);

    const handleSaveEvent = async (event: LifeEvent) => {
        if (!user) return;
        await appDataService.saveEvent(user.id, event);
        addToast("Event saved.", "success");
    };

    const handleEventComment = async (eventId: string, commentText: string) => {
        if (!user) return;
        const event = events.find(e => e.id === eventId);
        if (!event) return;
        const newComment: AppComment = {
            id: `comment-${Date.now()}`, authorId: user.id, authorName: user.displayName || user.firstName, authorAvatarUrl: user.profilePictureUrl, content: commentText, timestamp: new Date()
        };
        const updatedEvent = { ...event, comments: [...(event.comments || []), newComment] };
        await appDataService.saveEvent(user.id, updatedEvent);
        addToast("Comment added.", "success");
    };

    const handleSaveTag = async (tag: Tag, isSilent: boolean = false, navigate?: (path: string) => void, refreshCallback?: () => void) => {
        if (!user) return;

        // [ZEN] Optimistic local state push — new/updated tag appears in gallery
        // immediately without waiting for the full loadUserData DB round-trip.
        setTags(prev => {
            const exists = prev.some(t => t.id === tag.id);
            if (exists) return prev.map(t => t.id === tag.id ? tag : t);
            return [tag, ...prev]; // Prepend so new tag is visible at top before sort
        });

        await appDataService.saveTag(user.id, tag);
        typesenseService.upsertTag(tag, user.id).catch(console.error);
        if (refreshCallback) refreshCallback();
        
        if (!isSilent) {
            if (navigate) navigate('tags');
            addToast("Tag saved.", "success");
        }
    };

    const handleSaveMedia = async (mediaItem: Media, targetCollection: 'media' | 'pending_accessions' = 'media') => {
        if (!user) return;
        
        // [ZEN] Optimistic Update: Push to local state immediately to prevent "ghost" inbox items
        setMedia(prev => {
            const exists = prev.some(m => m.id === mediaItem.id);
            if (exists) return prev.map(m => m.id === mediaItem.id ? mediaItem : m);
            return [mediaItem, ...prev];
        });

        await appDataService.saveMedia(user.id, mediaItem, targetCollection);
    };

    const handleDeleteMedia = async (id: string, targetCollection: string = 'media') => {
        if (!user) return;
        
        // [ZEN] Optimistic Update: Remove from local state immediately to purge UI ghost artifacts
        setMedia(prev => prev.filter(m => m.id !== id));
        addToast("Asset deleted.", "success");
        
        // [ZEN] Fire-and-forget background deletion to prevent UI blocking
        (async () => {
            try {
                await appDataService.deleteMedia(user.id, id, targetCollection);
                try {
                    if (targetCollection === 'media') {
                        await typesenseService.deleteMedia(id);
                    }
                } catch (tsErr) {
                    console.warn("[handleDeleteMedia] Failed to delete from Typesense index:", tsErr);
                }
            } catch (e) { 
                console.error("[handleDeleteMedia] Background deletion failed:", e);
                // Optional: We could trigger a toast or revert here, but we fail silently to user
            }
        })();
    };

    const handleJournalComment = async (entryId: string, commentText: string) => {
        if (!user) return;
        const newComment: AppComment = {
            id: `comment-${Date.now()}`, authorId: user.id, authorName: user.displayName || user.firstName, authorAvatarUrl: user.profilePictureUrl, content: commentText, timestamp: new Date()
        };
        const entryIndex = gigiJournal.findIndex(e => e.id === entryId);
        if (entryIndex === -1) return;
        const entryToSave = { ...gigiJournal[entryIndex], comments: [...(gigiJournal[entryIndex].comments || []), newComment] };
        await appDataService.saveGigiJournalEntry(user.id, entryToSave);

        const thinkingId = `thinking-${Date.now()}`;
        const primary: AiCompanion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
        const thinkingComment: AppComment = {
            id: thinkingId, authorId: 'ai-thinking', authorName: primary.name, authorAvatarUrl: primary.avatarUrl, content: 'Thinking...', timestamp: new Date()
        };

        setGigiJournal(prev => prev.map(entry => {
            if (entry.id === entryId) return { ...entry, comments: [...(entry.comments || []), thinkingComment] };
            return entry;
        }));

        generateAiCommentResponse(entryToSave, newComment, user)
            .then(async (aiResponse) => {
                if (aiResponse) {
                    const entryWithAi = { ...entryToSave, comments: [...(entryToSave.comments || []), aiResponse] };
                    await appDataService.saveGigiJournalEntry(user.id, entryWithAi);
                } else {
                    loadUserData(user.id);
                }
            })
            .catch(e => console.error("AI Comment failed", e));
    };

    const handleCreateTag = useCallback(async (name: string, type: Tag['type'], metadata?: any) => {
        if (!user) return null;
        const newTag: Tag = {
            id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name,
            type,
            mediaGallery: [],
            description: `Sovereign place record for ${name}. Created from Time Vortex.`,
            privateNotes: '',
            isPrivate: false,
            tagIds: [],
            mediaIds: [],
            metadata: metadata || {}
        };
        await handleSaveTag(newTag, true); // Silent save
        return newTag;
    }, [user, handleSaveTag]);

    return {
        events: sortedEvents, setEvents, tags, setTags, media: sortedMedia, setMedia, chatHistory, setChatHistory, gigiJournal, setGigiJournal, commsArchives, setCommsArchives, messages, setMessages, isInitialSyncComplete, airlockRequests, loadUserData, handleSaveEvent, handleEventComment, handleSaveTag, handleSaveMedia, handleDeleteMedia, handleJournalComment, handleCreateTag, streamStatus, verts, peerSessions,
        loadMoreChat, hasMoreChat, // [ZEN V34]
        pendingAccessionsCount
    };
};