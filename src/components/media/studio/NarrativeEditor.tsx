import React, { useState, useEffect } from 'react';
import { Wand2, Package, Loader2, Sparkles, Lock, ChevronDown } from 'lucide-react';
import { WikiTagEditor } from '../../shared/WikiTagEditor';
import type { Tag } from '../../../types';

interface NarrativeEditorProps {
    initialDescription: string;
    initialNarrative: string;
    initialPrivateDetails: string;
    onFieldChange: (field: 'title' | 'description' | 'narrative' | 'privateDetails', val: string) => void;
    isSparkling: boolean;
    handleSparkle: (directive?: string) => void;
    sparkleString: string;
    setIsDirty: (val: boolean) => void;
    targetField?: 'description' | 'narrative' | 'title' | null;
    isResurrecting?: boolean;
    onResurrect?: () => void;
    userId?: string;
    onTagCreated?: (tag: Tag) => void;
}

const NarrativeEditor = React.memo(({ 
    initialDescription, initialNarrative, initialPrivateDetails, onFieldChange, 
    isSparkling, handleSparkle, sparkleString, setIsDirty, targetField,
    isResurrecting, onResurrect, userId, onTagCreated
}: NarrativeEditorProps) => {
    
    const [descriptionValue, setDescriptionValue] = useState(initialDescription);
    const [narrativeValue, setNarrativeValue] = useState(initialNarrative);
    const [privateDetailsValue, setPrivateDetailsValue] = useState(initialPrivateDetails);
    const [isPrivateOpen, setIsPrivateOpen] = useState(false);
    const [museDirective, setMuseDirective] = useState('');
    const [isMuseOpen, setIsMuseOpen] = useState(false);

    const checkAuth = () => {
        try {
            const authData = localStorage.getItem('gigi_vault_auth');
            if (authData) {
                const { expires } = JSON.parse(authData);
                if (Date.now() < expires) return true;
            }
        } catch (e) {
            // parsing error
        }
        return false;
    };

    const [isAuthenticated, setIsAuthenticated] = useState(checkAuth);
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState(false);

    const handleUnlock = () => {
        if (passwordInput.toLowerCase() === 'commander' || passwordInput.toLowerCase() === 'zen') {
            const authData = { expires: Date.now() + 1000 * 60 * 60 * 24 }; // 24 hours expiry
            localStorage.setItem('gigi_vault_auth', JSON.stringify(authData));
            setIsAuthenticated(true);
            setAuthError(false);
            setPasswordInput('');
        } else {
            setAuthError(true);
        }
    };

    const handleLock = () => {
        localStorage.removeItem('gigi_vault_auth');
        setIsAuthenticated(false);
        setIsPrivateOpen(false);
    };

    useEffect(() => {
        console.log("[NarrativeEditor] sparkleString useEffect triggered. sparkleString:", `"${sparkleString}"`);
        if (sparkleString) {
            console.log("[NarrativeEditor] Setting descriptionValue state & calling parent onFieldChange with:", `"${sparkleString}"`);
            setDescriptionValue(sparkleString);
            onFieldChange('description', sparkleString);
            onFieldChange('title', sparkleString);
        }
    }, [sparkleString, onFieldChange]);

    useEffect(() => {
        console.log("[NarrativeEditor] initialDescription useEffect triggered. initialDescription:", `"${initialDescription}"`, "current descriptionValue:", `"${descriptionValue}"`);
        if (initialDescription !== descriptionValue) {
            console.log("[NarrativeEditor] Overriding descriptionValue state with initialDescription:", `"${initialDescription}"`);
            setDescriptionValue(initialDescription);
        }
    }, [initialDescription]);

    useEffect(() => {
        if (initialNarrative !== narrativeValue) {
            setNarrativeValue(initialNarrative);
        }
    }, [initialNarrative]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* 1. ARTIFACT LABEL (Short) */}
            <div className="space-y-3 relative">
                <div className="flex items-center justify-between">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${targetField === 'description' ? 'text-cyan-400' : 'text-slate-500'}`}>
                        Artifact Label {targetField === 'description' && '• TARGET'}
                    </label>
                    <button 
                        onClick={() => setIsMuseOpen(!isMuseOpen)}
                        disabled={isSparkling}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all disabled:opacity-30 animate-in fade-in"
                    >
                        <Wand2 className={`w-3 h-3 ${isSparkling ? 'animate-pulse text-yellow-400' : ''}`} />
                        {isSparkling ? 'MUSING...' : 'NEURAL MUSE'}
                    </button>
                </div>

                {/* Neural Muse Interactive Popover Panel */}
                {isMuseOpen && (
                    <div className="absolute right-0 top-10 w-[320px] bg-[#0d1017] border border-cyan-500/30 rounded-2xl p-4 shadow-2xl z-[130] space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Neural Muse Directives</span>
                            <button onClick={() => setIsMuseOpen(false)} className="text-slate-500 hover:text-white text-xs">✕</button>
                        </div>
                        
                        <textarea
                            value={museDirective}
                            onChange={(e) => setMuseDirective(e.target.value)}
                            placeholder="e.g. 'Grounded short description' or 'Make it warm and nostalgic'..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:border-cyan-500/50 outline-none resize-none h-20 font-sans leading-relaxed"
                        />
                        
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                { label: 'Short & Grounded', dir: 'Short, direct, grounded description. No flowery language or generic prose.' },
                                { label: 'Evocative Prose', dir: 'Evocative, nostalgic, and warm memories.' },
                                { label: 'Clinical Log', dir: 'Objective, clinical, high-fidelity field log style.' }
                            ].map(preset => (
                                <button
                                    key={preset.label}
                                    onClick={() => setMuseDirective(preset.dir)}
                                    className="px-2 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-bold text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/20 transition-all text-left"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                        
                        <button
                            onClick={() => {
                                handleSparkle(museDirective);
                                setIsMuseOpen(false);
                            }}
                            className="w-full py-2.5 bg-cyan-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-cyan-400 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                        >
                            <Wand2 size={12} /> Run Muse
                        </button>
                    </div>
                )}

                <WikiTagEditor
                    value={descriptionValue}
                    onChange={(val) => {
                        setDescriptionValue(val);
                        onFieldChange('description', val);
                        onFieldChange('title', val);
                    }}
                    userId={userId || ''}
                    onTagCreated={onTagCreated}
                    className={`${targetField === 'description' ? 'border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : ''}`}
                    placeholder="Short, human-readable label..."
                    rows={3}
                />
            </div>

            {/* 2. NEURAL NARRATIVE (Long/Wordy) */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${targetField === 'narrative' ? 'text-violet-400' : 'text-slate-500'}`}>
                        Neural Narrative {targetField === 'narrative' && '• TARGET'}
                    </label>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={onResurrect}
                            disabled={isResurrecting}
                            className="px-3 py-1.5 bg-violet-500/10 text-violet-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-violet-500/20 hover:bg-violet-500/20 hover:border-violet-500/50 transition-all disabled:opacity-30 flex items-center gap-2"
                        >
                            {isResurrecting ? <Loader2 size={12} className="animate-spin" /> : <Package size={12} />}
                            {isResurrecting ? 'RESURRECTING...' : 'RESURRECT'}
                        </button>
                        <div className="px-2 py-1 bg-white/5 rounded text-[8px] font-bold text-slate-600 uppercase tracking-widest border border-white/5">
                            RAG Optimized
                        </div>
                    </div>
                </div>
                <div className="relative group">
                    <WikiTagEditor
                        value={narrativeValue}
                        onChange={(val) => {
                            setNarrativeValue(val);
                            onFieldChange('narrative', val);
                        }}
                        userId={userId || ''}
                        onTagCreated={onTagCreated}
                        placeholder="Deep, verbose observation..."
                        rows={6}
                        className={`${targetField === 'narrative' ? 'border-violet-500/60 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : ''} ${isResurrecting ? 'blur-[1px] opacity-50' : ''}`}
                    />
                    
                    {isResurrecting && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px] rounded-xl border border-violet-500/30 animate-pulse">
                            <div className="flex flex-col items-center gap-3">
                                <div className="relative">
                                    <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                                    <Sparkles className="w-3 h-3 text-cyan-400 absolute -top-1 -right-1 animate-bounce" />
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[9px] font-black text-violet-300 uppercase tracking-[0.2em]">Neural Resurrection</span>
                                    <span className="text-[8px] text-slate-500 font-medium uppercase tracking-widest">GIGI is observing through the lens...</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* [ZEN] Private Details (The Closet Vault) */}
            <div className="space-y-3">
                <button 
                    onClick={() => {
                        if (!isAuthenticated && !isPrivateOpen) {
                            setIsPrivateOpen(true);
                        } else if (isAuthenticated) {
                            setIsPrivateOpen(!isPrivateOpen);
                        } else {
                            setIsPrivateOpen(false);
                        }
                    }} 
                    className="flex justify-between items-center w-full text-left text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors"
                >
                    <span className="flex items-center gap-2"><Lock size={12} /> Private Details</span>
                    <ChevronDown size={12} className={`transform transition-transform ${isPrivateOpen ? 'rotate-180' : 'rotate-0'}`} />
                </button>
                {isPrivateOpen && !isAuthenticated && (
                    <div className="relative animate-in fade-in zoom-in-95 duration-200 bg-[#0a120a] border border-red-900/30 rounded-xl p-4 flex flex-col gap-3">
                         <div className="flex items-center gap-2 text-red-500 text-sm font-bold">
                             <Lock size={16} /> <span>Vault Locked</span>
                         </div>
                         <input 
                             type="password"
                             value={passwordInput}
                             onChange={e => { setPasswordInput(e.target.value); setAuthError(false); }}
                             onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
                             placeholder="Enter passcode..."
                             className="bg-black/50 border border-red-900/50 rounded-lg px-3 py-2 text-sm text-red-100 outline-none focus:border-red-500"
                         />
                         {authError && <span className="text-red-500 text-[10px]">Incorrect passcode.</span>}
                         <button onClick={handleUnlock} className="bg-red-900/50 hover:bg-red-800/50 text-red-200 text-[10px] uppercase font-bold py-2 rounded-lg transition-colors">
                             Unlock Vault
                         </button>
                    </div>
                )}
                {isPrivateOpen && isAuthenticated && (
                    <div className="relative animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-end mb-2">
                             <button onClick={handleLock} className="text-[9px] text-red-500/70 hover:text-red-400 uppercase tracking-widest flex items-center gap-1">
                                 <Lock size={10} /> Re-lock Vault
                             </button>
                        </div>
                        <WikiTagEditor
                            value={privateDetailsValue}
                            onChange={(val) => {
                                setPrivateDetailsValue(val);
                                onFieldChange('privateDetails', val);
                            }}
                            userId={userId || ''}
                            onTagCreated={onTagCreated}
                            placeholder="Gate codes, receipts, private medical info, or other sensitive utility data..."
                            className="border-red-900/30 bg-[#0a120a] focus-within:border-red-500/50 focus-within:shadow-[0_0_15px_rgba(239,68,68,0.15)] shadow-inner [&_div]:text-red-100/90 rounded-xl"
                        />
                        <div className="absolute top-8 right-3 text-red-900 pointer-events-none">
                            <Lock size={16} />
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
});

export default NarrativeEditor;
