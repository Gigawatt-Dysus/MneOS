import React, { useState, useRef } from 'react';
import { User, Dog, MapPin, Package, Calendar, Link as LinkIcon, Plus, X, Upload, Trash2, Grid, List, Tag as TagIcon, Globe, Camera, Network, Sparkles, Loader2, Brain } from 'lucide-react';
import { NeuralBridge } from '../shared/NeuralBridge';
import type { Tag, Media, PersonTag, PetTag, PlaceTag, ThingTag, EventTag, ConceptTag, Settings, AiCompanion } from '../../types';
import { MultiverseCoords } from '../tags/MultiverseCoords';
import { GlassButton } from '../GlassButton';
import PersonForm from '../tags/PersonForm';
import PlaceForm from '../tags/PlaceForm';
import ThingForm from '../tags/ThingForm';
import EventTagForm from '../tags/EventTagForm';
import ConceptForm from '../tags/ConceptForm';
import { MatrixGrid } from '../matrix/MatrixGrid';
import { DocumentList } from '../matrix/DocumentList';
import { FamilyTreeWizard } from '../family/FamilyTreeWizard';

// [ZEN FIX] Import the new modular PetForm
import PetForm from '../tags/pets';

import { GalleryTab } from '../ProfileEditor/GalleryTab';
import { SimulacrumTab } from './SimulacrumTab'; // [ZEN] Import SimulacrumTab
import { WikiTagEditor } from '../shared/WikiTagEditor';
import { compileTagContext } from '../../services/contextCompiler';

const TypeButton = ({ icon: Icon, label, type, currentType, onTypeChange }: { icon: any, label: string, type: Tag['type'], currentType: string, onTypeChange: (t: Tag['type']) => void }) => {
    const isSelected = currentType === type;
    const typeStyles: Record<string, string> = {
        person: "bg-blue-600/60 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] border-blue-400/50 hover:bg-blue-500/70",
        pet: "bg-purple-600/60 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)] border-purple-400/50 hover:bg-purple-500/70",
        place: "bg-emerald-600/60 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] border-emerald-400/50 hover:bg-emerald-500/70",
        thing: "bg-amber-500/60 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)] border-amber-400/50 hover:bg-amber-400/70",
        event: "bg-rose-500/60 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] border-rose-400/50 hover:bg-rose-400/70",
        concept: "bg-indigo-600/60 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] border-indigo-400/50 hover:bg-indigo-500/70",
    };
    const baseStyle = "text-xs font-bold transition-all duration-300 flex-1";
    const selectedStyle = typeStyles[type] || "bg-slate-600 text-white";
    const unselectedStyle = "text-slate-400 hover:text-white";

    return (
        <GlassButton
            onClick={() => onTypeChange(type)}
            variant={isSelected ? undefined : 'secondary'}
            className={`${baseStyle} ${isSelected ? selectedStyle : unselectedStyle}`}
        >
            <Icon size={14} /> {label}
        </GlassButton>
    );
};

interface TagEditorTabsProps {
    activeTab: string;
    isAdversarial?: boolean;
    resumeSessionId?: string;
    formData: Tag;
    allTags: Tag[];
    allMedia: Media[];
    settings?: Settings;
    onChange: (field: keyof Tag, value: any) => void;
    onMetadataChange: (metadata: any) => void;
    onTypeChange: (newType: Tag['type']) => void;
    onEnrollFace: () => void;
    isEnrolling: boolean;
    relatedMedia: Media[];
    groupedAssets: any[];
    galleryViewMode: 'grid' | 'list';
    setGalleryViewMode: (mode: 'grid' | 'list') => void;
    isSelectionMode: boolean;
    setIsSelectionMode: (v: boolean) => void;
    selectedMediaIds: Set<string>;
    setSelectedMediaIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    openMatrix: (mode: 'gallery') => void;
    handleMediaClick: (media: Media) => void;
    handleBatchUnlink: () => void;
    handleDeleteAsset: (id: string) => void;
    setShowAddTagModal: (v: boolean) => void;
    updateFormData: (data: Tag) => void;
    contextSearch: string;
    setContextSearch: (v: string) => void;
    contextSuggestions: string[];
    onAddKeyword: (kw: string) => void;
    onRemoveKeyword: (kw: string) => void;
    primaryCompanion: AiCompanion;
    onOpenGedcom?: () => void;
    userId: string;
    userPresets?: any[];
    onDirectUploadMedia?: (files: File[]) => Promise<void>;
    isUploadingMedia?: boolean;
}

