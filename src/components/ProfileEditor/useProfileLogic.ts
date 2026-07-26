import { useState, useRef, useEffect, useMemo } from 'react';
import type { User, Toast, Media, ImportStatus, View } from '../../types';
import { parseLegacyData, processGenieArchive } from '../../services/importer';
import { appDataService } from '../../services/serviceManager';
import { uploadFile, dataURLToBlob } from '../../services/storageService';
import { validateSlugSyntax } from '../../utils/slugValidator';
import * as localDb from '../../services/localDbService';
import { filterSystemAssets } from '../matrix/MatrixShared';
import { googlePhotosService } from '../../services/googlePhotosService';

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
    const [activeTab, setActiveTab] = useState<'identity' | 'career' | 'gallery' | 'controls' | 'intelligence'>('identity');
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
    const [isGoogleLinked, setIsGoogleLinked] = useState<boolean | null>(null);

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

    useEffect(() => {
        const checkGoogleLink = async () => {
            const linked = await googlePhotosService.checkLinkStatus();
            setIsGoogleLinked(linked);
        };
        if (activeTab === 'controls') checkGoogleLink();
    }, [activeTab]);

    // Filtered Gallery
    const userMedia = useMemo(() => {
        const safeAllMedia = allMedia || [];
        const rawMedia = (formData.mediaIds || [])
            .map(id => safeAllMedia.find(m => m.id === id))
            .filter((m): m is Media => !!m);

        return filterSystemAssets(rawMedia);
    }, [formData.mediaIds, allMedia]);

    // --- Handlers ---

    // [ZEN FIX] Phone Number Formatter
    const formatPhoneNumber = (value: string) => {
        if (!value) return value;
        const phoneNumber = value.replace(/[^\d]/g, '');
        const phoneNumberLength = phoneNumber.length;
        if (phoneNumberLength < 4) return phoneNumber;
        if (phoneNumberLength < 7) {
            return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
        }
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        
        let finalValue = value;
        if (id === 'phoneNumber') {
            finalValue = formatPhoneNumber(value);
        }

        if (id.includes('.')) {
            const [parent, child] = id.split('.');
            setFormData(prev => ({ ...prev, [parent]: { ...(prev[parent as keyof User] as object), [child]: finalValue } } as User));
        } else {
            setFormData(prev => ({ ...prev, [id]: finalValue }));
        }
    };

    const handleAddressChange = (addressData: any) => {
        setFormData(prev => ({
            ...prev,
            address: {
                ...prev.address,
                street: addressData.streetAddress,
                city: addressData.addressLocality,
                state: addressData.addressRegion,
                zip: addressData.postalCode,
                address2: prev.address.address2 // Preserve address2 if manual
            }
        }));
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

        // --- Phase 2: Anti-Collision Slug Validations ---
        let finalSlug = formData.publicSlug;
        if (finalSlug && finalSlug !== user.publicSlug) {
            const validation = validateSlugSyntax(finalSlug);

            if (!validation.isValid) {
                addToast(validation.error || "Invalid Username Syntax.", "error");
                setIsSaving(false);
                return; // Halt Save
            }

            finalSlug = validation.cleanSlug;

            // Query Database Index safely via AppData wrapper
            if (appDataService.checkSlugAvailability) {
                const isAvailable = await appDataService.checkSlugAvailability(finalSlug, user.id);
                if (!isAvailable) {
                    addToast(`"@${finalSlug}" is unavailable. Generating equivalents...`, "warning");
                    if (appDataService.generateSlugAlternatives) {
                        const alts = await appDataService.generateSlugAlternatives(finalSlug);
                        if (alts.length > 0) {
                            addToast(`Available suggestions: ${alts.join(', ')}`, "info");
                        }
                    }
                    setIsSaving(false);
                    return; // Halt Save
                }
            }
        }

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
            publicSlug: finalSlug, // Mount the deeply sanitized slug
            profilePictureUrl: finalAvatarUrl,
        };

        onUserUpdate(updatedUser);

        // Verify clearance to determine immediate activation vs queuing
        const clearance = updatedUser.securityClearance || 0;
        if (finalSlug && finalSlug !== user.publicSlug && clearance < 10) {
            addToast("Your Vanity URL has been queued for verification by a Level 10+ Administrator.", "info");
        } else {
            addToast("Profile updated successfully.", "success");
        }

        setIsSaving(false);
    };

    // ... (Legacy Import, Reset, Rescue, Migrate handlers remain the same as previous)
    const handleLegacyFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Check if it's a Genie (folder) import
        if (files.length > 1 || (e.target as any).webkitdirectory) {
            setLegacyImportStatus({ 
                type: 'confirming', 
                file: { name: `Archive Folder (${files.length} files)` } as any,
                isGenie: true,
                files: Array.from(files)
            } as any);
        } else {
            const file = files[0];
            setLegacyImportStatus({ type: 'confirming', file });
        }
        e.target.value = '';
    };

    const handleStartLegacyImport = async () => {
        if (legacyImportStatus.type !== 'confirming') return;
        
        // Genie Mode: Folder List
        if ((legacyImportStatus as any).isGenie && (legacyImportStatus as any).files) {
            try {
                setLegacyImportStatus({ type: 'loading', message: 'Genie is scanning archive volume...' });
                const result = await processGenieArchive(
                    (legacyImportStatus as any).files, 
                    user.id, 
                    (curr, tot, msg) => setLegacyImportStatus({ type: 'loading', message: `Genie: ${msg} (${curr}/${tot})` })
                );
                
                setLegacyImportStatus({ type: 'loading', message: 'Staging high-fidelity records...' });
                await appDataService.stageLegacyData(user.id, result);
                
                setLegacyImportStatus({ type: 'success', message: 'Genie Ingestion Successful! Redirecting...' });
                addToast('Genie has prepared your memories.', 'success');
                setTimeout(() => window.dispatchEvent(new CustomEvent('navigate-gateway')), 1500);
            } catch (error) {
                console.error("Genie failed", error);
                setLegacyImportStatus({ type: 'error', message: `Genie Error: ${error instanceof Error ? error.message : 'Unknown'}` });
            }
            return;
        }

        // Standard Mode: Single File
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                setLegacyImportStatus({ type: 'loading', message: 'Parsing legacy data...' });
                const parsedData = parseLegacyData(event.target?.result as string);
                setLegacyImportStatus({ type: 'loading', message: 'Staging records for review...' });
                await appDataService.stageLegacyData(user.id, parsedData);
                setLegacyImportStatus({ type: 'success', message: 'Data staged successfully! Redirecting to Gateway...' });
                addToast('Data staged for review.', 'success');
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('navigate-gateway'));
                }, 1500);
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

    const handleConnectGooglePhotos = async () => {
        try {
            addToast("Connecting to Google Photos...", "info");
            await googlePhotosService.connect();
            setIsGoogleLinked(true);
            addToast("Google Photos linked successfully!", "success");
        } catch (err: any) {
            console.error("Google Photos connection failed", err);
            addToast(`Connection failed: ${err.message}`, "error");
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
        addToast("🔥 Initializing Nuclear Purge Protocol...", "info");

        try {
            // 1. BACKUP (Safety first)
            const history = await appDataService.getChatHistory(user.id);
            if (history.length > 0) {
                const dataStr = JSON.stringify(history, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `ai-history-snap-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

            // 2. TRIGGER ANIMATION & NUCLEAR PURGE
            window.dispatchEvent(new CustomEvent('incinerate-chat'));

            // A. CLEAR CLOUD (Firestore + Typesense)
            // deleteChatHistory now calls purgeUserMemory internally
            await appDataService.deleteChatHistory(user.id);

            // B. CLEAR LOCAL (IndexedDB)
            // Import dbDelete dynamically or use existing localDb if available
            // In this file localDb is already imported as 'localDbService'
            // However, useProfileLogic already has 'localDb' imported from '../services/localDbService'
            // Let's check what localDbService exports.
            await localDb.deleteChatHistory(user.id);

            // 3. WAIT FOR ANIMATION
            await new Promise(r => setTimeout(r, 2000));

            addToast("✨ Nuclear Purge Successful. The past is forgotten.", "success");

            // Reload to ensure all states are clean
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            console.error("[Incinerator] Nuclear Sequence Failed", e);
            addToast("❌ Purge Failure. Data preserved.", "error");
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
        handleAddressChange,
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
        handlePersonalIncinerate,
        handleConnectGooglePhotos,
        isGoogleLinked
    };
};