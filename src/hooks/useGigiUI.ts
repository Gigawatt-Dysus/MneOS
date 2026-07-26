import { useState, useCallback, useEffect, useRef } from 'react';
import type { User, Toast, ImportStatus, Settings, GodModeSettings, UserStatus, Theme, Tag, Media, SettingsTab } from '../types';
import { appDataService } from '../services/serviceManager';
import { uploadFile } from '../services/storageService';
import * as localDb from '../services/localDbService';

const DEFAULT_SETTINGS: Settings = {
    idleTimeout: 30,
    aiDaydreaming: true,
    daydreamInterval: 240,
    autoBackupInterval: 0,
    showMemoryPromptOnDashboard: false,
    toneSetting: 3,
    fontSize: 16,
    lineHeight: 1.5,
    fontFamily: 'Inter',
    theme: 'dark',
    daydreamDepth: 10,
    daydreamSampling: 'random',
    glassSettings: {
        opacity: 0.3,
        blur: 12,
        highlight: 0.3
    }
};

async function extractSourceElement(
    safeUrl: string,
    media: Media
): Promise<HTMLImageElement | HTMLVideoElement> {
    return new Promise((resolve, reject) => {
        const isVideo = media.fileType?.startsWith('video/');
        
        let timeoutId = setTimeout(() => {
            reject(new Error('Media load timeout'));
        }, 10000);

        if (isVideo) {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.muted = true;
            video.playsInline = true;
            
            video.onloadeddata = () => {
                const seekTime = Math.max(1, video.duration * 0.25);
                video.currentTime = isFinite(seekTime) ? seekTime : 1;
            };
            video.onseeked = () => {
                clearTimeout(timeoutId);
                resolve(video);
            };
            video.onerror = () => {
                clearTimeout(timeoutId);
                reject(new Error('Video load error'));
            };
            video.src = safeUrl;
        } else {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                clearTimeout(timeoutId);
                resolve(img);
            };
            img.onerror = () => {
                clearTimeout(timeoutId);
                reject(new Error('Image load error'));
            };
            img.src = safeUrl;
        }
    });
}

