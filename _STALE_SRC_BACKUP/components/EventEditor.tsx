import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Plus, Calendar, Image as ImageIcon, Tag as TagIcon } from 'lucide-react';
import type { LifeEvent, Tag, Media, AddressData } from '@/types'; 
import { AddressAutocomplete } from './AddressAutocomplete'; 
import { MarkdownEditor } from './shared/MarkdownEditor'; 

interface EventEditorProps {
    event: Partial<LifeEvent>; 
    allTags: Tag[];
    allMedia: Media[];
    onSave: (event: LifeEvent) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
    onCreateTag: (name: string, type: string) => Promise<Tag>;
}

const EventEditor: React.FC<EventEditorProps> = ({ event, allTags, allMedia, onSave, onDelete, onCancel, onCreateTag }) => {
    const [title, setTitle] = useState(event.title || '');
    const [date, setDate] = useState<string>(
        event.date ? new Date(event.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    );
    const [details, setDetails] = useState(event.details || '');
    const [selectedTags, setSelectedTags] = useState<string[]>(event.tagIds || []);
    const [attachedMediaIds, setAttachedMediaIds] = useState<string[]>(
        event.mediaIds || (event as any).mediaUrls || [] 
    );
    const [location, setLocation] = useState<AddressData | undefined>(event.location);
    const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [isMediaMenuOpen, setIsMediaMenuOpen] = useState(false);

    useEffect(() => {
        setTitle(event.title || '');
        setDate(event.date ? new Date(event.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        setDetails(event.details || '');
        setSelectedTags(event.tagIds || []);
        setAttachedMediaIds(event.mediaIds || (event as any).mediaUrls || []); 
        setLocation(event.location);
    }, [event]);

    const handleSave = () => {
        if (!title.trim()) return; 
        const updatedEvent: any = {
            id: event.id || `event-${Date.now()}`, 
            title,
            date: new Date(date), 
            details,
            tagIds: selectedTags,
            mediaIds: attachedMediaIds,
            location,
            comments: event.comments || []
        };
        onSave(updatedEvent);
    };

    const toggleTag = (tagId: string) => setSelectedTags(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
    const toggleMedia = (mediaId: string) => setAttachedMediaIds(prev => prev.includes(mediaId) ? prev.filter(id => id !== mediaId) : [...prev, mediaId]);

    const handleCreateTag = async () => {
        if (newTagName.trim()) {
            const newTag = await onCreateTag(newTagName, 'concept'); 
            setSelectedTags(prev => [...prev, newTag.id]);
            setNewTagName('');
            setIsTagMenuOpen(false);
        }
    };

    const availableTags = allTags.filter(t => !selectedTags.includes(t.id));
    const availableMedia = allMedia.filter(m => !attachedMediaIds.includes(m.id));
    const selectedTagObjects = allTags.filter(t => selectedTags.includes(t.id));
    
    const selectedMediaObjects = attachedMediaIds.map(id => {
        const found = allMedia.find(m => m.id === id);
        if (found) return found;
        if (id.startsWith('http') || id.startsWith('blob:')) {
            // [ZEN FIX] Added missing mediaIds property
            return {
                id, url: id, thumbnailUrl: id, caption: 'Provisional Image',
                uploadDate: new Date(), fileType: 'image/unknown', fileName: 'unknown', size: 0,
                tagIds: [], status: 'provisional',
                mediaIds: [] 
            } as Media; 
        }
        return null;
    }).filter(Boolean) as Media[];

    return (
        <div className="max-w-5xl mx-auto h-[90vh] mt-4 bg-[#0f1219] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#13161f]">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                    {event.id?.startsWith('event-') ? 'Log New Event' : 'Edit Memory'}
                </h2>
                <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                
                {/* Title & Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Title</label>
                        <input 
                            type="text" value={title} onChange={e => setTitle(e.target.value)} 
                            placeholder="e.g., Summer Vacation 1999"
                            className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1a1d26] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input 
                                type="date" value={date} onChange={e => setDate(e.target.value)} 
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-white/10 bg-[#1a1d26] text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Details - Replaced Textarea with MarkdownEditor */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Details</label>
                    <div className="min-h-[250px] border border-white/10 rounded-xl bg-[#1a1d26] overflow-hidden">
                        <MarkdownEditor 
                            value={details} 
                            onChange={setDetails} 
                            hideFooter={true} 
                            placeholder="Describe what happened..."
                            className="h-full min-h-[300px]"
                        />
                    </div>
                </div>

                {/* Location */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Location</label>
                    <div className="bg-[#1a1d26] rounded-xl border border-white/10 p-1">
                        <AddressAutocomplete 
                            value={location || { streetAddress: '', addressLocality: '', addressRegion: '', postalCode: '' }}
                            onChange={setLocation}
                            apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                        />
                    </div>
                </div>

                {/* Tags */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Tags</label>
                        <button onClick={() => setIsTagMenuOpen(!isTagMenuOpen)} className="text-xs font-bold text-cyan-500 hover:text-cyan-400 flex items-center gap-1 uppercase tracking-wider">
                            <Plus className="w-4 h-4" /> Add Tag
                        </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 min-h-[50px] p-4 rounded-xl border border-white/10 bg-[#1a1d26]">
                        {selectedTagObjects.length > 0 ? (
                            selectedTagObjects.map(tag => (
                                <span key={tag.id} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0f1219] text-slate-300 text-sm border border-white/10">
                                    <TagIcon className="w-3 h-3 text-cyan-500" />
                                    {tag.name}
                                    <button onClick={() => toggleTag(tag.id)} className="hover:text-red-400 ml-1"><X className="w-3 h-3" /></button>
                                </span>
                            ))
                        ) : (
                            <span className="text-slate-600 italic text-sm">No tags selected.</span>
                        )}
                    </div>

                    {isTagMenuOpen && (
                        <div className="mt-2 p-4 bg-[#1a1d26] rounded-xl border border-white/10 shadow-xl animate-in slide-in-from-top-2">
                            <div className="flex gap-2 mb-3">
                                <input 
                                    type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)}
                                    placeholder="New tag name..."
                                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-white/10 bg-[#0f1219] text-white focus:outline-none focus:border-cyan-500/50"
                                />
                                <button onClick={handleCreateTag} disabled={!newTagName.trim()} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold disabled:opacity-50">Create</button>
                            </div>
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                                {availableTags.map(tag => (
                                    <button key={tag.id} onClick={() => toggleTag(tag.id)} className="px-3 py-1.5 rounded-lg bg-[#0f1219] border border-white/5 text-slate-400 hover:text-white hover:border-white/20 text-sm transition-colors">
                                        {tag.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Media */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Associated Media</label>
                        <button onClick={() => setIsMediaMenuOpen(!isMediaMenuOpen)} className="text-xs font-bold text-violet-500 hover:text-violet-400 flex items-center gap-1 uppercase tracking-wider">
                            <Plus className="w-4 h-4" /> Add from Matrix
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4 rounded-xl border border-white/10 bg-[#1a1d26] min-h-[120px]">
                        {selectedMediaObjects.length > 0 ? (
                            selectedMediaObjects.map(media => (
                                <div key={media.id} className="relative group aspect-square rounded-xl overflow-hidden border border-white/10">
                                    <img src={media.thumbnailUrl || media.url} alt="media" className="w-full h-full object-cover" />
                                    <button onClick={() => toggleMedia(media.id)} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2 text-[10px] text-white truncate">
                                        {media.caption || 'No caption'}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full flex flex-col items-center justify-center text-slate-600 italic h-full">
                                <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                                <span>No media attached. Click to select from Matrix.</span>
                            </div>
                        )}
                    </div>

                    {isMediaMenuOpen && (
                        <div className="mt-2 p-4 bg-[#1a1d26] rounded-xl border border-white/10 shadow-xl max-h-60 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {availableMedia.map(m => (
                                    <div key={m.id} onClick={() => toggleMedia(m.id)} className="cursor-pointer border-2 border-transparent hover:border-cyan-500 rounded-lg overflow-hidden aspect-square relative group">
                                        <img src={m.thumbnailUrl || m.url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt="select" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-[#13161f] flex justify-between items-center">
                {event.id && !event.id.startsWith('event-') ? (
                    <button onClick={() => onDelete(event.id!)} className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors font-bold text-sm">
                        <Trash2 className="w-4 h-4" /> Delete Event
                    </button>
                ) : <div></div>}
                
                <div className="flex gap-4">
                    <button onClick={onCancel} className="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-8 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-900/30 transition-all hover:scale-105">
                        <Save className="w-4 h-4" /> Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EventEditor;