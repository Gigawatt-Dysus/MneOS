import { useState, useEffect } from 'react';
import type { Settings, User, Tag, Media } from '@/types';
import { DEFAULT_EMOJIS } from '@/types';
import { appDataService } from '../../services/serviceManager';
import { FaceRecognitionService } from '../../services/ai/faceRecognition';
import { CleanupService } from '../../services/cleanupService';
import { hydrateMemory } from '../../services/searchService'; // [ZEN NEW]

interface UseSettingsLogicProps {
    isOpen: boolean;
    settings: Settings;
    onSettingsChange: (newSettings: Settings) => void;
    onClose: () => void;
    user?: User | null;
}

export type SettingsTab = 'fonts' | 'companions' | 'interface' | 'utils';

export const useSettingsLogic = ({ isOpen, settings, onSettingsChange, onClose, user }: UseSettingsLogicProps) => {
    // UI State
    const [activeTab, setActiveTab] = useState<SettingsTab>('companions');
    const [localSettings, setLocalSettings] = useState<Settings>(settings);

    // Config State
    const [firebaseConfigJson, setFirebaseConfigJson] = useState('');
    const [configStatus, setConfigStatus] = useState<{ type: 'info' | 'error' | 'success', msg: string }>({ type: 'info', msg: '' });
    const [isUsingLocalStorage, setIsUsingLocalStorage] = useState(false);
    const [isForcedLocal, setIsForcedLocal] = useState(false);

    // Emoji State
    const [newEmoji, setNewEmoji] = useState('');

    // Scanner/Janitor State
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [allMedia, setAllMedia] = useState<Media[]>([]);
    const [brokenLinks, setBrokenLinks] = useState<Media[]>([]);
    const [duplicates, setDuplicates] = useState<Media[]>([]);
    const [scanStatus, setScanStatus] = useState<string>('');

    // [ZEN NEW] Hippocampus State
    const [hydrationStatus, setHydrationStatus] = useState<string>('');
    const [isHydrating, setIsHydrating] = useState(false);

    // 1. Sync Settings when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalSettings(settings);
            // Pre-load AI models
            if (FaceRecognitionService && FaceRecognitionService.loadModels) {
                FaceRecognitionService.loadModels().catch(err => console.warn("Background model load failed", err));
            }
        }
    }, [isOpen, settings]);

    // 2. Load Config & User Data
    useEffect(() => {
        const stored = localStorage.getItem('gigi_firebase_config');
        const forced = localStorage.getItem('gigi_force_local_mode') === 'true';
        setIsForcedLocal(forced);

        if (stored) {
            setFirebaseConfigJson(stored);
            setIsUsingLocalStorage(true);
            setConfigStatus({ type: 'success', msg: 'Using Browser Storage configuration.' });
        } else {
            setIsUsingLocalStorage(false);
            setConfigStatus({ type: 'info', msg: 'Using file-based configuration.' });
        }

        if (user && isOpen) {
            appDataService.getAllTags(user.id).then(setAllTags);
            appDataService.getAllMedia(user.id).then(setAllMedia);
        }
    }, [isOpen, user]);

    // --- Handlers ---

    const handleSettingChange = (key: keyof Settings, value: any) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleGlassChange = (key: 'opacity' | 'blur' | 'highlight', value: number) => {
        setLocalSettings(prev => ({
            ...prev,
            glassSettings: {
                ...(prev.glassSettings || { opacity: 0.3, blur: 12, highlight: 0.3 }),
                [key]: value
            }
        }));
    };

    const handleSaveChanges = () => {
        onSettingsChange(localSettings);
        onClose();
    };

    // Config Management
    const handleClearConfig = () => {
        if (window.confirm("Clear saved browser configuration?")) {
            localStorage.removeItem('gigi_firebase_config');
            localStorage.removeItem('gigi_force_local_mode');
            setFirebaseConfigJson('');
            setIsUsingLocalStorage(false);
            setConfigStatus({ type: 'info', msg: 'Config cleared. Reloading...' });
            setTimeout(() => window.location.reload(), 1000);
        }
    };

    const handleSaveConfig = () => {
        try {
            let jsonStr = firebaseConfigJson.trim();
            if (!jsonStr) { handleClearConfig(); return; }
            jsonStr = jsonStr.replace(/^(const|let|var|export\s+const)\s+\w+\s*=\s*/, '');
            jsonStr = jsonStr.replace(/;$/, '');
            let parsed: any;
            try { parsed = JSON.parse(jsonStr); } catch (strictError) {
                try { parsed = new Function(`return ${jsonStr}`)(); } catch (evalError) { throw new Error("Could not parse configuration."); }
            }
            localStorage.setItem('gigi_firebase_config', JSON.stringify(parsed, null, 2));
            localStorage.removeItem('gigi_force_local_mode');
            setConfigStatus({ type: 'success', msg: 'Saved! Reloading...' });
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            console.error(e);
            setConfigStatus({ type: 'error', msg: `Error: ${(e as Error).message}` });
        }
    };

    // [ZEN NEW] Backfill Logic (Hippocampus)
    const handleHydrateMemory = async () => {
        if (!user || !confirm("This will download ALL chat history and generate vectors. It may take a few minutes. Continue?")) return;

        setIsHydrating(true);
        setHydrationStatus("Fetching history from Firestore...");

        try {
            const allChats = await appDataService.getFullChatHistory(user.id);

            if (!allChats || allChats.length === 0) {
                setHydrationStatus("No history found.");
                setIsHydrating(false);
                return;
            }

            setHydrationStatus(`Found ${allChats.length} messages. Generating Vectors...`);

            await hydrateMemory(allChats);

            setHydrationStatus(`Success! Indexed ${allChats.length} memories.`);
        } catch (e: any) {
            console.error(e);
            setHydrationStatus(`Error: ${e.message}`);
        } finally {
            setIsHydrating(false);
        }
    };

    // Janitor Logic
    const runScan = async () => {
        if (!user) return;
        setScanStatus('Scanning...');
        const freshMedia = await appDataService.getAllMedia(user.id);
        setAllMedia(freshMedia);

        if (!freshMedia || freshMedia.length === 0) {
            setScanStatus("No media found.");
            return;
        }

        const broken = CleanupService.scanForBrokenLinks(freshMedia);
        const dupes = CleanupService.scanForDuplicates(freshMedia);

        setBrokenLinks(broken);
        setDuplicates(dupes);
        setScanStatus(`Found ${broken.length} broken links and ${dupes.length} potential duplicates.`);
    };

    const executePurge = async (type: 'broken' | 'dupes') => {
        if (!user) return;

        if (type === 'broken') {
            if (!confirm("Delete broken links?")) return;
            setScanStatus('Purging...');
            const count = await CleanupService.purgeMedia(user.id, brokenLinks);
            setScanStatus(`Cleaned ${count} links.`);
            setBrokenLinks([]);
        }
        else if (type === 'dupes') {
            if (!confirm(`Tag ${duplicates.length} files as 'Possible Duplicate'?`)) return;
            setScanStatus('Tagging...');
            const msg = await CleanupService.quarantineDuplicates(user.id, duplicates, allTags);
            setScanStatus(msg);
            setDuplicates([]);
        }
    };

    // Emoji Logic
    const currentEmojis = localSettings.preferredEmojis || DEFAULT_EMOJIS;
    const addEmoji = () => {
        if (!newEmoji || currentEmojis.includes(newEmoji)) return;
        handleSettingChange('preferredEmojis', [...currentEmojis, newEmoji]);
        setNewEmoji('');
    };
    const removeEmoji = (e: string) => handleSettingChange('preferredEmojis', currentEmojis.filter(x => x !== e));
    const resetEmojis = () => {
        if (confirm("Reset emojis?")) handleSettingChange('preferredEmojis', undefined);
    };

    return {
        activeTab, setActiveTab,
        localSettings,
        handleSettingChange,
        handleGlassChange,
        handleSaveChanges,

        // Config
        firebaseConfigJson, setFirebaseConfigJson,
        configStatus, isUsingLocalStorage, isForcedLocal,
        handleClearConfig, handleSaveConfig,

        // Emoji
        newEmoji, setNewEmoji, addEmoji, removeEmoji, resetEmojis, currentEmojis,

        // Janitor
        allTags, allMedia,
        brokenLinks, duplicates, scanStatus,
        runScan, executePurge,

        // [ZEN NEW]
        handleHydrateMemory,
        hydrationStatus,
        isHydrating
    };
};