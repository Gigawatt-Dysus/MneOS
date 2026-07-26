import React, { useState, useEffect } from 'react';
import type { Settings } from '../../types';
import { GlassSlider } from '../GlassInputs';
import { GlassButton } from '../GlassButton';
import { GOOGLE_FONTS_LIBRARY, SYSTEM_FONTS } from '../shared/fontData';
import { Search, Plus, Trash2, Check, Type } from 'lucide-react';

interface FontsTabProps {
    localSettings: Settings;
    handleSettingChange: (key: keyof Settings, value: any) => void;
}

export const FontsTab: React.FC<FontsTabProps> = ({ localSettings, handleSettingChange }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');

    const installed = localSettings.installedFonts && localSettings.installedFonts.length > 0 
        ? localSettings.installedFonts 
        : ['Inter', 'Orbitron']; 

    const currentFont = localSettings.fontFamily || 'Inter';

    const handleInstall = (fontName: string) => {
        if (installed.includes(fontName)) return;
        handleSettingChange('installedFonts', [...installed, fontName]);
        // [ZEN FIX] Auto-select the font upon install for immediate gratification
        handleSettingChange('fontFamily', fontName);
    };

    const handleUninstall = (fontName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newDeck = installed.filter(f => f !== fontName);
        handleSettingChange('installedFonts', newDeck);
        if (currentFont === fontName) {
            handleSettingChange('fontFamily', 'Inter');
        }
    };

    const handleSelect = (fontName: string) => {
        handleSettingChange('fontFamily', fontName);
    };

    // Helper to get fallback category for any font (System or Google)
    const getFontCategory = (name: string) => {
        const found = GOOGLE_FONTS_LIBRARY.find(g => g.name === name) || SYSTEM_FONTS.find(s => s.name === name);
        return found ? found.category : 'sans-serif';
    };

    const filteredLibrary = GOOGLE_FONTS_LIBRARY.filter(f => {
        const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCat = activeCategory === 'all' || f.category === activeCategory;
        const notInstalled = !installed.includes(f.name);
        return matchesSearch && matchesCat && notInstalled;
    });

    // [ZEN FIX] Enhanced Preview Engine
    // Loads BOTH library results AND installed fonts to ensure the top deck renders correctly.
    useEffect(() => {
        // combine installed fonts + visible library results
        const fontsToLoad = Array.from(new Set([
            ...installed, 
            ...filteredLibrary.slice(0, 15).map(f => f.name)
        ]));

        if (fontsToLoad.length === 0) return;

        // Filter out system fonts that don't need Google loading
        const googleFonts = fontsToLoad.filter(name => 
            GOOGLE_FONTS_LIBRARY.some(gf => gf.name === name)
        );

        if (googleFonts.length === 0) return;
        
        const fontParams = googleFonts
            .map(name => `family=${name.replace(/ /g, '+')}:wght@400;700`)
            .join('&');

        const linkId = 'gigi-font-previews';
        const url = `https://fonts.googleapis.com/css2?${fontParams}&display=swap`;

        let link = document.getElementById(linkId) as HTMLLinkElement;
        if (!link) {
            link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        link.href = url;

    }, [searchTerm, activeCategory, filteredLibrary.length, installed.length]); 

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-2 h-full flex flex-col">
            
            {/* --- TOP: INSTALLED DECK --- */}
            <div className="shrink-0">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-slate-200 flex items-center gap-2">
                        <Type size={16} className="text-cyan-400"/> 
                        Installed Fonts 
                        <span className="text-xs font-normal text-slate-500">({installed.length})</span>
                    </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {installed.map(font => {
                        const isActive = currentFont === font;
                        const category = getFontCategory(font);
                        
                        return (
                            <div 
                                key={font}
                                onClick={() => handleSelect(font)}
                                className={`
                                    relative p-3 rounded-xl border cursor-pointer transition-all group
                                    ${isActive 
                                        ? 'bg-cyan-900/30 border-cyan-500 shadow-lg shadow-cyan-900/20' 
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                    }
                                `}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider font-bold opacity-50 mb-1">{font}</p>
                                        {/* [ZEN FIX] Added correct fallback category here */}
                                        <p className="text-xl leading-none" style={{ fontFamily: `"${font}", ${category}` }}>Gigi AI</p>
                                    </div>
                                    {isActive && <Check size={16} className="text-cyan-400" />}
                                </div>
                                
                                {!isActive && (
                                    <button 
                                        onClick={(e) => handleUninstall(font, e)}
                                        className="absolute top-2 right-2 p-1.5 text-red-400 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Uninstall Font"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- MIDDLE: CONTROLS --- */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-black/20 rounded-xl border border-white/5 shrink-0">
                 <GlassSlider 
                    label="Size"
                    value={localSettings.fontSize || 16} 
                    min={12} max={32} 
                    onChange={(v) => handleSettingChange('fontSize', v)}
                    formatValue={(v) => `${v}px`}
                />
                <GlassSlider 
                    label="Height"
                    value={localSettings.lineHeight || 1.5} 
                    min={1.0} max={2.5} step={0.1}
                    onChange={(v) => handleSettingChange('lineHeight', v)}
                />
            </div>

            {/* --- BOTTOM: LIBRARY --- */}
            <div className="flex-grow flex flex-col min-h-0 bg-[#0a0c10] rounded-xl border border-white/10 overflow-hidden">
                {/* Search & Tabs */}
                <div className="p-3 border-b border-white/10 bg-black/20 flex flex-col gap-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="Search Google Fonts..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:border-cyan-500 outline-none"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        {['all', 'sans-serif', 'serif', 'display', 'handwriting', 'monospace'].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-2 py-1 text-[10px] uppercase font-bold rounded border transition-colors ${
                                    activeCategory === cat 
                                    ? 'bg-violet-600 border-violet-500 text-white' 
                                    : 'border-white/10 text-slate-500 hover:bg-white/5'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className="flex-grow overflow-y-auto custom-scrollbar p-2">
                    {filteredLibrary.map(font => (
                        <div key={font.name} className="flex justify-between items-center p-3 hover:bg-white/5 rounded-lg border-b border-white/5 last:border-0 group transition-colors">
                            <div>
                                <span className="text-lg text-slate-200" style={{ fontFamily: `"${font.name}", ${font.category}` }}>
                                    {font.name}
                                </span>
                                <span className="ml-2 text-[10px] text-slate-500 uppercase border border-white/10 px-1 rounded">
                                    {font.category}
                                </span>
                            </div>
                            
                            {/* [ZEN FIX] Enhanced Install Button - Clearer Label & Tooltip */}
                            <GlassButton 
                                onClick={() => handleInstall(font.name)}
                                variant="secondary" 
                                className="h-8 px-3 flex items-center justify-center gap-2 group/btn"
                                title={`Install ${font.name} to My Fonts`}
                            >
                                <Plus size={14} />
                                <span className="text-[10px] font-bold tracking-wider">INSTALL</span>
                            </GlassButton>
                        </div>
                    ))}
                    
                    {filteredLibrary.length === 0 && (
                        <div className="p-8 text-center text-slate-500 text-sm">
                            No fonts found. Try a different search.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};