import React, { useState, useEffect } from 'react';
import { 
    X, MapPin, Calendar, Tag as TagIcon, Info, 
    CalendarDays, Plus, Search, 
    User as UserIcon, 
    Dog, Package, Globe,
    Trash2, Check, AlertCircle,
    MessageSquare, 
    Sparkles 
} from 'lucide-react';
import type { Media, Tag, User } from '@/types';
import { appDataService } from '../../services/serviceManager';
import { GlassButton } from '../GlassButton'; 
import { GigiCoreIcon } from '../icons/GigiCoreIcon'; 

interface MediaEditorProps {
    asset: Media;
    onClose: () => void;
    userId: string;
    allTags: Tag[];
    onUpdateAsset: (asset: Media) => void;
    userSettings?: User['settings'];
    onDelete?: (id: string) => void;
    onTagCreated?: (tag: Tag) => void;
    isStaged?: boolean;
    onDiscuss?: (asset: Media) => void; 
    aiName?: string; 
}

export const MediaEditor: React.FC<MediaEditorProps> = ({
    asset, onClose, userId, allTags, onUpdateAsset, userSettings, onDelete, onTagCreated,
    isStaged = false,
    onDiscuss,
    aiName = "Gigi"
}) => {
    // --- STATE ---
    const [formData, setFormData] = useState<Media>({
        ...asset,
        tagIds: asset.tagIds || []
    });
    
    const [activeTab, setActiveTab] = useState<'tags' | 'details'>('tags');
    const [isSaving, setIsSaving] = useState(false);
    const [dateInput, setDateInput] = useState('');
    
    // Tagging State
    const [entitySearch, setEntitySearch] = useState('');
    const [contextSearch, setContextSearch] = useState('');
    const [localTagCache, setLocalTagCache] = useState<Tag[]>([]);
    
    // --- INIT ---
    useEffect(() => {
        setFormData({
            ...asset,
            tagIds: asset.tagIds || []
        });
        setLocalTagCache([]);

        if (asset.logicalDate) {
            try {
                setDateInput(new Date(asset.logicalDate).toISOString().slice(0, 16));
            } catch (e) { setDateInput(''); }
        }
    }, [asset.id]);

    // --- HELPERS ---
    const getTagIcon = (type: Tag['type']) => {
        switch (type) {
            case 'person': return <UserIcon size={12} />;
            case 'pet': return <Dog size={12} />;
            case 'place': return <MapPin size={12} />;
            case 'thing': return <Package size={12} />;
            case 'event': return <Calendar size={12} />;
            default: return <TagIcon size={12} />;
        }
    };

    const getTagColor = (type: Tag['type']) => {
        switch (type) {
            case 'person': return 'text-violet-400 bg-violet-400/10 border-violet-400/20';
            case 'pet': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
            case 'place': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
            case 'thing': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
            case 'event': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
            default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
        }
    };

    // --- ACTIONS ---
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Only save to DB if not in staging mode
            if (!isStaged) {
                await appDataService.saveMedia(userId, formData);
            }
            
            onUpdateAsset(formData);

            if (!isStaged) {
                onClose();
            }
        } catch (e) {
            console.error("Save failed", e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setDateInput(val);
        if (val) {
            const d = new Date(val);
            setFormData(prev => ({ 
                ...prev, 
                logicalDate: d.toISOString(),
                year: d.getFullYear()
            }));
        }
    };

    const handleAddTag = (tagId: string) => {
        const currentTags = formData.tagIds || [];
        if (!currentTags.includes(tagId)) {
            setFormData(prev => ({ ...prev, tagIds: [...currentTags, tagId] }));
        }
        setEntitySearch(''); 
        setContextSearch('');
    };

    // Smart Create Logic
    const handleSmartCreate = async (type: Tag['type']) => {
        const name = entitySearch.trim();
        if (!name) return;

        let initialMetadata: any = {};
        
        switch (type) {
            case 'person':
                initialMetadata = { 
                    dates: { birth: '' }, 
                    gender: 'Prefer not to say', 
                    relationships: [], 
                    locations: [], 
                    contacts: [], 
                    emails: [], 
                    socials: [] 
                };
                break;
            case 'pet':
                initialMetadata = { 
                    species: 'Unknown', 
                    dates: { adoption: '' }, 
                    medical: { vetName: '', conditions: [] }, 
                    documents: [] 
                };
                break;
            case 'place':
                initialMetadata = { 
                    address: '', 
                    significance: '', 
                    coordinates: { lat: 0, lng: 0 } 
                };
                break;
            case 'thing':
                initialMetadata = { 
                    acquisition: { date: '', cost: 0, sourceTagId: '' }, 
                    status: { currentVal: 0, condition: '', locationTagId: '' }, 
                    purpose: '' 
                };
                break;
            case 'event':
                initialMetadata = {};
                break;
            default:
                initialMetadata = {};
        }

        const newTag = {
            id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            type: type,
            mainImageId: asset.id,
            description: `Created from ${asset.originalName || 'media'}`,
            privateNotes: '',
            isPrivate: false,
            tagIds: [],
            mediaIds: [asset.id],
            mediaGallery: [],
            metadata: initialMetadata 
        } as Tag;

        try {
            await appDataService.saveTag(userId, newTag);
            setLocalTagCache(prev => [...prev, newTag]);
            handleAddTag(newTag.id);
            if (onTagCreated) onTagCreated(newTag);
            setEntitySearch('');
        } catch (e) {
            console.error("Smart Create Failed", e);
            alert("Failed to create new entity.");
        }
    };

    const handleCreateContextTag = async () => {
        const tagName = contextSearch.trim();
        if (!tagName) return;

        const effectiveAllTags = [...allTags, ...localTagCache];
        const lowerName = tagName.toLowerCase();

        const alreadyLinked = effectiveAllTags
            .filter(t => formData.tagIds?.includes(t.id))
            .some(t => t.name.toLowerCase() === lowerName);

        if (alreadyLinked) {
            setContextSearch(''); 
            return;
        }

        const existingGlobalTag = effectiveAllTags.find(t => t.name.toLowerCase() === lowerName);

        if (existingGlobalTag) {
            handleAddTag(existingGlobalTag.id);
        } else {
            const newTag: Tag = {
                id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: tagName,
                type: 'context',
                description: '',
                privateNotes: '',
                isPrivate: false,
                tagIds: [],
                mediaIds: [],
                metadata: { isSystem: false },
                mediaGallery: [] 
            };

            try {
                await appDataService.saveTag(userId, newTag);
                setLocalTagCache(prev => [...prev, newTag]);
                handleAddTag(newTag.id);
                if (onTagCreated) onTagCreated(newTag);
            } catch (e) {
                console.error("Failed to create new tag:", e);
            }
        }
        setContextSearch(''); 
    };

    const handleRemoveTag = (tagId: string) => {
        setFormData(prev => ({ 
            ...prev, 
            tagIds: (prev.tagIds || []).filter(id => id !== tagId) 
        }));
    };

    const handleDelete = () => {
        if (isStaged || !onDelete) return;
        if (window.confirm("Permanently delete this artifact?")) {
            onDelete(asset.id);
            onClose();
        }
    };

    // --- DERIVED DATA ---
    const safeTagIds = formData.tagIds || [];
    
    // De-duplicate tags
    const effectiveAllTags = [...allTags, ...localTagCache].reduce((acc, tag) => {
        if (!acc.some(t => t.id === tag.id)) acc.push(tag);
        return acc;
    }, [] as Tag[]);

    const linkedTags = effectiveAllTags
        .filter(t => safeTagIds.includes(t.id))
        .sort((a, b) => a.name.localeCompare(b.name));

    const activeEntityTags = linkedTags.filter(t => ['person', 'pet', 'place', 'thing', 'event'].includes(t.type));
    const activeContextTags = linkedTags.filter(t => !['person', 'pet', 'place', 'thing', 'event'].includes(t.type));

    const availableEntityTags = effectiveAllTags
        .filter(t => ['person', 'pet', 'place', 'thing', 'event'].includes(t.type))
        .filter(t => t.name.toLowerCase().includes(entitySearch.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

    const availableContextTags = effectiveAllTags
        .filter(t => !['person', 'pet', 'place', 'thing', 'event'].includes(t.type))
        .filter(t => t.name.toLowerCase().includes(contextSearch.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));
    
    const hasExactEntityMatch = availableEntityTags.some(t => t.name.toLowerCase() === entitySearch.trim().toLowerCase());

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 animate-in fade-in zoom-in-95">
            <div className="bg-[#0f1219] w-full max-w-6xl h-[90vh] rounded-3xl border border-white/10 shadow-2xl flex flex-col md:flex-row overflow-hidden relative">
                
                {/* --- LEFT: IMAGE VIEWPORT (Framed) --- */}
                <div className="flex-1 bg-[#050505] relative flex items-center justify-center p-8 border-r border-white/5 pattern-grid-lg">
                    <div className="absolute inset-0 bg-[url('/assets/grid.png')] opacity-5 pointer-events-none"></div>
                    
                    {formData.fileType && formData.fileType.startsWith('video/') ? (
                         <video 
                            src={formData.url} 
                            controls 
                            className="max-w-full max-h-full rounded-lg shadow-2xl border border-white/10"
                        />
                    ) : (
                        <div className="relative group">
                            <img 
                                src={formData.url || formData.thumbnailUrl} 
                                alt={formData.caption} 
                                className="max-w-full max-h-[80vh] rounded-lg shadow-2xl border border-white/10 object-contain"
                            />
                            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                {formData.width} x {formData.height}
                            </div>
                        </div>
                    )}

                    <button 
                        onClick={onClose} 
                        className="absolute top-4 left-4 p-2 bg-black/50 hover:bg-white/10 text-white rounded-full transition-colors z-50 backdrop-blur-md border border-white/10"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* --- RIGHT: CONTROL PANEL --- */}
                <div className="w-full md:w-[450px] bg-[#13161f] flex flex-col h-full border-l border-white/10 shadow-2xl z-20">
                    
                    {/* Header */}
                    <div className="p-5 border-b border-white/10 bg-[#0f1219]">
                        <input 
                            type="text" 
                            value={formData.title || formData.originalName || ''}
                            onChange={e => setFormData({...formData, title: e.target.value})}
                            placeholder="Untitled Artifact"
                            className="w-full bg-transparent text-xl font-bold text-white placeholder-slate-600 focus:outline-none focus:placeholder-slate-500"
                        />
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-mono">
                            {isStaged ? (
                                <span className="bg-yellow-500/20 px-1.5 py-0.5 rounded text-yellow-400 border border-yellow-500/30">STAGED</span>
                            ) : (
                                <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">{formData.fileType ? formData.fileType.split('/')[1].toUpperCase() : 'FILE'}</span>
                            )}
                            <span>•</span>
                            <span>{(formData.size ? (formData.size / 1024 / 1024).toFixed(2) : 0)} MB</span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-white/5 bg-[#0a0c10]">
                        <button 
                            onClick={() => setActiveTab('tags')} 
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'tags' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            <TagIcon size={14} /> Entities & Tags
                        </button>
                        <button 
                            onClick={() => setActiveTab('details')} 
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'details' ? 'border-violet-500 text-violet-400 bg-violet-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            <Info size={14} /> Meta & Context
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                        
                        {activeTab === 'tags' && (
                            <div className="space-y-6 animate-in slide-in-from-right-2 fade-in">
                                
                                {/* --- ENTITIES SECTION --- */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <UserIcon size={12} className="text-cyan-500"/> Identify Entities
                                    </h4>
                                    
                                    <div className="relative group mb-3">
                                        <div className="flex items-center bg-[#0a0c10] border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-cyan-500/50 transition-colors">
                                            <Search size={14} className="text-slate-500 mr-2" />
                                            <input 
                                                type="text"
                                                value={entitySearch}
                                                onChange={e => setEntitySearch(e.target.value)}
                                                placeholder="Who is in this?"
                                                className="bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none w-full"
                                            />
                                        </div>

                                        {entitySearch && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1d26] border border-white/10 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto custom-scrollbar">
                                                {!hasExactEntityMatch && (
                                                    <div className="p-3 border-b border-white/5 bg-cyan-900/10">
                                                        <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mb-2">Create "{entitySearch}" as:</p>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <button onClick={() => handleSmartCreate('person')} className="flex flex-col items-center p-2 bg-white/5 hover:bg-cyan-500/20 border border-white/10 rounded-lg transition-colors group">
                                                                <UserIcon size={16} className="text-slate-400 group-hover:text-cyan-300 mb-1"/>
                                                                <span className="text-[9px] text-slate-300">Person</span>
                                                            </button>
                                                            <button onClick={() => handleSmartCreate('pet')} className="flex flex-col items-center p-2 bg-white/5 hover:bg-amber-500/20 border border-white/10 rounded-lg transition-colors group">
                                                                <Dog size={16} className="text-slate-400 group-hover:text-amber-300 mb-1"/>
                                                                <span className="text-[9px] text-slate-300">Pet</span>
                                                            </button>
                                                            <button onClick={() => handleSmartCreate('place')} className="flex flex-col items-center p-2 bg-white/5 hover:bg-emerald-500/20 border border-white/10 rounded-lg transition-colors group">
                                                                <MapPin size={16} className="text-slate-400 group-hover:text-emerald-300 mb-1"/>
                                                                <span className="text-[9px] text-slate-300">Place</span>
                                                            </button>
                                                            <button onClick={() => handleSmartCreate('thing')} className="flex flex-col items-center p-2 bg-white/5 hover:bg-blue-500/20 border border-white/10 rounded-lg transition-colors group">
                                                                <Package size={16} className="text-slate-400 group-hover:text-blue-300 mb-1"/>
                                                                <span className="text-[9px] text-slate-300">Thing</span>
                                                            </button>
                                                            <button onClick={() => handleSmartCreate('event')} className="flex flex-col items-center p-2 bg-white/5 hover:bg-rose-500/20 border border-white/10 rounded-lg transition-colors group">
                                                                <Calendar size={16} className="text-slate-400 group-hover:text-rose-300 mb-1"/>
                                                                <span className="text-[9px] text-slate-300">Event</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {availableEntityTags.length > 0 ? availableEntityTags.map(tag => {
                                                    const isAlreadyLinked = safeTagIds.includes(tag.id);
                                                    return (
                                                        <button 
                                                            key={tag.id}
                                                            onClick={() => !isAlreadyLinked && handleAddTag(tag.id)}
                                                            className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 flex items-center gap-3 group/item transition-colors ${isAlreadyLinked ? 'bg-red-500/10 hover:bg-red-500/20 cursor-default' : 'hover:bg-white/5'}`}
                                                        >
                                                            <div className={`w-2 h-2 rounded-full ${getTagColor(tag.type).split(' ')[1]}`}></div>
                                                            <span className={`text-sm ${isAlreadyLinked ? 'text-red-400' : 'text-slate-200 group-hover:text-white'}`}>{tag.name}</span>
                                                            <span className="text-[10px] uppercase text-slate-600 ml-auto bg-black/20 px-1.5 py-0.5 rounded">{tag.type}</span>
                                                            {isAlreadyLinked && <AlertCircle size={14} className="text-red-500 ml-2" />}
                                                        </button>
                                                    );
                                                }) : (
                                                    <div className="p-4 text-center text-xs text-slate-500 italic">
                                                        {hasExactEntityMatch ? "Entity already linked or cached." : "No matching entities found. Create one above."}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. ACTIVE TAGS */}
                                    <div className="flex flex-wrap gap-2">
                                        {activeEntityTags.length > 0 ? activeEntityTags.map(tag => (
                                            <span key={tag.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${getTagColor(tag.type)}`}>
                                                {getTagIcon(tag.type)}
                                                {tag.name}
                                                <button onClick={() => handleRemoveTag(tag.id)} className="ml-1 hover:text-white transition-colors opacity-60 hover:opacity-100"><X size={12}/></button>
                                            </span>
                                        )) : (
                                            <p className="text-xs text-slate-600 italic pl-1">No entities linked.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="h-px bg-white/5"></div>

                                {/* --- CONTEXT SECTION --- */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <TagIcon size={12} className="text-slate-400"/> Context Keywords
                                    </h4>
                                    
                                    <div className="relative group mb-3">
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={contextSearch}
                                                onChange={e => setContextSearch(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleCreateContextTag(); 
                                                    }
                                                }}
                                                placeholder="Add keyword (e.g. 'Beach')..."
                                                className="flex-1 bg-[#0a0c10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-slate-500 outline-none"
                                            />
                                            <button 
                                                onClick={handleCreateContextTag} 
                                                disabled={!contextSearch.trim()} 
                                                className={`p-2 rounded-lg border border-white/5 transition-colors ${!contextSearch.trim() ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                                            >
                                                <Plus size={14}/>
                                            </button>
                                        </div>

                                        {contextSearch && availableContextTags.length > 0 && (
                                            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1a1d26] border border-white/10 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                                                {availableContextTags.map(tag => {
                                                    const isAlreadyLinked = safeTagIds.includes(tag.id);
                                                    return (
                                                        <button 
                                                            key={tag.id}
                                                            onClick={() => !isAlreadyLinked && handleAddTag(tag.id)}
                                                            className={`w-full text-left px-4 py-2.5 border-b border-white/5 last:border-0 flex items-center gap-2 group/item transition-colors ${isAlreadyLinked ? 'bg-red-500/10 hover:bg-red-500/20 cursor-default' : 'hover:bg-white/5'}`}
                                                        >
                                                            <Globe size={12} className={isAlreadyLinked ? "text-red-500" : "text-cyan-500"} />
                                                            <span className={`text-xs ${isAlreadyLinked ? 'text-red-400' : 'text-slate-300 group-hover:text-white'}`}>{tag.name}</span>
                                                            {isAlreadyLinked && <AlertCircle size={12} className="text-red-500 ml-auto" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. ACTIVE TAGS */}
                                    <div className="flex flex-wrap gap-2">
                                        {activeContextTags.length > 0 ? activeContextTags.map(tag => (
                                            <span key={tag.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-700 bg-slate-800/50 text-slate-300 text-xs group">
                                                {tag.name}
                                                <button onClick={() => handleRemoveTag(tag.id)} className="ml-1 text-slate-500 hover:text-red-400"><X size={10}/></button>
                                            </span>
                                        )) : (
                                            <p className="text-xs text-slate-600 italic pl-1">No keywords linked.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'details' && (
                            <div className="space-y-6 animate-in slide-in-from-right-2 fade-in">
                                
                                <div className="bg-violet-500/5 border border-violet-500/20 p-4 rounded-xl">
                                    <label className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <CalendarDays size={12} /> Timeline Sort Date
                                    </label>
                                    <input 
                                        type="datetime-local" 
                                        value={dateInput}
                                        onChange={handleDateChange}
                                        className="w-full bg-[#0a0c10] border border-violet-500/30 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500"
                                    />
                                    <p className="text-[10px] text-violet-400/60 mt-2">Adjusting this moves the item in the Time Vortex.</p>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Caption</label>
                                    {/* [ZEN FIX] Added custom-scrollbar class */}
                                    <textarea 
                                        value={formData.caption || ''}
                                        onChange={e => setFormData({...formData, caption: e.target.value})}
                                        className="w-full bg-[#0a0c10] border border-white/10 rounded-xl p-3 text-sm text-slate-300 min-h-[80px] focus:border-cyan-500/50 outline-none resize-none leading-relaxed custom-scrollbar"
                                        placeholder="What is happening in this image?"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Info size={12} /> Hidden Context (For AI)
                                    </label>
                                    {/* [ZEN FIX] Added custom-scrollbar class */}
                                    <textarea 
                                        value={formData.description || ''}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        className="w-full bg-[#0a0c10] border border-white/10 rounded-xl p-3 text-xs text-slate-400 min-h-[100px] focus:border-slate-500/50 outline-none resize-none leading-relaxed font-mono custom-scrollbar"
                                        placeholder="Add background info the AI wouldn't know..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-white/10 bg-[#0f1219] flex justify-between items-center gap-4">
                       
                         {/* [ZEN NEW] Ask AI Button */}
                         {onDiscuss && (
                            <GlassButton 
                                onClick={() => onDiscuss(formData)} 
                                variant="secondary" 
                                className="group"
                            >
                                <GigiCoreIcon className="w-5 h-5 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] group-hover:scale-110 transition-transform" />
                                <span className="group-hover:text-cyan-400">Ask {aiName}</span>
                            </GlassButton>
                         )}

                         {!isStaged && onDelete && (
                            <button 
                                onClick={handleDelete}
                                className="p-3 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                                title="Delete Artifact"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                        
                        <div className="flex gap-3 flex-1 justify-end">
                            <button onClick={onClose} className="px-6 py-3 text-xs font-bold text-slate-400 hover:text-white transition-colors">
                                {isStaged ? 'CLOSE' : 'CANCEL'}
                            </button>
                            <button 
                                onClick={handleSave} 
                                disabled={isSaving}
                                className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-cyan-900/20 transition-all flex items-center gap-2"
                            >
                                {isSaving ? <span className="animate-pulse">SAVING...</span> : <><Check size={16} /> {isStaged ? 'APPLY CHANGES' : 'SAVE CHANGES'}</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};