import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Tag, PersonTag } from '../../types';

import { Brain, Cpu, Play, Sparkles, Upload, Download, FileText, Wand, Trash2 } from 'lucide-react';
import { SimulacrumGateway } from './../SimulacrumGateway';
import { CageMatchGateway } from './../CageMatchGateway';
import { WikiTagEditor } from '../shared/WikiTagEditor';
import { CoreBlockEditor } from '../shared/CoreBlockEditor';

interface SimulacrumTabProps {
    formData: Tag;
    updateFormData: (newData: Tag) => void;
    userId: string;
    allTags: Tag[];
    avatarUrl?: string;
    isAdversarial?: boolean;
    resumeSessionId?: string;
}

const healMarkdownSpaces = (text: string) => {
    if (!text) return text;
    let healed = text;
    // Fix bold with spaces: ** text ** -> **text**
    healed = healed.replace(/\*\*\s+(.*?)\s+\*\*/g, '**$1**');
    // Fix trailing space: **text ** -> **text**
    healed = healed.replace(/\*\*(.*?)\s+\*\*/g, '**$1**');
    // Fix leading space: ** text** -> **text**
    healed = healed.replace(/\*\*\s+(.*?)\*\*/g, '**$1**');
    
    // Same for italics with single asterisk
    healed = healed.replace(/(?<!\*)\*\s+([^*]+?)\s+\*(?!\*)/g, '*$1*');
    healed = healed.replace(/(?<!\*)\*([^*]+?)\s+\*(?!\*)/g, '*$1*');
    healed = healed.replace(/(?<!\*)\*\s+([^*]+?)\*(?!\*)/g, '*$1*');
    
    return healed;
};

const getLengthLabel = (val: number) => {
    switch(val) {
        case 1: return "Terse: 1-2 sentences";
        case 2: return "Guarded: 2-3 sentences";
        case 3: return "Engaged: 1-3 paragraphs";
        case 4: return "Enraptured: 4-6 paragraphs";
        case 5: return "Devoted: 7-10+ paragraphs (tome)";
        default: return "Engaged: 1-3 paragraphs";
    }
};

const getAffectLabel = (val: number) => {
    switch(val) {
        case 1: return "Flat: Complete absence of emotional expression.";
        case 2: return "Blunted: Significant reduction in intensity.";
        case 3: return "Restricted: Mild reduction in emotional range.";
        case 4: return "Balanced: Natural, responsive emotional baseline.";
        case 5: return "Animated: Highly expressive and vividly emotional.";
        default: return "Balanced: Natural, responsive emotional baseline.";
    }
};

