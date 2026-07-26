import React, { useState } from 'react';
import { User, ResumeStyleConfig } from '../../types';
import { Check, Columns, MousePointer2, Type, Layout, Save, Trash2, RotateCcw } from 'lucide-react';

interface ResumeTemplateGalleryProps {
    user: User;
    onTemplateSelect: (templateId: string, config: ResumeStyleConfig) => void;
    onSaveCustom: (name: string, config: ResumeStyleConfig) => void;
    onDeleteCustom: (name: string) => void;
}

const PRESET_TEMPLATES: ResumeStyleConfig[] = [
    {
        id: 'classic-sentinel',
        name: 'The Sentinel (Classic)',
        fontFamily: 'times',
        headerSize: 24,
        bodySize: 11,
        margins: { top: 25, right: 20, bottom: 20, left: 20 },
        accentColor: '#000000'
    },
    {
        id: 'modern-archon',
        name: 'The Archon (Modern)',
        fontFamily: 'helvetica',
        headerSize: 22,
        bodySize: 10,
        margins: { top: 20, right: 15, bottom: 15, left: 15 },
        accentColor: '#10b981'
    },
    {
        id: 'minimal-ghost',
        name: 'The Ghost (Minimalist)',
        fontFamily: 'courier',
        headerSize: 18,
        bodySize: 9,
        margins: { top: 15, right: 15, bottom: 15, left: 15 },
        accentColor: '#64748b'
    }
];

