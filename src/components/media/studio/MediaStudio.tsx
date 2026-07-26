import React, { useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStudioState } from './useStudioState';
import { useStudioActions } from './useStudioActions';
import { useStudioMedia } from './useStudioMedia';
import { MediaStudioProps } from './types';
import { 
    StudioHeader, 
    StudioSidebar, 
    StudioDrawer, 
    StudioViewport,
    ScrapbookViewport
} from './index';
import MatrixSelector from '../MatrixSelector';
import { ImageCropper } from '../../ImageCropper';
import { doc, getDoc, setDoc } from '../../../services/sovereignDbAdapter';
import { db } from '../../../firebaseConfig';
import type { Tag } from '../../../types';
import { getPolishFilter } from '../../../utils/mediaUtils';
import TagEditor from '../../TagEditor';
import { uploadFile } from '../../../services/storageService';
import { appDataService } from '../../../services/serviceManager';

export const MediaStudio: React.FC<MediaStudioProps> = (props) => {
    const state = useStudioState(props.asset, props.tags);
    const media = useStudioMedia(props.asset, props.user, state.valuesRef, state.setIsDirty);
    
    const actions = useStudioActions(
        props.asset, props.user, state.valuesRef, state.setIsDirty,
        state.setIsSaving, state.setIsAnalyzing, state.setMigrationStatus,
        props.onUpdate, props.onClose, state.tagMap, props.tags, props.onTagCreated
    );

    // [ZEN] Polish Filter Generation using the unified utility engine
    const polishFilter = useMemo(() => {
        return getPolishFilter(state.layers, state.adjustments, state.preset);
    }, [state.preset, state.layers, state.adjustments]);

    // [ZEN] Signal Extraction Trigger
    useEffect(() => {
        const raw = (props.asset.textContent || (props.asset as any).content || '');
        const isLog = (props.asset as any).type === 'messenger_log' || raw.includes('Sender:');
        if (isLog && state.tagIds.length === 0 && !state.isNeuralScanning) {
            actions.handleNeuralSignalExtraction(true).then(res => {
                if (res.linked > 0) state.setTagIds(res.newTagIds || []);
            });
        }
    }, [props.asset.id]);

    const handleSparkle = async (directive?: string) => {
        console.log("[MediaStudio] handleSparkle callback triggered with directive:", directive);
        const res = await actions.handleSparkle(directive);
        console.log("[MediaStudio] handleSparkle actions returned:", `"${res}"`);
        if (res) {
            console.log("[MediaStudio] Setting sparkleString in state to:", `"${res}"`);
            state.setSparkleString(res);
        } else {
            console.warn("[MediaStudio] handleSparkle returned empty or null. Not setting sparkleString.");
        }
    };

    const toggleTag = (id: string) => {
        const tag = state.tagMap.get(id);
        if (!state.tagIds.includes(id)) {
            if (tag?.type === 'place') {
                const existing = state.tagIds.find(tid => state.tagMap.get(tid)?.type === 'place');
                if (existing) return;
            }
            state.setTagIds(prev => [...prev, id]);
            
            // [ZEN] Fictional Inheritance Rule
            // If the added tag is fictional, AND this media is a brand new upload (provisional),
            // the media inherits the Fictional ontological status automatically.
            if (tag?.isFiction && props.asset.status === 'provisional') {
                state.valuesRef.current.isFiction = true;
                // Since there is no setForm here directly, we just mark dirty.
            }
        } else {
            state.setTagIds(prev => prev.filter(t => t !== id));
        }
        state.setIsDirty(true);
    };

    const filteredTags = useMemo(() => 
        props.tags.filter(t => !state.tagIds.includes(t.id) && t.name.toLowerCase().includes(state.tagSearch.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)), 
    [props.tags, state.tagIds, state.tagSearch]);

    const handlePrecisionChange = (p: any) => {
        state.setDatePrecision(p);
        state.setIsDirty(true);
    };

    // [ZEN] Tag & Location Operations
    const [isCreatingTag, setIsCreatingTag] = React.useState(false);
    const [isPromotingPlace, setIsPromotingPlace] = React.useState(false);
    const [editingTag, setEditingTag] = React.useState<Tag | null>(null);

    const handleUploadAvatar = async (avatarBlob: Blob): Promise<string> => {
        if (!props.user) return "";
        const mediaId = `media-avatar-${Date.now()}`;
        try {
            const uploadRes = await uploadFile(avatarBlob, props.user.id, `avatar_${Date.now()}.jpg`);
            if (!uploadRes.url) throw new Error("B2 Upload failed");
            const newMedia = {
                id: mediaId,
                url: uploadRes.url,
                thumbnailUrl: uploadRes.url,
                caption: 'Tag Avatar',
                uploadDate: new Date(),
                fileType: 'image/jpeg',
                tagIds: [],
                status: 'clean',
                isAvatar: true
            } as any;
            await appDataService.saveMedia(props.user.id, newMedia);
            return mediaId;
        } catch (e) {
            console.error("Avatar save failed", e);
            throw e;
        }
    };

    const handleSaveEditedTag = async (updatedTag: Tag, silent?: boolean) => {
        if (!props.user) return;
        try {
            await appDataService.saveTag(props.user.id, updatedTag);
            if (props.onTagCreated) {
                props.onTagCreated(updatedTag);
            }
        } catch (e) {
            console.error("Failed to save edited tag", e);
        }
    };

    const createNewTag = async (type: Tag['type']) => {
        if (isCreatingTag || !state.tagSearch.trim() || !props.user?.id) return;
        setIsCreatingTag(true);

        let finalName = state.tagSearch.trim();
        if (type === 'person' || type === 'pet') {
            finalName = finalName
                .split(' ')
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }

        const newTagId = `tag-${Date.now()}`;
        const newTag = {
            id: newTagId,
            name: finalName,
            type: type,
            tagIds: [],
            mediaIds: [props.asset.id],
            mediaGallery: [],
            metadata: {},
            description: `Created via Media Studio`,
            isPrivate: false,
            privateNotes: ''
        } as Tag;

        try {
            await setDoc(doc(db, 'users', props.user.id, 'tags', newTagId), newTag);
            
            // Link to the active asset's tagIds
            state.setTagIds(prev => [...prev, newTagId]);
            state.setIsDirty(true);
            
            if (props.onTagCreated) props.onTagCreated(newTag);
            state.setTagSearch('');
            state.setIsTagDropdownOpen(false);
        } catch (error) {
            console.error("[MediaStudio] Failed to create tag", error);
        } finally {
            setIsCreatingTag(false); 
        }
    };

    const promoteToPlaceTag = async () => {
        if (isPromotingPlace || !state.addressData.streetAddress || !props.user?.id) return;
        setIsPromotingPlace(true);

        const newTagId = `tag-${Date.now()}`;
        const newTag = {
            id: newTagId,
            name: state.addressData.streetAddress,
            type: 'place',
            tagIds: [],
            mediaIds: [props.asset.id],
            mediaGallery: [],
            metadata: {
                address: {
                    streetAddress: state.addressData.streetAddress,
                    addressLocality: state.addressData.addressLocality || '',
                    addressRegion: state.addressData.addressRegion || '',
                    postalCode: state.addressData.postalCode || '',
                    addressCountry: state.addressData.addressCountry || '',
                    coordinates: state.addressData.coordinates
                },
                significance: `Promoted from Media Studio location context`,
                coordinates: state.addressData.coordinates
            },
            description: `Place promoted via Media Studio`,
            isPrivate: false,
            privateNotes: ''
        } as any;

        try {
            await setDoc(doc(db, 'users', props.user.id, 'tags', newTagId), newTag);
            
            // Link to the active asset's tagIds
            state.setTagIds(prev => [...prev, newTagId]);
            state.setIsDirty(true);
            
            if (props.onTagCreated) props.onTagCreated(newTag);
        } catch (error) {
            console.error("[MediaStudio] Failed to promote place tag", error);
        } finally {
            setIsPromotingPlace(false);
        }
    };

    // [ZEN] Parse both rich Markdown tags and raw @mentions to extract linked tag IDs
    const extractTagIdsFromText = useCallback((text: string): string[] => {
        if (!text) return [];
        const foundIds = new Set<string>();
        
        // 1. Parse standard rich Markdown tag links: [Name](tag://type:id)
        const richRegex = /\[([^\]]+)\]\(tag:\/\/([a-zA-Z0-9_:-]+):([a-zA-Z0-9_\-\u00C0-\u017F]+)\)/g;
        const richMatches = Array.from(text.matchAll(richRegex));
        richMatches.forEach(m => {
            if (m[3]) foundIds.add(m[3]);
        });
        
        // 2. Parse raw mentions like "@isabella" matching known tags
        const mentionRegex = /@([a-zA-Z0-9_\-\u00C0-\u017F]+)/g;
        const mentions = Array.from(text.matchAll(mentionRegex)).map(m => m[1].toLowerCase());
        props.tags.forEach(t => {
            if (mentions.includes(t.name.toLowerCase()) || mentions.includes(t.id.toLowerCase())) {
                foundIds.add(t.id);
            }
        });
        
        return Array.from(foundIds);
    }, [props.tags]);

    // [ZEN] Live synchronization of narrative editors to the Linked Entities sidebar
    const handleFieldChange = (field: string, value: any) => {
        const oldRef = { ...state.valuesRef.current };
        (state.valuesRef.current as any)[field] = value;
        state.setIsDirty(true);

        if (field === 'narrative') {
            state.setNarrative(value);
        }

        // Live syncing of tags from updated editors to sidebar state
        if (field === 'description' || field === 'narrative' || field === 'privateDetails') {
            const descTags = extractTagIdsFromText(state.valuesRef.current.description || '');
            const narrativeTags = extractTagIdsFromText(state.valuesRef.current.narrative || '');
            const privateTags = extractTagIdsFromText(state.valuesRef.current.privateDetails || '');
            
            const allTextTags = new Set([...descTags, ...narrativeTags, ...privateTags]);
            
            state.setTagIds(prev => {
                const next = new Set(prev);
                
                // Add all currently detected text tags
                allTextTags.forEach(id => next.add(id));
                
                // Remove tags that were deleted from this specific edited field
                const oldFieldText = field === 'description' ? (oldRef.description || '') :
                                     field === 'narrative' ? (state.narrative || oldRef.narrative || '') :
                                     field === 'privateDetails' ? (oldRef.privateDetails || '') : '';
                
                const oldFieldTags = extractTagIdsFromText(oldFieldText);
                oldFieldTags.forEach(id => {
                    if (!allTextTags.has(id)) {
                        next.delete(id);
                    }
                });
                
                return Array.from(next);
            });
        }
    };

    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!state.isDragging || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let clientX = 0;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = (e as React.MouseEvent).clientX;
        }
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        state.setSliderPos((x / rect.width) * 100);
    }, [state.isDragging, state.setSliderPos]);

    return createPortal(
        <React.Fragment>,
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={props.onClose} />
                <div className="relative bg-[#020617] border border-white/10 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
                    
                    <StudioHeader 
                        asset={useMemo(() => ({ 
                            ...props.asset, 
                            title: state.sparkleString || props.asset.title 
                        }), [props.asset, state.sparkleString])}
                        viewMode={state.viewMode}
                        setViewMode={state.setViewMode}
                        handleSave={actions.handleSave}
                        isSaving={state.isSaving}
                        isDirty={state.isDirty}
                        migrationStatus={state.migrationStatus}
                        handleAttemptClose={props.onClose}
                    />

                    <div className="flex-1 flex min-h-0 overflow-hidden">
                        <StudioSidebar 
                            asset={props.asset}
                            activeTab={state.activeTab}
                            setActiveTab={state.setActiveTab}
                            setIsCropping={state.setIsCropping}
                            onRemove={props.onRemove}
                            onClose={props.onClose}
                        />

                        <div className="w-[500px] border-r border-white/5 bg-black/20 flex flex-col min-h-0 relative z-40">
                            <div className="flex-1 flex flex-col min-h-0">
                                <StudioDrawer 
                                    asset={props.asset}
                                    activeTab={state.activeTab}
                                    setActiveTab={state.setActiveTab}
                                    polishTab={state.polishTab}
                                    setPolishTab={state.setPolishTab}
                                    adjustments={state.adjustments}
                                    handleAdjustment={(k, v) => { 
                                        if (k === 'STACK_RESTORE') {
                                            state.setAdjustments(v); 
                                        } else {
                                            state.setAdjustments(p => ({ ...p, [k]: v })); 
                                        }
                                        state.setIsDirty(true); 
                                    }}
                                    preset={state.preset}
                                    setPreset={state.setPreset}
                                    displayUrl={state.displayUrl}
                                    setIsDirty={state.setIsDirty}
                                    aiDirective={state.aiDirective}
                                    setAiDirective={state.setAiDirective}
                                    isAnalyzing={state.isAnalyzing}
                                    handleAutoFix={() => {}}
                                    handleStack={() => { state.setLayers(prev => [...prev, polishFilter]); state.setAdjustments({}); state.setIsDirty(true); }}
                                    handleClearLayers={() => { state.setLayers([]); state.setAdjustments({}); state.setIsDirty(true); }}
                                    datePrecision={state.datePrecision}
                                    handlePrecisionChange={handlePrecisionChange}
                                    dateStr={state.dateStr}
                                    setDateStr={state.setDateStr}
                                    valuesRef={state.valuesRef}
                                    handleFieldChange={handleFieldChange}
                                    isSparkling={state.isAnalyzing}
                                    handleSparkle={handleSparkle}
                                    sparkleString={state.sparkleString}
                                    activeTargetField={null}
                                    isResurrectingNarrative={false}
                                    handleResurrectNarrative={() => {}}
                                    tagSearch={state.tagSearch}
                                    setTagSearch={state.setTagSearch}
                                    isTagDropdownOpen={state.isTagDropdownOpen}
                                    setIsTagDropdownOpen={state.setIsTagDropdownOpen}
                                    filteredTags={filteredTags}
                                    toggleTag={toggleTag}
                                    isCreatingTag={isCreatingTag}
                                    createNewTag={createNewTag}
                                    tagIds={state.tagIds}
                                    tagMap={state.tagMap}
                                    addressData={state.addressData}
                                    setAddressData={state.setAddressData}
                                    promoteToPlaceTag={promoteToPlaceTag}
                                    isPromotingPlace={isPromotingPlace}
                                    onMarkerDragEnd={(lat, lng) => {
                                        const newData = { ...state.addressData, coordinates: { lat, lng } };
                                        state.setAddressData(newData);
                                        state.valuesRef.current.location = newData;
                                        state.setIsDirty(true);
                                    }}
                                    tags={props.tags}
                                    user={props.user}
                                    onTagCreated={props.onTagCreated}
                                    isNeuralScanning={state.isNeuralScanning}
                                    onNeuralScan={() => {
                                        actions.handleNeuralSignalExtraction(false).then(res => {
                                            if (res.linked > 0) {
                                                state.setTagIds(res.newTagIds || []);
                                            }
                                        });
                                    }}
                                    discoveredEntities={state.discoveredEntities}
                                    editHistory={state.editHistory}
                                    onEditTag={(tag) => setEditingTag(tag)}
                                />
                            </div>
                        </div>

                        <StudioViewport 
                            asset={props.asset}
                            displayUrl={state.displayUrl}
                            viewMode={state.viewMode}
                            setViewMode={state.setViewMode}
                            sliderPos={state.sliderPos}
                            setSliderPos={state.setSliderPos}
                            isDragging={state.isDragging}
                            setIsDragging={state.setIsDragging}
                            handleMove={handleMove}
                            polishFilter={polishFilter}
                            attachedMediaObjects={media.attachedMediaObjects}
                            narrative={state.narrative}
                            setShowMatrixPicker={() => {}}
                            handleScrapbookUpload={media.handleScrapbookUpload}
                            handleRemoveAttachment={media.handleRemoveAttachment}
                            isUploading={media.isUploading}
                            isCropping={state.isCropping}
                            setIsCropping={state.setIsCropping}
                            onResurrect={() => {}}
                            containerRef={containerRef}
                            adjustments={state.adjustments}
                            handleAdjustment={(k, v) => { 
                                if (k === 'STACK_RESTORE') {
                                    state.setAdjustments(v); 
                                } else {
                                    state.setAdjustments(p => ({ ...p, [k]: v })); 
                                }
                                state.setIsDirty(true); 
                            }}
                        />
                    </div>
                </div>
            </div>
            {state.isCropping && (
                <ImageCropper 
                    imageSrc={state.displayUrl}
                    cropShape="rect"
                    polishFilter={polishFilter}
                    onCropComplete={(croppedUrl) => {
                        state.setDisplayUrl(croppedUrl);
                        state.valuesRef.current.url = croppedUrl;
                        state.setIsDirty(true);
                        state.setIsCropping(false);
                    }}
                    onCancel={() => state.setIsCropping(false)}
                />
            )}
            {editingTag && createPortal(
                <TagEditor
                    tag={editingTag}
                    allTags={props.tags}
                    allMedia={[]}
                    user={props.user}
                    onSave={handleSaveEditedTag}
                    onUploadAvatar={handleUploadAvatar}
                    onCancel={() => setEditingTag(null)}
                    onDiscuss={() => {}}
                    createDefaultMetadata={(type) => {
                        if (type === 'person') {
                            return {
                                givenName: '',
                                familyName: '',
                                alternateName: '',
                                gender: 'unknown',
                                birthDate: '',
                                deathDate: '',
                                isDeceased: false,
                                lifeFacts: []
                            };
                        }
                        return {};
                    }}
                />,
                document.body
            )}
        </React.Fragment>,
        document.body
    );
};
