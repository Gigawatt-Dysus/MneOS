import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, X, Loader2, Maximize, Flame, Image as ImageIcon, Download, Plus, RefreshCcw, Terminal, Edit2, Check, ChevronDown, ChevronRight, Users, HeartPulse } from 'lucide-react';
import { WikiTagEditor } from '../shared/WikiTagEditor';
import { aiStateBridge } from '../../utils/aiStateBridge';
import { httpsCallable } from '../../services/apiClient';
import type { Tag } from '../../types';
import { GlassAvatar } from '../GlassAvatar';
import emotionalDB from '../../data/emotionalDB.json';
import { validateEmotions, EmotionVector } from '../../services/emotionValidator';
import realismModulesDB from '../../data/realismModules.json';
import roleplayOverlaysDB from '../../data/roleplayOverlays.json';
import fetishLibraryDB from '../../data/fetish_scene_library.json';

interface ReferenceAsset {
    id: string;
    label: string;
    dataUrl: string;
    caption?: string;
    isCaptioning?: boolean;
}

interface EratosPalaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

export const EratosPalaceModal: React.FC<EratosPalaceModalProps> = ({
    isOpen,
    onClose,
    userId
}) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [outputUrl, setOutputUrl] = useState<string | null>(null);
    const [aspectRatio, setAspectRatio] = useState<'portrait_4_3' | 'landscape_16_9' | 'square'>('portrait_4_3');
    const [selectedModel, setSelectedModel] = useState('fal-ai/flux/dev');
    const [cameraStyle, setCameraStyle] = useState('photorealistic');
    const [cameraLens, setCameraLens] = useState('none');
    const [cameraLighting, setCameraLighting] = useState('none');
    const [cameraFilter, setCameraFilter] = useState('none');
    const [sourceImage, setSourceImage] = useState<string | null>(null);
    const [strength, setStrength] = useState(0.8);
    const [assets, setAssets] = useState<ReferenceAsset[]>([]);
    const [showXRay, setShowXRay] = useState(false);
    const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
    const [tempCaption, setTempCaption] = useState('');
    const [selectedEmotions, setSelectedEmotions] = useState<{ major: string, minor: string }[]>([]);
    const [activeEmotionMajor, setActiveEmotionMajor] = useState<string>('none');
    const [activeEmotionMinor, setActiveEmotionMinor] = useState<string>('none');
    const [emotionConflicts, setEmotionConflicts] = useState<string[]>([]);
    const [poseReferenceAssetId, setPoseReferenceAssetId] = useState<string | null>(null);
    const [isVanillaMode, setIsVanillaMode] = useState(true);

    interface ActiveRealismModule {
        name: string;
        volume: 'subtle' | 'moderate' | 'heavy';
    }
    const [activeRealismModules, setActiveRealismModules] = useState<ActiveRealismModule[]>([]);
    const [activeRoleplayOverlays, setActiveRoleplayOverlays] = useState<string[]>([]);
    const [activeFetishes, setActiveFetishes] = useState<string[]>([]);

    const allFetishes = useMemo(() => {
        let list: {category: string, subcategory: string, name: string, description: string}[] = [];
        fetishLibraryDB.categories.forEach(c => {
            c.subcategories.forEach(s => {
                s.entries.forEach(e => {
                    list.push({
                        category: c.name,
                        subcategory: s.name,
                        name: e.name,
                        description: e.visual_description
                    });
                });
            });
        });
        return list;
    }, []);

    // Unique Major States, filtered by Vanilla Mode if active
    const majorStates = useMemo(() => {
        const filtered = emotionalDB.filter(e => {
            // Support backward compatibility if Content_Level isn't fully migrated yet
            if (!isVanillaMode) return true;
            const contentLevel = (e as any).Content_Level || 'Vanilla';
            return contentLevel === 'Vanilla' || contentLevel === 'Sensual';
        });
        const states = new Set(filtered.map(e => e['Major Emotional State']));
        return Array.from(states).sort();
    }, [isVanillaMode]);

    const minorStates = useMemo(() => {
        if (activeEmotionMajor === 'none') return [];
        const filtered = emotionalDB.filter(e => e['Major Emotional State'] === activeEmotionMajor && (!isVanillaMode || ((e as any).Content_Level || 'Vanilla') === 'Vanilla' || ((e as any).Content_Level || 'Sensual') === 'Sensual'));
        return filtered.map(e => e['Minor Valence']).sort();
    }, [activeEmotionMajor, isVanillaMode]);
    
    // Effect to reset minor state when major changes
    useEffect(() => {
        if (activeEmotionMajor === 'none') {
            setActiveEmotionMinor('none');
        } else if (minorStates.length > 0 && !minorStates.includes(activeEmotionMinor)) {
            setActiveEmotionMinor(minorStates[0]);
        }
    }, [activeEmotionMajor, minorStates]);

    // Validation effect
    useEffect(() => {
        const fullEmotions = selectedEmotions.map(se => 
            emotionalDB.find(e => e['Major Emotional State'] === se.major && e['Minor Valence'] === se.minor) as EmotionVector
        ).filter(Boolean);
        
        const result = validateEmotions(fullEmotions);
        setEmotionConflicts(result.conflicts);
    }, [selectedEmotions]);

    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        structuralBase: false,
        callSheet: true,
        referenceAssets: true,
        engineSettings: false,
        cameraBay: true,
        emotionalMatrix: true,
        motionCapture: false,
        sovereignModifiers: false
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Global tags for the Call Sheet
    const [globalTags, setGlobalTags] = useState<Tag[]>([]);
    const [wardrobeSubjectId, setWardrobeSubjectId] = useState<string | null>(null);
    const [activeReferences, setActiveReferences] = useState<Record<string, string[]>>({});

    const toggleWardrobeReference = (tagId: string, url: string) => {
        setActiveReferences(prev => {
            const current = prev[tagId] || [];
            if (current.includes(url)) {
                return { ...prev, [tagId]: current.filter(u => u !== url) };
            } else {
                return { ...prev, [tagId]: [...current, url] };
            }
        });
    };
    useEffect(() => {
        if (isOpen && userId && userId !== 'dev-user-root') {
            const sovereignQuery = httpsCallable(null, 'sovereignDbQuery');
            sovereignQuery({ collectionName: 'tags', userId }).then((res: any) => {
                if (res.data) setGlobalTags(res.data);
            }).catch(console.error);
        }
    }, [isOpen, userId]);

    // Parse prompt for Call Sheet avatars
    const sceneTags = useMemo(() => {
        const matches = Array.from(prompt.matchAll(/\[([^\]]+)\]\(tag:\/\/([a-zA-Z0-9_:-]+)\)/g));
        const uniqueTags = new Map<string, any>();
        
        matches.forEach(match => {
            const displayName = match[1];
            const tagRef = match[2];
            const id = tagRef.includes(':') ? tagRef.split(':')[1] : tagRef;
            const type = tagRef.includes(':') ? tagRef.split(':')[0] : 'unknown';
            
            if (type !== 'asset' && !uniqueTags.has(id)) {
                const globalTag = globalTags.find(t => t.id === id);
                uniqueTags.set(id, {
                    id,
                    displayName,
                    type,
                    tagRef,
                    avatarUrl: globalTag?.mediaGallery?.[0]?.url || null
                });
            }
        });
        
        return Array.from(uniqueTags.values());
    }, [prompt, globalTags]);

    const toggleSection = (section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const dataUrl = reader.result as string;
            const newId = `asset-${Date.now()}`;
            const newLabel = `Image ${assets.length + 1}`;
            
            const newAsset: ReferenceAsset = {
                id: newId,
                label: newLabel,
                dataUrl,
                isCaptioning: true
            };
            
            setAssets(prev => [...prev, newAsset]);
            if (fileInputRef.current) fileInputRef.current.value = '';
            
            // Background captioning
            try {
                const { default: GrokVisionService } = await import('../../services/ai/grokVision');
                const result = await GrokVisionService.generateNarrative(dataUrl);
                if (result.success && result.narrative) {
                    setAssets(prev => prev.map(a => a.id === newId ? { ...a, caption: result.narrative, isCaptioning: false } : a));
                } else {
                    setAssets(prev => prev.map(a => a.id === newId ? { ...a, isCaptioning: false, caption: 'Visual reference.' } : a));
                }
            } catch (err) {
                 setAssets(prev => prev.map(a => a.id === newId ? { ...a, isCaptioning: false, caption: 'Visual reference.' } : a));
            }
        };
        reader.readAsDataURL(file);
    };

    const getCompiledPrompt = () => {
        let compiled = prompt;
        const assetRegex = /\[([^\]]+)\]\(tag:\/\/asset:([a-zA-Z0-9_-]+)\)/g;
        compiled = compiled.replace(assetRegex, (match, displayName, assetId) => {
            const asset = assets.find(a => a.id === assetId);
            if (asset && asset.caption) {
                return `[Visual Reference: ${asset.caption}]`;
            }
            return displayName;
        });
        // Strip remaining tags
        compiled = compiled.replace(/\[([^\]]+)\]\(tag:\/\/[^)]+\)/g, '$1');

        // Append Camera Bay modifiers
        let modifiers = [];
        
        if (cameraStyle === 'photorealistic') {
            modifiers.push("make this person look real, ultra-realistic, highly detailed, photorealistic, RAW photo, sharp focus");
        } else if (cameraStyle === 'anime') {
            modifiers.push("Anime style, Studio Ghibli, 2D animation, cel shaded, vibrant colors");
        } else if (cameraStyle === 'vintage') {
            modifiers.push("vintage 35mm film photograph, film grain, nostalgic, slight vignette");
        } else if (cameraStyle === 'bw') {
            modifiers.push("classic black and white photography, monochrome, high contrast grayscale, Ansel Adams style");
        } else if (cameraStyle === 'sepia') {
            modifiers.push("vintage sepia tone photograph, warm monochrome, aged antique photo, historical");
        } else if (cameraStyle === 'cyberpunk') {
            modifiers.push("cyberpunk style, grim dark future, high tech low life, rain-slicked streets");
        } else if (cameraStyle === 'chroma') {
            modifiers.push("shot in a studio against a bright flat chroma key neon green screen background, perfect for compositing, flat even background lighting");
        }
        
        if (cameraLens === 'macro') {
            modifiers.push("macro photography, extreme close-up, massive depth of field blur, gorgeous colorful bokeh background");
        } else if (cameraLens === 'portrait') {
            modifiers.push("85mm portrait lens, f/1.4, shallow depth of field, subject in sharp focus, blurred background bokeh");
        } else if (cameraLens === 'wide') {
            modifiers.push("14mm wide angle lens, deep focus, expansive sweeping view");
        }

        if (cameraLighting === 'chiaroscuro') {
            modifiers.push("chiaroscuro lighting, dramatic deep shadows, single light source, cinematic contrast");
        } else if (cameraLighting === 'golden_hour') {
            modifiers.push("golden hour lighting, warm sunlight, long shadows, lens flare, ethereal glow");
        } else if (cameraLighting === 'neon') {
            modifiers.push("neon lighting, volumetric fog, magenta and cyan reflections, glowing lights");
        } else if (cameraLighting === 'studio') {
            modifiers.push("professional studio lighting, softbox, rim light, perfect illumination");
        } else if (cameraLighting === 'finnerman') {
            modifiers.push("1960s theatrical television lighting, highly saturated colored gel lights painted on background walls, vibrant contrasting colors, dramatic retro sci-fi studio lighting");
        } else if (cameraLighting === 'hitchcock') {
            modifiers.push("noir suspense lighting, harsh directional light, long dramatic shadows, silhouetted figures, psychological thriller atmosphere, mysterious high contrast");
        }

        if (cameraFilter === 'promist') {
            modifiers.push("1/4 Black Pro-Mist filter, cinematic diffusion, blooming highlights, halation, soft glowing edges");
        } else if (cameraFilter === 'diopter') {
            modifiers.push("split diopter shot, extreme deep focus, both foreground subject and distant background in perfect sharp focus simultaneously");
        } else if (cameraFilter === 'polarizer') {
            modifiers.push("CPL polarizing filter, deep blue sky, glare reduction, saturated natural colors, no reflections");
        } else if (cameraFilter === 'star') {
            modifiers.push("4-point star filter, starburst effect on specular highlights, glittering lights");
        } else if (cameraFilter === 'aerochrome') {
            modifiers.push("Kodak Aerochrome infrared film style, crimson foliage, surreal color shift");
        } else if (cameraFilter === 'vaseline') {
            modifiers.push("classic 1960s glamour shot, soft focus, vaseline on the lens, dreamy hazy glow, romantic diffusion");
        }

        if (selectedEmotions.length > 0) {
            const vectors = selectedEmotions.map(se => {
                const emotionEntry = emotionalDB.find(e => e['Major Emotional State'] === se.major && e['Minor Valence'] === se.minor) as any;
                if (!emotionEntry) return '';
                let vectorStr = `Character Expression [L-Vector: ${emotionEntry.Description}]`;
                if (emotionEntry.FACS && emotionEntry.FACS.length > 0) {
                    vectorStr += ` [FACS: ${emotionEntry.FACS.join(', ')}]`;
                }
                return vectorStr;
            }).filter(Boolean);
            if (vectors.length > 0) {
                compiled = `${vectors.join(", ")}, ${compiled}`;
            }
        }

        if (modifiers.length > 0) {
            compiled = `${modifiers.join(", ")}, ${compiled}`;
        }
        
        if (!isVanillaMode) {
            if (activeRealismModules.length > 0) {
                const realismStr = activeRealismModules.map(rm => {
                    const mod = realismModulesDB.realism_modules.find(m => m.module_name === rm.name);
                    if (mod) {
                        let text = `[Realism Module: ${mod.module_name.replace(/_/g, ' ').toUpperCase()} - Anatomy: ${mod.anatomy_block}`;
                        if (mod.wetness_block) text += `, Wetness: ${mod.wetness_block}`;
                        if (mod.ejaculation_block) text += `, Ejaculation: ${mod.ejaculation_block}`;
                        if (mod.nipple_block) text += `, Nipple state: ${mod.nipple_block}`;
                        text += `, Output Volume: ${mod.volume_levels[rm.volume as keyof typeof mod.volume_levels]}]`;
                        return text;
                    }
                    return '';
                }).filter(Boolean).join(", ");
                
                if (realismStr) {
                    compiled = `${realismStr}, ${compiled}`;
                    if (!compiled.includes('<lora:kontext-make-person-real:1>')) {
                        compiled = `<lora:kontext-make-person-real:1>, ${compiled}`;
                    }
                }
            }

            if (activeRoleplayOverlays.length > 0) {
                const rpStr = activeRoleplayOverlays.map(name => {
                    const overlay = roleplayOverlaysDB.roleplay_overlays.find(o => o.name === name);
                    return overlay ? `[Roleplay Overlay: ${overlay.prompt_seed}]` : '';
                }).filter(Boolean).join(", ");
                if (rpStr) {
                    compiled = `${rpStr}, ${compiled}`;
                }
            }

            if (activeFetishes.length > 0) {
                const fetishStr = activeFetishes.map(name => {
                    const fetish = allFetishes.find(f => f.name === name);
                    return fetish ? `[Fetish/Kink Setup: ${fetish.description}]` : '';
                }).filter(Boolean).join(", ");
                if (fetishStr) {
                    compiled = `${fetishStr}, ${compiled}`;
                }
            }
        }
        
        return compiled;
    };

    const handleDream = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setOutputUrl(null);
        aiStateBridge.setThinking(true, `Erato is weaving the tapestry in ${aspectRatio}...`);

        try {
            const finalPrompt = getCompiledPrompt();

            const payload: any = {
                prompt: finalPrompt,
                aspectRatio: aspectRatio,
                model: selectedModel
            };
            
            if (sourceImage) {
                payload.imageUrl = sourceImage;
                payload.strength = strength;
            }

            if (poseReferenceAssetId) {
                const poseAsset = assets.find(a => a.id === poseReferenceAssetId);
                if (poseAsset) {
                    payload.poseReferenceUrl = poseAsset.dataUrl;
                }
            }

            const response = await fetch('/api/media/eratosPalace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "The Muse refused to wake.");
            }

            setOutputUrl(data.imageUrl);

        } catch (error: any) {
            console.error("[Erato's Palace] Failed:", error);
            alert("Erato Error: " + error.message);
        } finally {
            setIsGenerating(false);
            aiStateBridge.setThinking(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black animate-in fade-in">
            <div className="bg-[#0f172a] w-screen h-screen flex flex-col relative overflow-hidden">
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-rose-900/30 bg-gradient-to-r from-slate-900 to-rose-950 shrink-0">
                    <div className="flex items-center gap-3">
                        <Flame className="text-rose-500 animate-pulse" size={24} />
                        <h2 className="text-xl font-black tracking-widest uppercase bg-gradient-to-r from-rose-400 to-rose-600 bg-clip-text text-transparent drop-shadow-sm">
                            Erato's Palace
                        </h2>
                        <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full ml-2 border ${isVanillaMode ? 'text-blue-500/50 border-blue-900/50' : 'text-rose-500/50 border-rose-900/50'}`}>
                            {isVanillaMode ? 'Safe Context' : 'Unrestricted Engine'}
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsVanillaMode(!isVanillaMode)}
                            title={isVanillaMode ? 'Switch to Sovereign (Unrestricted) Mode' : 'Switch to Vanilla (Safe) Mode'}
                            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded border transition-colors ${
                                isVanillaMode 
                                    ? 'bg-blue-900/30 text-blue-400 border-blue-500/50 hover:bg-blue-800/50' 
                                    : 'bg-rose-900/30 text-rose-400 border-rose-500/50 hover:bg-rose-800/50 shadow-[0_0_10px_rgba(225,29,72,0.3)]'
                            }`}
                        >
                            {isVanillaMode ? 'Vanilla Mode: ON' : 'Sovereign Mode: ACTIVE'}
                        </button>
                        <button onClick={onClose} disabled={isGenerating} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Input & Controls */}
                    <div className="w-1/3 border-r border-rose-900/30 bg-slate-900/80 flex flex-col shrink-0">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col">
                            <div className="flex justify-between items-center mb-4 shrink-0">
                                <h3 className="text-rose-400 text-xs font-bold uppercase tracking-widest">The Incantation</h3>
                                <button 
                                    onClick={() => setShowXRay(!showXRay)}
                                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border flex items-center gap-1 transition-colors ${showXRay ? 'bg-cyan-900/50 text-cyan-400 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-cyan-400 hover:border-cyan-400'}`}
                                    title="Toggle Prompt Compiler X-Ray"
                                >
                                    <Terminal size={12} /> X-Ray
                                </button>
                            </div>
                            
                            {/* Prompt Box */}
                            <div className="min-h-[200px] shrink-0 bg-black rounded-lg border border-slate-700 focus-within:border-rose-500 overflow-hidden relative mb-4">
                                {showXRay ? (
                                    <textarea 
                                        readOnly
                                        value={getCompiledPrompt()}
                                        className="w-full h-full min-h-[200px] bg-slate-950 text-cyan-400 font-mono text-xs p-4 resize-none custom-scrollbar focus:outline-none"
                                    />
                                ) : (
                                    <WikiTagEditor
                                        value={prompt}
                                        onChange={setPrompt}
                                        userId={userId}
                                        placeholder="Describe the scene with absolute freedom..."
                                        customSuggestions={assets.map(a => ({ id: a.id, name: a.label, type: 'asset', originalAsset: a }))}
                                        className="bg-transparent border-none text-sm p-4 w-full h-full min-h-[200px] resize-none custom-scrollbar focus:ring-0 text-slate-200"
                                    />
                                )}
                            </div>

                        {/* The Call Sheet (Scene Elements) */}
                        {sceneTags.length > 0 && (
                            <div className="mb-4 bg-slate-900/50 rounded-lg border border-slate-700 shrink-0 overflow-hidden">
                                <div 
                                    className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded-t-lg"
                                    tabIndex={0}
                                    onClick={() => toggleSection('callSheet')}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleSection('callSheet');
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-2 text-slate-500">
                                        {openSections.callSheet !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        <Users size={14} className="text-cyan-500/70" />
                                        <label className="text-xs font-bold uppercase tracking-widest cursor-pointer">The Call Sheet</label>
                                    </div>
                                    <span className="text-[10px] text-cyan-500 font-bold bg-cyan-900/30 px-2 py-0.5 rounded-full">
                                        {sceneTags.length} Detected
                                    </span>
                                </div>
                                
                                {openSections.callSheet !== false && (
                                    <div className="p-3 pt-0 border-t border-slate-700/50 mt-3 flex flex-wrap gap-4">
                                        {sceneTags.map(st => (
                                            <div key={st.id} className="flex flex-col items-center gap-2 w-16">
                                                <GlassAvatar 
                                                    imageUrl={st.avatarUrl} 
                                                    fallbackChar={st.displayName}
                                                    size="w-12 h-12"
                                                    onClick={() => setWardrobeSubjectId(wardrobeSubjectId === st.id ? null : st.id)}
                                                    className={`border-2 shadow-lg transition-transform hover:scale-105 cursor-pointer ${
                                                        wardrobeSubjectId === st.id ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : ''
                                                    } ${
                                                        st.type === 'person' ? 'border-violet-500/50 shadow-[0_0_10px_rgba(139,92,246,0.2)]' :
                                                        st.type === 'pet' ? 'border-pink-500/50 shadow-[0_0_10px_rgba(236,72,153,0.2)]' :
                                                        st.type === 'place' ? 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]' :
                                                        st.type === 'thing' ? 'border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' :
                                                        st.type === 'event' ? 'border-sky-500/50 shadow-[0_0_10px_rgba(14,165,233,0.2)]' :
                                                        st.type === 'concept' ? 'border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.2)]' :
                                                        'border-slate-500/50'
                                                    }`}
                                                />
                                                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wide text-center w-full truncate" title={st.displayName}>
                                                    {st.displayName}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {wardrobeSubjectId && (
                                    <div className="p-3 border-t border-slate-700/50 bg-slate-950/50">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                                <ImageIcon size={12} className="text-cyan-500" />
                                                Wardrobe & Structural Physics Matrix
                                            </span>
                                            <button 
                                                onClick={() => setWardrobeSubjectId(null)}
                                                className="text-slate-500 hover:text-slate-300"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        {(() => {
                                            const activeTag = globalTags.find(t => t.id === wardrobeSubjectId);
                                            const gallery = activeTag?.mediaGallery || [];
                                            const selectedUrls = activeReferences[wardrobeSubjectId] || [];
                                            
                                            if (gallery.length === 0) {
                                                return <div className="text-[10px] text-slate-500 italic py-2 text-center">No structural reference data available in ledger for this asset.</div>;
                                            }
                                            
                                            return (
                                                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                                    {gallery.map((media, idx) => {
                                                        const isSelected = selectedUrls.includes(media.url);
                                                        return (
                                                            <div 
                                                                key={idx}
                                                                onClick={() => toggleWardrobeReference(wardrobeSubjectId, media.url)}
                                                                className={`relative w-16 h-16 shrink-0 rounded-md overflow-hidden cursor-pointer border-2 transition-all ${
                                                                    isSelected ? 'border-cyan-500 scale-100 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'border-slate-700 hover:border-slate-500 scale-95 opacity-50 hover:opacity-100'
                                                                }`}
                                                            >
                                                                <img src={media.url} className="w-full h-full object-cover" />
                                                                {isSelected && (
                                                                    <div className="absolute top-1 right-1 bg-cyan-500 text-white rounded-full p-0.5 shadow-md">
                                                                        <Check size={10} strokeWidth={4} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                        <div className="text-[9px] text-slate-400 mt-2 text-center font-mono uppercase tracking-widest">
                                            {(activeReferences[wardrobeSubjectId]?.length || 0)} L-Vectors Active
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Img2Img Control */}
                        <div className="mb-4 bg-slate-800/50 rounded-lg border border-slate-700 shrink-0 overflow-hidden">
                            <div 
                                className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded-t-lg"
                                tabIndex={0}
                                onClick={() => toggleSection('structuralBase')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleSection('structuralBase');
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2 text-slate-500">
                                    {openSections.structuralBase ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <label className="text-xs font-bold uppercase tracking-widest cursor-pointer">Structural Base</label>
                                </div>
                                {sourceImage && (
                                    <button onClick={(e) => { e.stopPropagation(); setSourceImage(null); }} className="text-[10px] text-rose-400 hover:text-rose-300 uppercase font-bold tracking-widest px-2 py-1 bg-rose-900/30 rounded">
                                        Clear Base
                                    </button>
                                )}
                            </div>
                            
                            {openSections.structuralBase && (
                                <div className="p-3 pt-0 border-t border-slate-700/50">
                                    {!sourceImage ? (
                                        <div className="text-[10px] text-slate-400 italic text-center py-2 px-4 leading-tight">
                                            To generate over an existing image, upload it below and click the image icon to set it as the structural foundation.
                                        </div>
                                    ) : (
                                        <div className="flex gap-3 items-center">
                                            <img src={sourceImage} alt="Reference" className="w-16 h-16 object-cover rounded-md border border-slate-600" />
                                            <div className="flex-1">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                            <span>Transformation Strength</span>
                                            <span>{Math.round(strength * 100)}%</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" max="1" step="0.05"
                                            value={strength}
                                            onChange={e => setStrength(parseFloat(e.target.value))}
                                            className="w-full accent-cyan-500"
                                        />
                                                <p className="text-[9px] text-slate-500 mt-1 leading-tight">Higher = more changes. Lower = closer to original.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Reference Assets Tray */}
                        <div className="mb-4 bg-black rounded-lg border border-slate-700 relative overflow-hidden shrink-0">
                            <div 
                                className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-900 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded-t-lg"
                                tabIndex={0}
                                onClick={() => toggleSection('referenceAssets')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleSection('referenceAssets');
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2 text-slate-500">
                                    {openSections.referenceAssets ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <label className="text-xs font-bold uppercase tracking-widest cursor-pointer">Reference Assets</label>
                                </div>
                                <span className="text-[9px] text-slate-400">Use @ in prompt</span>
                            </div>

                            {openSections.referenceAssets && (
                                <div className="p-3 pt-0 border-t border-slate-700/50">
                                    {editingAssetId && (
                                 <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm z-50 p-3 flex flex-col animate-in fade-in">
                                     <div className="flex justify-between items-center mb-2 shrink-0">
                                         <div className="flex items-center gap-2">
                                             <Edit2 size={12} className="text-cyan-400" />
                                             <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">CtxEd: Tuning Vision</label>
                                         </div>
                                         <div className="flex gap-2">
                                             <button onClick={() => setEditingAssetId(null)} className="text-[10px] bg-slate-700 text-white px-2 py-0.5 rounded font-bold">
                                                 Cancel
                                             </button>
                                             <button onClick={() => {
                                                 setAssets(prev => prev.map(a => a.id === editingAssetId ? { ...a, caption: tempCaption } : a));
                                                 setEditingAssetId(null);
                                             }} className="text-[10px] bg-cyan-600 hover:bg-cyan-500 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1 transition-colors">
                                                 <Check size={10} /> Save
                                             </button>
                                         </div>
                                     </div>
                                     <textarea 
                                         value={tempCaption}
                                         onChange={(e) => setTempCaption(e.target.value)}
                                         className="flex-1 bg-black border border-slate-700 rounded text-xs p-2 text-slate-300 resize-none focus:outline-none focus:border-cyan-500 custom-scrollbar"
                                         placeholder="Enter visual description..."
                                     />
                                 </div>
                             )}

                             <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                                 {assets.map(asset => (
                                     <div key={asset.id} className="relative w-16 h-16 shrink-0 rounded-md border border-slate-600 overflow-hidden group">
                                         <img src={asset.dataUrl} className="w-full h-full object-cover" />
                                         {asset.isCaptioning && (
                                             <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                                 <Loader2 size={16} className="animate-spin text-cyan-400" />
                                             </div>
                                         )}
                                         
                                         <div className="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                             <button 
                                                 type="button"
                                                 title="Use as Structural Base"
                                                 onClick={(e) => {
                                                     e.preventDefault();
                                                     e.stopPropagation();
                                                     setSourceImage(asset.dataUrl);
                                                 }} 
                                                 className="bg-cyan-500 text-white rounded-sm p-0.5 hover:bg-cyan-400"
                                             >
                                                 <ImageIcon size={10} />
                                             </button>

                                             <button 
                                                 type="button"
                                                 title="Use as Pose Reference (Mocap)"
                                                 onClick={(e) => {
                                                     e.preventDefault();
                                                     e.stopPropagation();
                                                     setPoseReferenceAssetId(asset.id);
                                                     if (!openSections.motionCapture) toggleSection('motionCapture');
                                                 }} 
                                                 className="bg-emerald-500 text-white rounded-sm p-0.5 hover:bg-emerald-400"
                                             >
                                                 <Users size={10} />
                                             </button>

                                             <button 
                                                 type="button"
                                                 title="Edit Grok Vision Caption"
                                                 onClick={(e) => {
                                                     e.preventDefault();
                                                     e.stopPropagation();
                                                     setTempCaption(asset.caption || '');
                                                     setEditingAssetId(asset.id);
                                                 }} 
                                                 className="bg-blue-600 text-white rounded-sm p-0.5 hover:bg-blue-500"
                                             >
                                                 <Edit2 size={10} />
                                             </button>
                                         </div>
                                         
                                         <button 
                                             type="button"
                                             onClick={(e) => {
                                                 e.preventDefault();
                                                 e.stopPropagation();
                                                 setAssets(prev => prev.filter(a => a.id !== asset.id));
                                                 if (sourceImage === asset.dataUrl) setSourceImage(null);
                                                 if (poseReferenceAssetId === asset.id) setPoseReferenceAssetId(null);
                                             }} 
                                             className="absolute top-1 right-1 bg-rose-500 text-white rounded-sm p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                         >
                                             <X size={10} />
                                         </button>
                                         
                                         <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] text-center text-white font-bold truncate px-1 py-0.5 pointer-events-none z-10">
                                            {asset.label}
                                         </div>
                                     </div>
                                 ))}
                                 <button 
                                     onClick={() => fileInputRef.current?.click()}
                                     className="w-16 h-16 shrink-0 border border-dashed border-slate-600 hover:border-cyan-500 rounded-md flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-cyan-400 transition-colors"
                                 >
                                     <Plus size={16} />
                                     <span className="text-[8px] uppercase tracking-widest font-bold">Upload</span>
                                 </button>
                             </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleImageUpload} 
                            />
                            </div>
                            )}
                        </div>

                        {/* Emotional Matrix */}
                        <div className="mb-4 bg-slate-800/50 rounded-lg border border-slate-700 shrink-0 overflow-hidden">
                            <div 
                                className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded-t-lg"
                                tabIndex={0}
                                onClick={() => toggleSection('emotionalMatrix')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleSection('emotionalMatrix');
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2 text-slate-500">
                                    {openSections.emotionalMatrix ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <HeartPulse size={14} className="text-rose-500/70" />
                                    <label className="text-xs font-bold uppercase tracking-widest cursor-pointer">Emotional Matrix</label>
                                </div>
                            </div>
                            
                            {openSections.emotionalMatrix && (
                                <div className="p-3 pt-0 border-t border-slate-700/50 mt-3 space-y-3">
                                    <div className="flex gap-3 items-end">
                                        <div className="flex-1">
                                            <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Major State</label>
                                            <select 
                                                value={activeEmotionMajor}
                                                onChange={(e) => setActiveEmotionMajor(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-600 rounded text-xs p-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
                                            >
                                                <option value="none">None (Neutral)</option>
                                                {majorStates.map(state => (
                                                    <option key={state} value={state}>{state}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        <div className="flex-1">
                                            <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Minor Valence</label>
                                            <select 
                                                value={activeEmotionMinor}
                                                onChange={(e) => setActiveEmotionMinor(e.target.value)}
                                                disabled={activeEmotionMajor === 'none'}
                                                className="w-full bg-slate-900 border border-slate-600 rounded text-xs p-1.5 text-slate-300 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                                            >
                                                <option value="none">Select Valence...</option>
                                                {minorStates.map(state => (
                                                    <option key={state} value={state}>{state}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <button 
                                            onClick={() => {
                                                if (activeEmotionMajor !== 'none' && activeEmotionMinor !== 'none') {
                                                    // Don't add duplicates
                                                    if (!selectedEmotions.some(e => e.major === activeEmotionMajor && e.minor === activeEmotionMinor)) {
                                                        setSelectedEmotions(prev => [...prev, { major: activeEmotionMajor, minor: activeEmotionMinor }]);
                                                    }
                                                    setActiveEmotionMajor('none');
                                                }
                                            }}
                                            disabled={activeEmotionMajor === 'none' || activeEmotionMinor === 'none'}
                                            className="bg-cyan-600 hover:bg-cyan-500 text-white rounded p-1.5 disabled:opacity-50 transition-colors"
                                            title="Add Emotion"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                    
                                    {selectedEmotions.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {selectedEmotions.map((emotion, idx) => (
                                                <div key={idx} className="flex items-center gap-1 bg-slate-800 border border-slate-600 rounded-full px-2 py-1 text-xs text-slate-300">
                                                    <span>{emotion.major}: {emotion.minor}</span>
                                                    <button 
                                                        onClick={() => setSelectedEmotions(prev => prev.filter((_, i) => i !== idx))}
                                                        className="hover:text-rose-400 transition-colors"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {emotionConflicts.length > 0 && (
                                        <div className="mt-2 p-2 bg-rose-500/20 border border-rose-500/50 rounded text-[10px] text-rose-200 leading-relaxed">
                                            <div className="font-bold flex items-center gap-1 mb-1"><Flame size={12} /> HALLUCINATION WARNING: CONFLICTING STATES DETECTED</div>
                                            <ul className="list-disc list-inside">
                                                {emotionConflicts.map((c, i) => <li key={i}>{c}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Sovereign Modifiers */}
                        {!isVanillaMode && (
                            <div className="mb-4 bg-slate-800/50 rounded-lg border border-rose-900/50 shrink-0 overflow-hidden shadow-[0_0_15px_rgba(225,29,72,0.1)]">
                                <div 
                                    className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-1 focus:ring-rose-500 rounded-t-lg"
                                    tabIndex={0}
                                    onClick={() => toggleSection('sovereignModifiers')}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleSection('sovereignModifiers');
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-2 text-rose-500">
                                        {openSections.sovereignModifiers ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        <Flame size={14} className="text-rose-500" />
                                        <label className="text-xs font-bold uppercase tracking-widest cursor-pointer text-rose-400">Sovereign Matrix (Uncensored)</label>
                                    </div>
                                </div>
                                
                                {openSections.sovereignModifiers && (
                                    <div className="p-3 pt-0 border-t border-rose-900/30 mt-3 space-y-5">
                                        
                                        {/* Realism Modules */}
                                        <div>
                                            <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-2">Realism Modules</label>
                                            <div className="space-y-2">
                                                {realismModulesDB.realism_modules.map(mod => {
                                                    const active = activeRealismModules.find(m => m.name === mod.module_name);
                                                    return (
                                                        <div key={mod.module_name} className="flex flex-col gap-2 p-3 bg-slate-900/80 rounded border border-rose-900/30 hover:border-rose-700/50 transition-colors">
                                                            <div className="flex justify-between items-center">
                                                                <label className="text-xs font-bold text-slate-300 flex items-center gap-2 cursor-pointer">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={!!active}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setActiveRealismModules([...activeRealismModules, { name: mod.module_name, volume: 'moderate' }]);
                                                                            } else {
                                                                                setActiveRealismModules(activeRealismModules.filter(m => m.name !== mod.module_name));
                                                                            }
                                                                        }}
                                                                        className="accent-rose-500 w-4 h-4 rounded focus:ring-rose-500"
                                                                    />
                                                                    {mod.module_name.replace(/_/g, ' ').toUpperCase()}
                                                                </label>
                                                            </div>
                                                            {active && (
                                                                <div className="pl-6 pt-1 flex gap-2">
                                                                    {(['subtle', 'moderate', 'heavy'] as const).map(vol => (
                                                                        <button
                                                                            key={vol}
                                                                            onClick={() => {
                                                                                setActiveRealismModules(activeRealismModules.map(m => m.name === mod.module_name ? { ...m, volume: vol } : m));
                                                                            }}
                                                                            className={`flex-1 py-1.5 text-[9px] uppercase font-bold tracking-widest rounded transition-colors ${active.volume === vol ? 'bg-rose-900 text-rose-200 border border-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.3)]' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-rose-900/50 hover:text-rose-300'}`}
                                                                        >
                                                                            {vol}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Roleplay Overlays */}
                                        <div>
                                            <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-2">Roleplay Overlays</label>
                                            <div className="flex flex-wrap gap-2">
                                                {roleplayOverlaysDB.roleplay_overlays.map(overlay => (
                                                    <button
                                                        key={overlay.name}
                                                        onClick={() => {
                                                            if (activeRoleplayOverlays.includes(overlay.name)) {
                                                                setActiveRoleplayOverlays(activeRoleplayOverlays.filter(n => n !== overlay.name));
                                                            } else {
                                                                setActiveRoleplayOverlays([...activeRoleplayOverlays, overlay.name]);
                                                            }
                                                        }}
                                                        className={`px-3 py-1.5 text-[10px] uppercase font-bold tracking-widest rounded transition-colors ${activeRoleplayOverlays.includes(overlay.name) ? 'bg-rose-900 text-rose-200 border border-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.3)]' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-rose-900/50 hover:text-rose-300'}`}
                                                    >
                                                        {overlay.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Fetish Scene Library */}
                                        <div>
                                            <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-2">Fetish Scene Elements</label>
                                            <select
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val && !activeFetishes.includes(val)) {
                                                        setActiveFetishes([...activeFetishes, val]);
                                                    }
                                                    e.target.value = '';
                                                }}
                                                className="w-full bg-slate-900 border border-slate-700 hover:border-rose-900/50 rounded text-xs p-2 text-slate-300 focus:outline-none focus:border-rose-500 mb-2 transition-colors"
                                                value=""
                                            >
                                                <option value="" disabled>+ Inject Scene Element...</option>
                                                {allFetishes.map((f, i) => (
                                                    <option key={i} value={f.name}>{f.category} ⭢ {f.name}</option>
                                                ))}
                                            </select>
                                            {activeFetishes.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {activeFetishes.map(fName => (
                                                        <div key={fName} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-rose-700/50 rounded-full text-[10px] font-bold text-rose-300">
                                                            {fName}
                                                            <button 
                                                                onClick={() => setActiveFetishes(activeFetishes.filter(n => n !== fName))} 
                                                                className="hover:text-white transition-colors"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                )}
                            </div>
                        )}

                        {/* Motion Capture & Pose */}
                        <div className="mb-4 bg-slate-800/50 rounded-lg border border-slate-700 shrink-0 overflow-hidden">
                            <div 
                                className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded-t-lg"
                                tabIndex={0}
                                onClick={() => toggleSection('motionCapture')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleSection('motionCapture');
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2 text-slate-500">
                                    {openSections.motionCapture ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <Users size={14} className="text-emerald-500/70" />
                                    <label className="text-xs font-bold uppercase tracking-widest cursor-pointer">Motion Capture & Pose</label>
                                </div>
                                {poseReferenceAssetId && (
                                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-900/30 px-2 py-0.5 rounded-full">
                                        Pose Locked
                                    </span>
                                )}
                            </div>
                            
                            {openSections.motionCapture && (
                                <div className="p-3 pt-0 border-t border-slate-700/50 mt-3 space-y-3">
                                    {!poseReferenceAssetId ? (
                                        <div className="text-[10px] text-slate-400 italic text-center py-2 px-4 leading-tight">
                                            To map complex actor movements or specific poses, upload an image to Reference Assets and select it here as the master pose conditioning layer.
                                        </div>
                                    ) : (
                                        <div className="flex gap-3 items-center">
                                            <img src={assets.find(a => a.id === poseReferenceAssetId)?.dataUrl} alt="Pose Reference" className="w-16 h-16 object-cover rounded-md border border-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                                            <div className="flex-1">
                                                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">
                                                    Pose Locked
                                                </div>
                                                <p className="text-[9px] text-slate-500 leading-tight">This asset will be used strictly for structural pose/depth extraction by the rendering engine.</p>
                                            </div>
                                            <button onClick={() => setPoseReferenceAssetId(null)} className="p-2 text-slate-400 hover:text-rose-400 rounded transition-colors">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Engine & Canvas Settings */}
                        <div className="mb-4 bg-slate-800/30 rounded-lg border border-slate-700 shrink-0 overflow-hidden">
                            <div 
                                className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded-t-lg"
                                tabIndex={0}
                                onClick={() => toggleSection('engineSettings')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleSection('engineSettings');
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2 text-slate-500">
                                    {openSections.engineSettings ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <label className="text-xs font-bold uppercase tracking-widest cursor-pointer">Engine & Canvas</label>
                                </div>
                            </div>

                            {openSections.engineSettings && (
                                <div className="p-3 pt-0 border-t border-slate-700/50 space-y-4 mt-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Neural Engine</label>
                                        <select 
                                            value={selectedModel}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 rounded text-xs font-bold p-2 text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors uppercase tracking-widest"
                                        >
                                            <option value="fal-ai/flux/dev">FLUX.1 [dev] (Heavyweight)</option>
                                            <option value="fal-ai/flux/schnell">FLUX.1 [schnell] (Rapid Iteration)</option>
                                            <option value="fal-ai/flux-pro">FLUX.1 [pro] (Commercial)</option>
                                            <option value="fal-ai/stable-diffusion-v3-medium">SD3 Medium (Alt Latent)</option>
                                        </select>
                                    </div>

                                    {/* Aspect Ratio */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Aspect Ratio</label>
                                        <div className="flex gap-2">
                                            {[
                                                { id: 'portrait_4_3', label: 'Portrait' },
                                                { id: 'landscape_16_9', label: 'Landscape' },
                                                { id: 'square', label: 'Square' }
                                            ].map(ratio => (
                                                <button
                                                    key={ratio.id}
                                                    onClick={() => setAspectRatio(ratio.id as any)}
                                                    className={`flex-1 py-2 rounded text-xs font-bold transition-all ${
                                                        aspectRatio === ratio.id 
                                                        ? 'bg-rose-900/50 text-rose-300 border border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.2)]' 
                                                        : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                                                    }`}
                                                >
                                                    {ratio.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* The Camera Bay */}
                        <div className="mb-6 bg-slate-800/50 rounded-lg border border-slate-700 shrink-0 overflow-hidden">
                            <div 
                                className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded-t-lg"
                                tabIndex={0}
                                onClick={() => toggleSection('cameraBay')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleSection('cameraBay');
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2 text-slate-500">
                                    {openSections.cameraBay ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <label className="text-xs font-bold uppercase tracking-widest cursor-pointer">The Camera Bay</label>
                                </div>
                            </div>
                            
                            {openSections.cameraBay && (
                                <div className="p-3 pt-0 border-t border-slate-700/50 mt-3 space-y-3">
                                    <div>
                                        <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Style</label>
                                        <select 
                                            value={cameraStyle}
                                            onChange={(e) => setCameraStyle(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded text-xs p-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
                                        >
                                            <option value="none">Raw Output</option>
                                            <option value="photorealistic">Cinematic Photorealism</option>
                                            <option value="chroma">Chroma Key (Green Screen)</option>
                                            <option value="bw">Classic Black & White</option>
                                            <option value="sepia">Antique Sepia Tone</option>
                                            <option value="anime">Anime / Studio Ghibli</option>
                                            <option value="vintage">Vintage 35mm Film</option>
                                            <option value="cyberpunk">Cyberpunk Edge</option>
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Lens & Focus</label>
                                        <select 
                                            value={cameraLens}
                                            onChange={(e) => setCameraLens(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded text-xs p-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
                                        >
                                            <option value="none">Standard Auto-Focus</option>
                                            <option value="macro">Macro (Extreme Close-up, Heavy Bokeh)</option>
                                            <option value="portrait">Portrait (85mm, Subject Isolation)</option>
                                            <option value="wide">Wide Angle (14mm, Deep Focus)</option>
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Lighting Setup</label>
                                        <select 
                                            value={cameraLighting}
                                            onChange={(e) => setCameraLighting(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded text-xs p-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
                                        >
                                            <option value="none">Natural Ambient</option>
                                            <option value="finnerman">Theatrical Gel (TOS Finnerman Style)</option>
                                            <option value="chiaroscuro">Chiaroscuro (High Contrast Shadows)</option>
                                            <option value="hitchcock">Noir Shadows (Hitchcock / Serling)</option>
                                            <option value="golden_hour">Golden Hour (Warm, Sunset)</option>
                                            <option value="neon">Neon Volumetric</option>
                                            <option value="studio">Studio Softbox</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Optical Filters</label>
                                        <select 
                                            value={cameraFilter}
                                            onChange={(e) => setCameraFilter(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded text-xs p-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
                                        >
                                            <option value="none">No Filter (Clear UV)</option>
                                            <option value="vaseline">Vaseline Smudge (60s Glamour Soft-Focus)</option>
                                            <option value="diopter">Split Diopter (Deep dual-focus)</option>
                                            <option value="promist">1/4 Black Pro-Mist (Halation / Bloom)</option>
                                            <option value="polarizer">CPL Polarizer (Rich saturation, no glare)</option>
                                            <option value="star">4-Point Star (Starburst highlights)</option>
                                            <option value="aerochrome">IR Aerochrome (Crimson foliage shift)</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                        </div>
                        
                        {/* Action */}
                        <div className="p-4 bg-slate-900/95 border-t border-rose-900/30 shrink-0">
                            <button 
                                onClick={handleDream}
                                disabled={isGenerating || !prompt.trim()}
                                className="w-full bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white py-4 rounded-xl font-black tracking-widest uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale transition-all shadow-[0_0_20px_rgba(225,29,72,0.3)] hover:shadow-[0_0_30px_rgba(225,29,72,0.5)]"
                            >
                                <Sparkles size={18} /> Generate Dream
                            </button>
                        </div>
                    </div>

                    {/* Right: Output Canvas */}
                    <div className="w-2/3 flex flex-col bg-black relative pattern-boxes pattern-slate-900 pattern-bg-black pattern-size-4 pattern-opacity-20">
                        <div className="flex-1 relative flex items-center justify-center p-8">
                            {!outputUrl && !isGenerating && (
                                <div className="text-rose-950 flex flex-col items-center">
                                    <Flame size={64} className="mb-4 opacity-50" />
                                    <p className="uppercase tracking-widest font-black text-lg opacity-50">The Canvas is Blank</p>
                                </div>
                            )}

                            {isGenerating && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                                    <Loader2 size={64} className="animate-spin text-rose-500 mb-6" />
                                    <p className="text-rose-400 font-bold uppercase tracking-widest animate-pulse drop-shadow-md text-lg">
                                        Synthesizing Neural Tapestry...
                                    </p>
                                </div>
                            )}

                            {outputUrl && !isGenerating && (
                                <div className="relative w-full h-full flex items-center justify-center group">
                                    <img 
                                        src={outputUrl} 
                                        alt="Erato Dream" 
                                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-700 border border-rose-900/30"
                                    />
                                    
                                    {/* Hover Controls for Output */}
                                    <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity flex gap-3">
                                        <button 
                                            onClick={() => window.open(outputUrl, '_blank')}
                                            className="bg-black/80 hover:bg-black text-white px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase border border-slate-700 hover:border-rose-500 flex items-center gap-2 backdrop-blur transition-colors"
                                        >
                                            <Maximize size={16} /> Full Size
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setSourceImage(outputUrl);
                                                setOutputUrl(null);
                                            }}
                                            className="bg-cyan-900/80 hover:bg-cyan-800 text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase border border-cyan-700 hover:border-cyan-400 flex items-center gap-2 backdrop-blur transition-colors"
                                            title="Set as Structural Base for next iteration"
                                        >
                                            <RefreshCcw size={16} /> Iterate (Set Base)
                                        </button>
                                        <button 
                                            className="bg-emerald-900/80 hover:bg-emerald-800 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase border border-emerald-700 hover:border-emerald-400 flex items-center gap-2 backdrop-blur transition-colors"
                                        >
                                            <Download size={16} /> Accession
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
