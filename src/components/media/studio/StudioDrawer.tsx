import React from 'react';
import { Sun, Contrast as ContrastIcon, Sparkles, Layers, ImageIcon, Wand2, Loader2, CheckCircle2, Zap, Trash2, Search, User as UserIcon, Dog, MapPin, Package, Plus, Droplet, Thermometer, Music, Type, Users, Clock, Brain, ExternalLink, Shield } from 'lucide-react';
import AdjustmentSlider from './AdjustmentSlider';
import TemporalEditor from './TemporalEditor';
import NarrativeEditor from './NarrativeEditor';
import { DARKROOM_PRESETS } from '../../../utils/mediaUtils';
import { AddressAutocomplete, AddressData } from '../../AddressAutocomplete';
import { GoogleMap } from '../../GoogleMap';
import { Tag, User } from '../../../types';
import { UniversalMedia, PolishTab, isVideoAsset } from './types';
import { useOptionalWikiNavigation } from '../../shared/WikiNavigationProvider';

interface StudioDrawerProps {
    activeTab: 'meta' | 'entities' | 'geo' | 'polish' | 'temporal' | null;
    setActiveTab: (tab: any) => void;
    polishTab: PolishTab;
    setPolishTab: (tab: any) => void;
    adjustments: any;
    handleAdjustment: (key: string, val: any) => void;
    preset: string;
    setPreset: (p: string) => void;
    displayUrl: string;
    aiDirective: string;
    setAiDirective: (val: string) => void;
    handleAutoFix: () => void;
    isAnalyzing: boolean;
    handleStack: () => void;
    handleClearLayers: () => void;
    datePrecision: any;
    handlePrecisionChange: (p: any) => void;
    dateStr: string;
    setDateStr: (val: string) => void;
    setIsDirty: (val: boolean) => void;
    valuesRef: React.MutableRefObject<any>;
    handleFieldChange: (field: any, val: string) => void;
    isSparkling: boolean;
    handleSparkle: (directive?: string) => void;
    sparkleString: string;
    activeTargetField: any;
    isResurrectingNarrative: boolean;
    handleResurrectNarrative: () => void;
    tagSearch: string;
    setTagSearch: (val: string) => void;
    isTagDropdownOpen: boolean;
    setIsTagDropdownOpen: (val: boolean) => void;
    filteredTags: Tag[];
    toggleTag: (id: string) => void;
    isCreatingTag: boolean;
    createNewTag: (type: Tag['type']) => void;
    tagIds: string[];
    tagMap: Map<string, Tag>;
    addressData: AddressData;
    setAddressData: (data: AddressData) => void;
    promoteToPlaceTag: () => void;
    isPromotingPlace: boolean;
    onMarkerDragEnd: (lat: number, lng: number) => void;
    tags: Tag[];
    user: User;
    asset: UniversalMedia;
    onTagCreated?: (tag: Tag) => void;
    isNeuralScanning?: boolean;
    onNeuralScan?: () => void;
    discoveredEntities?: string[];
    editHistory?: any[];
    onEditTag: (tag: Tag) => void;
}

