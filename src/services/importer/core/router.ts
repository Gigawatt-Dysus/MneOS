import type { Tag, Media } from '../../../types';
import { generateContentHash } from '../../../utils/hasher';
import { uploadFile } from '../../storageService';
import { aiStateBridge } from '../../../utils/aiStateBridge';
import { matchDiscoveredPeople } from '../../ai/generators/personMatcher';
import { fixFBString, getTitle } from '../utils';
import { parseLegacyData } from '../legacy/index';
import { FB_NOISE_PATTERNS } from '../facebook/index';

/**
 * [ZEN] The Forensic Router
 * Orchestrates folder-level scanning, high-fidelity uploads, and conversational log stitching.
 */

export const stitchMedia = async (mediaFiles: File[], allMedia: any[], userId: string, reconMap: Map<string, any>, onProgress: (current: number, total: number, message: string) => void): Promise<any[]> => {
    const stitchedMedia: any[] = [];
    const concurrencyLimit = 5;
    const activeTasks = new Set<Promise<void>>();
    let completedCount = 0;

    for (let i = 0; i < allMedia.length; i++) {
        const mediaGhost = allMedia[i];
        const ghostUrl = mediaGhost.url || '';
        let normalizedGhost = ghostUrl;
        try { normalizedGhost = decodeURIComponent(normalizedGhost); } catch(e) {}
        normalizedGhost = normalizedGhost.toLowerCase();
        if (normalizedGhost.includes('?')) normalizedGhost = normalizedGhost.split('?')[0];
        
        const match = mediaFiles.find(f => {
            const normalizedFileName = f.name.toLowerCase();
            return normalizedGhost.endsWith(normalizedFileName) || normalizedFileName.endsWith(normalizedGhost) || (f as any).webkitRelativePath?.toLowerCase().endsWith(normalizedGhost);
        });

        if (match) {
            const task = (async () => {
                try {
                    const { url } = await uploadFile(match, userId);
                    const contentHash = await generateContentHash(match);
                    mediaGhost.url = url;
                    mediaGhost.contentHash = contentHash;
                    mediaGhost.status = 'ready';

                    const recon = reconMap.get(match.name) || reconMap.get(normalizedGhost);
                    if (recon) {
                        mediaGhost.title = recon.caption; 
                        mediaGhost.caption = recon.caption;
                        if (recon.title && recon.title !== 'Facebook User' && recon.title !== 'Messenger') {
                            mediaGhost.originalName = recon.title;
                        }
                    }
                } catch (err) {
                    console.error(`Genie upload failed for ${match.name}:`, err);
                } finally {
                    completedCount++;
                    onProgress(completedCount, allMedia.length, `Uploading pixels...`);
                }
            })();

            activeTasks.add(task);
            task.finally(() => activeTasks.delete(task));
            if (activeTasks.size >= concurrencyLimit) await Promise.race(activeTasks);
            stitchedMedia.push(mediaGhost);
        }
    }
    await Promise.all(activeTasks);
    return stitchedMedia;
};

