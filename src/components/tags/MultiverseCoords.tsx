import React, { useState, useEffect } from 'react';
import { Globe, GitFork, X, Sparkles, AlertCircle } from 'lucide-react';
import type { Tag } from '../../types';

interface MultiverseCoordsProps {
    tag: Tag;
    allTags: Tag[];
    onChange: (field: keyof Tag, value: any) => void;
}

export const MultiverseCoords: React.FC<MultiverseCoordsProps> = ({ tag, allTags, onChange }) => {
    const isFiction = tag.isFiction || false;
    const isVariant = tag.isVariant || false;
    const anchorTagId = tag.anchorTagId || '';
    const activeUniverse = tag.universeIds?.[0] || (tag as any).universeId || 'reality';

    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Tag[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // List of common fictional universes for quick selection combined with user's dynamically created ones
    const dynamicUniverses = Array.from(new Set([
        'Espionage World', 'Wife Daydream', 'Cake Shop World', 'Holmesian London',
        ...allTags.flatMap(t => t.universeIds || [(t as any).universeId]).filter(u => u && u !== 'reality' && u.trim() !== ''),
        (activeUniverse && activeUniverse !== 'reality' && activeUniverse.trim() !== '') ? activeUniverse.trim() : null
    ].filter(Boolean) as string[])).sort();

    // Find the current anchor tag details if linked
    const anchorTag = allTags.find(t => t.id === anchorTagId);

    useEffect(() => {
        if (searchQuery.trim().length > 1) {
            const matches = allTags.filter(t => 
                !t.isFiction && 
                t.id !== tag.id && 
                t.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setSuggestions(matches);
        } else {
            setSuggestions([]);
        }
    }, [searchQuery, allTags, tag.id]);

    const handleSelectAnchor = (anchor: Tag) => {
        onChange('isVariant', true);
        onChange('anchorTagId', anchor.id);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const handleRemoveAnchor = () => {
        onChange('isVariant', false);
        onChange('anchorTagId', undefined);
    };

    const toggleLoreMode = (fictionActive: boolean) => {
        onChange('isFiction', fictionActive);
        if (!fictionActive) {
            onChange('universeIds', ['reality']);
            onChange('isVariant', false);
            onChange('anchorTagId', undefined);
        } else {
            onChange('universeIds', [activeUniverse === 'reality' ? 'Espionage World' : activeUniverse]);
        }
    };

    const handleUniverseChange = (val: string) => {
        onChange('universeIds', [val]);
    };

    return (
        <div className="bg-[#13161f] border border-white/5 rounded-2xl p-6 relative overflow-hidden transition-all duration-300">
            {/* Ambient Background Glow */}
            <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-[100px] transition-all duration-1000 -z-10 ${
                isFiction ? 'bg-amber-500/10' : 'bg-cyan-500/10'
            }`} />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
                <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Globe className={`w-4 h-4 ${isFiction ? 'text-amber-400 animate-pulse' : 'text-cyan-400'}`} />
                        Entity Universe Coordinates
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                        Define if this entity resides in physical reality or alternate roleplay lore.
                    </p>
                </div>

                {/* Sleek Toggle Switch */}
                <div className="flex bg-[#0f1219] p-1 rounded-xl border border-white/10 w-fit self-start md:self-auto">
                    <button
                        onClick={() => toggleLoreMode(false)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-1.5 ${
                            !isFiction 
                                ? 'bg-cyan-900/30 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        🌌 Reality
                    </button>
                    <button
                        onClick={() => toggleLoreMode(true)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-1.5 ${
                            isFiction 
                                ? 'bg-amber-900/30 border border-amber-500/40 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        📚 Fictional Lore
                    </button>
                </div>
            </div>

            {/* Fictional Sandbox Panel */}
            {isFiction && (
                <div className="space-y-4 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Active Universe Coord */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Fictional Universe / Sandbox</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Enter Story/World Name..."
                                    value={activeUniverse === 'reality' ? '' : activeUniverse}
                                    onChange={e => handleUniverseChange(e.target.value)}
                                    className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-amber-500 outline-none transition-all pr-10"
                                />
                                <Sparkles size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500/50" />
                            </div>

                            {/* Quick Select Buttons */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {dynamicUniverses.map(u => (
                                    <button
                                        key={u}
                                        onClick={() => handleUniverseChange(u)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                            activeUniverse === u
                                                ? 'bg-amber-900/20 border-amber-500/30 text-amber-400'
                                                : 'bg-transparent border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-400'
                                        }`}
                                    >
                                        {u}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Anchor Polymorphic Match */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Based Upon (Anchor Identity)</label>
                            
                            {isVariant && anchorTag ? (
                                <div className="flex items-center justify-between bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 animate-in zoom-in-95 duration-200">
                                    <div className="flex items-center gap-2">
                                        {/* Glowing DNA helix animation */}
                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 relative">
                                            <span className="text-sm">🧬</span>
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-amber-300">{anchorTag.name}</span>
                                            <p className="text-[10px] text-amber-500/80 font-medium">DNA Likeness Linked</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleRemoveAnchor}
                                        className="p-1.5 bg-[#1a1d26] hover:bg-[#252936] text-slate-400 hover:text-red-400 rounded-lg border border-white/5 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search reality tags to inherit DNA/likeness..."
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                                        onFocus={() => setShowSuggestions(true)}
                                        className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-amber-500 outline-none transition-all"
                                    />
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1d26] border border-white/10 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                                            {suggestions.map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => handleSelectAnchor(s)}
                                                    className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-[#252936] hover:text-white flex items-center gap-2 border-b border-white/5 last:border-0"
                                                >
                                                    🧬 {s.name} <span className="text-[10px] text-slate-500">({s.type})</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {isVariant && anchorTag && (
                        <div className="flex items-center gap-2 bg-[#1a1d26] border border-white/5 p-3 rounded-xl mt-2 text-[10px] text-slate-400 font-medium">
                            <AlertCircle size={12} className="text-amber-500 flex-shrink-0" />
                            <span>This variant automatically inherits physical traits, face Recognition photos, and vocal characteristics from <b>{anchorTag.name}</b>. Empty fields will display inherited base values.</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
