import React, { useState, useMemo } from 'react';
import { Brain, Calendar, MapPin, Network, ChevronDown, Plus, X } from 'lucide-react';
import type { ConceptTag, Tag } from '../../types';

interface ConceptFormProps {
    tag: ConceptTag;
    onMetadataChange: (metadata: any) => void;
    allTags: Tag[];
}

const DEFAULT_FLAVORS = [
    'Group/Band',
    'Era/Epoch',
    'Aesthetic/Style',
    'Fandom/Universe',
    'Ideology',
    'Theology',
    'Philosophy/Idea'
];

const ConceptForm: React.FC<ConceptFormProps> = ({ tag, onMetadataChange, allTags }) => {
    const meta = tag.metadata;
    const [isFlavorDropdownOpen, setIsFlavorDropdownOpen] = useState(false);
    const [customFlavorText, setCustomFlavorText] = useState('');
    const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);
    const [parentSearch, setParentSearch] = useState('');

    // Harvest unique custom flavors currently stored across all Concept Tags in the database
    const harvestedFlavors = useMemo(() => {
        const uniqueFlavors = new Set<string>(DEFAULT_FLAVORS);
        allTags.forEach(t => {
            if (t.type === 'concept' && t.metadata?.flavor) {
                // Capitalize first letter cleanly
                const capitalized = t.metadata.flavor.charAt(0).toUpperCase() + t.metadata.flavor.slice(1);
                uniqueFlavors.add(capitalized);
            }
        });
        return Array.from(uniqueFlavors);
    }, [allTags]);

    // Filter potential parent concepts to link hierarchy
    const availableParentConcepts = useMemo(() => {
        return allTags.filter(t => 
            t.type === 'concept' && 
            t.id !== tag.id && // Cannot be parent of itself
            t.name.toLowerCase().includes(parentSearch.toLowerCase())
        ) as ConceptTag[];
    }, [allTags, tag.id, parentSearch]);

    const currentParent = useMemo(() => {
        if (!meta.parentConceptId) return null;
        return allTags.find(t => t.id === meta.parentConceptId);
    }, [allTags, meta.parentConceptId]);

    const updateMeta = (field: string, value: any) => {
        onMetadataChange({
            ...meta,
            [field]: value
        });
    };

    const handleSelectFlavor = (flavor: string) => {
        updateMeta('flavor', flavor);
        setIsFlavorDropdownOpen(false);
    };

    const handleCreateCustomFlavor = () => {
        if (customFlavorText.trim()) {
            const formatted = customFlavorText.trim().charAt(0).toUpperCase() + customFlavorText.trim().slice(1);
            updateMeta('flavor', formatted);
            setCustomFlavorText('');
            setIsFlavorDropdownOpen(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header Badge */}
            <div className="bg-[#161922] p-4 rounded-xl border border-white/5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                    <Brain size={20} />
                </div>
                <div>
                    <h4 className="text-white font-bold text-sm">Concept Tag Model</h4>
                    <p className="text-[10px] text-slate-400 tracking-wide uppercase mt-0.5">
                        In the history of GIGI, ideas, epochs, and groups are treated with the dignity of persons.
                    </p>
                </div>
            </div>

            {/* FLAVOR IDENTITY */}
            <div className="bg-[#1a1d26] p-5 rounded-xl border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Brain size={12} /> Flavor Identity
                </h3>
                <div className="relative">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Concept Sub-Type / Flavor</label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setIsFlavorDropdownOpen(!isFlavorDropdownOpen)}
                            className="flex-1 flex justify-between items-center bg-[#0f1219] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 transition-all hover:bg-[#12151d] text-left"
                        >
                            <span>{meta.flavor || <span className="text-slate-600">Select or type custom flavor...</span>}</span>
                            <ChevronDown size={14} className="text-slate-400" />
                        </button>
                    </div>

                    {isFlavorDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1d26] border border-white/10 rounded-xl shadow-2xl z-50 p-3 space-y-3">
                            {/* Autocomplete dynamic flavor options */}
                            <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto custom-scrollbar">
                                {harvestedFlavors.map(flavor => (
                                    <button
                                        key={flavor}
                                        type="button"
                                        onClick={() => handleSelectFlavor(flavor)}
                                        className={`text-left px-3 py-2 rounded-lg text-xs transition-all ${
                                            meta.flavor === flavor
                                                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                                                : 'text-slate-300 hover:bg-[#252936] hover:text-white border border-transparent'
                                        }`}
                                    >
                                        {flavor}
                                    </button>
                                ))}
                            </div>

                            {/* Create Custom Inline Input */}
                            <div className="border-t border-white/5 pt-2 flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Add custom flavor (e.g. 'Ideology')..."
                                    value={customFlavorText}
                                    onChange={e => setCustomFlavorText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateCustomFlavor()}
                                    className="flex-1 bg-[#0f1219] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleCreateCustomFlavor}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                >
                                    <Plus size={12} /> Add
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* TEMPORAL EPOCH BOUNDS */}
            <div className="bg-[#1a1d26] p-5 rounded-xl border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar size={12} /> Chronology & Lifespan
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Origin / Formation Date</label>
                        <input
                            type="text"
                            placeholder="e.g. '1960', 'Jurassic', 'September 28, 1967'..."
                            value={meta.startDate || ''}
                            onChange={e => updateMeta('startDate', e.target.value)}
                            className="w-full bg-[#0f1219] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder-slate-700"
                        />
                        <span className="text-[9px] text-slate-500 mt-1 block">Bands form, eras begin, theologies emerge.</span>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Demise / Dissolution Date</label>
                        <input
                            type="text"
                            placeholder="e.g. '1970', 'Present', 'Ongoing'..."
                            value={meta.endDate || ''}
                            onChange={e => updateMeta('endDate', e.target.value)}
                            className="w-full bg-[#0f1219] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder-slate-700"
                        />
                        <span className="text-[9px] text-slate-500 mt-1 block">Bands disband, eras draw to a close.</span>
                    </div>
                </div>
            </div>

            {/* CRADLE & GEOGRAPHY */}
            <div className="bg-[#1a1d26] p-5 rounded-xl border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <MapPin size={12} /> Geographical Cradle
                </h3>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Cradle / Place of Origin</label>
                    <input
                        type="text"
                        placeholder="e.g. 'Liverpool, England', 'Ancient Greece'..."
                        value={meta.cradlePlaceString || ''}
                        onChange={e => updateMeta('cradlePlaceString', e.target.value)}
                        className="w-full bg-[#0f1219] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder-slate-700"
                    />
                </div>
            </div>

            {/* PRECURSORS & HIERARCHY */}
            <div className="bg-[#1a1d26] p-5 rounded-xl border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Network size={12} /> Precursors & Hierarchy
                </h3>
                <div className="relative">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Parent Concept</label>
                    {currentParent ? (
                        <div className="flex items-center justify-between bg-[#0f1219] border border-indigo-500/30 rounded-xl p-3.5 text-sm text-indigo-300">
                            <div className="flex items-center gap-2">
                                <Brain size={14} className="text-indigo-400" />
                                <span className="font-bold">{currentParent.name}</span>
                                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                                    {(currentParent.metadata as any)?.flavor || 'Concept'}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => updateMeta('parentConceptId', '')}
                                className="text-slate-500 hover:text-red-400 transition-colors p-1"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <div>
                            <button
                                type="button"
                                onClick={() => setIsParentDropdownOpen(!isParentDropdownOpen)}
                                className="w-full flex justify-between items-center bg-[#0f1219] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-indigo-500 transition-all hover:bg-[#12151d] text-left"
                            >
                                <span className="text-slate-500">None Linked (Add Precursor Concept...)</span>
                                <ChevronDown size={14} className="text-slate-400" />
                            </button>

                            {isParentDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1d26] border border-white/10 rounded-xl shadow-2xl z-50 p-3 space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Search other Concept Tags..."
                                        value={parentSearch}
                                        onChange={e => setParentSearch(e.target.value)}
                                        className="w-full bg-[#0f1219] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
                                    />
                                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                                        {availableParentConcepts.length === 0 ? (
                                            <p className="text-[10px] text-slate-500 italic p-2 text-center">No other concept tags found matching your search.</p>
                                        ) : (
                                            availableParentConcepts.map(parent => (
                                                <button
                                                    key={parent.id}
                                                    type="button"
                                                    onClick={() => {
                                                        updateMeta('parentConceptId', parent.id);
                                                        setIsParentDropdownOpen(false);
                                                        setParentSearch('');
                                                    }}
                                                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-[#252936] hover:text-white flex justify-between items-center transition-all border border-transparent"
                                                >
                                                    <span className="font-bold">{parent.name}</span>
                                                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase">
                                                        {parent.metadata?.flavor || 'Concept'}
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConceptForm;
