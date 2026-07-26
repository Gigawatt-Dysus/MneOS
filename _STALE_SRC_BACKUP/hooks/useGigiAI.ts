import { useState, useCallback, useEffect } from 'react';
import type { User, LifeEvent, Tag, Media, GigiJournalEntry, Settings, UserStatus } from '@/types';
import { appDataService } from '../services/serviceManager';
import { generateDaydreamEntry, generateDeepDiveEntry, generateDeepDiveFromQuery } from '../services/geminiService';
import { aiStateBridge } from '../utils/aiStateBridge';

export const useGigiAI = (
    user: User | null,
    events: LifeEvent[],
    tags: Tag[],
    media: Media[],
    settings: Settings,
    userStatus: UserStatus,
    setUserStatus: (s: UserStatus) => void,
    addToast: (msg: string, type: 'success' | 'error' | 'info') => void,
    setGigiJournal: React.Dispatch<React.SetStateAction<GigiJournalEntry[]>>,
    idleTimerRef: React.MutableRefObject<any>
) => {
    const [isGigiThinking, setIsGigiThinking] = useState(false);
    const [deepDiveQuery, setDeepDiveQuery] = useState<string | null>(null);

    // Listen to the AI State Bridge (Visual Pulse)
    useEffect(() => {
        return aiStateBridge.subscribe(setIsGigiThinking);
    }, []);

    const handleTriggerDeepDive = useCallback(async (target: LifeEvent | string) => {
        if (!user) return;
        let result;
        let eventId: string | undefined;

        if (typeof target === 'string') {
            addToast(`Gigi is researching: "${target}"...`, 'info');
            try {
                // [ZEN FIX] Passed 'media' (5th arg) so AI can see images
                result = await generateDeepDiveFromQuery(target, user, events, tags, media);
                eventId = result?.relatedEventId;
            } catch (e) {
                console.error(e);
                addToast("Research failed.", "error");
                return;
            }
        } else {
            addToast(`Deep Dive initiated for "${target.title}"...`, 'info');
            eventId = target.id;
            try {
                // [ZEN FIX] Passed 'media' (5th arg) so AI can see images
                const targetTitle = (target as LifeEvent).title || "Untitled Event";
                result = await generateDeepDiveEntry(targetTitle, user, events, tags, media);
            } catch (e) {
                console.error(e);
                addToast("Deep Dive failed.", "error");
                return;
            }
        }

        if (result) {
            const newEntry: GigiJournalEntry = {
                id: `journal-deepdive-${Date.now()}`,
                title: result.title,
                content: result.content,
                creationDate: new Date(),
                relatedChatHistory: [],
                type: 'deep_dive',
                reactions: [],
                comments: [],
                read: false,
                relatedEventId: eventId
            };
            await appDataService.saveGigiJournalEntry(user.id, newEntry);
            setGigiJournal(prev => [...prev, newEntry]);
            addToast(`Research Complete: "${result.title}" added to Memories.`, 'success');
        } else {
            addToast("Deep Dive failed to generate content. Try again.", "error");
        }
    }, [user, events, tags, media, addToast, setGigiJournal]);

    const triggerDaydream = useCallback(() => {
        if (!user || events.length === 0) return;
        const primaryCompanion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];

        // 30% chance to do a specific Deep Dive on a random event instead of a generic daydream
        if (Math.random() > 0.7) {
            const randomEvent = events[Math.floor(Math.random() * events.length)];
            handleTriggerDeepDive(randomEvent);
            return;
        }

        addToast(`${primaryCompanion.name} has started a deep daydream...`, 'info');

        generateDaydreamEntry(user, events, tags, media)
            .then(async (entry) => {
                if (entry) {
                    const newJournalEntry: GigiJournalEntry = {
                        id: `journal-daydream-${Date.now()}`,
                        title: entry.title,
                        content: entry.content,
                        creationDate: new Date(),
                        relatedChatHistory: [],
                        type: 'reflection',
                        reactions: [],
                        comments: [],
                        read: false,
                        relatedEventId: entry.relatedEventId
                    };
                    await appDataService.saveGigiJournalEntry(user.id, newJournalEntry);
                    setGigiJournal(prev => [...prev, newJournalEntry]);
                    addToast(`${primaryCompanion.name} has finished writing a new memory.`, 'success');
                }
            })
            .catch((e) => {
                console.error("Daydream failed in background", e);
                addToast("Gigi lost her train of thought.", "error");
            });
    }, [user, events, tags, media, addToast, setGigiJournal, handleTriggerDeepDive]);

    const handleActivity = useCallback(() => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        if (userStatus === 'away') setUserStatus('online');

        if (settings.aiDaydreaming && user) {
            idleTimerRef.current = setTimeout(() => {
                setUserStatus('away');
                triggerDaydream();
            }, settings.idleTimeout * 60 * 1000);
        }
    }, [settings.idleTimeout, settings.aiDaydreaming, user, userStatus, setUserStatus, triggerDaydream, idleTimerRef]);

    return { isGigiThinking, deepDiveQuery, setDeepDiveQuery, handleTriggerDeepDive, triggerDaydream, handleActivity };
};