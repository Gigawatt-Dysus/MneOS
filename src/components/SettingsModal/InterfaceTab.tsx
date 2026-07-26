import React, { useRef } from 'react';
import type { Theme, Settings, WallpaperSettings } from '../../types';
import { SunIcon, MoonIcon, TrashIcon } from '../icons'; 
import { Sparkles, SmilePlus, HelpCircle, Monitor, Upload, Image as ImageIcon } from 'lucide-react'; 
import { GlassSlider } from '../GlassInputs';
import { GlassButton } from '../GlassButton';
import { EmojiPicker } from '../shared/EmojiPicker'; 
import { WALLPAPER_PRESETS } from '../shared/backgroundAssets';

interface InterfaceTabProps {
    localSettings: Settings;
    handleSettingChange: (key: keyof Settings, value: any) => void; 
    handleGlassChange: (key: 'opacity' | 'blur' | 'highlight', value: number) => void;
    theme: Theme;
    toggleTheme: () => void;
    newEmoji: string;
    setNewEmoji: (s: string) => void;
    addEmoji: () => void;
    currentEmojis: string[];
    removeEmoji: (e: string) => void;
    resetEmojis: () => void;
}

export const InterfaceTab: React.FC<InterfaceTabProps> = (props) => {
    const glass = props.localSettings.glassSettings || { opacity: 0.3, blur: 12, highlight: 0.3 };
    
    // [ZEN FIX] Strict defaults to prevent 'undefined' errors
    const wallpaper: WallpaperSettings = props.localSettings.wallpaper || { 
        id: 'midnight-void', 
        type: 'preset', 
        value: 'linear-gradient(to bottom, #000000, #0f172a)', 
        opacity: 1, 
        blur: 0 
    };

    const maxEmojis = 40;
    const isOverLimit = props.currentEmojis.length >= maxEmojis;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleWallpaperChange = (updates: Partial<WallpaperSettings>) => {
        // [ZEN FIX] Use the generic handler passed from index.tsx
        props.handleSettingChange('wallpaper', { ...wallpaper, ...updates });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                handleWallpaperChange({
                    id: 'custom-upload',
                    type: 'image',
                    value: reader.result as string,
                    opacity: 0.5, 
                    blur: 0
                });
            };
            reader.readAsDataURL(file);
        }
    };

    // ... Emoji Logic ...
    const handlePickerSelect = (emoji: string) => {
        if (props.currentEmojis.includes(emoji)) return; 
        if (isOverLimit) {
            alert(`Reaction Deck full! Limit is ${maxEmojis}.`);
            return;
        }
        props.setNewEmoji(emoji); 
    };

    /**
     * [ZEN FIX] Safely parses raw CSS strings (with semicolons) into React Style Objects.
     * This fixes the "Style property values shouldn't contain a semicolon" console error.
     */
    const getPresetStyle = (value: string, type?: string): React.CSSProperties => {
        if (type === 'matrix') {
            return {
                background: 'linear-gradient(to bottom, #001100, #002200)',
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.1) 2px, rgba(0,255,0,0.1) 4px)',
                backgroundSize: 'cover'
            };
        }
        if (value && value.includes(';')) {
            const style: any = {};
            const parts = value.split(';');
            
            // Handle the first part (often the background gradient without a key)
            const firstPart = parts[0].trim();
            if (firstPart && (!firstPart.includes(':') || firstPart.includes('gradient'))) {
                 style.background = firstPart;
            }

            // Handle named properties (background-color, background-size, etc.)
            parts.forEach(part => {
                if (part.includes(':')) {
                    const [prop, val] = part.split(/:(.+)/); 
                    if (prop && val) {
                        // Convert kebab-case to camelCase for React
                        const key = prop.trim().replace(/-./g, c => c.substr(1).toUpperCase());
                        style[key] = val.trim();
                    }
                }
            });
            return style;
        }
        // Default behavior for simple gradients/images
        return { background: value, backgroundSize: 'cover' };
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-2 h-full flex flex-col">
             
             {/* --- SECTION 1: HOLO-DECK (WALLPAPER) --- */}
             <div className="p-5 bg-indigo-900/10 rounded-2xl border border-indigo-500/30 shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-widest">
                        <Monitor size={16} /> Holo-Deck Environment
                    </h3>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept="image/*" 
                        className="hidden" 
                    />
                    <GlassButton onClick={() => fileInputRef.current?.click()} variant="secondary" className="h-7 text-xs">
                        <Upload size={12} className="mr-1"/> Upload Custom
                    </GlassButton>
                </div>

                {/* Preset Grid */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    {WALLPAPER_PRESETS.map(preset => {
                        const isActive = wallpaper.id === preset.id;
                        return (
                            <button
                                key={preset.id}
                                onClick={() => handleWallpaperChange({ id: preset.id, type: preset.type, value: preset.value })}
                                className={`
                                    relative h-16 rounded-lg overflow-hidden border transition-all group
                                    ${isActive ? 'border-cyan-400 ring-2 ring-cyan-500/20' : 'border-white/10 hover:border-white/30'}
                                `}
                            >
                                {/* [ZEN FIX] Use getPresetStyle to safely render previews */}
                                <div className="absolute inset-0" style={getPresetStyle(preset.value, preset.type)} />
                                <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors" />
                                <span className="absolute bottom-1 left-2 text-[9px] font-bold text-white uppercase tracking-wider shadow-sm">
                                    {preset.name}
                                </span>
                                {isActive && <div className="absolute top-1 right-1 w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" />}
                            </button>
                        );
                    })}
                </div>

                {/* Atmosphere Controls */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                    <GlassSlider 
                        label="Dimmer (Opacity)"
                        value={wallpaper.opacity ?? 1} 
                        min={0} max={1} step={0.05}
                        onChange={(v) => handleWallpaperChange({ opacity: v })}
                        formatValue={(v) => `${Math.round(v * 100)}%`}
                    />
                    <GlassSlider 
                        label="Depth of Field (Blur)"
                        value={wallpaper.blur ?? 0} 
                        min={0} max={20}
                        onChange={(v) => handleWallpaperChange({ blur: v })}
                        formatValue={(v) => `${v}px`}
                    />
                </div>
            </div>

             {/* --- SECTION 2: GLASS ENGINE --- */}
             <div className="p-5 bg-cyan-900/10 rounded-2xl border border-cyan-500/30 shrink-0">
                <h3 className="text-sm font-bold text-cyan-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                    <Sparkles size={16} /> Glass Engine
                </h3>
                <div className="grid grid-cols-3 gap-4">
                    <GlassSlider 
                        label="Reflectivity"
                        value={glass.highlight ?? 0.3} min={0} max={1} step={0.05}
                        onChange={(v) => props.handleGlassChange('highlight', v)}
                        formatValue={(v) => `${Math.round(v * 100)}%`}
                    />
                    <GlassSlider 
                        label="Backdrop Blur"
                        value={glass.blur ?? 12} min={0} max={20}
                        onChange={(v) => props.handleGlassChange('blur', v)}
                        formatValue={(v) => `${v}px`}
                    />
                    <GlassSlider 
                        label="Surface Opacity"
                        value={glass.opacity ?? 0.3} min={0} max={1} step={0.05}
                        onChange={(v) => props.handleGlassChange('opacity', v)}
                        formatValue={(v) => `${Math.round(v * 100)}%`}
                    />
                </div>
            </div>
            
            {/* --- SECTION 3: REACTION DECK --- */}
             <div className="flex-grow flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-slate-200 flex items-center gap-2">
                        <SmilePlus size={16} className="text-violet-400"/> 
                        Reaction Deck 
                        <span className={`text-xs font-normal ${isOverLimit ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                            ({props.currentEmojis.length}/{maxEmojis})
                        </span>
                    </h3>
                    
                    <button onClick={props.resetEmojis} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition-colors">
                        <TrashIcon className="w-3 h-3"/> Reset Defaults
                    </button>
                </div>

                {/* The "Deck" */}
                <div className="flex flex-wrap gap-2 p-4 bg-black/40 rounded-xl border border-white/10 min-h-[80px] items-center mb-4 shrink-0 transition-all">
                    {props.currentEmojis.map((emoji: string, idx: number) => (
                        <div key={`${emoji}-${idx}`} className="group relative">
                            <button 
                                onClick={() => props.removeEmoji(emoji)}
                                className="relative flex items-center justify-center w-10 h-10 bg-white/5 rounded-lg hover:bg-red-500/20 hover:border-red-500/50 border border-transparent transition-all text-2xl animate-in zoom-in cursor-pointer"
                            >
                                {emoji}
                                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[10px] font-bold text-red-400">REMOVE</span>
                                </div>
                            </button>
                        </div>
                    ))}
                    {!isOverLimit && Array.from({ length: Math.max(0, 10 - props.currentEmojis.length) }).slice(0, 3).map((_, i) => (
                        <div key={`empty-${i}`} className="w-10 h-10 rounded-lg border border-dashed border-white/5 bg-white/[0.02] flex items-center justify-center">
                        </div>
                    ))}
                </div>

                {/* The "Library" */}
                <div className="h-96 bg-[#0a0c10] rounded-xl border border-white/5 p-3 overflow-hidden flex flex-col shadow-inner">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2 ml-1 flex justify-between">
                        <span>Library Source</span>
                        {isOverLimit && <span className="text-red-500 animate-pulse">Deck Full</span>}
                    </p>
                    <div className="flex-grow overflow-hidden relative group/library">
                        <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
                            <EmojiPicker 
                                onEmojiSelect={handlePickerSelect} 
                                showSpicy={true} 
                            />
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t border-white/10 shrink-0">
                <h3 className="font-bold text-slate-200">App Theme</h3>
                <GlassButton onClick={props.toggleTheme} variant="secondary" className="rounded-full h-10 w-10 p-0 flex items-center justify-center">
                    {props.theme === 'light' ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
                </GlassButton>
            </div>
        </div>
    );
};