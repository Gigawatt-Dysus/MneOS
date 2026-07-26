import { useState, useRef, useEffect, useMemo } from 'react';
import type { User, Toast, Media, ImportStatus, View } from '@/types';
import { parseLegacyData } from '../../services/importer';
import { appDataService } from '../../services/serviceManager';
import { uploadFile, dataURLToBlob } from '../../services/storageService';
import * as localDb from '../../services/localDbService';
import { filterSystemAssets } from '../matrix/MatrixShared';

interface UseProfileLogicProps {
    user: User;
    allMedia: Media[];
    onUserUpdate: (user: User) => void;
    addToast: (message: string, type: Toast['type']) => void;
}

export const useProfileLogic = ({ user, allMedia, onUserUpdate, addToast }: UseProfileLogicProps) => {
    const [formData, setFormData] = useState<User>(user);
    const [profilePicPreview, setProfilePicPreview] = useState<string>(user.profilePictureUrl || '');
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // UI State
    const [activeTab, setActiveTab] = useState<'identity' | 'gallery' | 'controls'>('identity');
    const [isMatrixOpen, setIsMatrixOpen] = useState(false);
    const [viewingMedia, setViewingMedia] = useState<Media | null>(null);

    // Settings & Admin State
    const [legacyImportStatus, setLegacyImportStatus] = useState<ImportStatus>({ type: 'idle' });
    const [isResetting, setIsResetting] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [migrationStatus, setMigrationStatus] = useState<{ active: boolean, current: number, total: number }>({ active: false, current: 0, total: 0 });
    const [localRescueCount, setLocalRescueCount] = useState<number>(0);
    const [isRescuing, setIsRescuing] = useState(false);
    const [isIncinerating, setIsIncinerating] = useState(false);

    // Refs
    const legacyImportFileRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null); // [ZEN NEW] For direct avatar upload

    // Sync form with user prop changes
    useEffect(() => {
        if (user && user.id !== formData.id) {
            setFormData(user);
            setProfilePicPreview(user.profilePictureUrl || '');
        }
    }, [user, formData.id]);

    useEffect(() => {
        const checkLocalData = async () => {
            try {
                if (user && user.id && user.id.length > 20) {
                    const localEvents = await localDb.getAllEvents('check');
                    if (localEvents.length > 0) {
                        setLocalRescueCount(localEvents.length);
                    }
                }
            } catch (e) {
                console.error("Error checking for local rescue data:", e);
            }
        };
        checkLocalData();
    }, [user?.id]);

    // Filtered Gallery
    const userMedia = useMemo(() => {
        const safeAllMedia = allMedia || [];
        const rawMedia = (formData.mediaIds || [])
            .map(id => safeAllMedia.find(m => m.id === id))
            .filter((m): m is Media => !!m);

        return filterSystemAssets(rawMedia);
    }, [formData.mediaIds, allMedia]);

    // --- Handlers ---

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        if (id.includes('.')) {
            const [parent, child] = id.split('.');
            setFormData(prev => ({ ...prev, [parent]: { ...(prev[parent as keyof User] as object), [child]: value } } as User));
        } else {
            setFormData(prev => ({ ...prev, [id]: value }));
        }
    };

    // Avatar Actions
    const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setImageToCrop(e.target.result as string);
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
        // Reset input so same file can be selected again if needed
        e.target.value = '';
    };

    const handleCropComplete = async (croppedImageUrl: string) => {
        setProfilePicPreview(croppedImageUrl);
        setImageToCrop(null);
        // We upload immediately or on save? 
        // Existing logic suggests we upload here to get a URL, but for now we preview.
        // The save handler below handles persistence.
    };

    const handleRemoveAvatar = () => {
        if (window.confirm("Remove profile picture?")) {
            setProfilePicPreview('');
            setFormData(prev => ({ ...prev, profilePictureUrl: '' }));
        }
    };

    const handleRepositionAvatar = () => {
        if (profilePicPreview && !profilePicPreview.startsWith('http')) {
            // If it's a blob/base64 we can recrop. 
            // If it's a remote URL, we might need to proxy it or just limit this feature.
            setImageToCrop(profilePicPreview);
        } else if (profilePicPreview) {
            // For remote URLs, we ideally download it to a blob first, 
            // but for simple MVP we can try setting it directly if CORS allows.
            setImageToCrop(profilePicPreview);
        }
    };

    const handleAutoGenTheme = () => {
        addToast("Theme auto-generation coming soon!", "info");
    };

    const handleSaveChanges = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsSaving(true);

        let finalAvatarUrl = profilePicPreview;

        // If it's a Base64 string, upload it first
        if (profilePicPreview && profilePicPreview.startsWith('data:')) {
            try {
                const blob = await dataURLToBlob(profilePicPreview);
                const { url } = await uploadFile(blob, user.id, `profile-${Date.now()}.jpg`);
                if (url) finalAvatarUrl = url;
            } catch (err) {
                console.error("Avatar upload failed", err);
                addToast("Failed to upload new avatar image.", "error");
            }
        }

        const updatedUser: User = {
            ...formData,
            profilePictureUrl: finalAvatarUrl,
        };

        onUserUpdate(updatedUser);
        setIsSaving(false);
        addToast("Profile updated successfully.", "success");
    };

    // ... (Legacy Import, Reset, Rescue, Migrate handlers remain the same as previous)
    const handleLegacyFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setLegacyImportStatus({ type: 'confirming', file });
        e.target.value = '';
    };

    const handleStartLegacyImport = async () => {
        if (legacyImportStatus.type !== 'confirming') return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                setLegacyImportStatus({ type: 'loading', message: 'Parsing legacy data...' });
                const parsedData = parseLegacyData(event.target?.result as string);
                setLegacyImportStatus({ type: 'loading', message: 'Importing records to database...' });
                await appDataService.importLegacyData(user.id, parsedData);
                setLegacyImportStatus({ type: 'success', message: 'Legacy data imported successfully! Restarting app...' });
                addToast('Legacy data imported! Restarting...', 'success');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
                setLegacyImportStatus({ type: 'error', message: `Import failed: ${errorMessage}` });
            }
        };
        reader.readAsText(legacyImportStatus.file);
    };

    const handleResetAndSeed = async () => {
        if (window.confirm('Are you sure you want to reset all Time Vortex data?')) {
            setIsResetting(true);
            try {
                await appDataService.resetAndSeedDatabase(user.id);
                addToast('Data has been reset. Restarting...', 'success');
            } catch (error) {
                addToast('Error resetting data.', 'error');
                setIsResetting(false);
            }
        }
    };

    const handleRescueLocalData = async () => {
        if (!window.confirm(`Merge ${localRescueCount} items?`)) return;
        setIsRescuing(true);
        try {
            addToast("Starting rescue...", 'info');
            const [events, tags, media, journal] = await Promise.all([
                localDb.getAllEvents('local'),
                localDb.getAllTags('local'),
                localDb.getAllMedia('local'),
                localDb.getGigiJournal('local')
            ]);
            for (const e of events) await appDataService.saveEvent(user.id, e);
            for (const t of tags) await appDataService.saveTag(user.id, t);
            for (const m of media) await appDataService.saveMedia(user.id, m);
            for (const j of journal) await appDataService.saveGigiJournalEntry(user.id, j);
            addToast("Rescue complete!", 'success');
            setLocalRescueCount(0);
        } catch (e) {
            addToast("Rescue failed.", 'error');
        } finally {
            setIsRescuing(false);
        }
    };

    const handleMigrateToCloud = async () => {
        setMigrationStatus({ active: true, current: 0, total: 0 });
        try {
            await appDataService.migrateMediaToCloud(user.id, (current, total) => setMigrationStatus({ active: true, current, total }));
            addToast("Migration complete!", 'success');
        } catch (e) {
            addToast("Error during migration.", 'error');
        } finally {
            setMigrationStatus(prev => ({ ...prev, active: false }));
        }
    };

    const handleDeleteMedia = (mediaId: string) => {
        if (window.confirm("Remove image from gallery?")) {
            setFormData(prev => ({
                ...prev,
                mediaIds: prev.mediaIds?.filter(id => id !== mediaId) || []
            }));
            setViewingMedia(null);
        }
    };

    const handlePersonalIncinerate = async () => {
        if (!user?.id) {
            addToast("System Error: No valid session.", "error");
            return;
        }

        setIsIncinerating(true);
        addToast("🔥 Initializing Neural Snap...", "info");

        try {
            // 1. BACKUP
            const history = await appDataService.getChatHistory(user.id);
            if (history.length > 0) {
                const dataStr = JSON.stringify(history, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `personal-archive-snap-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

            // 2. TRIGGER ANIMATION
            window.dispatchEvent(new CustomEvent('incinerate-chat'));
            addToast("🔥 Disintegrating Personal Memplex...", "info");

            // 3. DELAY
            await new Promise(r => setTimeout(r, 4500));

            // 4. PURGE
            await appDataService.deleteChatHistory(user.id);

            addToast("✨ Incineration Successful. The past is gone.", "success");
            alert("Memplex Incinerated. Your conversational history has been cleared.");
        } catch (e) {
            console.error("[Incinerator] Personal Sequence Failed", e);
            addToast("❌ Snap Failure. Data preserved.", "error");
        } finally {
            setIsIncinerating(false);
        }
    };

    return {
        formData, setFormData,
        profilePicPreview, setProfilePicPreview,
        imageToCrop, setImageToCrop,
        isSaving,
        legacyImportStatus, setLegacyImportStatus,
        isResetting,
        isSettingsModalOpen, setIsSettingsModalOpen,
        viewingMedia, setViewingMedia,
        activeTab, setActiveTab,
        isMatrixOpen, setIsMatrixOpen,
        migrationStatus,
        localRescueCount,
        isRescuing,
        isIncinerating,
        legacyImportFileRef,
        userMedia,
        avatarInputRef, // [ZEN NEW]

        handleInputChange,
        handleAvatarFileSelect, // [ZEN NEW]
        handleRemoveAvatar,     // [ZEN NEW]
        handleRepositionAvatar, // [ZEN NEW]
        handleAutoGenTheme,     // [ZEN NEW]

        handleCropComplete,
        handleSaveChanges,
        handleLegacyFileSelected,
        handleStartLegacyImport,
        handleResetAndSeed,
        handleRescueLocalData,
        handleMigrateToCloud,
        handleDeleteMedia,
        handlePersonalIncinerate
    };
};