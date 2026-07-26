import { useState, useCallback, useEffect } from 'react';
import type { User, Toast, ImportStatus, Settings, GodModeSettings, UserStatus, Theme, Tag } from '@/types';
import { appDataService } from '../services/serviceManager';
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
    const [showDevTools, setShowDevTools] = useState(false);
    const [appResetToken, setAppResetToken] = useState(0);

    const [godModeSettings, setGodModeSettings] = useState<GodModeSettings>({
        isOpen: false,
        companionTraits: {},
        narrativeOverride: '',
        motorFunctionsFrozen: false
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
            } catch(e) { console.warn("Rescue check failed", e); }
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
            setSettings(prev => ({ ...prev, ...user.settings }));
        }
    }, [user]);

    // --- HANDLERS ---

    const addToast = useCallback((message: string, type: Toast['type']) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts(prev => [...prev, { id, message, type }]);
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
            if(file) setBackupImportStatus({ type: 'confirming', file });
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
        setStagedFiles(files);
        addToast(`${files.length} files moved to Staging for review.`, 'success');
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

    const handleUploadAvatar = async (avatarBlob: Blob): Promise<string> => {
        if (!user) return "";
        const mediaId = `media-avatar-${Date.now()}`;
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                const newMedia = {
                    id: mediaId,
                    url: base64data, 
                    thumbnailUrl: base64data,
                    caption: 'Tag Avatar',
                    uploadDate: new Date(),
                    fileType: 'image/png',
                    tagIds: [],
                    status: 'clean'
                };
                try {
                    await appDataService.saveMedia(user.id, newMedia);
                    resolve(mediaId);
                } catch (e) {
                    console.error("Avatar save failed", e);
                    reject(e);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(avatarBlob);
        });
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
        showDevTools,
        setShowDevTools,
        appResetToken,
        setAppResetToken,
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
        handleSaveTag
    };
};