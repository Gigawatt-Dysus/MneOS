import React, { useState } from 'react';
import type { User } from '../../types';
import { GlassButton } from '../GlassButton';
import { AlignLeft, Download, RefreshCw, Wand2, Trash2, Bot, Edit2, Save, Plus, Check, Layout } from 'lucide-react';
import { parseCareerBiomass, generateTailoredResumeContent } from '../../services/aiOrchestrator';
import { GLOBAL_LANGUAGES } from '../../utils/languages';
import { sortCareerNodes } from '../../utils/dateSorting';
import { ResumeTemplateGallery } from './ResumeTemplateGallery';
import { ResumeStyleConfig } from '../../types';

const PRIORITY_LANGUAGES = [
    "English", "Spanish", "Mandarin Chinese", "French", "Haitian Creole",
    "German", "Japanese", "Hindi", "Portuguese", "Arabic"
];

const sortedLanguageOptions = Object.entries(GLOBAL_LANGUAGES)
    .map(([k, v]) => v)
    .filter(lang => !PRIORITY_LANGUAGES.includes(lang))
    .sort((a, b) => a.localeCompare(b));

interface CareerTabProps {
    user: User;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export const CareerTab: React.FC<CareerTabProps> = ({ user, handleInputChange }) => {
    const [isParsing, setIsParsing] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
    const [isBiomassCollapsed, setIsBiomassCollapsed] = useState(!!user.careerBiomass);

    // [ZEN] Auto-collapse biomass once data is reliably present
    React.useEffect(() => {
        if (user.careerBiomass && user.careerBiomass.length > 10) {
            setIsBiomassCollapsed(true);
        }
    }, [user.careerBiomass]);

    // [ZEN NEW] Memoized sorting with 'Editing Lock'
    const sortedNodes = React.useMemo(() => {
        if (!user.careerNodes) return [];
        // Attach original index to handle updates correctly after sorting
        const indexed = user.careerNodes.map((n, i) => ({ ...n, originalIdx: i }));
        
        // If we are actively editing, we skip the sort to prevent nodes jumping around
        if (editingIndex !== null) {
            return indexed;
        }

        return sortCareerNodes(indexed as any) as (any & { originalIdx: number })[];
    }, [user.careerNodes, editingIndex]);

    const handleParse = async () => {
        if (!user.careerBiomass) return;
        setIsParsing(true);
        try {
            const nodes = await parseCareerBiomass(user.careerBiomass, user);
            const sorted = sortCareerNodes(nodes); // Immediate sort after parse
            console.log("[CareerTab] Received mapped nodes from AI:", sorted);

            const evt = { target: { id: 'careerNodes', value: sorted } } as any;
            handleInputChange(evt);
            
            setIsParsing(false);
        } catch (e: any) {
            alert("Parsing Failed: " + e.message);
            setIsParsing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* [ZEN NEW] Apex Command Center */}
            <div className="flex justify-between items-center bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 mb-2 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                        <Plus size={20} />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Manual Ingestion</h3>
                        <p className="text-[9px] text-emerald-500/60 font-mono uppercase">Inject new chronological node</p>
                    </div>
                </div>
                <button onClick={() => {
                    const newNode = { id: `node-${Date.now()}`, type: 'Job', title: 'New Position', organization: 'Company', startDate: new Date().toISOString().split('T')[0], endDate: 'Present', bullets: [] };
                    const updated = [newNode, ...(user.careerNodes || [])]; 
                    handleInputChange({ target: { id: 'careerNodes', value: updated } } as any);
                    setEditingIndex(0); 
                }} className="px-6 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-400 transition-all uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    New Position
                </button>
            </div>
            {/* [ZEN NEW] Executive Synthesis Command Center */}
            <div className={`bg-gradient-to-br from-[#0f141a] to-[#0a0c10] border ${isSettingsExpanded ? 'border-emerald-500/40' : 'border-white/10'} rounded-2xl overflow-hidden transition-all duration-500 shadow-2xl`}>
                <button 
                    onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                    className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl border ${isSettingsExpanded ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                            <RefreshCw size={18} className={isSettingsExpanded ? 'animate-spin' : ''} />
                        </div>
                        <div className="text-left">
                            <h3 className="text-sm font-bold text-white tracking-widest uppercase">Executive Synthesis Options</h3>
                            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-0.5">Control filters & AI course-correction</p>
                        </div>
                    </div>
                    <div className={`transition-transform duration-300 ${isSettingsExpanded ? 'rotate-180' : ''}`}>
                        <Plus size={20} className="text-slate-500" />
                    </div>
                </button>

                {isSettingsExpanded && (
                    <div className="p-6 border-t border-white/5 space-y-8 animate-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Lookback Filter */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Career Lookback Window</label>
                                    <span className="text-xs font-mono text-slate-400 bg-black/40 px-3 py-1 rounded-lg border border-white/10">
                                        {user.atsSettings?.lookbackYears === 'all' || !user.atsSettings?.lookbackYears ? 'Infinite Genesis' : `${user.atsSettings.lookbackYears} Years`}
                                    </span>
                                </div>
                                <input 
                                    type="range" 
                                    min="5" 
                                    max="40" 
                                    step="5"
                                    value={user.atsSettings?.lookbackYears === 'all' ? 40 : (user.atsSettings?.lookbackYears || 40)}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        const finalVal = val === 40 ? 'all' : val;
                                        handleInputChange({ target: { id: 'atsSettings.lookbackYears', value: finalVal } } as any);
                                    }}
                                    className="w-full accent-emerald-500 h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[9px] text-slate-600 font-mono uppercase tracking-tighter">
                                    <span>Focused (5y)</span>
                                    <span>Expanded (20y)</span>
                                    <span>Master Arc (All)</span>
                                </div>
                            </div>

                            {/* Role Categories Management */}
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Active Mandate Categories</label>
                                <div className="flex flex-wrap gap-2 p-4 bg-black/40 border border-white/10 rounded-2xl min-h-[100px]">
                                    {(user.atsSettings?.roleCategories || ['IT', 'Admin', 'Healthcare', 'Executive']).map((cat, ci) => (
                                        <div key={ci} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{cat}</span>
                                            <button 
                                                onClick={() => {
                                                    const updated = (user.atsSettings?.roleCategories || []).filter(c => c !== cat);
                                                    handleInputChange({ target: { id: 'atsSettings.roleCategories', value: updated } } as any);
                                                }}
                                                className="text-emerald-500/50 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => {
                                            const name = window.prompt("New Category Name:");
                                            if (name) {
                                                const updated = [...(user.atsSettings?.roleCategories || []), name];
                                                handleInputChange({ target: { id: 'atsSettings.roleCategories', value: updated } } as any);
                                            }
                                        }}
                                        className="px-3 py-1.5 border border-dashed border-white/20 rounded-xl text-[10px] font-bold text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all flex items-center gap-1"
                                    >
                                        <Plus size={12} /> New Type
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-4">
                            <Bot size={24} className="text-emerald-400 shrink-0" />
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Settings configured here will guide the **Emissary's synthesis** during on-demand PDF generation. Nodes falling outside the lookback window or explicitly shielded will be redacted from recruiter documentation.
                            </p>
                        </div>

                        {/* [ZEN NEW] Visual Design Suite */}
                        <div className="pt-8 border-t border-white/5 space-y-6">
                            <div className="flex items-center gap-3">
                                <Layout className="text-emerald-400" size={18} />
                                <h3 className="text-xs font-bold text-white tracking-widest uppercase">Executive Design Studio</h3>
                            </div>
                            <ResumeTemplateGallery 
                                user={user}
                                onTemplateSelect={(id, config) => {
                                    handleInputChange({ target: { id: 'atsSettings.activeTemplateId', value: id } } as any);
                                    // Also apply the config as a base
                                    Object.entries(config).forEach(([key, val]) => {
                                        if (key !== 'id' && key !== 'name') {
                                           // This might need a more robust deep update, but for now we trust the activeTemplateId
                                        }
                                    });
                                }}
                                onSaveCustom={(name, config) => {
                                    const updatedTemplates = { ...(user.atsSettings?.customTemplates || {}), [name]: config };
                                    handleInputChange({ target: { id: 'atsSettings.customTemplates', value: updatedTemplates } } as any);
                                }}
                                onDeleteCustom={(name) => {
                                    if (window.confirm(`Permanently excise '${name}' from memory records?`)) {
                                        const updatedTemplates = { ...(user.atsSettings?.customTemplates || {}) };
                                        delete updatedTemplates[name];
                                        handleInputChange({ target: { id: 'atsSettings.customTemplates', value: updatedTemplates } } as any);
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-inner mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[40px] rounded-full pointer-events-none" />
                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4 relative z-10">
                    <div className="flex items-center gap-3">
                        <Bot className="text-cyan-400" size={24} />
                        <h2 className="text-xl font-bold tracking-widest text-emerald-50 opacity-90 uppercase">Autonomous Proxy Configuration</h2>
                    </div>
                    <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[8px] font-bold text-emerald-400 tracking-[0.2em] uppercase">
                        Zen Intelligence Hub v2.1
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Proxy Moniker (Name)</label>
                        <input
                            type="text"
                            id="atsDemographics.proxyName"
                            value={user.atsDemographics?.proxyName || ''}
                            onChange={handleInputChange as any}
                            placeholder="e.g. Executive Assistant, Cyber-Proxy"
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-emerald-50 focus:border-emerald-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Avatar Image URL (Holo-Face)</label>
                        <input
                            type="text"
                            id="atsDemographics.proxyAvatarUrl"
                            value={user.atsDemographics?.proxyAvatarUrl || ''}
                            onChange={handleInputChange as any}
                            placeholder="Firebase URL or wait for Generator..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-emerald-50 focus:border-emerald-500/50"
                        />
                    </div>
                </div>
            </div>

            <div className={`bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-inner mb-6 transition-all duration-500 ${isBiomassCollapsed ? 'max-h-[80px]' : 'max-h-[800px]'}`}>
                <div className="flex items-center justify-between p-6">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 tracking-widest uppercase">
                        <AlignLeft size={18} className="text-emerald-400" />
                        Raw Career Biomass {isBiomassCollapsed && <span className="text-[10px] text-emerald-500/40 ml-2">(ARCHIVED)</span>}
                    </h3>
                    <div className="flex items-center gap-2">
                        <GlassButton onClick={handleParse} disabled={isParsing || !user.careerBiomass} variant="primary" className="bg-emerald-600/30 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/30 py-1.5 h-auto text-[10px]">
                            {isParsing ? <RefreshCw className="animate-spin" size={12} /> : <Wand2 size={12} />}
                            <span className="ml-1.5">Agentic Parse</span>
                        </GlassButton>
                        <button 
                            onClick={() => setIsBiomassCollapsed(!isBiomassCollapsed)}
                            className="p-2 text-slate-500 hover:text-white transition-colors"
                        >
                            <Plus size={18} className={`transition-transform duration-300 ${isBiomassCollapsed ? '' : 'rotate-45'}`} />
                        </button>
                    </div>
                </div>
                
                {!isBiomassCollapsed && (
                    <div className="p-6 pt-0 border-t border-white/5 animate-in slide-in-from-top-2">
                        <p className="text-[11px] text-slate-500 mb-4 leading-relaxed font-mono uppercase tracking-widest">
                            Initial ingestion vector. Paste resume text below to extract LifeOS nodes.
                        </p>
                        <textarea
                            id="careerBiomass"
                            name="careerBiomass"
                            value={user.careerBiomass || ''}
                            onChange={handleInputChange}
                            placeholder="Paste resume text or comprehensive career history here..."
                            className="w-full h-80 bg-black/40 border border-white/10 rounded-xl p-4 text-xs font-mono text-emerald-50/70 focus:border-emerald-500/50 custom-scrollbar resize-none transition-all placeholder-slate-700"
                        />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {sortedNodes && sortedNodes.length > 0 ? (
                    sortedNodes.map((n, displayIdx) => {
                        const idx = n.originalIdx;
                        return (
                        <div key={idx} className="bg-[#0f1219]/80 border border-emerald-500/20 rounded-2xl p-6 shadow-[0_0_20px_rgba(16,185,129,0.05)] relative group animate-fade-in slide-in-from-bottom-2">
                            {editingIndex === idx ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={n.type || ''} 
                                                onChange={e => {
                                                    const updated = [...user.careerNodes!];
                                                    updated[idx] = { ...n, type: e.target.value };
                                                    handleInputChange({ target: { id: 'careerNodes', value: updated } } as any);
                                                }} 
                                                className="bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] font-bold tracking-widest text-emerald-500/50 uppercase w-32" 
                                            />
                                            <select 
                                                value={n.roleType || ''} 
                                                onChange={e => {
                                                    const updated = [...user.careerNodes!];
                                                    updated[idx] = { ...n, roleType: e.target.value };
                                                    handleInputChange({ target: { id: 'careerNodes', value: updated } } as any);
                                                }}
                                                className="bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] font-bold tracking-widest text-cyan-400 uppercase w-32 appearance-none"
                                            >
                                                <option value="">No Mandate Tag</option>
                                                {(user.atsSettings?.roleCategories || ['IT', 'Admin', 'Healthcare', 'Executive']).map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer group/toggle">
                                                <span className={`text-[10px] font-bold tracking-widest uppercase transition-colors ${n.excludeFromResume ? 'text-red-500/50' : 'text-emerald-500'}`}>
                                                    {n.excludeFromResume ? 'SHIELDED' : 'INCLUDED IN PDF'}
                                                </span>
                                                <div 
                                                    onClick={() => {
                                                        const updated = [...user.careerNodes!];
                                                        updated[idx] = { ...n, excludeFromResume: !n.excludeFromResume };
                                                        handleInputChange({ target: { id: 'careerNodes', value: updated } } as any);
                                                    }}
                                                    className={`w-10 h-5 rounded-full relative transition-all duration-300 border ${n.excludeFromResume ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/30'}`}
                                                >
                                                    <div className={`absolute top-1 w-2.5 h-2.5 rounded-full transition-all duration-300 ${n.excludeFromResume ? 'left-1 bg-red-400' : 'left-6 bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
                                                </div>
                                            </label>
                                            <button onClick={() => setEditingIndex(null)} className="p-2 px-4 shadow-[0_0_15px_rgba(16,185,129,0.2)] text-emerald-400 hover:text-white bg-emerald-500/20 rounded-xl flex items-center gap-1 font-bold tracking-wider text-xs uppercase transition-colors"><Check size={16}/> Save</button>
                                        </div>
                                    </div>
                                    <input 
                                        type="text" 
                                        value={n.title || ''} 
                                        onChange={e => {
                                            const updated = [...user.careerNodes!];
                                            updated[idx] = { ...n, title: e.target.value };
                                            handleInputChange({ target: { id: 'careerNodes', value: updated } } as any);
                                        }} 
                                        onBlur={() => {
                                            // Soft save to parent state
                                            handleInputChange({ target: { id: 'careerNodes', value: user.careerNodes } } as any);
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-xl font-bold text-emerald-400 focus:border-emerald-500/50" 
                                        placeholder="Job Title" 
                                    />
                                    <input 
                                        type="text" 
                                        value={n.organization || ''} 
                                        onChange={e => {
                                            const updated = [...user.careerNodes!];
                                            updated[idx] = { ...n, organization: e.target.value };
                                            handleInputChange({ target: { id: 'careerNodes', value: updated } } as any);
                                        }} 
                                        onBlur={() => {
                                            // Soft save to parent state
                                            handleInputChange({ target: { id: 'careerNodes', value: user.careerNodes } } as any);
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-emerald-100 font-bold focus:border-emerald-500/50" 
                                        placeholder="Organization" 
                                    />
                                    <div className="flex flex-col gap-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-4">
                                            <label className="text-xs text-slate-500 font-bold uppercase tracking-widest w-16">Start</label>
                                            <input 
                                                type="date" 
                                                value={(n.startDate && !isNaN(new Date(n.startDate).getTime()) && n.startDate !== 'Present' && n.startDate !== 'YYYY') ? new Date(n.startDate).toISOString().split('T')[0] : ''} 
                                                onChange={e => {
                                                    const updated = [...user.careerNodes!];
                                                    updated[idx] = { ...n, startDate: e.target.value };
                                                    handleInputChange({ target: { id: 'careerNodes', value: updated } } as any);
                                                }} 
                                                className="flex-1 bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-slate-200 font-mono focus:border-emerald-500/50" 
                                            />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <label className="text-xs text-slate-500 font-bold uppercase tracking-widest w-16">End</label>
                                            {n.endDate === 'Present' ? (
                                                <div className="flex-1 bg-emerald-900/20 border border-emerald-500/20 rounded-lg p-2 text-sm text-emerald-400 font-mono font-bold tracking-widest flex items-center justify-center h-[38px]">
                                                    — CURRENTLY EVOLVING —
                                                </div>
                                            ) : (
                                                <input 
                                                    type="date" 
                                                    value={(n.endDate && !isNaN(new Date(n.endDate).getTime()) && n.endDate !== 'Present' && n.endDate !== 'YYYY') ? new Date(n.endDate).toISOString().split('T')[0] : ''} 
                                                    onChange={e => {
                                                        const updated = [...user.careerNodes!];
                                                        updated[idx] = { ...n, endDate: e.target.value };
                                                        handleInputChange({ target: { id: 'careerNodes', value: updated } } as any);
                                                    }} 
                                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-slate-200 font-mono focus:border-emerald-500/50" 
                                                />
                                            )}
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-emerald-400 transition-colors bg-white/5 px-3 py-2 rounded-lg border border-emerald-500/10">
                                                <input 
                                                    type="checkbox" 
                                                    checked={n.endDate === 'Present'} 
                                                    onChange={e => {
                                                        const updated = [...user.careerNodes!];
                                                        updated[idx] = { ...n, endDate: e.target.checked ? 'Present' : '' };
                                                        handleInputChange({ target: { id: 'careerNodes', value: updated } } as any);
                                                    }} 
                                                    className="accent-emerald-500 w-4 h-4 cursor-pointer" 
                                                />
                                                Present
                                            </label>
                                        </div>
                                    </div>
                                    <div className="space-y-3 mt-6">
                                        <label className="text-xs text-emerald-500/70 font-bold uppercase tracking-widest mb-2 block border-b border-emerald-500/10 pb-2">Bullet Points</label>
                                        {n.bullets?.map((b: string, bid: number) => (
                                            <div key={bid} className="flex gap-2">
                                                <div className="text-emerald-500/50 pt-3 flex-shrink-0">•</div>
                                                <textarea 
                                                    value={b} 
                                                    onChange={e => {
                                                        const updated = [...user.careerNodes!];
                                                        const newB = [...n.bullets];
                                                        newB[bid] = e.target.value;
                                                        updated[idx] = { ...n, bullets: newB };
                                                        handleInputChange({ target: { id: 'careerNodes', value: updated } } as any);
                                                    }} 
                                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-slate-300 h-24 custom-scrollbar focus:border-emerald-500/50 leading-relaxed" 
                                                />
                                                <button onClick={() => {
                                                    const updated = [...user.careerNodes!];
                                                    const newB = [...n.bullets];
                                                    newB.splice(bid, 1);
                                                    updated[idx] = { ...n, bullets: newB };
                                                    handleInputChange({ target: { id: 'careerNodes', value: updated } } as any);
                                                }} className="text-slate-600 hover:text-red-400 hover:bg-red-500/10 p-3 rounded-lg flex-shrink-0 transition-colors h-12 self-start"><Trash2 size={16}/></button>
                                            </div>
                                        ))}
                                        <button onClick={() => {
                                            const updated = [...user.careerNodes!];
                                            updated[idx] = { ...n, bullets: [...(n.bullets||[]), ""] };
                                            handleInputChange({ target: { id: 'careerNodes', value: updated } } as any);
                                        }} className="text-xs font-bold tracking-widest uppercase text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-4 py-3 rounded-lg flex items-center justify-center gap-2 mt-4 w-full border border-dashed border-emerald-500/30 transition-all"><Plus size={14}/> Add Requirement Bullet</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="absolute top-6 right-6 flex items-center gap-2">
                                        {n.roleType && (
                                            <div className="text-[9px] font-bold tracking-widest text-cyan-400/70 uppercase bg-cyan-400/5 px-2 py-0.5 rounded-lg border border-cyan-400/10">
                                                {n.roleType}
                                            </div>
                                        )}
                                        <div className={`text-[10px] font-bold tracking-widest uppercase bg-emerald-500/5 px-3 py-1 rounded-full border transition-colors ${n.excludeFromResume ? 'text-red-500/50 border-red-500/10' : 'text-emerald-500/50 border-emerald-500/10'}`}>
                                            {n.excludeFromResume ? 'Redacted' : n.type}
                                        </div>
                                        <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity ml-2">
                                            <button
                                                onClick={() => setEditingIndex(idx)}
                                                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-full transition-colors"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Delete this career node?')) {
                                                        const updated = [...user.careerNodes!];
                                                        updated.splice(idx, 1);
                                                        handleInputChange({ target: { id: 'careerNodes', value: updated } } as any);
                                                    }
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        {n.excludeFromResume && (
                                            <div className="p-1 px-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                                                <AlignLeft size={10} className="rotate-45" />
                                            </div>
                                        )}
                                    </div>

                                    <h4 className={`text-xl font-bold tracking-tight pr-24 transition-opacity ${n.excludeFromResume ? 'text-emerald-400/40' : 'text-emerald-400'}`}>{n.title}</h4>
                                    <p className={`text-sm font-bold tracking-wide mt-1 transition-opacity ${n.excludeFromResume ? 'text-emerald-100/30' : 'text-emerald-100'}`}>{n.organization}</p>
                                    <p className="text-[10px] text-slate-500 font-mono mt-2 uppercase tracking-widest bg-black/40 inline-block px-2 py-0.5 rounded-sm border border-white/5">
                                        {n.startDate} - {n.endDate}
                                    </p>

                                    <ul className="mt-6 space-y-3">
                                        {n.bullets?.map((b: string, bid: number) => (
                                            <li key={bid} className="text-sm text-slate-300 pl-5 relative before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:bg-emerald-500/50 before:rounded-full leading-relaxed whitespace-pre-wrap">
                                                {b}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                        );
                    })
                ) : (
                    <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-slate-500 col-span-full">
                        <Download size={32} className="mb-4 opacity-30 text-emerald-500/50" />
                        <p className="font-mono text-[10px] uppercase tracking-widest bg-black/40 px-4 py-2 rounded-lg border border-white/5">
                            Awaiting ATS Parse Sequence
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