export const TagEditorTabs: React.FC<TagEditorTabsProps> = ({
    activeTab, isAdversarial, resumeSessionId, formData, allTags, allMedia, settings, onChange, onMetadataChange, onTypeChange,
    onEnrollFace, isEnrolling, relatedMedia, groupedAssets, galleryViewMode, setGalleryViewMode,
    isSelectionMode, setIsSelectionMode, selectedMediaIds, setSelectedMediaIds, openMatrix,
    handleMediaClick, handleBatchUnlink, handleDeleteAsset, setShowAddTagModal, updateFormData,
    contextSearch, setContextSearch, contextSuggestions, onAddKeyword, onRemoveKeyword, primaryCompanion,
    onOpenGedcom, userId, userPresets, onDirectUploadMedia, isUploadingMedia
}) => {
    const containerPadding = activeTab === 'gallery' ? 'p-0' : 'p-8';

    // [ZEN] Wizard State
    const [showWizard, setShowWizard] = useState(false);

    // [ZEN] Sandbox Compiler State
    const [isCompiling, setIsCompiling] = useState(false);
    const [sandboxResult, setSandboxResult] = useState<{ compiledContext: string, tokenCountEst: number } | null>(null);

    const handleSandboxCompile = async (useLLM: boolean) => {
        setIsCompiling(true);
        try {
            const result = await compileTagContext(formData, relatedMedia, useLLM);
            setSandboxResult(result);
            // Optionally, we could automatically save it here, but keeping it as a Sandbox first.
            if (result && result.compiledContext) {
                 onChange('compiledContext', result.compiledContext);
            }
        } catch (e) {
            console.error("Sandbox compile failed", e);
        } finally {
            setIsCompiling(false);
        }
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0 && onDirectUploadMedia) {
            onDirectUploadMedia(Array.from(e.target.files));
        }
    };

    if (formData.type === 'person') {
        return (
            <div className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative ${containerPadding}`}>
                {activeTab !== 'gallery' && (
                    <>
                        {/* [ZEN] Launch Family Tree Wizard from Connections Tab */}
                        {activeTab === 'connections' && (
                            <div className="max-w-3xl mb-4">
                                <div className="bg-gradient-to-r from-violet-900/40 to-cyan-900/40 border border-white/10 rounded-xl p-4 flex justify-between items-center">
                                    <div>
                                        <h4 className="text-white font-bold flex items-center gap-2"><Network size={16} className="text-cyan-400" /> Family Graph Wizard</h4>
                                        <p className="text-xs text-slate-400">Interactively visualize and fix logic errors in your tree.</p>
                                    </div>
                                    <button
                                        onClick={() => setShowWizard(true)}
                                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-cyan-900/20 transition-all flex items-center gap-2"
                                    >
                                        Launch Wizard
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* [ZEN] Simulacrum Gateway */}
                        {activeTab === 'simulacrum' && (
                            <div className="max-w-4xl mx-auto w-full">
                                <SimulacrumTab 
                                    isAdversarial={isAdversarial}
                                    resumeSessionId={resumeSessionId}
                                    formData={formData}
                                    updateFormData={(newData) => {
                                        onChange('metadata', newData.metadata);
                                    }}
                                    userId={userId}
                                    allTags={allTags}
                                    avatarUrl={formData.mainImageId ? allMedia.find(m => m.id === formData.mainImageId)?.url : undefined}
                                />
                            </div>
                        )}

                        <PersonForm
                            tag={formData as PersonTag}
                            activeTab={activeTab}
                            allTags={allTags}
                            onMetadataChange={onMetadataChange}
                            onRootChange={onChange}
                            settings={settings}
                            onEnrollFace={onEnrollFace}
                            isEnrolling={isEnrolling}
                            primaryCompanion={primaryCompanion}
                            onOpenGedcom={onOpenGedcom} // [ZEN] Pass down
                            userId={userId}
                            userPresets={userPresets}
                            relatedMedia={relatedMedia}
                        />
                    </>
                )}

                {activeTab === 'gallery' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-[#1a1d26] p-2 rounded-xl border border-white/5">
                            <div className="flex gap-2">
                                <button onClick={() => setGalleryViewMode('grid')} className={`p-2 rounded-lg ${galleryViewMode === 'grid' ? 'bg-[#0f1219] text-white shadow' : 'text-slate-500 hover:text-white'}`}><Grid size={16} /></button>
                                <button onClick={() => setGalleryViewMode('list')} className={`p-2 rounded-lg ${galleryViewMode === 'list' ? 'bg-[#0f1219] text-white shadow' : 'text-slate-500 hover:text-white'}`}><List size={16} /></button>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    multiple
                                    className="hidden"
                                    accept="image/*,video/*,application/pdf"
                                />
                                <GlassButton 
                                    onClick={() => fileInputRef.current?.click()} 
                                    variant={formData.isFiction ? undefined : "secondary"}
                                    className={`text-xs ${formData.isFiction ? 'bg-fuchsia-600/60 hover:bg-fuchsia-500/70 border-fuchsia-400/50 text-white shadow-[0_0_15px_rgba(217,70,239,0.4)] font-bold' : ''}`}
                                    disabled={isUploadingMedia}
                                >
                                    {isUploadingMedia ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" /> Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={14} /> Upload Direct
                                        </>
                                    )}
                                </GlassButton>
                                <GlassButton onClick={() => openMatrix('gallery')} variant="secondary" className="text-xs" disabled={isUploadingMedia}>
                                    <Grid size={14} /> Link Existing
                                </GlassButton>
                                {isSelectionMode && selectedMediaIds.size > 0 && (
                                    <GlassButton onClick={handleBatchUnlink} variant="danger" className="text-xs">
                                        <Trash2 size={14} /> Remove ({selectedMediaIds.size})
                                    </GlassButton>
                                )}
                                <button
                                    onClick={() => setIsSelectionMode(!isSelectionMode)}
                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${isSelectionMode ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' : 'border-white/10 text-slate-400 hover:text-white'}`}
                                >
                                    {isSelectionMode ? 'Done' : 'Select'}
                                </button>
                            </div>
                        </div>

                        {relatedMedia.length === 0 ? (
                            <div className="text-slate-500 italic flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/10 rounded-xl bg-[#1a1d26]/50 mx-4">
                                <Camera size={32} className="mb-2 opacity-50" />
                                <p>No media linked yet.</p>
                                <p className="text-xs mt-1">Upload files in the Matrix and tag them with "{(formData as any).name}".</p>
                            </div>
                        ) : (
                            <>
                                {galleryViewMode === 'grid' ? (
                                    <MatrixGrid
                                        groupedAssets={groupedAssets}
                                        viewMode="sm"
                                        isSelectionMode={isSelectionMode}
                                        selectedIds={selectedMediaIds}
                                        onToggleSelection={(id) => {
                                            const newSet = new Set(selectedMediaIds);
                                            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                                            setSelectedMediaIds(newSet);
                                        }}
                                        onMediaClick={handleMediaClick}
                                        onEditAsset={() => { }}
                                    // onDeleteAsset={handleDeleteAsset}
                                    />
                                ) : (
                                    <DocumentList
                                        assets={relatedMedia}
                                        selectedIds={selectedMediaIds}
                                        isSelectionMode={isSelectionMode}
                                        onToggleSelection={(id) => {
                                            const newSet = new Set(selectedMediaIds);
                                            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                                            setSelectedMediaIds(newSet);
                                        }}
                                        onDeleteAsset={handleDeleteAsset}
                                    />
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* [ZEN] Mount Wizard Modal */}
                {showWizard && (
                    <FamilyTreeWizard
                        initialFocalId={formData.id}
                        allTags={allTags}
                        onClose={() => setShowWizard(false)}
                        onUpdateTag={(updatedTag) => {
                            if (updatedTag.id === formData.id) updateFormData(updatedTag);
                        }}
                        allMedia={allMedia}
                    />
                )}
            </div>
        );
    }

    return (
        <div className={`flex-1 overflow-y-auto custom-scrollbar relative ${containerPadding}`}>
            {activeTab !== 'gallery' && (
                <>
                    {/* [ZEN] Simulacrum Gateway */}
                    {activeTab === 'simulacrum' && (
                        <div className="max-w-4xl mx-auto w-full">
                            <SimulacrumTab 
                                isAdversarial={isAdversarial}
                                resumeSessionId={resumeSessionId}
                                formData={formData}
                                updateFormData={(newData) => {
                                    onChange('metadata', newData.metadata);
                                }}
                                userId={userId}
                                allTags={allTags}
                            />
                        </div>
                    )}
                    
                    {/* [ZEN] Generic Type Editor Logic */}
                    {activeTab === 'general' && (
                        <div className="space-y-8 max-w-3xl">
                            <MultiverseCoords tag={formData} allTags={allTags} onChange={onChange} />
                            
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Tag Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => onChange('name', e.target.value)}
                                    className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-4 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none text-xl font-bold placeholder-slate-600 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Entity Type</label>
                                <div className="flex gap-2 flex-wrap">
                                    <TypeButton icon={User} label="Person" type="person" currentType={formData.type} onTypeChange={onTypeChange} />
                                    <TypeButton icon={Dog} label="Pet" type="pet" currentType={formData.type} onTypeChange={onTypeChange} />
                                    <TypeButton icon={MapPin} label="Place" type="place" currentType={formData.type} onTypeChange={onTypeChange} />
                                    <TypeButton icon={Package} label="Thing" type="thing" currentType={formData.type} onTypeChange={onTypeChange} />
                                    <TypeButton icon={Calendar} label="Event" type="event" currentType={formData.type} onTypeChange={onTypeChange} />
                                    <TypeButton icon={Brain} label="Concept" type="concept" currentType={formData.type} onTypeChange={onTypeChange} />
                                </div>
                            </div>

                            {/* CONTEXT KEYWORDS SECTION */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Context Keywords</label>
                                <div className="bg-[#1a1d26] p-4 rounded-xl border border-white/5 space-y-3">
                                    <div className="flex gap-2 relative">
                                        <input
                                            type="text"
                                            value={contextSearch}
                                            onChange={e => setContextSearch(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && onAddKeyword(contextSearch)}
                                            placeholder="Add descriptive keyword (e.g. 'Beach', 'Summer')..."
                                            className="flex-1 bg-[#0f1219] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                                        />
                                        <GlassButton onClick={() => onAddKeyword(contextSearch)} disabled={!contextSearch.trim()} variant="secondary" className="h-full">
                                            <Plus size={16} /> Add
                                        </GlassButton>

                                        {/* Suggestions Dropdown */}
                                        {contextSuggestions.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1d26] border border-white/10 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                                                {contextSuggestions.map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => onAddKeyword(s)}
                                                        className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-[#252936] hover:text-white flex items-center gap-2 border-b border-white/5 last:border-0"
                                                    >
                                                        <Globe size={12} className="text-cyan-500" /> {s}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.keywords?.map(k => (
                                            <span key={k} className="flex items-center gap-1 bg-[#0f1219] text-cyan-200 border border-white/10 px-3 py-1 rounded-full text-xs font-medium">
                                                <TagIcon size={10} className="text-cyan-500/50" /> {k}
                                                <button onClick={() => onRemoveKeyword(k)} className="ml-1 text-slate-500 hover:text-red-400"><X size={12} /></button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}



                    {activeTab === 'details' && (
                        <div className="max-w-3xl">
                            <div className="mb-8 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description / Overview</label>
                                    <NeuralBridge
                                        value={formData.description || ''}
                                        onChange={(val) => onChange('description', val)}
                                        userId={userId}
                                        userPresets={userPresets}
                                        label="Refine Bio"
                                    />
                                </div>
                                <WikiTagEditor
                                    value={formData.description || ''}
                                    onChange={val => onChange('description', val)}
                                    userId={userId}
                                    placeholder={`Describe this ${formData.type}...`}
                                    rows={10}
                                />
                            </div>

                            {/* [ZEN FIX] New PetForm Implementation */}
                            {formData.type === 'pet' && (
                                <PetForm
                                    metadata={(formData as PetTag).metadata}
                                    onChange={onMetadataChange}
                                />
                            )}

                            {formData.type === 'place' && <PlaceForm tag={formData as PlaceTag} onMetadataChange={onMetadataChange} settings={settings} userId={userId} userPresets={userPresets} allTags={allTags} />}
                            {formData.type === 'thing' && <ThingForm tag={formData as ThingTag} onMetadataChange={onMetadataChange} />}
                            {formData.type === 'event' && <EventTagForm tag={formData as EventTag} onMetadataChange={onMetadataChange} />}
                            {formData.type === 'concept' && <ConceptForm tag={formData as ConceptTag} onMetadataChange={onMetadataChange} allTags={allTags} />}
                        </div>
                    )}

                    {activeTab === 'connections' && (
                        <div className="max-w-3xl animate-in fade-in space-y-6">
                            <div className="bg-[#1a1d26] p-6 rounded-xl border border-white/5">
                                <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2">
                                    <LinkIcon size={16} /> Related Entities
                                </h3>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {formData.tagIds.map(tagId => {
                                        const linkedTag = allTags.find(t => t.id === tagId);
                                        return (
                                            <span key={tagId} className="inline-flex items-center gap-1.5 bg-[#0f1219] text-cyan-200 border border-white/10 px-2.5 py-1.5 rounded-lg text-xs font-medium group">
                                                {linkedTag ? linkedTag.name : 'Unknown Tag'}
                                                <button onClick={() => {
                                                    const updated = formData.tagIds.filter(id => id !== tagId);
                                                    updateFormData({ ...formData, tagIds: updated });
                                                }} className="text-slate-500 hover:text-red-400 ml-1 transition-colors">
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        );
                                    })}
                                    {formData.tagIds.length === 0 && <p className="text-xs text-slate-500 italic">No connections yet.</p>}
                                </div>
                                <button onClick={() => setShowAddTagModal(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-600 transition-all">
                                    <Plus size={14} /> Add Connection
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'private' && (
                        <div className="space-y-4 max-w-3xl animate-in fade-in">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Private Notes</label>
                                    <NeuralBridge
                                        value={formData.privateNotes || ''}
                                        onChange={(val) => onChange('privateNotes', val)}
                                        userId={userId}
                                        userPresets={userPresets}
                                        label="Polish Notes"
                                    />
                                </div>
                                <textarea
                                    rows={10}
                                    value={formData.privateNotes}
                                    onChange={e => onChange('privateNotes', e.target.value)}
                                    className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-4 text-slate-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none min-h-[12rem] placeholder-slate-600 transition-all font-mono text-sm custom-scrollbar"
                                />
                            </div>

                            {/* [ZEN] AI Directive Field for Context Compilation */}
                            <div className="mt-6">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                                        <Sparkles size={12} /> AI Directive (Context Override)
                                    </label>
                                </div>
                                <textarea
                                    rows={4}
                                    value={formData.aiDirective || ''}
                                    onChange={e => onChange('aiDirective', e.target.value)}
                                    placeholder="e.g. 'Always refer to this event as a turning point in the timeline. Do not mention the rain.' (Injected directly into Context Compiler)"
                                    className="w-full bg-[#0f1219] border border-cyan-500/30 rounded-xl p-4 text-cyan-100 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 outline-none min-h-[6rem] placeholder-cyan-900/50 transition-all font-mono text-sm custom-scrollbar shadow-[inset_0_0_20px_rgba(6,182,212,0.05)]"
                                />

                                {/* [ZEN] Sandbox Compiler Controls */}
                                <div className="mt-4 p-4 bg-[#11141b] rounded-xl border border-cyan-500/20">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                                            <Brain size={14} /> Semantic Context Compiler
                                        </h4>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleSandboxCompile(false)}
                                                disabled={isCompiling}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold border border-white/10 transition-colors disabled:opacity-50"
                                            >
                                                Test Fast (Deterministic)
                                            </button>
                                            <button 
                                                onClick={() => handleSandboxCompile(true)}
                                                disabled={isCompiling}
                                                className="px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-500/40 text-cyan-200 rounded-lg text-[10px] font-bold border border-cyan-500/50 transition-colors disabled:opacity-50 flex items-center gap-1"
                                            >
                                                {isCompiling ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Test LLM Triples
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {sandboxResult && (
                                        <div className="animate-in fade-in slide-in-from-top-2">
                                            <div className="text-[10px] text-cyan-500 mb-2 font-mono">
                                                EST. TOKEN PAYLOAD: {sandboxResult.tokenCountEst} tokens
                                            </div>
                                            <textarea 
                                                readOnly
                                                value={sandboxResult.compiledContext}
                                                className="w-full bg-[#0a0c10] border border-cyan-500/10 rounded-lg p-3 text-cyan-50/70 font-mono text-[10px] h-32 custom-scrollbar outline-none"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center p-4 bg-[#1a1d26] rounded-xl border border-white/5">
                                <input
                                    id="isPrivate"
                                    type="checkbox"
                                    checked={formData.isPrivate}
                                    onChange={e => onChange('isPrivate', e.target.checked)}
                                    className="h-5 w-5 rounded border-slate-600 bg-slate-900 text-violet-600 focus:ring-violet-500 focus:ring-offset-gray-900"
                                />
                                <label htmlFor="isPrivate" className="ml-3 block text-sm font-medium text-white">Mark as Private (Hide in Reports)</label>
                            </div>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'gallery' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-[#1a1d26] p-2 rounded-xl border border-white/5">
                        <div className="flex gap-2">
                            <button onClick={() => setGalleryViewMode('grid')} className={`p-2 rounded-lg ${galleryViewMode === 'grid' ? 'bg-[#0f1219] text-white shadow' : 'text-slate-500 hover:text-white'}`}><Grid size={16} /></button>
                            <button onClick={() => setGalleryViewMode('list')} className={`p-2 rounded-lg ${galleryViewMode === 'list' ? 'bg-[#0f1219] text-white shadow' : 'text-slate-500 hover:text-white'}`}><List size={16} /></button>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                multiple
                                className="hidden"
                                accept="image/*,video/*,application/pdf"
                            />
                            <GlassButton 
                                onClick={() => fileInputRef.current?.click()} 
                                variant={formData.isFiction ? undefined : "secondary"}
                                className={`text-xs ${formData.isFiction ? 'bg-fuchsia-600/60 hover:bg-fuchsia-500/70 border-fuchsia-400/50 text-white shadow-[0_0_15px_rgba(217,70,239,0.4)] font-bold' : ''}`}
                                disabled={isUploadingMedia}
                            >
                                {isUploadingMedia ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" /> Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={14} /> Upload Direct
                                    </>
                                )}
                            </GlassButton>
                            <GlassButton onClick={() => openMatrix('gallery')} variant="secondary" className="text-xs" disabled={isUploadingMedia}>
                                <Grid size={14} /> Link Existing
                            </GlassButton>
                            {isSelectionMode && selectedMediaIds.size > 0 && (
                                <GlassButton onClick={handleBatchUnlink} variant="danger" className="text-xs">
                                    <Trash2 size={14} /> Remove ({selectedMediaIds.size})
                                </GlassButton>
                            )}
                            <button
                                onClick={() => setIsSelectionMode(!isSelectionMode)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${isSelectionMode ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' : 'border-white/10 text-slate-400 hover:text-white'}`}
                            >
                                {isSelectionMode ? 'Done' : 'Select'}
                            </button>
                        </div>
                    </div>

                    {relatedMedia.length === 0 ? (
                        <div className="text-slate-500 italic flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/10 rounded-xl bg-[#1a1d26]/50 mx-4">
                            <Camera size={32} className="mb-2 opacity-50" />
                            <p>No media linked yet.</p>
                            <p className="text-xs mt-1">Upload files in the Matrix and tag them with "{(formData as any).name}".</p>
                        </div>
                    ) : (
                        <>
                            {galleryViewMode === 'grid' ? (
                                <MatrixGrid
                                    groupedAssets={groupedAssets}
                                    viewMode="sm"
                                    isSelectionMode={isSelectionMode}
                                    selectedIds={selectedMediaIds}
                                    onToggleSelection={(id) => {
                                        const newSet = new Set(selectedMediaIds);
                                        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                                        setSelectedMediaIds(newSet);
                                    }}
                                    onMediaClick={handleMediaClick}
                                    onEditAsset={() => { }}
                                // onDeleteAsset={handleDeleteAsset}
                                />
                            ) : (
                                <DocumentList
                                    assets={relatedMedia}
                                    selectedIds={selectedMediaIds}
                                    isSelectionMode={isSelectionMode}
                                    onToggleSelection={(id) => {
                                        const newSet = new Set(selectedMediaIds);
                                        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                                        setSelectedMediaIds(newSet);
                                    }}
                                    onDeleteAsset={handleDeleteAsset}
                                />
                            )}
                        </>
                    )}
                </div>
            )}

            {/* [ZEN] Mount Wizard Modal */}
            {showWizard && (
                <FamilyTreeWizard
                    allTags={allTags}
                    allMedia={allMedia}
                    onClose={() => setShowWizard(false)}
                    initialFocalId={formData.id}
                    currentTagOverride={formData} // [ZEN FIX] Pass current edit state
                    onUpdateTag={(updatedTag) => {
                        // Propagate update via updateFormData which saves to Firestore
                        updateFormData(updatedTag);
                    }}
                />
            )}
        </div>
    );
};