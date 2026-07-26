import React, { useState, useEffect, useCallback } from 'react';
import { 
    Save, Calendar, Type, Hash, Loader2, Sparkles, MessageSquare, ChevronDown 
} from 'lucide-react';
import { NeuralBridge } from '../../shared/NeuralBridge';
import { doc, updateDoc } from '../../../services/sovereignDbAdapter';
import { db } from '../../../firebaseConfig';
import type { Media, User as UserType } from '../../../types';
import { GlassButton } from '../../GlassButton';
import { appDataService } from '../../../services/serviceManager';
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
    const [datePrecision, setDatePrecision] = useState<'exact' | 'day' | 'month' | 'year' | 'unknown' | 'circa' | 'decade'>(media.datePrecision || 'exact');
    const [isPrecisionOpen, setIsPrecisionOpen] = useState(false);
    const [userPresets, setUserPresets] = useState<any[]>([]);
    const precisionRef = React.useRef<HTMLDivElement>(null);

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
        logicalDate: getSafeDate(media.logicalDate).toISOString(),
        isFiction: media.isFiction || false
    });

    useEffect(() => {
        const safeDateObj = getSafeDate(media.logicalDate);
        
        setForm({
            title: media.title || '',
            description: media.description || '',
            caption: media.caption || '',
            logicalDate: safeDateObj.toISOString(),
            isFiction: media.isFiction || false
        });

        setDateInput(toLocalInputValue(safeDateObj));
        setDatePrecision(media.datePrecision || 'exact');

    }, [media.id, media.title, media.description, media.caption, media.logicalDate, media.datePrecision, getSafeDate]);

    useEffect(() => {
        const fetchPresets = async () => {
            try {
                const presets = await appDataService.getUserPresets(user.id);
                setUserPresets(presets);
            } catch (e) {
                // Fallback to empty if not found
            }
        };
        fetchPresets();
    }, [user.id]);

    // Handle clicking outside the precision dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (precisionRef.current && !precisionRef.current.contains(e.target as Node)) {
                setIsPrecisionOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
            const updates = { ...dataToSave, datePrecision };
            await updateDoc(mediaRef, updates);
            
            const updated = { ...media, ...updates };
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
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Title</label>
                    <NeuralBridge
                        value={form.title}
                        onChange={(val) => setForm({...form, title: val})}
                        userId={user.id}
                        userPresets={userPresets}
                        label="Rewrite Title"
                    />
                </div>
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
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare size={12}/> Caption / Context (Short)
                    </label>
                    <NeuralBridge
                        value={form.caption}
                        onChange={(val) => setForm({...form, caption: val})}
                        userId={user.id}
                        userPresets={userPresets}
                        label="Neural Caption"
                    />
                </div>
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
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles size={12}/> AI Analysis (Full Description)
                    </label>
                    <NeuralBridge
                        value={form.description}
                        onChange={(val) => setForm({...form, description: val})}
                        userId={user.id}
                        userPresets={userPresets}
                        label="Analyze Logic"
                    />
                </div>
                <textarea 
                    rows={10}
                    value={form.description}
                    onChange={e => setForm({...form, description: e.target.value})}
                    onKeyDown={(e) => handleKeyDown(e, true)}
                    className="w-full bg-[#111318] border border-cyan-900/30 rounded-xl p-4 text-xs font-mono text-cyan-100/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none resize-y transition-all placeholder-slate-700 custom-scrollbar leading-relaxed shadow-inner"
                    placeholder="Full AI generated description will appear here..."
                />
            </div>

            {/* 4. Date & Precision */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Calendar size={12}/> Temporal Stamp
                    </label>
                    <div className="relative" ref={precisionRef}>
                        <button
                            onClick={() => setIsPrecisionOpen(!isPrecisionOpen)}
                            className="flex items-center gap-2 px-2 py-1 rounded bg-black/40 border border-white/10 text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:bg-black/60 transition-colors"
                        >
                            {datePrecision === 'exact' ? 'Exact Time' : datePrecision === 'day' ? 'Date Only' : datePrecision === 'month' ? 'Month & Year' : 'Year Only'}
                            <ChevronDown size={10} className={`transition-transform duration-300 ${isPrecisionOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isPrecisionOpen && (
                            <div className="absolute right-0 top-full mt-2 w-40 bg-[#161b22] border border-white/10 rounded-lg shadow-2xl z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                {[
                                    { id: 'exact', label: 'Exact Time' },
                                    { id: 'day', label: 'Date Only' },
                                    { id: 'month', label: 'Month & Year' },
                                    { id: 'year', label: 'Year Only' }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => {
                                            setDatePrecision(opt.id as any);
                                            setIsPrecisionOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors border-b border-white/5 last:border-b-0 ${
                                            datePrecision === opt.id ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="relative group">
                    <input 
                        type={datePrecision === 'year' ? 'number' : datePrecision === 'month' ? 'month' : datePrecision === 'day' ? 'date' : 'datetime-local'}
                        value={datePrecision === 'year' ? dateInput.substring(0, 4) : 
                               datePrecision === 'month' ? dateInput.substring(0, 7) : 
                               datePrecision === 'day' ? dateInput.substring(0, 10) : 
                               dateInput}
                        onChange={e => {
                            const val = e.target.value;
                            if (datePrecision === 'year') setDateInput(`${val}-01-01T00:00`);
                            else if (datePrecision === 'month') setDateInput(`${val}-01T00:00`);
                            else if (datePrecision === 'day') setDateInput(`${val}T00:00`);
                            else setDateInput(val);
                        }}
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
            </div>

            {/* 4.5. Fictional Lore Toggle */}
            <div className="bg-fuchsia-950/20 border border-fuchsia-500/20 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <h3 className="text-[10px] font-bold text-fuchsia-400 uppercase flex items-center gap-2">
                        <Sparkles size={12} /> Fictional Lore
                    </h3>
                    <p className="text-[10px] text-fuchsia-300/70 mt-1">Silos this media from the Reality Matrix.</p>
                </div>
                <button
                    onClick={() => setForm({...form, isFiction: !form.isFiction})}
                    className={`w-10 h-5 rounded-full relative transition-colors duration-300 focus:outline-none ${form.isFiction ? 'bg-fuchsia-500' : 'bg-slate-700'}`}
                >
                    <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${form.isFiction ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
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