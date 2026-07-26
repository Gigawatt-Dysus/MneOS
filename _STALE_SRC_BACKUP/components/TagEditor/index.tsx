import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Tag, Media, Settings, User as UserType } from '@/types';
import { ImageCropper } from '../ImageCropper';
import { getStaticMapUrl } from '../../utils/googleMapsLoader';
import { InteractiveMap } from '../InteractiveMap';
import { groupAssetsByMonth } from '../../utils/dateGrouper';
import AddTagModal from '../AddTagModal';
import SelectionActionsBar from '../SelectionActionsBar';
import { appDataService } from '../../services/serviceManager';
import { ReportService } from '../../services/reportService';
import MatrixSelector from '../media/MatrixSelector';
import { FaceRecognitionService } from '../../services/ai/faceRecognition';
import { MediaEditor } from '../media/MediaEditor';
import { getGlobalTagSuggestions } from '../../services/GlobalTags';

// Sub-Components
import { TagEditorHeader } from './TagEditorHeader';
import { TagEditorFooter } from './TagEditorFooter';
import { TagEditorTabs } from './TagEditorTabs';
import { TagEditorSidebar } from './TagEditorSidebar';

export type TabType = 'identity' | 'contact' | 'life' | 'bio' | 'connections' | 'gallery' | 'general' | 'details' | 'private';

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
}

