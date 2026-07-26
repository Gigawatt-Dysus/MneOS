import React from 'react';
import type { Theme, Settings } from '@/types';
import { SunIcon, MoonIcon, PlusIcon, TrashIcon } from '../icons'; 
import { Sparkles } from 'lucide-react'; 
import { GlassSlider } from '../GlassInputs';
import { GlassButton } from '../GlassButton';

interface InterfaceTabProps {
    localSettings: Settings;
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

export const InterfaceTab: React.FC<InterfaceTabProps> = ({ 
    localSettings, handleGlassChange, theme, toggleTheme,
    newEmoji, setNewEmoji, addEmoji, currentEmojis, removeEmoji, resetEmojis
}) => {
    const glass = localSettings.glassSettings || { opacity: 0.3, blur: 12, highlight: 0.3 };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
             <div className="p-5 bg-cyan-900/10 rounded-2xl border border-cyan-500/30">
                <h3 className="text-sm font-bold text-cyan-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                    <Sparkles size={16} /> Glass Engine
                </h3>
                
                <GlassSlider 
                    label="Reflection Intensity"
                    value={glass.highlight} min={0} max={1} step={0.05}
                    onChange={(v) => handleGlassChange('highlight', v)}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                />
                <GlassSlider 
                    label="Background Blur"
                    value={glass.blur} min={0} max={20}
                    onChange={(v) => handleGlassChange('blur', v)}
                    formatValue={(v) => `${v}px`}
                />
                <GlassSlider 
                    label="Surface Opacity"
                    value={glass.opacity} min={0} max={1} step={0.05}
                    onChange={(v) => handleGlassChange('opacity', v)}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                />
            </div>
            
            <div>
                <h3 className="font-bold text-slate-200 mb-3">Reaction Emojis</h3>
                <div className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        value={newEmoji} 
                        onChange={(e) => setNewEmoji(e.target.value)} 
                        placeholder="Paste emoji..." 
                        className="flex-grow p-2 rounded-xl border border-white/10 bg-black/40 text-white text-center focus:border-cyan-500 outline-none" 
                        maxLength={2} 
                    />
                    <GlassButton onClick={addEmoji} disabled={!newEmoji} variant="primary">
                        <PlusIcon className="w-5 h-5" />
                    </GlassButton>
                </div>
                <div className="grid grid-cols-8 gap-2 p-3 bg-black/20 rounded-xl border border-white/5 max-h-40 overflow-y-auto custom-scrollbar">
                    {currentEmojis.map((emoji: string, idx: number) => (
                        <div key={`${emoji}-${idx}`} className="relative group flex justify-center p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-default">
                            {emoji}
                            <button onClick={() => removeEmoji(emoji)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end mt-2">
                    <button onClick={resetEmojis} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><TrashIcon className="w-3 h-3"/> Reset Defaults</button>
                </div>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t border-white/10">
                <h3 className="font-bold text-slate-200">App Theme</h3>
                <GlassButton onClick={toggleTheme} variant="secondary" className="rounded-full h-10 w-10 p-0 flex items-center justify-center">
                    {theme === 'light' ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
                </GlassButton>
            </div>
        </div>
    );
};