import { useCallback } from 'react';
import { doc, updateDoc, setDoc, getDoc } from '../../../services/sovereignDbAdapter';
import { getFunctions } from 'firebase/functions';
import { httpsCallable } from '../../../services/apiClient';
import { db } from '../../../firebaseConfig';
import { Tag, User } from '../../../types';
import { UniversalMedia } from './types';
import { typesenseService } from '../../../services/typesenseService';
import { sparkleAssetDescription, suggestPolishPreset } from '../../../services/aiOrchestrator';
import { uploadFile } from '../../../services/storageService';
import { appDataService } from '../../../services/serviceManager';
import { aiStateBridge } from '../../../utils/aiStateBridge';

export const useStudioActions = (
    asset: UniversalMedia,
    user: User,
    valuesRef: any,
    setIsDirty: (d: boolean) => void,
    setIsSaving: (s: boolean) => void,
    setIsThinking: (t: boolean) => void,
    setMigrationStatus: (s: string) => void,
    onUpdate: (id: string, updates: Partial<UniversalMedia>) => void,
    onClose: () => void,
    tagMap: Map<string, Tag>,
    tags: Tag[],
    onTagCreated?: (tag: Tag) => void
) => {
    const handleSave = useCallback(async (mode: 'replace' | 'version' = 'replace', extraUpdates: any = {}) => {
        const { 
            title, caption, description, datePrecision, dateStr, tagIds, 
            location, isInboxDismissed, isPurist, polishLayers, url, mediaIds,
            preset, adjustmentStack, editHistory, isFiction, skipAI 
        } = valuesRef.current;
        let finalLocation = location;

        setIsSaving(true);
        try {
            let finalDate = new Date();
            if (dateStr) {
                if (datePrecision === 'year') finalDate = new Date(`${dateStr}-01-01T00:00:00`);
                else if (datePrecision === 'month') finalDate = new Date(`${dateStr}-01T00:00:00`);
                else if (datePrecision === 'day') finalDate = new Date(`${dateStr}T00:00:00`);
                else finalDate = new Date(dateStr);
            }

            const finalEditHistory = [...(editHistory || [])];
            const currentSnapshot = {
                preset: preset || 'original',
                adjustmentStack: adjustmentStack || {},
                timestamp: Date.now()
            };

            const lastSnapshot = finalEditHistory[finalEditHistory.length - 1];
            const hasVisualChanges = !lastSnapshot || 
                lastSnapshot.preset !== currentSnapshot.preset || 
                JSON.stringify(lastSnapshot.adjustmentStack) !== JSON.stringify(currentSnapshot.adjustmentStack);

            if (hasVisualChanges) {
                finalEditHistory.push(currentSnapshot);
            }

            // General tag extraction before saving
            const textToScan = `${title || ''}\n${caption || ''}\n${description || ''}\n${valuesRef.current.narrative || ''}\n${asset.textContent || ''}`;
            const autoExtractedTagIds = new Set<string>(tagIds || []);
            
            // 1. Explicitly scan and extract tag:// capsules
            const richRegex = /\[([^\]]+)\]\(tag:\/\/([a-zA-Z0-9_:-]+):([a-zA-Z0-9_\-\u00C0-\u017F]+)\)/g;
            const richMatches = Array.from(textToScan.matchAll(richRegex));
            richMatches.forEach(m => {
                if (m[3]) autoExtractedTagIds.add(m[3]);
            });

            // 2. Mention scanning and word match scanning
            const mentionMatches = Array.from(textToScan.matchAll(/@([a-zA-Z0-9_\-\u00C0-\u017F]+)/g)).map(m => m[1].toLowerCase());
            
            tags.forEach(tag => {
                const tagNameLower = tag.name.toLowerCase();
                if (tagNameLower.length > 2) {
                    const isMentioned = mentionMatches.includes(tagNameLower) || mentionMatches.includes(tag.id.toLowerCase());
                    
                    const escapedName = tag.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const wordRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
                    const isNameMatch = wordRegex.test(textToScan);
                    
                    if (isMentioned || isNameMatch) {
                        autoExtractedTagIds.add(tag.id);
                    }
                }
            });

            const finalTagIds = Array.from(autoExtractedTagIds);
            valuesRef.current.tagIds = finalTagIds;

            const updates: any = {
                title: title || description, 
                caption, 
                description: description || title,
                datePrecision, 
                logicalDate: finalDate, 
                tagIds: finalTagIds,
                location: finalLocation,
                isInboxDismissed: isInboxDismissed ?? false, 
                isPurist: isPurist ?? false,
                polishLayers: polishLayers || [], 
                preset: preset || 'original',
                adjustmentStack: adjustmentStack || {},
                editHistory: finalEditHistory,
                url: url || asset.url,
                mediaIds: mediaIds || [],
                'search_metadata.summary': description || title || valuesRef.current.narrative,
                ai_description: valuesRef.current.narrative || description || title,
                narrative: valuesRef.current.narrative || '',
                isFiction: isFiction ?? false,
                skipAI: skipAI ?? false,
                ...extraUpdates
            };

            if (url && url.startsWith('data:')) {
                setMigrationStatus('Archiving Adjustment...');
                const response = await fetch(url);
                const blob = await response.blob();
                const uploadRes = await uploadFile(blob, user.id, `edit_${Date.now()}.jpg`);
                if (uploadRes.url) updates.url = uploadRes.url;
                setMigrationStatus('');
            }

            if (mode === 'version') {
                const newId = `media-${Date.now()}`;
                const newAsset = { ...asset, ...updates, id: newId, originalId: asset.id, uploadDate: new Date() };
                await setDoc(doc(db, 'users', user.id, 'media', newId), { ...newAsset, logicalDate: finalDate.toISOString(), uploadDate: new Date().toISOString() });
                await typesenseService.updateMedia(newAsset as any);
                onUpdate(newId, newAsset);
            } else {
                if (asset.isProduction) {
                    const collectionName = 
                        (asset as any).type === 'event' ? 'events' :
                        (asset as any).type === 'messenger_log' ? 'communication_archives' :
                        (asset as any).type === 'signal' ? 'messages' :
                        (asset as any).type === 'tag' ? 'tags' : 'media';

                    await updateDoc(doc(db, 'users', user.id, collectionName, asset.id), { ...updates, logicalDate: finalDate.toISOString() });
                    
                    if (collectionName === 'media') {
                        await typesenseService.updateMedia({ ...asset, ...updates, logicalDate: finalDate.toISOString() } as any);
                    } else if (collectionName === 'events') {
                        await typesenseService.updateEvent({ ...asset, ...updates, logicalDate: finalDate.toISOString() } as any, user.id);
                    }
                }
                onUpdate(asset.id, updates);
            }
            onClose();
        } catch (error) { console.error("[StudioActions] Save Error:", error); }
        finally { setIsSaving(false); setMigrationStatus(''); }
    }, [asset, user.id, onUpdate, onClose, tags]);

    const handleSparkle = useCallback(async (customDirective?: string) => {
        console.log("[StudioActions] handleSparkle initiated. Directive:", customDirective);
        setIsThinking(true);
        aiStateBridge.setThinking(true);
        try {
            const originalText = asset.caption || asset.description || asset.title || '';
            const inputText = valuesRef.current.title || valuesRef.current.caption || valuesRef.current.description || '';
            console.log("[StudioActions] Input text context resolved to:", `"${inputText}"`);
            
            const polished = await sparkleAssetDescription(
                inputText, 
                user, 
                customDirective,
                originalText
            );
            console.log("[StudioActions] sparkleAssetDescription resolved successfully to:", `"${polished}"`);
            
            valuesRef.current.title = polished;
            valuesRef.current.description = polished;
            setIsDirty(true);
            return polished;
        } catch (e) {
            console.error("[useStudioActions] Sparkle Failed:", e);
            const errMsg = e instanceof Error ? e.message : 'Unknown error';
            window.dispatchEvent(new CustomEvent('gigi-status-toast', { 
                detail: `Neural Muse Failed: ${errMsg}`
            }));
            return null;
        } finally { 
            console.log("[StudioActions] handleSparkle finished. Resetting thinking state.");
            setIsThinking(false); 
            aiStateBridge.setThinking(false);
        }
    }, [user, asset]);

    const handleResurrection = async () => {
        setIsThinking(true);
        aiStateBridge.setThinking(true);
        try {
            const functions = getFunctions();
            const resurrect = httpsCallable(functions, 'processMediaMagic');
            const result = await resurrect({ imageUrl: asset.url, factor: 2 }) as any;
            if (result.data?.url) {
                valuesRef.current.url = result.data.url;
                await handleSave('version'); 
                return true;
            }
        } catch (error) { console.error("[StudioActions] Resurrection Failure:", error); }
        finally { 
            setIsThinking(false); 
            aiStateBridge.setThinking(false);
        }
        return false;
    };

    const handleNeuralSignalExtraction = async (isAuto = false) => {
        aiStateBridge.setThinking(true);
        try {
            const raw = (asset.textContent || (asset as any).content || asset.description || '');
            const title = asset.title || '';
            const narrative = valuesRef.current?.narrative || (asset as any).narrative || '';
            const textToScan = `${title}\n${raw}\n${narrative}`;

            // 1. Legacy Chat Name Matcher
            const nameMatches = Array.from(textToScan.matchAll(/(?:Sender|Recipient|Messages): (.*?)(?::|\n|$)/gi))
                .map((m: any) => m[1].replace(/\*\*/g, '').replace(/^\[\d{1,2}:\d{2}\s*(?:AM|PM)\]\s*/gi, '').trim())
                .filter(name => name && name !== 'Archive' && name !== 'Eric Cornett' && name.length > 2); 

            const uniqueNames = Array.from(new Set(nameMatches));
            const newTagIds = new Set<string>(valuesRef.current.tagIds || []);
            let linkedCount = 0;
            const unresolved: string[] = [];

            for (const name of uniqueNames) {
                const sName = name.toLowerCase();
                let match = tags.find(t => {
                    const tName = t.name.toLowerCase();
                    return tName === sName || tName.includes(sName) || sName.includes(tName);
                });

                if (!match) {
                    try {
                        const { reconcileVertexPersona } = await import('../../../services/aiOrchestrator');
                        const result = await reconcileVertexPersona(name, tags.filter(t => t.type === 'person'));
                        if (result.matchId && result.confidence > 0.8) match = tags.find(t => t.id === result.matchId);
                    } catch (e) {}
                }
                
                if (match) {
                    if (!newTagIds.has(match.id)) { newTagIds.add(match.id); linkedCount++; }
                } else { unresolved.push(name); }
            }

            // 2. Upgraded Modern General Extractor: @mentions and case-insensitive word matching of known tags
            const mentionMatches = Array.from(textToScan.matchAll(/@([a-zA-Z0-9_\-\u00C0-\u017F]+)/g)).map(m => m[1].toLowerCase());
            
            tags.forEach(tag => {
                const tagNameLower = tag.name.toLowerCase();
                if (tagNameLower.length > 2) {
                    const isMentioned = mentionMatches.includes(tagNameLower) || mentionMatches.includes(tag.id.toLowerCase());
                    
                    const escapedName = tag.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const wordRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
                    const isNameMatch = wordRegex.test(textToScan);
                    
                    if (isMentioned || isNameMatch) {
                        if (!newTagIds.has(tag.id)) {
                            newTagIds.add(tag.id);
                            linkedCount++;
                        }
                    }
                }
            });

            if (linkedCount > 0) {
                valuesRef.current.tagIds = Array.from(newTagIds);
                setIsDirty(true);
            }
            return { linked: linkedCount, unresolved, newTagIds: Array.from(newTagIds) };
        } finally {
            aiStateBridge.setThinking(false);
        }
    };

    return { handleSave, handleSparkle, handleResurrection, handleNeuralSignalExtraction };
};