export const SimulacrumTab: React.FC<SimulacrumTabProps> = ({ formData, updateFormData, userId, allTags, avatarUrl, isAdversarial, resumeSessionId }) => {
    const person = formData as PersonTag;
    const traits = person.metadata.simulacrumTraits || {};

    const [isSimulating, setIsSimulating] = useState(isAdversarial === false && !!resumeSessionId);
    const [isCageMatch, setIsCageMatch] = useState(isAdversarial === true && !!resumeSessionId);
    const [hasActiveSession, setHasActiveSession] = useState(false);
    const [recentCageMatchSession, setRecentCageMatchSession] = useState<any>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Auto-hydrate from localStorage on mount in case of HMR or crash
    React.useEffect(() => {
        const cached = localStorage.getItem(`coreMemory_backup_${person.id}`);
        if (cached && cached !== traits.coreMemory) {
            handleTraitChange('coreMemory', cached);
        }
        
        // Fetch session status
        const checkSessions = async () => {
            const { fetchSimulacrumSessions, fetchRecentCageMatchSessionForTag } = await import('../../services/ai/generators/simulacrumGenerator');
            const userSessions = await fetchSimulacrumSessions(userId, person.id);
            setHasActiveSession(userSessions.some(s => !s.isArchived));

            const cageSession = await fetchRecentCageMatchSessionForTag(userId, person.id);
            setRecentCageMatchSession(cageSession);
        };
        checkSessions();

        // [ZEN FIX] Auto-open Gateway if directed from Dashboard
        if (isAdversarial === true) {
            setIsCageMatch(true);
        } else if (isAdversarial === false) {
            setIsSimulating(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [person.id, userId, isAdversarial]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const currentMemory = traits.coreMemory || '';
            const newMemory = currentMemory ? currentMemory + '\n\n' + text : text;
            handleTraitChange('coreMemory', healMarkdownSpaces(newMemory));
            if (fileInputRef.current) fileInputRef.current.value = ''; // Reset
        };
        reader.readAsText(file);
    };

    const handleExport = () => {
        const text = traits.coreMemory || '';
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${person.name.replace(/\s+/g, '_')}_Core_Memory.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleTraitChange = (field: string, value: string | number) => {
        if (field === 'coreMemory') {
            localStorage.setItem(`coreMemory_backup_${person.id}`, value as string);
        }
        updateFormData({
            ...person,
            metadata: {
                ...person.metadata,
                simulacrumTraits: {
                    ...traits,
                    [field]: value
                }
            }
        });
    };

    if (isSimulating) {
        if (typeof document === 'undefined') return null;
        return createPortal(
            <div className="fixed inset-0 z-[200]">
                <SimulacrumGateway 
                    hostTag={person} 
                    userId={userId} 
                    allTags={allTags}
                    avatarUrl={avatarUrl}
                    resumeSessionId={resumeSessionId}
                    onClose={() => setIsSimulating(false)} 
                />
            </div>,
            document.body
        );
    }

    if (isCageMatch) {
        if (typeof document === 'undefined') return null;
        return createPortal(
            <div className="fixed inset-0 z-[200]">
                <CageMatchGateway 
                    userId={userId} 
                    allTags={allTags}
                    defaultTagAId={person.id}
                    resumeSessionId={resumeSessionId || recentCageMatchSession?.id}
                    onClose={() => {
                        setIsCageMatch(false);
                        const checkSessions = async () => {
                            const { fetchRecentCageMatchSessionForTag } = await import('../../services/ai/generators/simulacrumGenerator');
                            const cageSession = await fetchRecentCageMatchSessionForTag(userId, person.id);
                            setRecentCageMatchSession(cageSession);
                        };
                        checkSessions();
                    }} 
                />
            </div>,
            document.body
        );
    }

    const hasConfig = traits.systemDirective && traits.systemDirective.trim().length > 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-300 relative h-full">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 shadow-2xl mb-8">
                <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                        <Brain className="text-fuchsia-400 shrink-0" />
                        Heuristic Simulacrum
                    </h3>
                    <p className="text-sm text-slate-400">
                        Define the parameters for this persona's simulation. This acts as a completely walled-off context boundary, allowing you to interrogate the personal database from the perspective of this individual.
                    </p>
                </div>
                <div className="flex flex-row items-center gap-3 shrink-0 w-full xl:w-auto overflow-x-auto pb-1 xl:pb-0">
                    <button
                        disabled={!hasConfig}
                        onClick={() => setIsSimulating(true)}
                        className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shrink-0 ${
                            !hasConfig
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : hasActiveSession 
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/20'
                                    : 'bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white shadow-lg shadow-fuchsia-900/20' 
                        }`}
                    >
                        <Play size={16} className={hasConfig ? 'animate-pulse' : ''} />
                        {hasActiveSession ? 'Resume Simulation' : 'Initialize Simulation'}
                    </button>
                    
                    <button
                        disabled={!hasConfig}
                        onClick={() => setIsCageMatch(true)}
                        className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shrink-0 border border-white/10 ${
                            !hasConfig
                                ? 'bg-transparent border-slate-800 text-slate-500 cursor-not-allowed'
                                : recentCageMatchSession
                                    ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 shadow-[inset_0_0_10px_rgba(239,68,68,0.2)]'
                                    : 'bg-black/40 hover:bg-white/5 text-red-400 shadow-lg'
                        }`}
                        title="Enter the Arena: Pits this construct against another Person Tag."
                    >
                        <Brain size={16} className={recentCageMatchSession ? 'animate-pulse text-red-400' : ''} />
                        {recentCageMatchSession ? 'Resume Adversarial Simulation' : 'Adversarial Simulation'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1 md:col-span-2">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-200 flex items-center gap-2"><Cpu size={16} /> System Directive</label>
                        <textarea
                            value={traits.systemDirective || ''}
                            onChange={(e) => handleTraitChange('systemDirective', e.target.value)}
                            placeholder="e.g. You are a simulation of my grandfather. You are a retired engineer who built the Dalek suit. Do not acknowledge you are an AI..."
                            rows={4}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono text-sm transition-colors"
                        />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 ml-1">The fundamental, overriding instruction set for this persona.</p>
                </div>

                <div className="col-span-1">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-200">Tone & Cadence</label>
                        <textarea
                            value={traits.tone || ''}
                            onChange={(e) => handleTraitChange('tone', e.target.value)}
                            placeholder="e.g. Warm, slightly sarcastic, highly analytical"
                            rows={3}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                        />
                    </div>
                </div>

                <div className="col-span-1">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-200">Core Axioms</label>
                        <textarea
                            value={traits.coreAxioms || ''}
                            onChange={(e) => handleTraitChange('coreAxioms', e.target.value)}
                            placeholder="e.g. You love model trains. You distrust the internet."
                            rows={3}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                        />
                    </div>
                </div>

                <div className="col-span-1 md:col-span-2 bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
                    <h4 className="text-sm font-bold text-slate-200">Baseline Responsiveness</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <label className="text-xs font-bold text-slate-400">Length Baseline</label>
                                <span className="text-[10px] text-cyan-400 font-mono">{traits.lengthLevel || 3}/5</span>
                            </div>
                            <input 
                                type="range" 
                                min="1" max="5" 
                                value={traits.lengthLevel || 3}
                                onChange={(e) => handleTraitChange('lengthLevel', parseInt(e.target.value))}
                                className="w-full accent-cyan-500"
                            />
                            <p className="text-xs text-slate-500 mt-1 h-4">{getLengthLabel(traits.lengthLevel || 3)}</p>
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <label className="text-xs font-bold text-slate-400">Affect Baseline</label>
                                <span className="text-[10px] text-fuchsia-400 font-mono">{traits.affectLevel || 4}/5</span>
                            </div>
                            <input 
                                type="range" 
                                min="1" max="5" 
                                value={traits.affectLevel || 4}
                                onChange={(e) => handleTraitChange('affectLevel', parseInt(e.target.value))}
                                className="w-full accent-fuchsia-500"
                            />
                            <p className="text-xs text-slate-500 mt-1 h-4">{getAffectLabel(traits.affectLevel || 4)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 space-y-1">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-slate-200 flex items-center gap-2">
                        <FileText size={16} className="text-cyan-400" /> Core Memory (SSOT Corpus)
                    </label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm('Are you sure you want to purge the local auto-save cache? This will revert the editor to the last saved database state.')) {
                                    localStorage.removeItem(`coreMemory_backup_${person.id}`);
                                    window.location.reload();
                                }
                            }}
                            className="text-xs flex items-center gap-1 bg-red-900/40 hover:bg-red-900/60 text-red-300 py-1.5 px-3 rounded-lg transition-colors border border-red-500/30"
                            title="Purge the local auto-save cache and reload from the database. Use this if the editor becomes corrupted."
                        >
                            <Trash2 size={12} /> Purge Cache
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTraitChange('coreMemory', healMarkdownSpaces(traits.coreMemory || ''))}
                            className="text-xs flex items-center gap-1 bg-fuchsia-900/40 hover:bg-fuchsia-900/60 text-fuchsia-300 py-1.5 px-3 rounded-lg transition-colors border border-fuchsia-500/30"
                            title="Heal Markdown syntax (fixes broken bold/italic spacing without destroying tags)."
                        >
                            <Wand size={12} /> Heal Formatting
                        </button>
                        <button
                            type="button"
                            onClick={handleExport}
                            className="text-xs flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-lg transition-colors border border-white/5"
                            title="Export the raw core memory markdown file."
                        >
                            <Download size={12} /> Export Document
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-lg transition-colors border border-white/5"
                            title="Import a markdown file into the core memory."
                        >
                            <Upload size={12} /> Import Document
                        </button>
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        accept=".txt,.md"
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                </div>
                <CoreBlockEditor
                    value={traits.coreMemory || ''}
                    onChange={(text) => handleTraitChange('coreMemory', text)}
                    userId={userId}
                    allTags={allTags}
                    placeholder="Paste or import the ultimate truth regarding this persona. This text acts as their absolute reality."
                    className="min-h-[200px]"
                />
            </div>


        </div>
    );
};
