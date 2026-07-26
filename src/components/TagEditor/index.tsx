import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { Tag, Media, Settings, User as UserType } from '../../types';
import { AvatarCropper } from '../AvatarCropper';
import { getStaticMapUrl } from '../../utils/googleMapsLoader';
import { InteractiveMap } from '../InteractiveMap';
import { groupAssetsByMonth } from '../../utils/dateGrouper';
import AddTagModal from '../AddTagModal';
import SelectionActionsBar from '../SelectionActionsBar';
import { appDataService } from '../../services/serviceManager';
import { ReportService } from '../../services/reportService';
import MatrixSelector from '../media/MatrixSelector';
// [ZEN EWO 001] FaceRecognitionService removed - migrated to Azure Vision
import { MediaEditor } from '../media/MediaEditor';
import { filterSystemAssets } from '../matrix/MatrixShared';
import { getGlobalTagSuggestions } from '../../services/GlobalTags';
import { GedcomInspector } from '../gedcom/GedcomInspector'; // [ZEN] Import Inspector
import { formatFullName } from '../../utils/formatters';
import { uploadFile } from '../../services/storageService';

// Sub-Components
import { TagEditorHeader } from './TagEditorHeader';
import { TagEditorFooter } from './TagEditorFooter';
import { TagEditorTabs } from './TagEditorTabs';
import { TagEditorSidebar } from './TagEditorSidebar';

export type TabType = 'identity' | 'contact' | 'life' | 'lifestory' | 'bio' | 'connections' | 'gallery' | 'general' | 'details' | 'private' | 'chassis' | 'simulacrum' | 'tensors' | 'reflux';

const GOOGLE_MAPS_PLACEHOLDER = "/Google_Maps_icon-icons.com_75717.png";

interface TagEditorProps {
    tag: Tag;
    allTags: Tag[];
    allMedia: Media[];
    user: UserType;
    onSave: (tag: Tag, isSilent?: boolean) => Promise<void>;
    onUploadAvatar: (file: Blob) => Promise<string>;
    onCancel: () => void;
    onDiscuss: (tag: Tag) => void;
    createDefaultMetadata: (type: string) => any;
    settings?: Settings;
    onLoadTagId?: (id: string) => void;
    initialTab?: TabType;
    isAdversarial?: boolean;
    resumeSessionId?: string;
}