export const useGigiUI = (user: User | null, isFirebaseConfigured: boolean, settingsInitializedRef: React.MutableRefObject<boolean>, theme: Theme, setTheme: (t: Theme) => void) => {

    // --- STATE ---
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [notifications, setNotifications] = useState({ gigiJournal: 0, commsCenter: 0 });
    const [userStatus, setUserStatus] = useState<UserStatus>('online');

    const [backupImportStatus, setBackupImportStatus] = useState<ImportStatus>({ type: 'idle' });
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);

    const [showExportModal, setShowExportModal] = useState(false);
    const [showRescueModal, setShowRescueModal] = useState(false);
    const [localRescueCount, setLocalRescueCount] = useState(0);
    const [isRescuing, setIsRescuing] = useState(false);

    const [showDevPatch, setShowDevPatch] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsTab, setSettingsTab] = useState<SettingsTab>('companions');
    const [showDevTools, setShowDevTools] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showSocialDiscovery, setShowSocialDiscovery] = useState(false);
    const [appResetToken, setAppResetToken] = useState(0);
    const [matrixSelection, setMatrixSelection] = useState<string[]>([]);

    const [godModeSettings, setGodModeSettings] = useState<GodModeSettings>(() => {
        try {
            const saved = localStorage.getItem('gigi_god_mode_settings');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error("Failed to load godModeSettings", e);
        }
        return {
            isOpen: false,
            companionTraits: {},
            narrativeOverride: '',
            motorFunctionsFrozen: false
        };
    });

    const [settings, setSettings] = useState<Settings>(() => {
        try {
            const saved = localStorage.getItem('gigi_user_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (e) {
            console.error("Failed to load settings", e);
        }
        return DEFAULT_SETTINGS;
    });

    // --- EFFECTS ---

    // Apply Glass Effects & Typography
    useEffect(() => {
        const root = document.documentElement;
        const glass = settings.glassSettings || DEFAULT_SETTINGS.glassSettings!;

        root.style.setProperty('--glass-opacity', glass.opacity.toString());
        root.style.setProperty('--glass-blur', `${glass.blur}px`);
        root.style.setProperty('--glass-highlight', glass.highlight.toString());

        root.style.fontSize = `${settings.fontSize || 16}px`;

        let styleTag = document.getElementById('gigi-dynamic-typography');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'gigi-dynamic-typography';
            document.head.appendChild(styleTag);
        }
        styleTag.innerHTML = `:root { --app-font-family: '${settings.fontFamily || 'Inter'}', sans-serif; --app-line-height: ${settings.lineHeight || 1.5}; } body { font-family: var(--app-font-family) !important; }`;

    }, [settings]);

    // Check for local data to rescue on boot
    useEffect(() => {
        const checkRescue = async () => {
            if (!user || !isFirebaseConfigured) return;
            if (user.id === 'dev-user-root') return;

            try {
                const count = (await localDb.getAllEvents(user.id)).length + (await localDb.getAllMedia(user.id)).length;
                if (count > 0) {
                    setLocalRescueCount(count);
                    setShowRescueModal(true);
                }
            } catch (e) { console.warn("Rescue check failed", e); }
        };
        checkRescue();
    }, [user, isFirebaseConfigured]);

    // Apply Settings Sync
    useEffect(() => {
        if (!settingsInitializedRef.current) return;

        localStorage.setItem('gigi_user_settings', JSON.stringify(settings));

        if (user && user.id && isFirebaseConfigured) {
            const updatePayload: Partial<User> = { settings };
            appDataService.updateUserProfile(user.id, updatePayload as any).catch(err =>
                console.warn("Failed to sync settings to cloud", err)
            );
        }

        if (settings.theme && settings.theme !== theme) {
            setTheme(settings.theme);
        }

    }, [settings, user, isFirebaseConfigured, settingsInitializedRef, theme, setTheme]);

    useEffect(() => {
        if (user?.settings) {
            setSettings(prev => {
                const next = { ...prev, ...user.settings };
                if (JSON.stringify(prev) === JSON.stringify(next)) {
                    return prev; // Prevent infinite loop of reference changes!
                }
                return next;
            });
        }
    }, [user]);

    // Save godModeSettings to localStorage on change
    useEffect(() => {
        localStorage.setItem('gigi_god_mode_settings', JSON.stringify(godModeSettings));
    }, [godModeSettings]);

    // [ZEN] BEAT COP PIPELINE: Async Background Queue for Generation & Forensic Auditing
    const healMediaViolator = useCallback((media: Media, citationData?: any): Promise<Media> => {
        return new Promise((resolve, reject) => {
            if (!user) return reject(new Error("No active user"));
            
            const queueItem = { type: citationData ? 'citation' : 'variant', media, data: citationData, resolve, reject };
            beatCopQueueRef.current.push(queueItem as any);
            processBeatCopQueue();
        });
    }, [user]);

    const beatCopQueueRef = useRef<{type: 'variant' | 'citation', media: Media, data?: any, resolve: (m: Media) => void, reject: (e: any) => void}[]>([]);
    const isProcessingRef = useRef(false);

    // [ZEN] Emergency Reset for locked queues
    const resetBeatCopQueue = useCallback(() => {
        console.warn(`[BeatCop] 🚨 EMERGENCY RESET TRIGGERED. Clearing ${beatCopQueueRef.current.length} pending items.`);
        beatCopQueueRef.current.forEach(item => item.reject(new Error("Queue reset")));
        beatCopQueueRef.current = [];
        isProcessingRef.current = false;
    }, []);

    const processBeatCopQueue = useCallback(async () => {
        if (isProcessingRef.current || beatCopQueueRef.current.length === 0 || !user) return;
        isProcessingRef.current = true;
        
        const item = beatCopQueueRef.current.shift();
        if (!item) {
            isProcessingRef.current = false;
            return;
        }

        const { type, media, data: citationData, resolve, reject } = item;

        try {
            const isMigrationMode = localStorage.getItem('MIGRATION_MODE') === 'true';
            
            // [ZEN] CIRCUIT BREAKER COMPLETELY BYPASSED FOR MIGRATION
            // Processing queues as fast as possible to unblock UI.
            if (!isMigrationMode) {
                // If not in migration mode, we will still process, but we log it.
                // We've removed the strict 10-item cap so that large backlogs can clear automatically over time.
            } else {
                console.log(`[BeatCop] 🚀 MIGRATION MODE ENABLED: Bypassing circuit breaker.`);
            }
        } catch (e) {
            console.error("[BeatCop] Circuit Breaker failed to read/write state:", e);
        }

        if (!media || !media.url) {
            isProcessingRef.current = false;
            reject(new Error("Invalid media payload"));
            setTimeout(() => processBeatCopQueue(), 500); // 500ms delay to yield to event loop
            return;
        }

        try {
            if (type === 'citation' && citationData) {
                console.log(`[BeatCop] ⚖️ Processing forensic citation for: ${media.id}`);
                
                // Construct Judge Prompt using the Forensic Law
                const violations = citationData.violations || {};
                const notes = citationData.officerNotes || "";
                
                let citationList = [];
                if (violations.countViolation) citationList.push("Count Violation: Incorrect number of subjects.");
                if (violations.contextPresumption) citationList.push("Context Presumption: Assumed context without visual evidence.");
                if (violations.phantomEntity) citationList.push("Phantom Entity: Hallucinated object/person.");
                if (violations.relationalAssumption) citationList.push("Relational Assumption: Unfounded assumptions about relationships.");
                if (violations.emotionalProjection) citationList.push("Emotional Projection: Overstated or invented emotions.");
                if (violations.textFabrication) citationList.push("Text Fabrication: Hallucinated or misread text.");
                if (violations.other && notes) citationList.push(`Other: ${notes}`);

                const prompt = `You are the Chief Judicial AI of the Sovereign Matrix. Your purpose is to audit and remediate archival media metadata that has been contaminated by "hallucinations" from a previous, less reliable AI model.

## Your Mission
Draft a replacement narrative that corrects the factual errors cited in the report, while preserving the rich, atmospheric, and aesthetic language of the original text. We do not want robotic, dry descriptions. We want accurate, evocative narratives.

## The Forensic Law (Rules of Remediation)
1. Factual Inviolability: Zero Hallucination Tolerance. Exact Counts. Assumptions are Forbidden. Pay close attention to physical markers.
2. Atmospheric Preservation: Retain the Mood. Do Not Sanitize.
3. The Strike Process: Surgical Removal of flagged hallucinations. Seamless Integration into a flowing paragraph.

## Input Data
Citation Report:
${citationList.map(c => `- ${c}`).join('\\n')}
${notes && !violations.other ? `Officer Notes:\\n${notes}\\n` : ''}
Original Caption:
${media.description}

## Output Format
Return ONLY the corrected, flowing narrative paragraph. Do not include introductory text, explanations of what you changed, or markdown blocks. Just the final, pristine caption.`;

                // Call Grok API
                const apiKey = import.meta.env.VITE_XAI_API_KEY;
                if (!apiKey) throw new Error("VITE_XAI_API_KEY not found");

                const response = await fetch("https://api.x.ai/v1/chat/completions", {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: "grok-2-vision-1212",
                        messages: [{
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                { type: "image_url", image_url: { url: media.url, detail: "high" } }
                            ]
                        }],
                        max_tokens: 1000,
                        temperature: 0.2
                    })
                });

                const resData = await response.json();
                if (!response.ok) throw new Error(`Grok API Error: ${resData.error?.message || response.statusText}`);
                const newCaption = resData.choices[0].message.content.trim();

                const { httpsCallable } = await import('../services/apiClient');
                const sovereignDbWrite = httpsCallable(null, 'sovereignDbWrite');

                // Update pending_accession
                await sovereignDbWrite({
                    collectionName: 'pending_accessions',
                    userId: user.id,
                    docId: media.id,
                    operation: 'set',
                    options: { merge: true },
                    data: {
                        description: newCaption,
                        aiModel: "grok-test",
                        validationStatus: "remediated",
                        remediatedAt: new Date().toISOString()
                    }
                });

                // Update validations ticket if it exists
                await sovereignDbWrite({
                    collectionName: 'validations',
                    userId: user.id,
                    docId: media.id,
                    operation: 'set',
                    options: { merge: true },
                    data: {
                        status: "processed",
                        processedAt: new Date().toISOString(),
                        judgeModel: "grok-2-vision-1212"
                    }
                });

                console.log(`[BeatCop] ✅ Citation fully remediated by Judge: ${media.id}`);
                const updatedMedia = { ...media, description: newCaption, aiModel: "grok-test", validationStatus: "remediated" };
                resolve(updatedMedia as Media);
                return;
            }

            const isAvatar = !!media.isAvatar;
            console.log(`[BeatCop] 🚔 Processing violator: ${media.id} | track: ${isAvatar ? 'AVATAR (64/128/256px square)' : 'STANDARD (200/500/1000px)'}`);

            // 1. Fetch Master Binary via Backend Proxy to bypass CORS block
            const originalUrl = media.url;
            const safeUrl = originalUrl.startsWith('http') 
                ? `/api/media/proxy?url=${encodeURIComponent(originalUrl)}`
                : originalUrl;

            // 1. Load master element — image or video, routed by fileType
            const sourceEl = await extractSourceElement(safeUrl, media);

            // 2a. AVATAR TRACK — square center-crop at 64/128/256px
            const generateAvatarVariant = async (size: number, suffix: string): Promise<string> => {
                return new Promise((res, rej) => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = size;
                        canvas.height = size;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) throw new Error('No canvas context');

                        // Center-crop: find the largest square that fits within the source
                        const nativeW = sourceEl instanceof HTMLVideoElement ? sourceEl.videoWidth : (sourceEl as HTMLImageElement).naturalWidth;
                        const nativeH = sourceEl instanceof HTMLVideoElement ? sourceEl.videoHeight : (sourceEl as HTMLImageElement).naturalHeight;
                        
                        const srcSize = Math.min(nativeW, nativeH);
                        const srcX = (nativeW - srcSize) / 2;
                        const srcY = (nativeH - srcSize) / 2;

                        ctx.drawImage(sourceEl, srcX, srcY, srcSize, srcSize, 0, 0, size, size);

                        canvas.toBlob(async (blob) => {
                            if (!blob) { rej(new Error('Avatar canvas blob failed')); return; }
                            try {
                                const uploadResult = await uploadFile(blob, user!.id, `avatar_variant_${suffix}_${Date.now()}.jpg`);
                                res(uploadResult.url || '');
                            } catch (e) { rej(e); }
                        }, 'image/jpeg', 0.90); // Slightly higher quality for face detail
                    } catch (e) { rej(e); }
                });
            };

            // 2b. STANDARD TRACK — proportional scale at 200/500/1000px
            const generateStandardVariant = async (maxWidth: number, suffix: string): Promise<string> => {
                return new Promise((res, rej) => {
                    try {
                        const canvas = document.createElement('canvas');
                        const nativeW = sourceEl instanceof HTMLVideoElement ? sourceEl.videoWidth : (sourceEl as HTMLImageElement).naturalWidth;
                        const nativeH = sourceEl instanceof HTMLVideoElement ? sourceEl.videoHeight : (sourceEl as HTMLImageElement).naturalHeight;
                        
                        const scale = Math.min(1, maxWidth / nativeW);
                        canvas.width = nativeW * scale;
                        canvas.height = nativeH * scale;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) throw new Error('No canvas context');
                        ctx.drawImage(sourceEl, 0, 0, canvas.width, canvas.height);

                        if (sourceEl instanceof HTMLVideoElement) {
                            const radius = canvas.height * 0.14;
                            const cx = canvas.width / 2;
                            const cy = canvas.height / 2;
                            
                            ctx.fillStyle = 'rgba(0,0,0,0.45)';
                            ctx.beginPath();
                            ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
                            ctx.fill();
                            
                            ctx.fillStyle = 'white';
                            ctx.beginPath();
                            // Right-pointing triangle
                            const triRadius = radius * 0.4;
                            ctx.moveTo(cx - triRadius * 0.5, cy - triRadius);
                            ctx.lineTo(cx + triRadius, cy);
                            ctx.lineTo(cx - triRadius * 0.5, cy + triRadius);
                            ctx.closePath();
                            ctx.fill();
                        }

                        canvas.toBlob(async (blob) => {
                            if (!blob) { rej(new Error('Canvas blob failed')); return; }
                            try {
                                const uploadResult = await uploadFile(blob, user!.id, `variant_${suffix}_${Date.now()}.jpg`);
                                res(uploadResult.url || '');
                            } catch (e) { rej(e); }
                        }, 'image/jpeg', 0.85);
                    } catch (e) { rej(e); }
                });
            };

            // 3. Dispatch on correct track
            let smallUrl: string, mediumUrl: string, largeUrl: string;

            if (isAvatar) {
                [smallUrl, mediumUrl, largeUrl] = await Promise.all([
                    generateAvatarVariant(64, 'small'),
                    generateAvatarVariant(128, 'medium'),
                    generateAvatarVariant(256, 'large')
                ]);
            } else {
                [smallUrl, mediumUrl, largeUrl] = await Promise.all([
                    generateStandardVariant(200, 'small'),
                    generateStandardVariant(500, 'medium'),
                    generateStandardVariant(1000, 'large')
                ]);
            }

            if (smallUrl && mediumUrl && largeUrl) {
                const newMedia = {
                    ...media,
                    thumbnailUrls: {
                        ...media.thumbnailUrls,
                        small: smallUrl,
                        medium: mediumUrl,
                        large: largeUrl
                    }
                };

                // 4. Atomic Ledger Update via REST endpoint — same schema for both tracks
                const { httpsCallable } = await import('../services/apiClient');
                const sovereignDbWrite = httpsCallable(null, 'sovereignDbWrite');

                await sovereignDbWrite({
                    collectionName: 'media',
                    userId: user!.id,
                    docId: media.id,
                    operation: 'set',
                    options: { merge: true },
                    data: {
                        thumbnailUrls: newMedia.thumbnailUrls
                    }
                });

                console.log(`[BeatCop] ✅ Violator healed via REST [${isAvatar ? 'AVATAR' : 'STANDARD'}]: ${media.id}`);
                resolve(newMedia as Media);
            } else {
                reject(new Error('Variant generation failed — one or more upload URLs were empty.'));
            }

        } catch (err: any) {
            console.error(`[BeatCop] ❌ Failed to heal violator ${media?.id}`, err);
            reject(err);
        } finally {
            isProcessingRef.current = false;
            setTimeout(() => processBeatCopQueue(), 500); // 500ms delay between items to prevent blocking main thread
        }
    }, [user]);


    // --- HANDLERS ---

    const addToast = useCallback((message: string, type: Toast['type'], action?: Toast['action']) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts(prev => [...prev, { id, message, type, action }]);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const handleExportRequest = () => setShowExportModal(true);

    const handleTriggerRestore = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.gz,application/json,application/gzip,application/x-gzip';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (file) setBackupImportStatus({ type: 'confirming', file });
        };
        input.click();
    };

    const handleConfirmExport = async (type: 'full' | 'data-only', includeConfig: boolean) => {
        if (!user) return;
        try {
            const data = await appDataService.exportAllData(user.id, includeConfig);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gigi-archive-${type}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setShowExportModal(false);
            addToast("Export complete.", "success");
        } catch (e) {
            console.error("Export error", e);
            addToast("Export failed.", "error");
        }
    };

    const handleStageFiles = useCallback((files: File[]) => {
        // [ZEN FIX] Accumulate instead of overwrite — critical for streaming sideload batches
        // where onProgress fires once per item. Overwriting caused all-but-last item to vanish.
        setStagedFiles(prev => [...prev, ...files]);
        addToast(`${files.length} item(s) added to Staging.`, 'success');
    }, [addToast]);

    const handleRescueConfirm = async () => {
        if (!user) return;
        setIsRescuing(true);
        try {
            const localEvents = await localDb.getAllEvents(user.id);
            const localTags = await localDb.getAllTags(user.id);
            const localMedia = await localDb.getAllMedia(user.id);

            for (const e of localEvents) await appDataService.saveEvent(user.id, e);
            for (const t of localTags) await appDataService.saveTag(user.id, t);
            for (const m of localMedia) await appDataService.saveMedia(user.id, m);

            await localDb.clearLocalDataAfterSync();
            addToast("Data rescued successfully.", "success");
            setShowRescueModal(false);
            return true;
        } catch (e) {
            addToast("Rescue failed. Try again.", "error");
            return false;
        } finally {
            setIsRescuing(false);
        }
    };

    const handleUploadAvatar = async (avatarBlob: Blob): Promise<{id: string, media: any}> => {
        if (!user) return { id: "", media: null };
        const mediaId = `media-avatar-${Date.now()}`;
        
        try {
            // 1. Upload to B2 via Proxy (High Fidelity)
            const uploadRes = await uploadFile(avatarBlob, user.id, `avatar_${Date.now()}.jpg`);
            if (!uploadRes.url && !uploadRes.base64) throw new Error("B2 Upload failed and no base64 fallback available");

            // [ZEN FIX] Inject Telemetry Toast if we fall back to Base64
            if (!uploadRes.url && uploadRes.base64) {
                addToast("Cloud storage unreachable. Using Base64 Local Database fallback.", "warning");
            }

            // 2. Create Media Record with "Avatar Shield"
            const newMedia: Media = {
                id: mediaId,
                url: uploadRes.url || '',
                thumbnailUrl: uploadRes.url || '', // B2 doesn't have thumbnails yet, use same URL
                base64Data: uploadRes.base64,
                caption: 'Tag Avatar',
                uploadDate: new Date(),
                fileType: 'image/jpeg',
                tagIds: [],
                status: 'clean',
                isAvatar: true // [ZEN] THE OROBORUS SHIELD: Prevents appearance in Matrix/Artifacts
            } as any;

            await appDataService.saveMedia(user.id, newMedia);
            return { id: mediaId, media: newMedia };
        } catch (e) {
            console.error("Avatar save failed", e);
            throw e;
        }
    };

    const handleSaveTag = useCallback(async (tag: Tag, isSilent: boolean = false, navigate?: (path: string) => void, refreshCallback?: () => void) => {
        if (!user) return;
        await appDataService.saveTag(user.id, tag);

        if (refreshCallback) refreshCallback();

        if (!isSilent) {
            if (navigate) navigate('tags');
            addToast("Tag saved.", "success");
        }
    }, [user, addToast]);

    return {
        toasts,
        notifications,
        setNotifications,
        userStatus,
        setUserStatus,
        backupImportStatus,
        setBackupImportStatus,
        stagedFiles,
        setStagedFiles,
        showExportModal,
        setShowExportModal,
        showRescueModal,
        setShowRescueModal,
        localRescueCount,
        isRescuing,
        showDevPatch,
        setShowDevPatch,
        showSettingsModal,
        setShowSettingsModal,
        settingsTab,
        setSettingsTab,
        showDevTools,
        setShowDevTools,
        showShareModal,
        setShowShareModal,
        showSocialDiscovery,
        setShowSocialDiscovery,
        appResetToken,
        setAppResetToken,
        matrixSelection,
        setMatrixSelection,
        godModeSettings,
        setGodModeSettings,
        settings,
        setSettings,
        addToast,
        dismissToast,
        handleExportRequest,
        handleTriggerRestore,
        handleConfirmExport,
        handleStageFiles,
        handleRescueConfirm,
        handleUploadAvatar,
        handleSaveTag,
        healMediaViolator,
        resetBeatCopQueue
    };
};