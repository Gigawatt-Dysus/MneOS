import React from 'react';
import { User, Dog, MapPin, Package, Calendar, Link as LinkIcon, Plus, X, Upload, Trash2, Grid, List, Tag as TagIcon, Globe, Camera } from 'lucide-react';
import type { Tag, Media, PersonTag, PetTag, PlaceTag, ThingTag, EventTag, Settings, AiCompanion } from '@/types';
import { GlassButton } from '../GlassButton';
import PersonForm from '../tags/PersonForm';
import PlaceForm from '../tags/PlaceForm';
import ThingForm from '../tags/ThingForm';
import EventTagForm from '../tags/EventTagForm';
import { MatrixGrid } from '../matrix/MatrixGrid';
import { DocumentList } from '../matrix/DocumentList';
import AddTagModal from '../AddTagModal';

// [ZEN FIX] Import the new modular PetForm
import PetForm from '../tags/pets';

const TypeButton = ({ icon: Icon, label, type, currentType, onTypeChange }: { icon: any, label: string, type: Tag['type'], currentType: string, onTypeChange: (t: Tag['type']) => void }) => {
    const isSelected = currentType === type;
    const typeStyles: Record<string, string> = {
        person: "bg-blue-600/60 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] border-blue-400/50 hover:bg-blue-500/70",
        pet: "bg-purple-600/60 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)] border-purple-400/50 hover:bg-purple-500/70",
        place: "bg-emerald-600/60 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] border-emerald-400/50 hover:bg-emerald-500/70",
        thing: "bg-amber-500/60 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)] border-amber-400/50 hover:bg-amber-400/70",
        event: "bg-rose-500/60 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] border-rose-400/50 hover:bg-rose-400/70",
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
            <Icon size={14}/> {label}
        </GlassButton>
    );
};

interface TagEditorTabsProps {
    activeTab: string;
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
}

export const TagEditorTabs: React.FC<TagEditorTabsProps> = ({
    activeTab, formData, allTags, settings, onChange, onMetadataChange, onTypeChange,
    onEnrollFace, isEnrolling, relatedMedia, groupedAssets, galleryViewMode, setGalleryViewMode,
    isSelectionMode, setIsSelectionMode, selectedMediaIds, setSelectedMediaIds, openMatrix,
    handleMediaClick, handleBatchUnlink, handleDeleteAsset, setShowAddTagModal, updateFormData,
    contextSearch, setContextSearch, contextSuggestions, onAddKeyword, onRemoveKeyword, primaryCompanion
}) => {
    const containerPadding = activeTab === 'gallery' ? 'p-0' : 'p-8';

    return (
        <div className={`flex-1 overflow-y-auto custom-scrollbar relative ${containerPadding}`}>
            {activeTab !== 'gallery' && (
                <>
                    {formData.type !== 'person' && activeTab === 'general' && (
                        <div className="space-y-8 max-w-3xl">
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
                                                        <Globe size={12} className="text-cyan-500"/> {s}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.keywords?.map(k => (
                                            <span key={k} className="flex items-center gap-1 bg-[#0f1219] text-cyan-200 border border-white/10 px-3 py-1 rounded-full text-xs font-medium">
                                                <TagIcon size={10} className="text-cyan-500/50" /> {k}
                                                <button onClick={() => onRemoveKeyword(k)} className="ml-1 text-slate-500 hover:text-red-400"><X size={12}/></button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {formData.type === 'person' && (
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
                        />
                    )}

                    {activeTab === 'details' && (
                        <div className="max-w-3xl">
                            {formData.type !== 'person' && (
                                <div className="mb-8 animate-in fade-in slide-in-from-bottom-4">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Description / Overview</label>
                                    <textarea 
                                        value={formData.description || ''} 
                                        onChange={e => onChange('description', e.target.value)} 
                                        className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-4 text-slate-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none h-32 resize-none text-sm leading-relaxed placeholder-slate-600 transition-all custom-scrollbar"
                                        placeholder={`Describe this ${formData.type}...`}
                                    />
                                </div>
                            )}

                            {/* [ZEN FIX] New PetForm Implementation */}
                            {formData.type === 'pet' && (
                                <PetForm 
                                    metadata={(formData as PetTag).metadata} 
                                    onChange={onMetadataChange} 
                                />
                            )}
                            
                            {formData.type === 'place' && <PlaceForm tag={formData as PlaceTag} onMetadataChange={onMetadataChange} settings={settings} />}
                            {formData.type === 'thing' && <ThingForm tag={formData as ThingTag} onMetadataChange={onMetadataChange} />}
                            {formData.type === 'event' && <EventTagForm tag={formData as EventTag} onMetadataChange={onMetadataChange} />}
                        </div>
                    )}

                    {activeTab === 'connections' && formData.type !== 'person' && (
                        <div className="max-w-3xl animate-in fade-in space-y-6">
                            <div className="bg-[#1a1d26] p-6 rounded-xl border border-white/5">
                                <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2">
                                    <LinkIcon size={16}/> Related Entities
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
                                    <Plus size={14}/> Add Connection
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'private' && (
                        <div className="space-y-4 max-w-3xl animate-in fade-in">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Private Notes</label>
                                <textarea 
                                    rows={6} 
                                    value={formData.privateNotes} 
                                    onChange={e => onChange('privateNotes', e.target.value)} 
                                    className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-4 text-slate-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none resize-none placeholder-slate-600 transition-all font-mono text-sm custom-scrollbar"
                                />
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
                             <button onClick={() => setGalleryViewMode('grid')} className={`p-2 rounded-lg ${galleryViewMode === 'grid' ? 'bg-[#0f1219] text-white shadow' : 'text-slate-500 hover:text-white'}`}><Grid size={16}/></button>
                             <button onClick={() => setGalleryViewMode('list')} className={`p-2 rounded-lg ${galleryViewMode === 'list' ? 'bg-[#0f1219] text-white shadow' : 'text-slate-500 hover:text-white'}`}><List size={16}/></button>
                        </div>
                        <div className="flex gap-2">
                            <GlassButton onClick={() => openMatrix('gallery')} variant="secondary" className="text-xs">
                                <Upload size={14} /> Add Media
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
                            <Camera size={32} className="mb-2 opacity-50"/>
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
                                    onEditAsset={() => {}}
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
        </div>
    );
};