export const ResumeTemplateGallery: React.FC<ResumeTemplateGalleryProps> = ({ user, onTemplateSelect, onSaveCustom, onDeleteCustom }) => {
    const [localConfig, setLocalConfig] = useState<ResumeStyleConfig>(
        PRESET_TEMPLATES.find(p => p.id === user.atsSettings?.activeTemplateId) || 
        (user.atsSettings?.customTemplates && user.atsSettings.activeTemplateId && user.atsSettings.customTemplates[user.atsSettings.activeTemplateId]) ||
        PRESET_TEMPLATES[1]
    );
    const [customName, setCustomName] = useState('');
    const [contrastWarning, setContrastWarning] = useState(false);

    // Merge Presets and Custom Templates for the Gallery
    const allTemplates = [
        ...PRESET_TEMPLATES.map(p => ({ ...p, category: 'PRESET' as const })),
        ...Object.entries(user.atsSettings?.customTemplates || {}).map(([name, config]) => ({
            ...config,
            id: name,
            name: name,
            category: 'CUSTOM' as const
        }))
    ];

    // [ZEN] Accessibility Helper: Check contrast against white
    const getContrastRatio = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        
        // sRGB to Luminance
        const a = [r, g, b].map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
        const L = 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
        return (1 + 0.05) / (L + 0.05);
    };

    const handleUpdate = (updates: Partial<ResumeStyleConfig>) => {
        const next = { ...localConfig, ...updates };
        
        // [ZEN] Accessibility Guard
        if (updates.accentColor) {
            const ratio = getContrastRatio(updates.accentColor);
            if (ratio < 4.5) {
                setContrastWarning(true);
                // Auto-darken if too light? No, just warn for now or suggest navy
            } else {
                setContrastWarning(false);
            }
        }

        setLocalConfig(next);
        onTemplateSelect(next.id, next);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Visual Browsing Gallery */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {allTemplates.map((tpl) => (
                    <div key={tpl.id} className="relative group">
                        <button
                            onClick={() => {
                                setLocalConfig(tpl);
                                onTemplateSelect(tpl.id, tpl);
                            }}
                            className={`w-full relative aspect-[3/4] rounded-2xl border-2 transition-all duration-300 overflow-hidden text-left ${
                                localConfig.id === tpl.id 
                                    ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)] scale-[1.02]' 
                                    : 'border-white/5 bg-black/40 hover:border-white/20'
                            }`}
                        >
                            {/* Dummy Text Preview */}
                            <div className="absolute inset-x-4 top-6 space-y-2 opacity-60">
                                <div className={`h-4 bg-white/20 rounded w-3/4 mb-6 ${tpl.fontFamily === 'times' ? 'font-serif' : 'font-sans'}`} />
                                <div className="h-1 bg-white/10 rounded w-full" />
                                <div className="h-1 bg-white/10 rounded w-5/6" />
                                <div className="h-1 bg-white/10 rounded w-1/2" />
                                <div className="mt-8 space-y-1">
                                    <div className="h-2 rounded w-1/3" style={{ backgroundColor: tpl.accentColor + '40' }} />
                                    <div className="h-1 bg-white/5 rounded w-full" />
                                    <div className="h-1 bg-white/5 rounded w-full" />
                                </div>
                            </div>

                            {/* Info Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-5">
                                <span className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">
                                    {tpl.category} ARCHITECTURE
                                </span>
                                <div className="flex items-center justify-between">
                                    <span className={`text-[10px] font-bold tracking-widest uppercase ${localConfig.id === tpl.id ? 'text-emerald-400' : 'text-slate-400'}`}>
                                        {tpl.name}
                                    </span>
                                    {localConfig.id === tpl.id && (
                                        <div className="bg-emerald-500 rounded-full p-1">
                                            <Check size={10} className="text-black" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                        
                        {/* Delete Action for Custom Templates */}
                        {tpl.category === 'CUSTOM' && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteCustom(tpl.id);
                                }}
                                className="absolute -top-2 -right-2 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white p-1.5 rounded-full border border-red-500/20 opacity-0 group-hover:opacity-100 transition-all z-20"
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Customizer Panel */}
            <div className="bg-black/40 border border-white/10 rounded-3xl p-8 space-y-8">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                    <Layout className="text-emerald-400" size={20} />
                    <h3 className="text-sm font-bold text-white tracking-widest uppercase">Style Parameter Control</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {/* Typography */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-slate-500 mb-2">
                            <Type size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Typography & Color</span>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] text-slate-600 uppercase mb-2">Font Family</label>
                                <div className="flex gap-2">
                                    {['helvetica', 'times', 'courier'].map(f => (
                                        <button 
                                            key={f}
                                            onClick={() => handleUpdate({ fontFamily: f as any })}
                                            className={`flex-1 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all ${
                                                localConfig.fontFamily === f 
                                                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                                                    : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/20'
                                            }`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Color Picker with Integrity Guard */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-[9px] text-slate-600 uppercase">Accent Color</label>
                                    {contrastWarning && (
                                        <span className="text-[8px] font-bold text-red-400 animate-pulse uppercase">Low Contrast Guard Active</span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {['#000000', '#1e293b', '#1e40af', '#10b981', '#0f766e', '#7e22ce', '#be123c', '#ca8a04'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => handleUpdate({ accentColor: color })}
                                            className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                                localConfig.accentColor === color ? 'border-emerald-500 scale-110 shadow-lg' : 'border-white/10 hover:border-white/30'
                                            }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    {/* Custom Hex Input */}
                                    <div className="flex-1 min-w-[80px]">
                                        <input 
                                            type="text" 
                                            value={localConfig.accentColor}
                                            onChange={e => handleUpdate({ accentColor: e.target.value })}
                                            className={`w-full bg-black/60 border rounded-lg p-2 text-[10px] text-white font-mono ${
                                                contrastWarning ? 'border-red-500/50 text-red-200' : 'border-white/10'
                                            }`}
                                            placeholder="#HEX"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] text-slate-600 uppercase mb-2">Header (pt)</label>
                                    <input 
                                        type="number" 
                                        value={localConfig.headerSize} 
                                        onChange={e => handleUpdate({ headerSize: parseInt(e.target.value) })}
                                        className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-xs text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] text-slate-600 uppercase mb-2">Body (pt)</label>
                                    <input 
                                        type="number" 
                                        value={localConfig.bodySize} 
                                        onChange={e => handleUpdate({ bodySize: parseInt(e.target.value) })}
                                        className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-xs text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Architecture (Margins) */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-slate-500 mb-2">
                            <Columns size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Architecture (mm)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {Object.keys(localConfig.margins).map((m) => (
                                <div key={m}>
                                    <label className="block text-[9px] text-slate-600 uppercase mb-2">{m}</label>
                                    <input 
                                        type="number" 
                                        value={(localConfig.margins as any)[m]} 
                                        onChange={e => handleUpdate({ 
                                            margins: { ...localConfig.margins, [m]: parseInt(e.target.value) } 
                                        })}
                                        className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-xs text-white"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Persistence */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-slate-500 mb-2">
                            <Save size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Persistence</span>
                        </div>
                        <div className="space-y-4">
                            <input 
                                type="text" 
                                placeholder="Custom-New-2026"
                                value={customName}
                                onChange={e => setCustomName(e.target.value)}
                                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-emerald-100 placeholder-slate-700"
                            />
                            <button 
                                onClick={() => {
                                    if (contrastWarning) {
                                        alert("ACCESSIBILITY DENIED: The selected accent color lacks sufficient contrast for professional legibility. Please select a darker tone.");
                                        return;
                                    }
                                    if (customName) onSaveCustom(customName, localConfig);
                                }}
                                className="w-full py-3 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-all"
                            >
                                Memory Record Template
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                    <div className="flex items-center gap-2">
                        <RotateCcw size={14} className="text-slate-600" />
                        <span className="text-[10px] text-slate-600 font-mono uppercase tracking-widest">Accessibility Rules Enforcement Active</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