const TagEditor: React.FC<TagEditorProps> = ({ tag, allTags, allMedia, user, onSave, onUploadAvatar, onCancel, onDiscuss, createDefaultMetadata, settings, onLoadTagId, initialTab, isAdversarial, resumeSessionId }) => {

    // Determine Primary Companion for Logic/Voice
    const primaryCompanion = (Array.isArray(user?.aiCompanions) && user.aiCompanions.length > 0)
        ? (user.aiCompanions.find(c => c?.isPrimary) || user.aiCompanions[0])
        : { id: 'ai', name: 'AI', role: 'assistant', isPrimary: true } as any;
    const aiName = primaryCompanion ? primaryCompanion.name : "AI";

    const [formData, setFormData] = useState<Tag>(() => {
        const initial = { ...tag };
        if (!initial.metadata || Object.keys(initial.metadata).length === 0) {
            initial.metadata = createDefaultMetadata(initial.type);
        }
        if (!initial.keywords) initial.keywords = [];
        return initial;
    });

    const [activeTab, setActiveTab] = useState<TabType>(initialTab || (tag.type === 'person' ? 'identity' : 'general'));
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [isDirty, setIsDirty] = useState(false);
    const [showInteractiveMapModal, setShowInteractiveMapModal] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [stagedAvatarBlob, setStagedAvatarBlob] = useState<Blob | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [galleryViewMode, setGalleryViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [showAddTagModal, setShowAddTagModal] = useState(false);
    const [showGedcomInspector, setShowGedcomInspector] = useState(false); // [ZEN] Inspector State
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [localUploadedMedia, setLocalUploadedMedia] = useState<Media[]>([]);

    const [isMatrixOpen, setIsMatrixOpen] = useState(false);
    const [matrixMode, setMatrixMode] = useState<'avatar' | 'gallery'>('avatar');
    const [isEnrolling, setIsEnrolling] = useState(false);

    const [editingAsset, setEditingAsset] = useState<Media | null>(null);
    const [deletedMediaIds, setDeletedMediaIds] = useState<Set<string>>(new Set());

    const [contextSearch, setContextSearch] = useState('');
    const [contextSuggestions, setContextSuggestions] = useState<string[]>([]);
    const [userPresets, setUserPresets] = useState<any[]>([]);
    const [isSidebarForceOpen, setIsSidebarForceOpen] = useState(false);

    useEffect(() => {
        if (activeTab === 'simulacrum') {
            setIsSidebarForceOpen(false);
        }
    }, [activeTab]);

    useEffect(() => {
        const fetchPresets = async () => {
            try {
                const presets = await appDataService.getUserPresets(user.id);
                setUserPresets(presets);
            } catch (e) {
                console.error("[TagEditor] Failed to fetch presets", e);
            }
        };
        fetchPresets();
    }, [user.id]);

    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const personTabs: { id: TabType, label: string }[] = [
        { id: 'identity', label: 'Identity' },
        { id: 'lifestory', label: 'Life Story' }, // [ZEN] New Timeline Tab
        { id: 'contact', label: 'Contact' },
        { id: 'life', label: 'Life & Work' },
        { id: 'bio', label: 'Bio & Notes' },
        { id: 'connections', label: 'Connections' },
        ...(formData.isFiction ? [{ id: 'chassis' as TabType, label: '3D Chassis' }] : []),
        { id: 'simulacrum', label: 'Simulacrum' },
        { id: 'tensors' as TabType, label: 'Expressive Range' },
        { id: 'reflux' as TabType, label: 'Platinum Reflux' },
        { id: 'gallery', label: 'Gallery' },
        { id: 'private', label: 'Private' }
    ];
    const genericTabs: { id: TabType, label: string }[] = [
        { id: 'general', label: 'General' }, { id: 'details', label: 'Details' }, { id: 'connections', label: 'Connections' },
        { id: 'gallery', label: 'Gallery' }, { id: 'private', label: 'Private' }
    ];
    const currentTabs = formData.type === 'person' ? personTabs : genericTabs;

    // [ZEN EWO 001] Face model preloading removed - using Azure Vision cloud

    useEffect(() => {
        // [ZEN FIX] If the tag ID changes, OR if the incoming tag finally receives its hydrated metadata
        // but our formData is stuck as an empty shell, we MUST force an update.
        const hasHydratedMetadata = tag.metadata && Object.keys(tag.metadata).length > 0;
        const formIsMissingMetadata = !formData.metadata || Object.keys(formData.metadata).length === 0 || (!formData.metadata.givenName && !formData.metadata.familyName);
        
        if (tag.id !== formData.id || (hasHydratedMetadata && formIsMissingMetadata)) {
            setFormData({ 
                ...tag, 
                metadata: tag.metadata && Object.keys(tag.metadata).length > 0 ? tag.metadata : createDefaultMetadata(tag.type),
                keywords: tag.keywords || [] 
            });
            setStagedAvatarBlob(null);
        }
    }, [tag.id, tag.metadata, tag.updatedAt]);

    useEffect(() => {
        if (stagedAvatarBlob) return;
        const targetImageId = tag.mainImageId;
        if (!targetImageId) {
            setAvatarPreview(null);
            return;
        }
        const existingMedia = allMedia.find(m => m.id === targetImageId);
        if (existingMedia) {
            const url = existingMedia.thumbnailUrl || existingMedia.url || existingMedia.base64Data;
            if (avatarPreview !== url) setAvatarPreview(url || null);
        }
    }, [tag.mainImageId, allMedia, stagedAvatarBlob]);

    useEffect(() => {
        if (!isDirty) return;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

        autoSaveTimerRef.current = setTimeout(async () => {
            try {
                await handleFinalSave(true, undefined, true);
                setIsDirty(false);
            } catch (e) {
                console.error("Auto-save failed", e);
            }
        }, 3000);
        return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
    }, [formData, isDirty]);

    // --- Suggestion Logic ---
    useEffect(() => {
        if (contextSearch.trim().length > 1) {
            const suggestions = getGlobalTagSuggestions(contextSearch, allTags);
            setContextSuggestions(suggestions);
        } else {
            setContextSuggestions([]);
        }
    }, [contextSearch, allTags]);

    const updateFormData = (newData: Tag) => {
        setFormData(newData);
        setIsDirty(true);
    };

    const handleMetadataChange = (newMetadata: any) => {
        setFormData(prev => ({ ...prev, metadata: newMetadata } as Tag));
        setIsDirty(true);
    };

    const handleChange = (field: keyof Tag, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value } as Tag));
        setIsDirty(true);
    };

    const handleTypeChange = (newType: Tag['type']) => {
        const newMetadata = createDefaultMetadata(newType);
        updateFormData({ ...formData, type: newType, metadata: newMetadata } as Tag);
        setActiveTab(newType === 'person' ? 'identity' : 'general');
    };

    const handleAddKeyword = (keyword: string) => {
        if (!keyword.trim()) return;
        const currentKeywords = formData.keywords || [];
        if (!currentKeywords.includes(keyword)) {
            updateFormData({
                ...formData,
                keywords: [...currentKeywords, keyword]
            });
        }
        setContextSearch('');
        setContextSuggestions([]);
    };

    const handleRemoveKeyword = (keywordToRemove: string) => {
        const currentKeywords = formData.keywords || [];
        updateFormData({
            ...formData,
            keywords: currentKeywords.filter(k => k !== keywordToRemove)
        });
    };

    const handleLoadTag = (newTag: Tag) => {
        if (onLoadTagId) {
            onLoadTagId(newTag.id);
        } else {
            setFormData({ ...newTag, keywords: newTag.keywords || [] });
            setStagedAvatarBlob(null);
            let initialPreviewUrl: string | null = null;
            if (newTag.mainImageId) {
                const found = allMedia.find(m => m.id === newTag.mainImageId);
                if (found) initialPreviewUrl = found.thumbnailUrl || found.url;
            }
            setAvatarPreview(initialPreviewUrl);
            setIsDirty(false);
        }
    };

    // [ZEN EWO 001] handleEnrollFace removed - migrated to Azure Vision cloud
    const handleEnrollFace = async () => {
        alert("Face ID enrollment has been migrated to cloud processing. This feature will be re-enabled in a future update.");
    };

    const openMatrix = (mode: 'avatar' | 'gallery') => {
        setMatrixMode(mode);
        setIsMatrixOpen(true);
    };

    const handleMatrixSelect = (media: Media | Media[]) => {
        setIsMatrixOpen(false);
        const selectedAssets = Array.isArray(media) ? media : [media];
        if (selectedAssets.length === 0) return;

        if (matrixMode === 'avatar') {
            const first = selectedAssets[0];
            const url = first.thumbnailUrl || first.url;
            setAvatarPreview(url);
            updateFormData({ ...formData, mainImageId: first.id });
        } else {
            const currentIds = formData.mediaIds || [];
            const newIds = selectedAssets
                .map(m => m.id)
                .filter(id => !currentIds.includes(id));
            if (newIds.length > 0) {
                updateFormData({ ...formData, mediaIds: [...currentIds, ...newIds] });
            }
        }
    };

    const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setRawImageSrc(reader.result?.toString() || null);
                setIsCropping(true);
            });
            reader.readAsDataURL(e.target.files[0]);
            e.target.value = '';
        }
    };

    const handleCropComplete = (croppedImageUrl: string) => {
        setAvatarPreview(croppedImageUrl);
        setRawImageSrc(null);
        setIsCropping(false);
        fetch(croppedImageUrl).then(res => res.blob()).then(async (blob) => {
            setStagedAvatarBlob(blob);
            setIsDirty(true);
            await handleFinalSave(true, blob);
        });
    };

    const handleReCrop = () => {
        if (avatarPreview) {
            setRawImageSrc(avatarPreview);
            setIsCropping(true);
        }
    };

    const generateTheme = () => {
        const canvas = document.createElement('canvas');
        const size = 512;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let hash = 0;
        const str = formData.name + formData.type;
        for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
        const c1 = `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
        const c2 = `hsl(${Math.abs(hash >> 8) % 360}, 60%, 40%)`;
        const c3 = `hsl(${Math.abs(hash >> 16) % 360}, 80%, 70%)`;
        const grd = ctx.createLinearGradient(0, 0, size, size);
        grd.addColorStop(0, c1); grd.addColorStop(1, c2);
        ctx.fillStyle = grd; ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = c3; ctx.globalAlpha = 0.3;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(Math.abs((hash >> i) % size), Math.abs((hash >> (i + 2)) % size), Math.abs((hash >> (i + 4)) % 200) + 50, 0, 2 * Math.PI); ctx.fill(); }
        ctx.globalAlpha = 1.0; ctx.fillStyle = "white"; ctx.font = "bold 240px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const initial = formData.name ? formData.name.charAt(0).toUpperCase() : "?";
        ctx.fillText(initial, size / 2, size / 2);
        canvas.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                setAvatarPreview(url);
                setStagedAvatarBlob(blob);
                setIsDirty(true);
                handleFinalSave(true, blob);
            }
        }, 'image/png');
    };

    const handleFinalSave = async (silent: boolean = false, avatarBlobOverride?: Blob, isAutoSave: boolean = false): Promise<boolean> => {
        if (!isAutoSave) setSaveState('saving');
        try {
            let updatedFormData = { ...formData };
            if (formData.type === 'person') {
                // [ZEN] Ensure we have a fresh metadata object to modify
                const m = { ...formData.metadata } as any;
                
                // [ZEN] Auto-populate displayName if blank to satisfy the Deck Sweeper
                // Fallback order: Nickname -> First Name -> Base Name
                if (!m.displayName?.trim()) {
                    m.displayName = m.alternateName?.trim() || m.givenName?.trim() || "";
                }
                
                const targetName = m.displayName?.trim() || formatFullName(m, false);
                if (targetName) updatedFormData.name = targetName;
                updatedFormData.metadata = m;
            }
            const blobToUpload = avatarBlobOverride || stagedAvatarBlob;
            if (blobToUpload) {
                const newMediaId = await onUploadAvatar(blobToUpload);
                if (newMediaId) {
                    updatedFormData = {
                        ...updatedFormData,
                        mainImageId: newMediaId
                    };
                    setFormData(updatedFormData);
                    setAvatarPreview(URL.createObjectURL(blobToUpload));
                    setStagedAvatarBlob(null);
                } else {
                    throw new Error("Avatar upload failed");
                }
            }
            await onSave(updatedFormData, silent);
            if (!isAutoSave) {
                setSaveState('saved');
                setTimeout(() => setSaveState('idle'), 2000);
            }
            setIsDirty(false);
            return true;
        } catch (e) {
            console.error("Save failed", e);
            if (!isAutoSave) setSaveState('idle');
            return false;
        }
    };

    const handleDirectUploadMedia = async (files: File[]) => {
        if (!files || files.length === 0) return;
        setIsUploadingMedia(true);
        try {
            let uploadedCount = 0;
            const newMediaIds: string[] = [];
            const newlyCreatedObjects: Media[] = [];

            for (const file of files) {
                const { url, base64 } = await uploadFile(file, user.id);

                const newMedia: Media = {
                    id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    url: url || '',
                    thumbnailUrl: url || '',
                    base64Data: base64 || undefined,
                    fileName: file.name,
                    originalName: file.name,
                    title: file.name.split('.')[0] || 'Direct Accession',
                    fileType: file.type || 'application/octet-stream',
                    size: file.size,
                    caption: `Direct accession for ${formData.name}`,
                    uploadDate: new Date(),
                    isFiction: formData.isFiction || false,
                    universeIds: formData.universeIds || [],
                    tagIds: [formData.id],
                    status: 'clean'
                } as any;

                await appDataService.saveMedia(user.id, newMedia);
                newMediaIds.push(newMedia.id);
                newlyCreatedObjects.push(newMedia);
                uploadedCount++;
            }

            if (newMediaIds.length > 0) {
                setLocalUploadedMedia(prev => [...prev, ...newlyCreatedObjects]);
                const updatedMediaIds = [...(formData.mediaIds || []), ...newMediaIds];
                const updatedForm = { ...formData, mediaIds: updatedMediaIds };
                updateFormData(updatedForm);
                await handleFinalSave(true);
                alert(`Successfully uploaded and accessioned ${uploadedCount} file(s) into ${formData.isFiction ? 'fictional lore' : 'reality'} sovereignty!`);
            }
        } catch (e) {
            console.error("[TagEditor] Direct upload failed:", e);
            alert("Direct upload failed. Please try again.");
        } finally {
            setIsUploadingMedia(false);
        }
    };

    const relatedMedia = useMemo(() => {
        const combined = [...allMedia, ...localUploadedMedia];
        const uniqueMedia = combined.filter((m, index, self) =>
            self.findIndex(x => x.id === m.id) === index
        );
        const linkedMedia = uniqueMedia.filter(m =>
            ((m.tagIds && m.tagIds.includes(formData.id)) || (m.id === formData.mainImageId)) &&
            !deletedMediaIds.has(m.id)
        );
        return filterSystemAssets(linkedMedia);
    }, [allMedia, localUploadedMedia, formData.id, formData.mainImageId, deletedMediaIds]);

    const groupedAssets = useMemo(() => {
        return groupAssetsByMonth(relatedMedia);
    }, [relatedMedia]);

    const handleMediaClick = (media: Media) => {
        if (isSelectionMode) {
            const newSet = new Set(selectedMediaIds);
            if (newSet.has(media.id)) newSet.delete(media.id);
            else newSet.add(media.id);
            setSelectedMediaIds(newSet);
        } else {
            setEditingAsset(media);
        }
    };

    const handleDeleteAsset = async (id: string) => {
        try {
            await appDataService.deleteMedia(user.id, id);
            setDeletedMediaIds(prev => new Set(prev).add(id));
            setEditingAsset(null);
        } catch (e) {
            console.error("Delete failed", e);
            alert("Could not delete artifact.");
        }
    };

    const handleBatchDeleteAssets = async () => {
        if (selectedMediaIds.size === 0) return;
        if (window.confirm(`⚠️ DANGER: You are about to PERMANENTLY DELETE ${selectedMediaIds.size} files from the archive.\n\nThis cannot be undone. Are you sure?`)) {
            let deletedCount = 0;
            for (const id of Array.from(selectedMediaIds)) {
                try {
                    await appDataService.deleteMedia(user.id, id);
                    setDeletedMediaIds(prev => new Set(prev).add(id));
                    deletedCount++;
                } catch (e) {
                    console.error("Failed to delete", id);
                }
            }
            setSelectedMediaIds(new Set());
            setIsSelectionMode(false);
            if (deletedCount > 0) alert(`Deleted ${deletedCount} files.`);
        }
    };

    const handleLinkTag = async (targetTag: Tag) => {
        if (!formData.tagIds.includes(targetTag.id)) {
            const updatedTagIds = [...(formData.tagIds || []), targetTag.id];
            updateFormData({ ...formData, tagIds: updatedTagIds });
        }
        setShowAddTagModal(false);
    };

    const handleBatchAlias = async (targetTag: Tag) => {
        if (!user) return;
        const selectedAssets = relatedMedia.filter(m => selectedMediaIds.has(m.id));
        for (const asset of selectedAssets) {
            if (!asset.tagIds.includes(targetTag.id)) {
                const updatedAsset = { ...asset, tagIds: [...asset.tagIds, targetTag.id] };
                await appDataService.saveMedia(user.id, updatedAsset);
            }
        }
        setShowAddTagModal(false);
        setSelectedMediaIds(new Set());
        setIsSelectionMode(false);
        alert(`Linked ${selectedAssets.length} items to "${targetTag.name}".`);
    };

    const handleBatchUnlink = async () => {
        if (!user) return;
        const selectedAssets = relatedMedia.filter(m => selectedMediaIds.has(m.id));
        if (!confirm(`Remove "${formData.name}" tag from ${selectedAssets.length} items?`)) return;
        for (const asset of selectedAssets) {
            const updatedTagIds = asset.tagIds.filter(id => id !== formData.id);
            const updatedAsset = { ...asset, tagIds: updatedTagIds };
            await appDataService.saveMedia(user.id, updatedAsset);
        }
        setSelectedMediaIds(new Set());
        setIsSelectionMode(false);
    };

    const handleGeneratePDF = async () => {
        const selectedAssets = relatedMedia.filter(m => selectedMediaIds.has(m.id));
        if (selectedAssets.length === 0) return;
        try {
            const blob = await ReportService.generateAssetReport(selectedAssets as any, `Media Collection: ${formData.name}`, user.displayName);
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (e) {
            console.error("PDF Gen Failed", e);
            alert("Failed to generate PDF.");
        }
    };

    const headerContent = useMemo(() => {
        if (formData.type === 'unknown') {
            return { title: "Create New Entity", description: "Select a category to begin." };
        }

        const typeLabel = formData.type.charAt(0).toUpperCase() + formData.type.slice(1);
        const nameLabel = formData.name || typeLabel;

        if (formData.type === 'person') {
            const meta = formData.metadata as any;
            const friendlyName = meta.displayName || meta.alternateName || meta.givenName || formData.name || "this person";
            return { title: `Tell me about ${friendlyName}`, description: "Refine their story and details." };
        }

        return {
            title: `Edit ${nameLabel}`,
            description: "Refine the details of this item in your archive."
        };
    }, [formData.name, formData.type, formData.metadata]);

    const renderCropperModal = () => {
        if (!isCropping || !rawImageSrc) return null;
        if (typeof document === 'undefined') return null;
        return createPortal(<AvatarCropper imageSrc={rawImageSrc} onCropComplete={handleCropComplete} onCancel={() => setIsCropping(false)} />, document.body);
    };

    const renderMediaEditor = () => {
        if (!editingAsset) return null;
        if (typeof document === 'undefined') return null;
        return createPortal(
            <MediaEditor
                asset={editingAsset}
                onClose={() => setEditingAsset(null)}
                userId={user.id}
                allTags={allTags}
                onUpdateAsset={(updated) => { setEditingAsset(null); }}
                userSettings={settings}
                onDelete={handleDeleteAsset}
            />,
            document.body
        );
    };

    const meta = formData.metadata as any;
    const lat = meta?.address?.coordinates?.lat || meta?.coordinates?.lat;
    const lng = meta?.address?.coordinates?.lng || meta?.coordinates?.lng;
    const hasCoords = lat && lng;
    const mapZoom = meta?.mapZoom || 14;
    const staticMapUrl = hasCoords
        ? getStaticMapUrl(lat, lng, mapZoom, settings?.googleMapsApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '')
        : GOOGLE_MAPS_PLACEHOLDER;

    return createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[150] p-2 md:p-8">
            <div className="bg-[#0f1219] rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-5xl h-full md:h-[85vh] border border-white/10 flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-300">

                <TagEditorHeader
                    title={headerContent.title}
                    description={headerContent.description}
                    saveState={saveState}
                    onClose={onCancel}
                />

                <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">

                    {/* [ZEN FIX] Ribbon Logic */}
                    {selectedMediaIds.size > 0 && (
                        <div className="absolute bottom-4 left-0 right-0 z-[50] flex justify-center px-4">
                            <div className="w-full max-w-2xl">
                                <SelectionActionsBar
                                    selectedCount={selectedMediaIds.size}
                                    onClearSelection={() => setSelectedMediaIds(new Set())}
                                    onAlias={() => setShowAddTagModal(true)}
                                    onUnlink={handleBatchUnlink}
                                    onDelete={handleBatchDeleteAssets}
                                    onPDF={handleGeneratePDF}
                                />
                            </div>
                        </div>
                    )}

                    <TagEditorSidebar
                        tag={formData}
                        allTags={allTags}
                        onLoadTag={handleLoadTag}
                        avatarPreview={avatarPreview}
                        tagName={formData.name}
                        tagType={formData.type}
                        hasCoords={hasCoords}
                        staticMapUrl={staticMapUrl}
                        metaAddressLocality={meta.address?.addressLocality || meta.addressLocality}
                        metaAddressRegion={meta.address?.addressRegion || meta.addressRegion}
                        fileInputRef={avatarInputRef}
                        onFileSelect={onSelectFile}
                        onTriggerFileInput={() => avatarInputRef.current?.click()}
                        onShowMatrixSelector={() => openMatrix('avatar')}
                        onRemoveAvatar={() => { setAvatarPreview(null); updateFormData({ ...formData, mainImageId: undefined }); }}
                        onReCrop={handleReCrop}
                        onGenerateTheme={generateTheme}
                        onMapClick={() => hasCoords && setShowInteractiveMapModal(true)}
                        isCollapsed={activeTab === 'simulacrum' && !isSidebarForceOpen}
                    />

                    <div className="flex-1 flex flex-col overflow-hidden bg-[#0f1219] min-w-0 relative">
                        {/* TOGGLE BUTTON FOR DRAWER (Only when on Simulacrum Tab) */}
                        {activeTab === 'simulacrum' && (
                            <button
                                onClick={() => setIsSidebarForceOpen(!isSidebarForceOpen)}
                                className="absolute left-0 top-1/2 -translate-y-1/2 z-50 bg-slate-800/80 hover:bg-slate-700 p-1 py-4 rounded-r-lg border border-l-0 border-white/10 text-slate-400 hover:text-white transition-colors shadow-lg"
                                title={isSidebarForceOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                            >
                                {isSidebarForceOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                            </button>
                        )}

                        {/* [ZEN FIX] Wrapping Tabs Container */}
                        <div className="flex flex-wrap border-b border-white/5 pl-4 pr-12 bg-[#13161f]">
                            {currentTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    // [ZEN FIX] whitespace-nowrap to prevent text wrapping inside the button, but allow the button itself to wrap to next line
                                    className={`px-4 py-3 font-bold text-xs uppercase tracking-wider transition-all relative flex items-center justify-center text-center whitespace-nowrap ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {tab.label}
                                    {activeTab === tab.id && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-violet-500 shadow-[0_0_10px_#8b5cf6]"></span>}
                                </button>
                            ))}
                        </div>

                        <TagEditorTabs
                            activeTab={activeTab}
                            isAdversarial={isAdversarial}
                            resumeSessionId={resumeSessionId}
                            formData={formData}
                            allTags={allTags}
                            allMedia={allMedia}
                            settings={settings}
                            onChange={handleChange}
                            onMetadataChange={handleMetadataChange}
                            onTypeChange={handleTypeChange}
                            onEnrollFace={handleEnrollFace}
                            isEnrolling={isEnrolling}
                            relatedMedia={relatedMedia}
                            groupedAssets={groupedAssets}
                            galleryViewMode={galleryViewMode}
                            setGalleryViewMode={setGalleryViewMode}
                            isSelectionMode={isSelectionMode}
                            setIsSelectionMode={setIsSelectionMode}
                            selectedMediaIds={selectedMediaIds}
                            setSelectedMediaIds={setSelectedMediaIds}
                            openMatrix={openMatrix}
                            handleMediaClick={handleMediaClick}
                            handleBatchUnlink={handleBatchUnlink}
                            handleDeleteAsset={handleDeleteAsset}
                            setShowAddTagModal={setShowAddTagModal}
                            updateFormData={updateFormData}
                            onDirectUploadMedia={handleDirectUploadMedia}
                            isUploadingMedia={isUploadingMedia}

                            // [ZEN] GEDCOM Integration
                            onOpenGedcom={() => setShowGedcomInspector(true)}

                            // Context props
                            contextSearch={contextSearch}
                            setContextSearch={setContextSearch}
                            contextSuggestions={contextSuggestions}
                            onAddKeyword={handleAddKeyword}
                            onRemoveKeyword={handleRemoveKeyword}

                            // [ZEN FIX] Pass Primary Companion for Sherlock Logic
                            primaryCompanion={primaryCompanion}
                            userId={user.id}
                            userPresets={userPresets}
                        />
                    </div>
                </div>

                <TagEditorFooter
                    tag={formData}
                    aiName={aiName}
                    saveState={saveState}
                    isDirty={isDirty}
                    onDiscuss={onDiscuss}
                    onCancel={onCancel}
                    onSave={async () => { 
                        if (isDirty || saveState === 'saving') {
                            const success = await handleFinalSave(false);
                            if (success) {
                                onCancel(); // Exit after manual save
                            } else {
                                alert("Failed to save avatar or tag. Please try again.");
                            }
                        } else {
                            onCancel(); 
                        }
                    }}

                    // Passing Batch Props
                    selectedCount={selectedMediaIds.size}
                    onClearSelection={() => { setIsSelectionMode(false); setSelectedMediaIds(new Set()); }}
                    onBatchDelete={handleBatchDeleteAssets}
                    onBatchUnlink={handleBatchUnlink}
                    onBatchAlias={() => setShowAddTagModal(true)}
                    onPDF={handleGeneratePDF}
                />
            </div>

            {isMatrixOpen && (
                <MatrixSelector
                    onClose={() => setIsMatrixOpen(false)}
                    onSelect={handleMatrixSelect}
                    userId={user.id}
                />
            )}

            {showInteractiveMapModal && hasCoords && formData.type !== 'pet' && (
                <InteractiveMap
                    lat={lat}
                    lng={lng}
                    apiKey={settings?.googleMapsApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}
                    onClose={() => setShowInteractiveMapModal(false)}
                />
            )}

            {showAddTagModal && (
                <AddTagModal
                    allTags={allTags}
                    excludeTagId={formData.id}
                    onClose={() => setShowAddTagModal(false)}
                    onSelect={handleLinkTag}
                />
            )}

            {showGedcomInspector && formData.type === 'person' && createPortal(
                <GedcomInspector
                    currentPerson={formData as any}
                    user={user}
                    onUpdateTag={(updated) => { updateFormData(updated); }}
                    onClose={() => setShowGedcomInspector(false)}
                />,
                document.body
            )}

            {renderCropperModal()}
            {renderMediaEditor()}
        </div>,
        document.body
    );
};

export default TagEditor;