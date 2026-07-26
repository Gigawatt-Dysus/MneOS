import React from 'react';
import type { Settings } from '@/types';
import { GlassSlider } from '../GlassInputs';

interface FontsTabProps {
    localSettings: Settings;
    handleSettingChange: (key: keyof Settings, value: any) => void;
}

const fontOptions = [
    { value: 'Inter', label: 'Inter (Default)', family: 'Inter, sans-serif' },
    { value: 'Orbitron', label: 'Orbitron', family: 'Orbitron, sans-serif' },
    { value: 'Tangerine', label: 'Tangerine', family: 'Tangerine, cursive' },
    { value: 'ui-sans-serif', label: 'System Sans', family: 'ui-sans-serif, system-ui, sans-serif' },
    { value: 'ui-serif', label: 'System Serif', family: 'ui-serif, Georgia, serif' },
    { value: 'ui-monospace', label: 'Monospace', family: 'ui-monospace, monospace' },
    { value: 'OpenDyslexic, sans-serif', label: 'OpenDyslexic', family: 'OpenDyslexic, sans-serif' },
];

export const FontsTab: React.FC<FontsTabProps> = ({ localSettings, handleSettingChange }) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-2">
            <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-200">Font Family</label>
                <div className="grid grid-cols-1 gap-2">
                    {fontOptions.map((font) => (
                        <button 
                            key={font.value} 
                            onClick={() => handleSettingChange('fontFamily', font.value)} 
                            className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${(localSettings.fontFamily || 'Inter') === font.value ? 'border-cyan-500 bg-cyan-900/20 text-white shadow-lg shadow-cyan-900/20' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                        >
                            <span className="text-xs font-bold uppercase">{font.label}</span>
                            <span className="text-lg" style={{ fontFamily: font.family }}>Gigi Archive 123</span>
                        </button>
                    ))}
                </div>

                <GlassSlider 
                    label="Font Size"
                    value={localSettings.fontSize || 16} 
                    min={12} max={24} 
                    onChange={(v) => handleSettingChange('fontSize', v)}
                    formatValue={(v) => `${v}px`}
                />
                
                <GlassSlider 
                    label="Line Spacing"
                    value={localSettings.lineHeight || 1.5} 
                    min={1.0} max={2.0} step={0.1}
                    onChange={(v) => handleSettingChange('lineHeight', v)}
                />
            </div>
        </div>
    );
};