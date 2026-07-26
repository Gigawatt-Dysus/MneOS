import React, { useState, useMemo } from 'react';
import { X, Brain, Check, Search, ChevronDown } from 'lucide-react';
import type { Media, Tag } from '../../types';
import { GlassButton } from '../GlassButton';
import emotionalDB from '../../data/emotionalDB.json';
import { EmotionVector } from '../../services/emotionValidator';

interface TensorAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedMedia: Media[];
    tags: Tag[];
    onAssign: (personTagId: string, tensorKey: string, mediaUrls: string[]) => void;
}

export const TensorAssignmentModal: React.FC<TensorAssignmentModalProps> = ({
    isOpen, onClose, selectedMedia, tags, onAssign
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [tensorKey, setTensorKey] = useState('');

    const personTags = tags.filter(t => t.type === 'person' && t.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const emotionGroups = useMemo(() => {
        const groups: Record<string, string[]> = {};
        (emotionalDB as EmotionVector[]).forEach(e => {
            const major = e['Major Emotional State'];
            const minor = e['Minor Valence'];
            if (!groups[major]) {
                groups[major] = [];
            }
            if (!groups[major].includes(minor)) {
                groups[major].push(minor);
            }
        });
        // Sort minors within each group
        Object.keys(groups).forEach(k => groups[k].sort());
        return groups;
    }, []);

    if (!isOpen) return null;

    const handleAssign = () => {
        if (!selectedPersonId || !tensorKey.trim()) return;
        const urls = selectedMedia.map(m => m.url);
        onAssign(selectedPersonId, tensorKey.trim(), urls);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#111318] border border-indigo-500/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.2)] flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40 shrink-0">
                    <div className="flex items-center gap-3 text-indigo-400">
                        <Brain size={20} />
                        <h2 className="font-bold tracking-widest uppercase text-sm">Assign EmoDB Tensor</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                    {/* Media Preview */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Selected Tensors ({selectedMedia.length})</label>
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                            {selectedMedia.map(m => (
                                <img key={m.id} src={m.thumbnailUrl || m.url} alt="" className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                            ))}
                        </div>
                    </div>

                    {/* Step 1: Select Person Tag */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">1. Target Identity (Person Tag)</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                type="text"
                                placeholder="Search Person Tags..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 focus:border-indigo-500 outline-none placeholder-slate-600"
                            />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                            {personTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => setSelectedPersonId(tag.id)}
                                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${selectedPersonId === tag.id ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-black/20 border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/20'}`}
                                >
                                    <div className="w-6 h-6 rounded bg-indigo-900/50 flex items-center justify-center font-bold text-xs shrink-0">
                                        {tag.name[0]}
                                    </div>
                                    <span className="text-xs truncate">{tag.name}</span>
                                    {selectedPersonId === tag.id && <Check size={14} className="ml-auto text-indigo-400" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Step 2: Define Tensor Key */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">2. Emotion / Gesture Key</label>
                        <div className="relative">
                            <select
                                value={tensorKey}
                                onChange={(e) => setTensorKey(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 pr-10 text-sm text-slate-200 focus:border-indigo-500 outline-none placeholder-slate-600 appearance-none cursor-pointer"
                            >
                                <option value="" disabled>Select Emotion / Gesture Key...</option>
                                {Object.entries(emotionGroups).sort(([a], [b]) => a.localeCompare(b)).map(([major, minors]) => (
                                    <optgroup key={major} label={major} className="bg-slate-900 text-indigo-300 font-bold">
                                        {minors.map(minor => (
                                            <option key={minor} value={minor} className="text-slate-200 font-normal">
                                                {minor}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">
                            Locked to EmoDB schema. The Vibe analyzer relies on these exact vector coordinates.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-black/40 border-t border-white/10 flex justify-end gap-3 shrink-0">
                    <GlassButton variant="ghost" onClick={onClose} className="text-slate-400 text-xs hover:text-white">Cancel</GlassButton>
                    <GlassButton 
                        variant="primary" 
                        onClick={handleAssign}
                        disabled={!selectedPersonId || !tensorKey.trim()}
                        className="text-xs text-white bg-indigo-600 hover:bg-indigo-500 border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.4)] disabled:opacity-50"
                    >
                        Save Tensor Array
                    </GlassButton>
                </div>
            </div>
        </div>
    );
};