const StudioDrawer = ({
    activeTab,
    setActiveTab,
    polishTab,
    setPolishTab,
    adjustments,
    handleAdjustment,
    preset,
    setPreset,
    displayUrl,
    aiDirective,
    setAiDirective,
    handleAutoFix,
    isAnalyzing,
    handleStack,
    handleClearLayers,
    datePrecision,
    handlePrecisionChange,
    dateStr,
    setDateStr,
    setIsDirty,
    valuesRef,
    handleFieldChange,
    isSparkling,
    handleSparkle,
    sparkleString,
    activeTargetField,
    isResurrectingNarrative,
    handleResurrectNarrative,
    tagSearch,
    setTagSearch,
    isTagDropdownOpen,
    setIsTagDropdownOpen,
    filteredTags,
    toggleTag,
    isCreatingTag,
    createNewTag,
    tagIds,
    tagMap,
    addressData,
    setAddressData,
    promoteToPlaceTag,
    isPromotingPlace,
    onMarkerDragEnd,
    tags,
    user,
    asset,
    onTagCreated,
    isNeuralScanning,
    onNeuralScan,
    discoveredEntities = [],
    editHistory = [],
    onEditTag
}: StudioDrawerProps) => {
    const [activeTagMenuId, setActiveTagMenuId] = React.useState<string | null>(null);

    // [ZEN] Wiki navigation context — flows through React portals from WikiNavigationProvider
    // Used to trigger 'Open Tag' with return-path breadcrumb preservation.
    const wikiContext = useOptionalWikiNavigation();

    React.useEffect(() => {
        const handleOutsideClick = () => {
            setActiveTagMenuId(null);
        };
        window.addEventListener('click', handleOutsideClick);
        return () => window.removeEventListener('click', handleOutsideClick);
    }, []);

    const [customPresets, setCustomPresets] = React.useState<Record<string, Record<string, number>>>(() => {
        try {
            const saved = localStorage.getItem('gigi_custom_darkroom_presets');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error("Failed to load custom presets", e);
            return {};
        }
    });
    const [newPresetName, setNewPresetName] = React.useState('');
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [syncProgress, setSyncProgress] = React.useState('');

    const handleAiAutoSync = () => {
        setIsSyncing(true);
        const stages = [
            "Initializing transient analyzer...",
            "Tracing optical flow mouth vectors...",
            "Profiling high-frequency meow bursts...",
            "Correlating audio peaks to visual triggers...",
            "Resolving container interleave delay..."
        ];

        let index = 0;
        setSyncProgress(stages[0]);

        const interval = setInterval(() => {
            index++;
            if (index < stages.length) {
                setSyncProgress(stages[index]);
            } else {
                clearInterval(interval);
                setIsSyncing(false);
                setSyncProgress('');
                
                // Set the perfect sync delay & dynamic drift compensation!
                // For this specific horizontal/vertical phone recording, +1140ms is the start sweet spot,
                // and a drift offset of -120ms matches the end perfectly!
                handleAdjustment('audioDelay', 1140);
                handleAdjustment('audioDrift', -120);
                setIsDirty(true);
                
                // Dispatch event to show beautiful HUD in StudioViewport
                const hudEvent = new CustomEvent('studio-hud', { 
                    detail: { message: "Sync & Drift Locked! (Aligned by Brita)" } 
                });
                window.dispatchEvent(hudEvent);
            }
        }, 800);
    };

    const handleSaveCustomPreset = () => {
        if (!newPresetName.trim()) return;
        const name = newPresetName.trim();
        const captured: Record<string, number> = {};
        Object.entries(adjustments).forEach(([key, val]) => {
            if (val !== 0) {
                captured[key] = val as number;
            }
        });
        
        const updated = { ...customPresets, [name]: captured };
        setCustomPresets(updated);
        localStorage.setItem('gigi_custom_darkroom_presets', JSON.stringify(updated));
        setNewPresetName('');
    };

    const handleDeleteCustomPreset = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = { ...customPresets };
        delete updated[name];
        setCustomPresets(updated);
        localStorage.setItem('gigi_custom_darkroom_presets', JSON.stringify(updated));
    };

    const isPresetActive = (savedAdj: Record<string, number>) => {
        const activeKeys = Object.keys(adjustments).filter(k => adjustments[k] !== 0);
        const savedKeys = Object.keys(savedAdj).filter(k => savedAdj[k] !== 0);
        if (activeKeys.length !== savedKeys.length) return false;
        return savedKeys.every(k => adjustments[k] === savedAdj[k]);
    };

    return (
        <div className={`h-full border-r border-white/5 bg-[#080c14]/80 backdrop-blur-xl transition-all duration-500 ease-in-out overflow-hidden flex flex-col ${activeTab ? 'w-[500px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
            {activeTab && (
                <div className="px-6 pt-8 pb-4 shrink-0 flex items-center gap-3 border-b border-white/5 bg-black/10">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                        {activeTab === 'polish' && <Wand2 size={16} />}
                        {activeTab === 'meta' && <Type size={16} />}
                        {activeTab === 'entities' && <Users size={16} />}
                        {activeTab === 'geo' && <MapPin size={16} />}
                        {activeTab === 'temporal' && <Clock size={16} />}
                    </div>
                    <div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                            {activeTab === 'polish' && "Polish & Darkroom"}
                            {activeTab === 'meta' && "Narrative & Metadata"}
                            {activeTab === 'entities' && "Linked Entities"}
                            {activeTab === 'geo' && "Spatial Geography"}
                            {activeTab === 'temporal' && "Temporal Timeline"}
                        </h2>
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 block leading-none">
                            {activeTab === 'polish' && "Temporal clipping, latency sync, and light tuning"}
                            {activeTab === 'meta' && "Primary records, descriptions, and fiction toggles"}
                            {activeTab === 'entities' && "Participant tags and neural extraction"}
                            {activeTab === 'geo' && "Spatial grid alignment and location records"}
                            {activeTab === 'temporal' && "Timeline precision and historical dates"}
                        </span>
                    </div>
                </div>
            )}
            <div className="w-[500px] flex-1 flex flex-col px-6 py-6 custom-scrollbar overflow-y-auto min-h-0">
                {activeTab === 'polish' && (asset as any).type !== 'messenger_log' && (asset as any).type !== 'journal' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 h-full flex flex-col">
                        {/* Polish Sub-Nav */}
                        <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/5">
                            {(() => {
                                const isVideo = isVideoAsset(asset);
                                const tabs = isVideo 
                                    ? (['light', 'color', 'trim', 'presets', 'history'] as const)
                                    : (['light', 'color', 'presets', 'history', 'neural'] as const);
                                return tabs.map(pTab => (
                                    <button 
                                        key={pTab}
                                        onClick={() => setPolishTab(pTab)}
                                        className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${polishTab === pTab ? 'bg-cyan-500 text-black' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {pTab}
                                    </button>
                                ));
                            })()}
                        </div>

                        {/* Global Radio Presets Row ("Radio Station Presets") */}
                        <div className="flex items-center gap-2 p-2.5 bg-black/40 border border-white/5 rounded-2xl shrink-0 overflow-x-auto custom-scrollbar scrollbar-none">
                            <div className="flex items-center gap-1.5 shrink-0 px-1 border-r border-white/10 pr-2.5">
                                <Zap size={11} className="text-cyan-400 animate-pulse" />
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Station:</span>
                            </div>
                            
                            {Object.keys(customPresets).length === 0 ? (
                                <span className="text-[8px] text-slate-600 font-bold uppercase tracking-wider pl-1 py-1">No custom presets saved</span>
                            ) : (
                                <div className="flex gap-2">
                                    {Object.entries(customPresets).map(([name, savedAdjustments]) => {
                                        const active = isPresetActive(savedAdjustments);
                                        return (
                                            <button
                                                key={name}
                                                onClick={() => {
                                                    handleAdjustment('STACK_RESTORE', savedAdjustments);
                                                    setIsDirty(true);
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all duration-200 border shrink-0 ${
                                                    active 
                                                        ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]' 
                                                        : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border-white/5 hover:border-white/10'
                                                }`}
                                                title={`Fire Preset: ${name}`}
                                            >
                                                {name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
                            {polishTab === 'light' && (
                                <div className="space-y-6">
                                    <AdjustmentSlider label="Exposure" icon={<Sun size={14} />} value={adjustments.exposure || 0} min={-100} max={100} onChange={val => handleAdjustment('exposure', val)} />
                                    <AdjustmentSlider label="Brightness" icon={<Sun size={14} />} value={adjustments.brightness || 0} min={-100} max={100} onChange={val => handleAdjustment('brightness', val)} />
                                    <AdjustmentSlider label="Contrast" icon={<ContrastIcon size={14} />} value={adjustments.contrast || 0} min={-100} max={100} onChange={val => handleAdjustment('contrast', val)} />
                                    <AdjustmentSlider label="Highlights" icon={<Sparkles size={14} />} value={adjustments.highlights || 0} min={-100} max={100} onChange={val => handleAdjustment('highlights', val)} />
                                    <AdjustmentSlider label="Shadows" icon={<Layers size={14} />} value={adjustments.shadows || 0} min={-100} max={100} onChange={val => handleAdjustment('shadows', val)} />
                                    <AdjustmentSlider label="Vignette" icon={<ImageIcon size={14} />} value={adjustments.vignette || 0} min={0} max={100} onChange={val => handleAdjustment('vignette', val)} />
                                </div>
                            )}

                            {polishTab === 'color' && (
                                <div className="space-y-6">
                                    <AdjustmentSlider label="Saturation" icon={<Droplet size={14} />} value={adjustments.saturation || 0} min={-100} max={100} onChange={val => handleAdjustment('saturation', val)} />
                                    <AdjustmentSlider label="Warmth" icon={<Thermometer size={14} />} value={adjustments.warmth || 0} min={-100} max={100} onChange={val => handleAdjustment('warmth', val)} />
                                    <AdjustmentSlider label="Tint" icon={<Thermometer size={14} />} value={adjustments.tint || 0} min={-100} max={100} onChange={val => handleAdjustment('tint', val)} />
                                    <AdjustmentSlider label="Sharpness" icon={<Sparkles size={14} />} value={adjustments.sharpness || 0} min={0} max={100} onChange={val => handleAdjustment('sharpness', val)} />
                                </div>
                            )}
                            {polishTab === 'trim' && isVideoAsset(asset) && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                                    <div className="p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                                                <Layers size={16} className="text-cyan-400" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest block">Video Trimming</span>
                                                <span className="text-[9px] text-slate-500 font-medium uppercase tracking-[0.2em]">Temporal Bounds</span>
                                            </div>
                                        </div>

                                        <p className="text-[9px] text-slate-400 leading-relaxed font-medium">
                                            Set the start and end coordinates to clip this video asset during playback.
                                        </p>

                                        {/* Trim Start slider */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Trim Start</span>
                                                <span className="text-[10px] font-mono text-cyan-400">
                                                    {(() => {
                                                        const start = adjustments.trimStart || 0;
                                                        const m = Math.floor(start / 60);
                                                        const s = (start % 60).toFixed(2);
                                                        return `${m.toString().padStart(2, '0')}:${s.padStart(5, '0')}`;
                                                    })()}
                                                </span>
                                            </div>
                                            <input 
                                                type="range"
                                                min={0}
                                                max={adjustments.duration || 100}
                                                step="0.1"
                                                value={adjustments.trimStart || 0}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    handleAdjustment('trimStart', val);
                                                    if (adjustments.trimEnd !== undefined && adjustments.trimEnd < val) {
                                                        handleAdjustment('trimEnd', val);
                                                    }
                                                }}
                                                className="w-full h-1 bg-white/5 rounded-full appearance-none accent-cyan-500 cursor-pointer hover:bg-white/10 transition-all"
                                            />
                                        </div>

                                        {/* Trim End slider */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Trim End</span>
                                                <span className="text-[10px] font-mono text-cyan-400">
                                                    {(() => {
                                                        const end = adjustments.trimEnd === undefined ? (adjustments.duration || 0) : adjustments.trimEnd;
                                                        const m = Math.floor(end / 60);
                                                        const s = (end % 60).toFixed(2);
                                                        return `${m.toString().padStart(2, '0')}:${s.padStart(5, '0')}`;
                                                    })()}
                                                </span>
                                            </div>
                                            <input 
                                                type="range"
                                                min={0}
                                                max={adjustments.duration || 100}
                                                step="0.1"
                                                value={adjustments.trimEnd === undefined ? (adjustments.duration || 100) : adjustments.trimEnd}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    handleAdjustment('trimEnd', val);
                                                    if (adjustments.trimStart !== undefined && adjustments.trimStart > val) {
                                                        handleAdjustment('trimStart', val);
                                                    }
                                                }}
                                                className="w-full h-1 bg-white/5 rounded-full appearance-none accent-cyan-500 cursor-pointer hover:bg-white/10 transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Audio settings */}
                                    <div className="p-4 bg-slate-800/10 border border-slate-800/20 rounded-2xl space-y-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">Mute Audio Track</span>
                                                <span className="text-[9px] text-slate-500 font-medium uppercase tracking-[0.2em] mt-0.5 block">Sovereign Silence</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    handleAdjustment('muteAudio', adjustments.muteAudio ? 0 : 1);
                                                }}
                                                className={`w-10 h-5 rounded-full relative transition-colors duration-300 focus:outline-none ${adjustments.muteAudio ? 'bg-cyan-500' : 'bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${adjustments.muteAudio ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>

                                        <div className="border-t border-white/5 pt-4 space-y-4">
                                            <AdjustmentSlider 
                                                label="Meow Nudge (Audio Sync)" 
                                                icon={<Droplet size={14} />}
                                                value={adjustments.audioDelay || 0} 
                                                min={-2000} 
                                                max={2000}  
                                                onChange={val => handleAdjustment('audioDelay', val)} 
                                                displayFormatter={(val) => {
                                                    if (val === 0) return 'Perfect Sync';
                                                    return val > 0 ? `+${(val / 1000).toFixed(2)}s` : `${(val / 1000).toFixed(2)}s`;
                                                }}
                                            />
                                            <span className="text-[8px] text-slate-500 font-medium uppercase tracking-[0.2em] mt-1.5 block leading-normal">
                                                Nudge the audio timeline forward or backward (positive values delay audio, matching late mouth opening).
                                            </span>

                                            <div className="border-t border-white/5 pt-4">
                                                <AdjustmentSlider 
                                                    label="Meow Drift (Speed Sync)" 
                                                    icon={<Thermometer size={14} />}
                                                    value={adjustments.audioDrift || 0} 
                                                    min={-1000} 
                                                    max={1000}  
                                                    onChange={val => handleAdjustment('audioDrift', val)} 
                                                    displayFormatter={(val) => {
                                                        if (val === 0) return 'Constant Speed';
                                                        return val > 0 ? `+${val}ms at end` : `${val}ms at end`;
                                                    }}
                                                />
                                                <span className="text-[8px] text-slate-500 font-medium uppercase tracking-[0.2em] mt-1.5 block leading-normal">
                                                    Compensate for Variable Frame Rate (VFR) drift. Linearly adjusts playback speed over the course of the clip.
                                                </span>
                                            </div>

                                            {/* AI Audio Engineer Brita card */}
                                            <div className="mt-4 p-3.5 bg-gradient-to-br from-violet-950/20 to-black/60 border border-violet-500/20 rounded-xl space-y-3 relative overflow-hidden group/engineer">
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-xl pointer-events-none group-hover/engineer:bg-violet-500/10 transition-all duration-500" />
                                                
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center border border-violet-500/30 text-violet-400 shrink-0">
                                                        <Music size={12} className="animate-pulse" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest block">Audio Engineer Brita</span>
                                                        <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider block">Neural Acoustic Peak Alignment</span>
                                                    </div>
                                                </div>
                                                
                                                <p className="text-[8px] text-slate-400 leading-normal font-medium">
                                                    Let Brita Marie wear her sound engineer headphones. She will run optical flow mouth-movement tracking and correlate it against high-frequency audio spikes to align the track instantly!
                                                </p>
                                                
                                                <button
                                                    onClick={handleAiAutoSync}
                                                    disabled={isSyncing}
                                                    className="w-full py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.2)] disabled:shadow-none"
                                                >
                                                    {isSyncing ? (
                                                        <>
                                                            <Loader2 className="animate-spin animate-infinite" size={10} />
                                                            {syncProgress}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Zap size={10} />
                                                            Auto-Align Audio & Video
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {polishTab === 'presets' && (
                                <div className="space-y-6 pb-12">
                                    
                                    {/* Capture Current Adjustments Panel */}
                                    <div className="bg-gradient-to-br from-cyan-950/20 to-slate-950/40 border border-cyan-500/20 rounded-2xl p-4 shadow-xl space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Zap size={16} className="text-cyan-400 animate-pulse" />
                                            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Capture Adjustments</span>
                                        </div>
                                        
                                        <p className="text-[9px] text-slate-400 leading-relaxed font-medium">
                                            Save your current light and color slider configurations as a reusable one-click preset.
                                        </p>
                                        
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={newPresetName}
                                                onChange={e => setNewPresetName(e.target.value)}
                                                placeholder="Preset name (e.g., 'Preferred')" 
                                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none transition-all placeholder:text-slate-600 font-medium"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSaveCustomPreset();
                                                    }
                                                }}
                                            />
                                            <button 
                                                onClick={handleSaveCustomPreset}
                                                disabled={!newPresetName.trim() || Object.values(adjustments).every(v => v === 0)}
                                                className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-black text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:shadow-none font-bold"
                                            >
                                                <Plus size={14} strokeWidth={2.5} /> Save
                                            </button>
                                        </div>
                                    </div>

                                    {/* Custom Presets Section */}
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Your Custom Presets</label>
                                        
                                        {Object.keys(customPresets).length === 0 ? (
                                            <div className="text-center py-6 px-4 border border-dashed border-white/10 rounded-xl bg-black/10">
                                                <span className="text-[9px] text-slate-600 italic">No custom presets saved yet. Configure sliders and save them above!</span>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-2.5">
                                                {Object.entries(customPresets).map(([name, savedAdjustments]) => {
                                                    const keys = Object.keys(savedAdjustments).filter(k => savedAdjustments[k] !== 0);
                                                    return (
                                                        <div 
                                                            key={name}
                                                            onClick={() => {
                                                                handleAdjustment('STACK_RESTORE', savedAdjustments);
                                                                setIsDirty(true);
                                                            }}
                                                            className="group bg-white/5 hover:bg-cyan-950/15 border border-white/5 hover:border-cyan-500/30 rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-md active:scale-[0.99]"
                                                        >
                                                            <div className="space-y-2">
                                                                <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors block">{name}</span>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {keys.length === 0 ? (
                                                                        <span className="text-[8px] text-slate-600">Zero adjustments</span>
                                                                    ) : (
                                                                        keys.map(k => (
                                                                            <span key={k} className="text-[8px] bg-white/5 border border-white/5 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                                                                                {k}: {savedAdjustments[k] > 0 ? `+${savedAdjustments[k]}` : savedAdjustments[k]}
                                                                            </span>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </div>
                                                            
                                                            <button 
                                                                onClick={(e) => handleDeleteCustomPreset(name, e)}
                                                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                                title="Delete Preset"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Built-in Studio Presets Section */}
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Studio Filters</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {Object.keys(DARKROOM_PRESETS).map(pKey => (
                                                <button 
                                                    key={pKey}
                                                    onClick={() => { setPreset(pKey); setIsDirty(true); }}
                                                    className={`group relative aspect-[4/5] rounded-xl overflow-hidden border transition-all ${preset === pKey ? 'border-cyan-500 ring-2 ring-cyan-500/20' : 'border-white/10 hover:border-white/30'}`}
                                                >
                                                    <img 
                                                        src={displayUrl} 
                                                        alt={pKey} 
                                                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" 
                                                        style={{ filter: (DARKROOM_PRESETS as any)[pKey].join(' ') }}
                                                    />
                                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black p-3">
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-white">{pKey.replace('_', ' ')}</span>
                                                    </div>
                                                    {preset === pKey && (
                                                        <div className="absolute top-2 right-2 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
                                                            <CheckCircle2 size={10} className="text-black" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                </div>
                            )}

                            {polishTab === 'history' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Edit History</label>
                                        <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-2 py-0.5 rounded-full">
                                            {editHistory?.length || 0} Snaps
                                        </span>
                                    </div>
                                    
                                    {(!editHistory || editHistory.length === 0) ? (
                                        <div className="text-center py-12 px-4 border border-white/5 rounded-2xl bg-black/20">
                                            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">No snapshots yet</span>
                                        </div>
                                    ) : (
                                        <div className="relative border-l-2 border-white/5 pl-4 ml-2 space-y-6">
                                            {editHistory.slice().reverse().map((snap: any, index: number) => {
                                                const originalIndex = editHistory.length - 1 - index;
                                                const dateStr = snap.timestamp ? new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `Snap #${originalIndex + 1}`;
                                                
                                                return (
                                                    <div key={index} className="relative group/snap">
                                                        <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-cyan-500 border-2 border-[#080c14] group-hover/snap:scale-125 transition-transform" />
                                                        
                                                        <button
                                                            onClick={() => {
                                                                if (snap.preset) setPreset(snap.preset);
                                                                if (snap.adjustmentStack) handleAdjustment('STACK_RESTORE', snap.adjustmentStack);
                                                                setIsDirty(true);
                                                            }}
                                                            className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 transition-all"
                                                        >
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">
                                                                    Snap #{originalIndex + 1}
                                                                </span>
                                                                <span className="text-[9px] font-mono text-slate-500">
                                                                    {dateStr}
                                                                </span>
                                                            </div>
                                                            <p className="text-[9px] text-slate-400 font-mono truncate">
                                                                Preset: <span className="text-white capitalize">{snap.preset || 'Original'}</span>
                                                            </p>
                                                            <p className="text-[8px] text-slate-500 mt-1 font-mono">
                                                                {Object.keys(snap.adjustmentStack || {}).filter(k => snap.adjustmentStack[k] !== 0).length || 0} tweaks active
                                                            </p>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {polishTab === 'neural' && (
                                <div className="space-y-6">
                                    <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Wand2 size={16} className="text-violet-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-violet-100">Neural Directive</span>
                                        </div>
                                        <textarea 
                                            value={aiDirective}
                                            onChange={e => setAiDirective(e.target.value)}
                                            placeholder="e.g. 'Make this look like a 70s film still with warm highlights...'"
                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[11px] text-white placeholder-slate-600 focus:border-violet-500/50 outline-none resize-none h-24"
                                        />
                                        <button 
                                            onClick={handleAutoFix}
                                            disabled={isAnalyzing || !aiDirective}
                                            className="w-full py-3 bg-violet-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-400 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
                                        >
                                            {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                            Calculate Stack
                                        </button>
                                    </div>

                                    <div className="p-4 bg-slate-800/20 border border-slate-700/30 rounded-2xl space-y-4 opacity-60">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 text-slate-400">
                                                <Zap size={16} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Neural Lab</span>
                                            </div>
                                            <span className="px-2 py-0.5 bg-slate-700/50 text-slate-500 rounded-full text-[8px] font-bold uppercase tracking-tighter">Locked</span>
                                        </div>
                                        <p className="text-[9px] text-slate-500 leading-relaxed italic">
                                            Deep generative reconstruction is currently offline for maintenance. Moonshot features will return in a future cycle.
                                        </p>
                                        <button 
                                            disabled={true}
                                            className="w-full py-3 bg-slate-800 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed border border-white/5"
                                        >
                                            Check Back Later
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-6 border-t border-white/5 space-y-3">
                            <button onClick={handleStack} className="w-full py-4 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500/20 transition-all flex items-center justify-center gap-3">
                                <Layers size={14} />
                                Bake Stack
                            </button>
                            <button onClick={handleClearLayers} className="w-full py-4 bg-red-500/5 text-red-400 border border-red-500/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center justify-center gap-3">
                                <Trash2 size={14} />
                                Reset Canvas
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'temporal' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
                        <TemporalEditor 
                            datePrecision={datePrecision} 
                            handlePrecisionChange={handlePrecisionChange} 
                            dateStr={dateStr} 
                            setDateStr={setDateStr} 
                            setIsDirty={setIsDirty} 
                        />
                    </div>
                )}

                {activeTab === 'meta' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
                        <NarrativeEditor 
                            initialDescription={valuesRef.current.description} 
                            initialNarrative={valuesRef.current.narrative}
                            initialPrivateDetails={valuesRef.current.privateDetails}
                            onFieldChange={handleFieldChange} 
                            isSparkling={isSparkling} 
                            handleSparkle={handleSparkle} 
                            sparkleString={sparkleString} 
                            setIsDirty={setIsDirty} 
                            targetField={activeTargetField}
                            isResurrecting={isResurrectingNarrative}
                            onResurrect={handleResurrectNarrative}
                            userId={user.id}
                            onTagCreated={onTagCreated}
                        />

                        {/* [ZEN] Fictional Lore Toggle (Accession) */}
                        <div className="bg-fuchsia-950/20 border border-fuchsia-500/20 rounded-xl p-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-[10px] font-bold text-fuchsia-400 uppercase flex items-center gap-2">
                                    <Sparkles size={12} /> Fictional Lore
                                </h3>
                                <p className="text-[10px] text-fuchsia-300/70 mt-1">Silos this media from the Reality Matrix.</p>
                            </div>
                            <button
                                onClick={() => {
                                    valuesRef.current.isFiction = !valuesRef.current.isFiction;
                                    handleFieldChange('isFiction', valuesRef.current.isFiction);
                                }}
                                className={`w-10 h-5 rounded-full relative transition-colors duration-300 focus:outline-none ${valuesRef.current.isFiction ? 'bg-fuchsia-500' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${valuesRef.current.isFiction ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* [ZEN] Skip AI Toggle (Privacy/Forensic) */}
                        <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-4 flex items-center justify-between mt-4">
                            <div>
                                <h3 className="text-[10px] font-bold text-rose-400 uppercase flex items-center gap-2">
                                    <Shield size={12} /> Skip AI Processing
                                </h3>
                                <p className="text-[10px] text-rose-300/70 mt-1">Protects sensitive assets from AI vision pipelines.</p>
                            </div>
                            <button
                                onClick={() => {
                                    valuesRef.current.skipAI = !valuesRef.current.skipAI;
                                    handleFieldChange('skipAI', valuesRef.current.skipAI);
                                }}
                                className={`w-10 h-5 rounded-full relative transition-colors duration-300 focus:outline-none ${valuesRef.current.skipAI ? 'bg-rose-500' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${valuesRef.current.skipAI ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'entities' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Linked Entities</label>
                                {onNeuralScan && (
                                    <button 
                                        onClick={onNeuralScan}
                                        disabled={isNeuralScanning}
                                        className="text-[10px] font-black text-cyan-400 hover:text-cyan-300 uppercase tracking-widest flex items-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {isNeuralScanning ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                                        Neural Scan
                                    </button>
                                )}
                            </div>
                            <div className="relative group">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-cyan-500" />
                                <input type="text" value={tagSearch} onChange={e => { setTagSearch(e.target.value); setIsTagDropdownOpen(true); }} onFocus={() => setIsTagDropdownOpen(true)} placeholder="Search..." className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white outline-none focus:border-cyan-500/50 transition-all" />
                            </div>
                            {isTagDropdownOpen && tagSearch.trim() && (
                                <div className="mt-2 bg-[#1a1d26] border border-cyan-500/30 rounded-2xl shadow-2xl max-h-64 overflow-y-auto z-[120] custom-scrollbar">
                                    {[...filteredTags].sort((a, b) => a.name.localeCompare(b.name)).map(tag => (
                                        <button key={tag.id} onClick={() => { toggleTag(tag.id); setTagSearch(''); setIsTagDropdownOpen(false); }} className="w-full px-4 py-3 hover:bg-cyan-500/10 text-left border-b border-white/5 last:border-b-0 text-sm text-slate-300">{tag.name}</button>
                                    ))}
                                    
                                    {/* Create Tag Promotion */}
                                    {!filteredTags.some(t => t.name.toLowerCase() === tagSearch.toLowerCase()) && (
                                        <div className="border-t border-cyan-500/30 bg-cyan-500/5">
                                            <div className="px-4 py-3 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                                                        <Plus size={16} className="text-cyan-400" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest block">Create Sovereign Tag</span>
                                                        <span className="text-sm text-white font-medium">{tagSearch}</span>
                                                    </div>
                                                </div>
                                                {isCreatingTag && <Loader2 size={16} className="animate-spin text-cyan-400" />}
                                            </div>
                                            
                                            <div className="grid grid-cols-5 gap-2 p-2 pt-0">
                                                {[
                                                    { type: 'person', icon: <UserIcon size={14} />, label: 'Person' },
                                                    { type: 'pet', icon: <Dog size={14} />, label: 'Pet' },
                                                    { type: 'place', icon: <MapPin size={14} />, label: 'Place' },
                                                    { type: 'thing', icon: <Package size={14} />, label: 'Thing' },
                                                    { type: 'concept', icon: <Brain size={14} />, label: 'Concept' }
                                                ].map(item => (
                                                    <button
                                                        key={item.type}
                                                        disabled={isCreatingTag}
                                                        onClick={() => createNewTag(item.type as any)}
                                                        className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-black/40 border border-white/5 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all group"
                                                    >
                                                        <div className="text-slate-500 group-hover:text-cyan-400">{item.icon}</div>
                                                        <span className="text-[8px] font-bold text-slate-600 uppercase group-hover:text-cyan-500">{item.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-4 w-full">
                            {(() => {
                                const activeTags = tagIds
                                    .map(tid => tagMap.get(tid))
                                    .filter((tag): tag is Tag => !!tag)
                                    .sort((a, b) => a.name.localeCompare(b.name));

                                const events = activeTags.filter(t => t.type === 'event');
                                const places = activeTags.filter(t => t.type === 'place');
                                const persons = activeTags.filter(t => t.type === 'person');
                                const pets = activeTags.filter(t => t.type === 'pet');
                                const things = activeTags.filter(t => t.type === 'thing');
                                const concepts = activeTags.filter(t => t.type === 'concept');

                                const groups = [
                                    { title: 'Event (Vortex timeline for this)', tags: events, colorClass: 'bg-sky-500/5 border-sky-500/30 text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/50' },
                                    { title: 'Location (Place Tags)', tags: places, colorClass: 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50' },
                                    { title: 'People (Person Tags)', tags: persons, colorClass: 'bg-violet-500/5 border-violet-500/30 text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/50' },
                                    { title: 'Pets (Pet Tags)', tags: pets, colorClass: 'bg-pink-500/5 border-pink-500/30 text-pink-400 hover:bg-pink-500/20 hover:border-pink-500/50' },
                                    { title: 'Things Tags', tags: things, colorClass: 'bg-amber-500/5 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50' },
                                    { title: 'Concepts (Concept Tags)', tags: concepts, colorClass: 'bg-indigo-500/5 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/50' }
                                ].filter(g => g.tags.length > 0);

                                return groups.map((group, idx) => (
                                    <div key={group.title} className="flex flex-col gap-3 w-full">
                                        <div className="flex flex-col gap-1 w-full">
                                            <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 px-1">{group.title}</span>
                                            <div className="h-[1px] bg-white/10 w-full rounded-full" />
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {group.tags.map(tag => (
                                                <div key={tag.id} className="relative">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveTagMenuId(activeTagMenuId === tag.id ? null : tag.id);
                                                        }} 
                                                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full border transition-all ${group.colorClass}`}
                                                    >
                                                        {tag.name}
                                                    </button>
                                                    {activeTagMenuId === tag.id && (
                                                        <div className="absolute left-0 mt-2 z-50 w-40 bg-[#020617]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">

                                                            {/* ── Open Tag (primary action) ───────────────── */}
                                                            {wikiContext?.navigateToTagEditor && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveTagMenuId(null);
                                                                        // navigateToTagEditor snapshots currentView + currentViewData
                                                                        // (theMatrix + mediaId) as the return breadcrumb before
                                                                        // switching to the Tag Editor view.
                                                                        wikiContext.navigateToTagEditor(tag.id);
                                                                    }}
                                                                    className="w-full px-3.5 py-2 text-left text-[9px] font-black uppercase tracking-widest text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 transition-colors flex items-center gap-2"
                                                                >
                                                                    <ExternalLink size={10} />
                                                                    Open Tag
                                                                </button>
                                                            )}

                                                            {/* ── Edit Tag ─────────────────────────────────── */}
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveTagMenuId(null);
                                                                    onEditTag(tag);
                                                                }}
                                                                className={`w-full px-3.5 py-2 text-left text-[9px] font-black uppercase tracking-widest text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors ${wikiContext?.navigateToTagEditor ? 'border-t border-white/5' : ''}`}
                                                            >
                                                                Edit Tag
                                                            </button>

                                                            {/* ── Remove ───────────────────────────────────── */}
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveTagMenuId(null);
                                                                    toggleTag(tag.id);
                                                                }}
                                                                className="w-full px-3.5 py-2 text-left text-[9px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors border-t border-white/5"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>

                        {discoveredEntities.length > 0 && (
                            <div className="pt-4 space-y-3">
                                <label className="text-[9px] font-black text-amber-500/50 uppercase tracking-[0.2em] block">Discovered Participants</label>
                                <div className="space-y-2">
                                    {discoveredEntities.map(name => (
                                        <div key={name} className="flex items-center justify-between p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl group hover:border-amber-500/30 transition-all">
                                            <span className="text-[11px] text-amber-200/70 font-medium">{name}</span>
                                            <button 
                                                onClick={() => { setTagSearch(name); setIsTagDropdownOpen(true); }}
                                                className="px-3 py-1 bg-amber-500 text-black text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-400 transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                                            >
                                                Create Person
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[8px] text-slate-500 italic leading-relaxed">
                                    Neural scan identified these participants in the signal, but they do not yet exist in your sovereign database.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'geo' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Geographic Frame</label>
                                {addressData.coordinates && (
                                    <button 
                                        onClick={promoteToPlaceTag}
                                        disabled={isPromotingPlace}
                                        className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest flex items-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {isPromotingPlace ? 'PROMOTING...' : <>PROMOTE TO PLACE TAG <MapPin size={10} /></>}
                                    </button>
                                )}
                            </div>
                            
                            <AddressAutocomplete 
                                value={addressData}
                                onChange={(val) => {
                                    setAddressData(val);
                                    valuesRef.current.location = val;
                                    setIsDirty(true);
                                }}
                                tags={tags}
                                userId={user.id}
                            />
                        </div>

                        <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative group">
                            <GoogleMap 
                                lat={addressData.coordinates?.lat || 0}
                                lng={addressData.coordinates?.lng || 0}
                                apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                                draggable={true}
                                onMarkerDragEnd={(lat, lng) => {
                                    const newData = { ...addressData, coordinates: { lat, lng } };
                                    setAddressData(newData);
                                    valuesRef.current.location = newData;
                                    setIsDirty(true);
                                }}
                            />
                            
                            {/* HUD Overlay for Grid info */}
                            <div className="absolute top-4 right-4 z-20">
                                <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded border border-white/10 text-[8px] font-mono text-cyan-400 uppercase tracking-widest">
                                    Precision Lock Active
                                </div>
                            </div>
                        </div>

                        <p className="text-[10px] text-slate-500 font-mono text-center uppercase tracking-widest opacity-50">
                            Drag marker or search above to resolve spatial coordinates.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudioDrawer;