const TagEditor: React.FC<TagEditorProps> = ({ tag, allTags, allMedia, user, onSave, onUploadAvatar, onCancel, onDiscuss, createDefaultMetadata, settings }) => {
    
    // Determine Primary Companion for Logic/Voice
    const primaryCompanion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
    const aiName = primaryCompanion ? primaryCompanion.name : "Gigi";

    const [formData, setFormData] = useState<Tag>(() => {
        const initial = { ...tag };
        if (!initial.metadata || Object.keys(initial.metadata).length === 0) {
            initial.metadata = createDefaultMetadata(initial.type);
        }
        if (!initial.keywords) initial.keywords = [];
        return initial;
    });

    const [activeTab, setActiveTab] = useState<TabType>(tag.type === 'person' ? 'identity' : 'general');
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
    
    const [isMatrixOpen, setIsMatrixOpen] = useState(false);
    const [matrixMode, setMatrixMode] = useState<'avatar' | 'gallery'>('avatar');
    const [isEnrolling, setIsEnrolling] = useState(false);

    const [editingAsset, setEditingAsset] = useState<Media | null>(null);
    const [deletedMediaIds, setDeletedMediaIds] = useState<Set<string>>(new Set());
    
    // Context Tagging State
    const [contextSearch, setContextSearch] = useState('');
    const [contextSuggestions, setContextSuggestions] = useState<string[]>([]);

    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const personTabs: {id: TabType, label: string}[] = [
        { id: 'identity', label: 'Identity' }, { id: 'contact', label: 'Contact' }, { id: 'life', label: 'Life & Work' },
        { id: 'bio', label: 'Bio & Notes' }, { id: 'connections', label: 'Connections' }, { id: 'gallery', label: 'Gallery' }, { id: 'private', label: 'Private' }
    ];
    const genericTabs: {id: TabType, label: string}[] = [
        { id: 'general', label: 'General' }, { id: 'details', label: 'Details' }, { id: 'connections', label: 'Connections' },
        { id: 'gallery', label: 'Gallery' }, { id: 'private', label: 'Private' }
    ];
    const currentTabs = formData.type === 'person' ? personTabs : genericTabs;

    useEffect(() => {
        FaceRecognitionService.loadModels().catch(err => console.warn("Background model load failed", err));
    }, []);

    useEffect(() => {
        if (tag.id !== formData.id) {
            setFormData({ ...tag, keywords: tag.keywords || [] });
            setStagedAvatarBlob(null);
        }
    }, [tag.id]);

    useEffect(() => {
        if (stagedAvatarBlob) return;
        const targetImageId = tag.mainImageId;
        if (!targetImageId) {
            setAvatarPreview(null);
            return;
        }
        const existingMedia = allMedia.find(m => m.id === targetImageId);
        if (existingMedia) {
            const url = existingMedia.thumbnailUrl || existingMedia.url;
            if (avatarPreview !== url) setAvatarPreview(url);
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
        updateFormData({ ...formData, metadata: newMetadata } as Tag);
    };

    const handleChange = (field: keyof Tag, value: any) => {
        updateFormData({ ...formData, [field]: value } as Tag);
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

    const handleEnrollFace = async () => {
        if (!avatarPreview) {
            alert("Please set a profile picture before enrolling Face ID.");
            return;
        }
        
        setIsEnrolling(true);
        try {
            const descriptor = await FaceRecognitionService.encodeReferenceFace(avatarPreview);
            
            if (descriptor) {
                const descriptorObj: Record<string, number> = {};
                descriptor.forEach((val, i) => descriptorObj[i] = val);
                
                handleMetadataChange({ ...formData.metadata, faceDescriptor: descriptorObj });
                alert("Face ID Enrolled Successfully! You can now use the Batch Scanner.");
            } else {
                alert("Could not detect a clear face. Please try a different photo.");
            }
        } catch (e) {
            console.error("Enrollment error", e);
            alert("Face Enrollment failed.");
        } finally {
            setIsEnrolling(false);
        }
    };

    const openMatrix = (mode: 'avatar' | 'gallery') => {
        setMatrixMode(mode);
        setIsMatrixOpen(true);
    };

    const handleMatrixSelect = (media: Media) => {
        setIsMatrixOpen(false);
        if (matrixMode === 'avatar') {
            const url = media.thumbnailUrl || media.url;
            setAvatarPreview(url);
            updateFormData({ ...formData, mainImageId: media.id });
        } else {
            if (!formData.mediaIds?.includes(media.id)) {
                updateFormData({ ...formData, mediaIds: [...(formData.mediaIds || []), media.id] });
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
        fetch(croppedImageUrl).then(res => res.blob()).then(blob => {
            setStagedAvatarBlob(blob); 
            setIsDirty(true);
            handleFinalSave(true, blob); 
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
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(Math.abs((hash >> i) % size), Math.abs((hash >> (i+2)) % size), Math.abs((hash >> (i+4)) % 200) + 50, 0, 2 * Math.PI); ctx.fill(); }
        ctx.globalAlpha = 1.0; ctx.fillStyle = "white"; ctx.font = "bold 240px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; 
        const initial = formData.name ? formData.name.charAt(0).toUpperCase() : "?";
        ctx.fillText(initial, size/2, size/2);
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

    const handleFinalSave = async (silent: boolean = false, avatarBlobOverride?: Blob, isAutoSave: boolean = false) => {
        if (!isAutoSave) setSaveState('saving');
        try {
            let updatedFormData = { ...formData };
            const m = formData.metadata as any;
            if (formData.type === 'person') {
                const parts = [m.givenName, m.familyName].filter(Boolean);
                if (parts.length > 0 && !formData.name) updatedFormData.name = parts.join(' ');
            }
            const blobToUpload = avatarBlobOverride || stagedAvatarBlob;
            if (blobToUpload) {
                const newMediaId = await onUploadAvatar(blobToUpload);
                if (newMediaId) {
                    updatedFormData = { 
                        ...updatedFormData, 
                        mainImageId: newMediaId, 
                        mediaIds: [...(updatedFormData.mediaIds || []), newMediaId] 
                    };
                    setFormData(updatedFormData);
                    setAvatarPreview(URL.createObjectURL(blobToUpload));
                    setStagedAvatarBlob(null); 
                }
            }
            await onSave(updatedFormData, silent);
            if (!isAutoSave) setSaveState('saved');
            setIsDirty(false);
        } catch (e) {
            console.error("Save failed", e);
            if (!isAutoSave) setSaveState('idle');
        }
    };

    const relatedMedia = useMemo(() => {
        return allMedia.filter(m => 
            ((m.tagIds && m.tagIds.includes(formData.id)) || (m.id === formData.mainImageId)) &&
            !deletedMediaIds.has(m.id)
        );
    }, [allMedia, formData.id, formData.mainImageId, deletedMediaIds]);

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
            const friendlyName = meta.alternateName || meta.givenName || formData.name || "this person";
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
        return createPortal(<ImageCropper imageSrc={rawImageSrc} onCropComplete={handleCropComplete} onCancel={() => setIsCropping(false)} />, document.body);
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

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 pb-24 md:p-8">
            <div className="bg-[#0f1219] rounded-3xl shadow-2xl w-full max-w-5xl h-[calc(100vh-120px)] md:h-[85vh] border border-white/10 flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-300">
                
                <TagEditorHeader 
                    title={headerContent.title} 
                    description={headerContent.description} 
                    saveState={saveState} 
                    onClose={onCancel}
                />

                <div className="flex flex-1 overflow-hidden relative"> 
                    
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
                        onRemoveAvatar={() => { setAvatarPreview(null); updateFormData({...formData, mainImageId: undefined}); }}
                        onReCrop={handleReCrop}
                        onGenerateTheme={generateTheme}
                        onMapClick={() => hasCoords && setShowInteractiveMapModal(true)}
                    />

                    <div className="flex-1 flex flex-col overflow-hidden bg-[#0f1219] min-w-0">
                        
                        {/* [ZEN FIX] Horizontal Scroll Tabs Container */}
                        <div className="flex border-b border-white/5 px-2 bg-[#13161f] overflow-x-auto custom-scrollbar">
                            {currentTabs.map(tab => (
                                <button 
                                    key={tab.id} 
                                    onClick={() => setActiveTab(tab.id)} 
                                    // [ZEN FIX] whitespace-nowrap and flex-shrink-0 to prevent wrapping and squishing
                                    className={`px-4 py-3 font-bold text-xs uppercase tracking-wider transition-all relative flex items-center justify-center text-center whitespace-nowrap flex-shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {tab.label}
                                    {activeTab === tab.id && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-violet-500 shadow-[0_0_10px_#8b5cf6]"></span>}
                                </button>
                            ))}
                        </div>

                        <TagEditorTabs 
                            activeTab={activeTab}
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
                            
                            // Context props
                            contextSearch={contextSearch}
                            setContextSearch={setContextSearch}
                            contextSuggestions={contextSuggestions}
                            onAddKeyword={handleAddKeyword}
                            onRemoveKeyword={handleRemoveKeyword}

                            // [ZEN FIX] Pass Primary Companion for Sherlock Logic
                            primaryCompanion={primaryCompanion}
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
                    onSave={() => { if (isDirty) handleFinalSave(false); else onCancel(); }}
                    
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
            {renderCropperModal()}
            {renderMediaEditor()}
        </div>
    );
};

export default TagEditor;