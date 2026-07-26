import React, { useState, useEffect, useCallback } from 'react';
import { 
    Save, Calendar, Type, Hash, Loader2, Sparkles, MessageSquare 
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import type { Media, User as UserType } from '@/types';
import { GlassButton } from '../../GlassButton';
import { typesenseService } from '../../../services/typesenseService';

interface MetaPanelProps {
    media: Media;
    user: UserType;
    onUpdateLocal: (updated: Media) => void;
}

// [ZEN FIX] Helper to convert a Date object into the local "YYYY-MM-DDTHH:mm" string 
// required by the datetime-local input field.
const toLocalInputValue = (date: Date): string => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1); // Months are 0-indexed in JS
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const MetaPanel: React.FC<MetaPanelProps> = ({ media, user, onUpdateLocal }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [dateInput, setDateInput] = useState('');

    // Helper to reliably get a JavaScript Date object from various source types
    const getSafeDate = useCallback((val: any): Date => {
        if (!val) return new Date();
        if (val instanceof Date) return val;
        if (typeof val.toDate === 'function') return val.toDate(); // Firestore Timestamp
        if (typeof val === 'string') {
             const d = new Date(val);
             // Check for invalid date string and fall back to now
             return isNaN(d.getTime()) ? new Date() : d;
        }
        return new Date();
    }, []);

    const [form, setForm] = useState({
        title: media.title || '',
        description: media.description || '', 
        caption: media.caption || '',         
        // Store the UTC ISO string internally for the form state
        logicalDate: getSafeDate(media.logicalDate).toISOString()
    });

    useEffect(() => {
        const safeDateObj = getSafeDate(media.logicalDate);
        
        setForm({
            title: media.title || '',
            description: media.description || '',
            caption: media.caption || '',
            logicalDate: safeDateObj.toISOString()
        });

        // [ZEN FIX] Convert the safe Date object to the LOCAL string format for the input display
        setDateInput(toLocalInputValue(safeDateObj));

    }, [media.id, media.title, media.description, media.caption, media.logicalDate, getSafeDate]);

    // Called onBlur or Enter to update the internal form state from the input's local value
    const commitDateChange = () => {
        // new Date() interprets the "YYYY-MM-DDTHH:mm" string as LOCAL time, which is correct here.
        const d = new Date(dateInput);
        if (!isNaN(d.getTime())) {
            // Convert back to UTC ISO for storage
            setForm(prev => ({ ...prev, logicalDate: d.toISOString() }));
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        try {
            // Ensure the latest local input value is captured before saving
            const finalDate = new Date(dateInput);
            const dataToSave = { ...form };
            
            if (!isNaN(finalDate.getTime())) {
                // Ensure we save the UTC version
                dataToSave.logicalDate = finalDate.toISOString();
            }

            const mediaRef = doc(db, 'users', user.id, 'media', media.id);
            await updateDoc(mediaRef, { ...dataToSave });
            
            const updated = { ...media, ...dataToSave };
            onUpdateLocal(updated);
            
            await typesenseService.updateMedia(updated);
            
        } catch (error) {
            console.error("Meta Save failed", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, isTextArea = false) => {
        // Stop global navigation arrows from moving background records
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            e.stopPropagation();
        }

        // Handle Save shortcuts
        if (e.key === 'Enter') {
            if (isTextArea) {
                // Ctrl/Cmd + Enter for Textareas
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault(); 
                    e.stopPropagation();
                    handleSave();
                }
                // Normal enter adds a newline, so we don't stop propagation
            } else {
                // Standard Inputs save on Enter
                e.preventDefault();
                e.stopPropagation();
                handleSave();
            }
        }
    };

    const formatSize = (b?: number) => (!b ? 'Unknown' : (b / 1024 / 1024).toFixed(2) + ' MB');

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* 1. Title */}
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Title</label>
                <div className="relative group">
                    <Type size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input 
                        type="text" 
                        value={form.title}
                        onChange={e => setForm({...form, title: e.target.value})}
                        onKeyDown={(e) => handleKeyDown(e, false)}
                        className="w-full bg-[#1a1d26] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all placeholder-slate-600 font-medium shadow-inner"
                        placeholder="Enter title..."
                    />
                </div>
            </div>

            {/* 2. Short Caption */}
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare size={12}/> Caption / Context (Short)
                </label>
                <textarea 
                    rows={3}
                    value={form.caption}
                    onChange={e => setForm({...form, caption: e.target.value})}
                    onKeyDown={(e) => handleKeyDown(e, true)}
                    className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-4 text-sm text-slate-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none resize-y transition-all placeholder-slate-600 custom-scrollbar leading-relaxed shadow-inner"
                    placeholder="Short context (e.g., 'At the beach house')..."
                />
            </div>

            {/* 3. AI Analysis */}
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={12}/> AI Analysis (Full Description)
                </label>
                <textarea 
                    rows={10}
                    value={form.description}
                    onChange={e => setForm({...form, description: e.target.value})}
                    onKeyDown={(e) => handleKeyDown(e, true)}
                    className="w-full bg-[#111318] border border-cyan-900/30 rounded-xl p-4 text-xs font-mono text-cyan-100/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none resize-y transition-all placeholder-slate-700 custom-scrollbar leading-relaxed shadow-inner"
                    placeholder="Full AI generated description will appear here..."
                />
            </div>

            {/* 4. Date */}
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={12}/> Temporal Stamp
                </label>
                <input 
                    type="datetime-local" 
                    value={dateInput}
                    onChange={e => setDateInput(e.target.value)}
                    onBlur={commitDateChange}
                    onKeyDown={(e) => {
                        if(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.stopPropagation();
                        if(e.key === 'Enter') { 
                            e.preventDefault();
                            e.stopPropagation();
                            commitDateChange(); 
                            handleSave(); 
                        }
                    }}
                    className="w-full bg-[#1a1d26] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none font-mono shadow-inner uppercase tracking-wider"
                />
            </div>

            {/* 5. Forensics */}
            <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-3">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                    <Hash size={12} /> Forensics
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <span className="block text-[10px] text-slate-600">Format</span>
                        <span className="block text-xs font-mono text-cyan-400 uppercase">{media.fileType || 'UNK'}</span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-slate-600">Size</span>
                        <span className="block text-xs font-mono text-slate-300">{formatSize(media.size)}</span>
                    </div>
                    <div className="col-span-2">
                        <span className="block text-[10px] text-slate-600">Original Filename</span>
                        <span className="block text-xs font-mono text-slate-400 truncate" title={media.originalName}>
                            {media.originalName || 'Untitled'}
                        </span>
                    </div>
                </div>
            </div>

            <GlassButton 
                onClick={handleSave} 
                disabled={isSaving}
                variant="primary"
                className="w-full justify-center py-3 text-sm font-bold shadow-lg shadow-cyan-900/20"
            >
                {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}
                {isSaving ? 'Committing...' : 'Save Changes'}
            </GlassButton>
        </div>
    );
};