export const processGenieArchive = async (
    files: FileList | File[], 
    userId: string,
    onProgress: (current: number, total: number, message: string) => void,
    existingTags: Tag[] = [],
    htmlFiles: File[] = []
): Promise<any> => {
    const fileArray = Array.from(files);
    const jsonFiles = fileArray.filter(f => f.name.endsWith('.json'));
    const htmlFilesList = htmlFiles && htmlFiles.length > 0 ? htmlFiles : fileArray.filter(f => f.name.endsWith('.html'));
    const mediaFiles = fileArray.filter(f => /\.(jpg|jpeg|png|gif|webp|heic|mp4|mov)$/i.test(f.name));
    
    const reconMap = new Map<string, { caption: string; title: string }>();
    if (htmlFilesList.length > 0) {
        for (const htmlFile of htmlFilesList) {
            try {
                const text = await htmlFile.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                const sections = doc.querySelectorAll('section._a6-g');
                sections.forEach(section => {
                    const title = section.querySelector('h2._a6-h')?.textContent?.trim() || '';
                    const caption = section.querySelector('div._a6-p')?.textContent?.trim() || '';
                    section.querySelectorAll('img').forEach(img => {
                        const src = img.getAttribute('src');
                        if (src) {
                            const normalizedSrc = src.replace(/\\/g, '/');
                            reconMap.set(normalizedSrc, { caption, title });
                            const filename = normalizedSrc.split('/').pop();
                            if (filename) reconMap.set(filename, { caption, title });
                        }
                    });
                });
            } catch (err) {}
        }
    }

    const allEvents: any[] = [];
    const allMedia: any[] = [];
    const allTags: any[] = [];

    for (let i = 0; i < jsonFiles.length; i++) {
        try {
            const text = await jsonFiles[i].text();
            const result = parseLegacyData(text, existingTags);
            if (result.events) allEvents.push(...result.events);
            if (result.media) allMedia.push(...result.media);
            if (result.tags) allTags.push(...result.tags);
        } catch (err) {}
    }

    if (allEvents.length === 0) throw new Error("No memories found.");

    const mediaDedupMap = new Map<string, any>();
    const idMigrationMap = new Map<string, string>();
    allMedia.forEach(m => {
        const dedupKey = (m.url || '').split('/').pop() || m.url;
        if (mediaDedupMap.has(dedupKey)) {
            idMigrationMap.set(m.id, mediaDedupMap.get(dedupKey).id);
        } else mediaDedupMap.set(dedupKey, m);
    });
    allEvents.forEach(e => {
        if (e.mediaIds) e.mediaIds = Array.from(new Set(e.mediaIds.map((id: string) => idMigrationMap.get(id) || id)));
    });

    const stitchedMedia = await stitchMedia(mediaFiles, Array.from(mediaDedupMap.values()), userId, reconMap, onProgress);

    const vortexEvents: any[] = [];
    const commsJournal: any[] = [];
    const meTag = existingTags.find(t => (t.metadata as any)?.isMe === true || (t as any).isMe === true || t.name?.toLowerCase() === 'eric cornett' || t.name?.toLowerCase() === 'eric');
    const meTagId = meTag?.id;
    const meName = meTag?.name || 'Eric Cornett';

    const threadBuckets = new Map<string, Map<string, any[]>>();
    allEvents.forEach(e => {
        const date = e.date instanceof Date ? e.date : new Date(e.date);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const title = e.title || 'Untitled Entry';
        if (!threadBuckets.has(title)) threadBuckets.set(title, new Map());
        const monthMap = threadBuckets.get(title)!;
        if (!monthMap.has(yearMonth)) monthMap.set(yearMonth, []);
        monthMap.get(yearMonth)!.push(e);
    });

    threadBuckets.forEach((monthMap, threadTitle) => {
        monthMap.forEach((events, yearMonth) => {
            const hasMedia = events.some(e => e.mediaIds && e.mediaIds.length > 0);
            const isConversation = threadTitle.includes('Conversation') || threadTitle.includes('Messages:') || events.some(e => (e as any).type === 'messenger_log');
            const personName = threadTitle.replace(/Conversation with |Messages: /gi, '').trim();
            const personTagId = events[0]?.tagIds?.[0] || existingTags.find(t => t.name.toLowerCase() === personName.toLowerCase())?.id;

            if (hasMedia) {
                const mediaEvents = events.filter(e => e.mediaIds && e.mediaIds.length > 0 && e.type !== 'messenger_log');
                mediaEvents.forEach(e => {
                    if (personTagId && !e.tagIds.includes(personTagId)) e.tagIds.push(personTagId);
                    if (meTagId && !e.tagIds.includes(meTagId)) e.tagIds.push(meTagId);
                });
                vortexEvents.push(...mediaEvents);
            }

            if (isConversation) {
                let rawMessages: any[] = [];
                events.forEach(e => {
                    if (e.metadata?.messages) rawMessages.push(...e.metadata.messages.map((m: any) => ({ ...m, date: new Date(m.timestamp_ms || e.date) })));
                    else rawMessages.push({ date: e.date, sender_name: 'Unknown', content: e.details || '' });
                });
                const sorted = rawMessages.sort((a, b) => a.date.getTime() - b.date.getTime());
                
                const combined = sorted.map(m => {
                    const time = m.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const body = (m.content || '').replace(/Sent from .*? for iPhone/gi, '').trim();
                    return `Sender: ${m.sender_name}\nRecipient: ${personName}\nTime: ${time}\n\n${body}`;
                }).join('\n\n____________________\n\n');

                commsJournal.push({
                    id: `log-${threadTitle}-${yearMonth}`,
                    title: `${personName} (Log - ${yearMonth})`,
                    content: combined,
                    type: 'messenger_log',
                    tagIds: [personTagId, meTagId].filter(Boolean)
                });
            }
        });
    });

    return { events: [...vortexEvents, ...commsJournal], media: stitchedMedia, tags: allTags, journal: commsJournal };
};
