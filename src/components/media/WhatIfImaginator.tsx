import React, { useState, useEffect } from 'react';
import { X, Sparkles, Brain, Check, Loader2, Play, Pause, Film, Image, DollarSign, AlertCircle, ThumbsUp, Upload, Search } from 'lucide-react';
import type { Tag, Media, User } from '../../types';
import { appDataService } from '../../services/serviceManager';
import { uploadFile } from '../../services/storageService';
import { generateImageWithGrok, generateVideoWithGrok, pollVideoTask, extendVideoWithGrok, synthesizeRenderNarrative } from '../../services/aiOrchestrator';
import { aiStateBridge } from '../../utils/aiStateBridge';

interface WhatIfImaginatorProps {
    tag: Tag;
    allTags: Tag[];
    currentUser: User | null;
    onClose: () => void;
}

const WhatIfImaginator: React.FC<WhatIfImaginatorProps> = ({ tag, allTags, currentUser, onClose }) => {
    const [mode, setMode] = useState<'image' | 'video'>('image');
    const [quality, setQuality] = useState<'standard' | 'pro' | '480p' | '720p'>('standard');
    const [selectedAnchors, setSelectedAnchors] = useState<Media[]>([]);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const [lastVideoTaskId, setLastVideoTaskId] = useState<string | null>(null);
    const [videoDuration, setVideoDuration] = useState(10);
    const [narrative, setNarrative] = useState('');
    const [feedbackScore, setFeedbackScore] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [isNarrativeLoading, setIsNarrativeLoading] = useState(false);

    // Dynamic prompt prefill
    useEffect(() => {
        let basePrompt = '';
        if (tag.type === 'person') {
            basePrompt = `${tag.name} laughing during a warm retro 1980s sunset picnic, light leaks, film grain style, candid close-up, historical family photo aesthetic`;
        } else if (tag.type === 'place') {
            basePrompt = `Nostalgic golden-hour rendering of ${tag.name} during the early autumn of 1978, oil painting style, warm tones, high details`;
        } else {
            basePrompt = `A stylized representation of ${tag.name} with dreamlike elements, vibrant colors, nostalgic atmosphere`;
        }
        setPrompt(basePrompt);
    }, [tag]);

    // Multi-source resemblance anchors selection
    const [anchorSourceTab, setAnchorSourceTab] = useState<'tag' | 'matrix' | 'upload'>('tag');
    const [tagImages, setTagImages] = useState<Media[]>([]);
    const [matrixSearchQuery, setMatrixSearchQuery] = useState('');
    const [matrixSearchResults, setMatrixSearchResults] = useState<Media[]>([]);
    const [isUploadingAnchor, setIsUploadingAnchor] = useState(false);
    const [accessionUploadedAnchor, setAccessionUploadedAnchor] = useState(false);

    useEffect(() => {
        const fetchRelated = async () => {
            if (!currentUser?.id) return;
            try {
                const allMedia = await appDataService.getAllMedia(currentUser.id);
                const related = allMedia.filter(m => 
                    !m.isFiction && 
                    !m.isAvatar && 
                    m.tagIds?.includes(tag.id) && 
                    m.fileType?.startsWith('image')
                );
                
                const uniqueRelated: Media[] = [];
                const seenIds = new Set<string>();
                for (const m of related) {
                    if (!seenIds.has(m.id)) {
                        seenIds.add(m.id);
                        uniqueRelated.push(m);
                    }
                }
                setTagImages(uniqueRelated);
            } catch (err) {
                console.error("Failed to fetch related media anchors:", err);
            }
        };
        fetchRelated();
    }, [tag, currentUser]);

    // Matrix search effect
    useEffect(() => {
        const searchMatrix = async () => {
            if (!currentUser?.id) return;
            if (!matrixSearchQuery.trim()) {
                setMatrixSearchResults([]);
                return;
            }
            try {
                const allMedia = await appDataService.getAllMedia(currentUser.id);
                const q = matrixSearchQuery.toLowerCase();
                const matched = allMedia.filter(m => 
                    !m.isFiction && 
                    !m.isAvatar && 
                    m.fileType?.startsWith('image') && 
                    ((m.caption && m.caption.toLowerCase().includes(q)) || (m.fileName && m.fileName.toLowerCase().includes(q)))
                );
                
                const uniqueMatched: Media[] = [];
                const seenIds = new Set<string>();
                for (const m of matched) {
                    if (!seenIds.has(m.id)) {
                        seenIds.add(m.id);
                        uniqueMatched.push(m);
                    }
                }
                setMatrixSearchResults(uniqueMatched.slice(0, 12));
            } catch (err) {
                console.error("Failed to search greater matrix:", err);
            }
        };
        const timer = setTimeout(searchMatrix, 300);
        return () => clearTimeout(timer);
    }, [matrixSearchQuery, currentUser]);

    // Upload custom anchor handler
    const handleUploadAnchor = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!currentUser?.id) return;
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingAnchor(true);
        try {
            const { url } = await uploadFile(file, currentUser.id, `anchor_${Date.now()}_${file.name}`);
            if (!url) throw new Error("Upload failed");

            const newMedia: Media = {
                id: `anchor_${Date.now()}`,
                url,
                thumbnailUrl: url,
                caption: accessionUploadedAnchor 
                    ? `Uploaded Resonance Anchor for ${tag.name}`
                    : `Temporary Reference Seed: ${file.name}`,
                year: new Date().getFullYear(),
                logicalDate: new Date().toISOString(),
                uploadDate: new Date(),
                fileType: file.type || 'image/jpeg',
                tagIds: [tag.id]
            };

            if (accessionUploadedAnchor) {
                await appDataService.saveMedia(currentUser.id, newMedia);
                // Prepend to tagImages so it shows up immediately
                setTagImages(prev => [newMedia, ...prev]);
            }

            // Automatically select
            setSelectedAnchors(prev => {
                if (mode === 'video') return [newMedia];
                if (prev.length >= 3) return prev;
                return [...prev, newMedia];
            });

            setAnchorSourceTab('tag');
        } catch (err) {
            console.error("Failed to upload custom resonance anchor:", err);
            setGenerationError("Failed to upload custom reference image.");
        } finally {
            setIsUploadingAnchor(false);
        }
    };

    // Handle Anchor selection toggle
    const toggleAnchor = (mediaItem: Media) => {
        setSelectedAnchors(prev => {
            if (prev.some(a => a.id === mediaItem.id)) {
                return prev.filter(a => a.id !== mediaItem.id);
            }
            if (mode === 'video') {
                // Video model supports 1 image input
                return [mediaItem];
            }
            if (prev.length >= 3) return prev; // Limit to 3 for image
            return [...prev, mediaItem];
        });
    };

    // Auto-update quality type based on mode selection
    useEffect(() => {
        if (mode === 'image') {
            setQuality('standard');
            // reset selected anchors to max 3 if they exceed
            if (selectedAnchors.length > 3) setSelectedAnchors(selectedAnchors.slice(0, 3));
        } else {
            setQuality('480p');
            // reset selected anchors to max 1 for video
            if (selectedAnchors.length > 1) setSelectedAnchors(selectedAnchors.slice(0, 1));
        }
    }, [mode]);

    // Cost Estimator calculation
    const getEstimatedCost = () => {
        if (mode === 'image') {
            return quality === 'pro' ? 0.07 : 0.05;
        } else {
            const base = quality === '720p' ? 0.50 : 0.10;
            return base * (videoDuration / 10);
        }
    };

    const pollVideoStatus = async (taskId: string): Promise<string> => {
        const maxRetries = 100;
        for (let i = 0; i < maxRetries; i++) {
            const res = await pollVideoTask(taskId);
            if (res.status === 'done' && res.url) {
                return res.url;
            }
            if (res.status === 'failed') {
                throw new Error("Grok Video generation reported a status failure.");
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        throw new Error("Video generation task timed out.");
    };

    const handleDream = async () => {
        if (!currentUser?.id) return;
        setIsGenerating(true);
        setGenerationError(null);
        setGeneratedUrl(null);
        setNarrative('');
        setFeedbackScore(null);
        setVideoDuration(10);
        aiStateBridge.setThinking(true);

        try {
            if (mode === 'image') {
                const imageUrls = selectedAnchors.map(a => a.url);
                const result = await generateImageWithGrok(prompt, {
                    quality: quality === 'pro' ? '2k' : '1k',
                    referenceImages: imageUrls
                });
                setGeneratedUrl(result);

                // Run narrative synthesis in background
                setIsNarrativeLoading(true);
                try {
                    const desc = await synthesizeRenderNarrative(prompt, result, [tag]);
                    setNarrative(desc);
                } catch (descErr) {
                    console.error("Narrative generation error:", descErr);
                    setNarrative(`A simulated what-if render of ${tag.name} matching: "${prompt}"`);
                } finally {
                    setIsNarrativeLoading(false);
                }
            } else {
                const seedUrl = selectedAnchors[0]?.url;
                const task = await generateVideoWithGrok(prompt, {
                    startImage: seedUrl,
                    resolution: quality === '720p' ? '720p' : '480p'
                });
                setLastVideoTaskId(task.taskId);

                // Poll video status
                const videoUrl = await pollVideoStatus(task.taskId);
                setGeneratedUrl(videoUrl);

                // Run narrative synthesis in background
                setIsNarrativeLoading(true);
                try {
                    const desc = await synthesizeRenderNarrative(prompt, videoUrl, [tag]);
                    setNarrative(desc);
                } catch (descErr) {
                    console.error("Narrative generation error:", descErr);
                    setNarrative(`A simulated what-if render of ${tag.name} matching: "${prompt}"`);
                } finally {
                    setIsNarrativeLoading(false);
                }
            }
        } catch (err: any) {
            console.error("Dream failed:", err);
            setGenerationError(err.message || "Failed to generate visual render from Grok model. Please check keys/quota.");
        } finally {
            setIsGenerating(false);
            aiStateBridge.setThinking(false);
        }
    };

    const handleExtend = async () => {
        if (!currentUser?.id || !lastVideoTaskId || !generatedUrl) return;
        setIsGenerating(true);
        setGenerationError(null);
        aiStateBridge.setThinking(true);

        try {
            const extTask = await extendVideoWithGrok(lastVideoTaskId, 10);
            const newVideoUrl = await pollVideoStatus(extTask.taskId);
            setGeneratedUrl(newVideoUrl);
            setLastVideoTaskId(extTask.taskId);
            setVideoDuration(prev => Math.min(prev + 10, 30));
        } catch (err: any) {
            console.error("Extend failed:", err);
            setGenerationError(err.message || "Failed to extend the video. Max duration or service error occurred.");
        } finally {
            setIsGenerating(false);
            aiStateBridge.setThinking(false);
        }
    };

    const handleSave = async () => {
        if (!currentUser?.id || !generatedUrl) return;
        setIsSaving(true);
        try {
            const cost = getEstimatedCost();
            const newMedia: Media = {
                id: `whatif_${Date.now()}`,
                url: generatedUrl,
                thumbnailUrl: generatedUrl,
                caption: narrative || `Parallel memory: "${prompt}"`,
                year: new Date().getFullYear(),
                logicalDate: new Date().toISOString(),
                uploadDate: new Date(),
                fileType: mode === 'video' ? 'video/mp4' : 'image/jpeg',
                tagIds: [tag.id],
                isFiction: true,
                universeIds: ['what-if'],
                metadata: {
                    prompt,
                    feedbackScore: feedbackScore || undefined,
                    videoDuration: mode === 'video' ? videoDuration : undefined,
                    costEstimated: cost
                }
            };

            await appDataService.saveMedia(currentUser.id, newMedia);
            onClose();
        } catch (err) {
            console.error("Failed to save re-imagined memory:", err);
            setGenerationError("Failed to save media to database.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col md:flex-row max-h-[90vh] overflow-hidden relative">
                
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 bg-slate-900/60 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                    <X size={20} />
                </button>

                {/* Left Side: Input Form */}
                <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col overflow-y-auto border-r border-slate-900 custom-scrollbar">
                    <div className="flex items-center gap-2 mb-6">
                        <Sparkles size={24} className="text-fuchsia-400 animate-pulse" />
                        <h2 className="text-xl font-black text-white tracking-tight uppercase">Imaginator Studio</h2>
                    </div>

                    {/* Mode Toggle */}
                    <div className="mb-6">
                        <span className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Synthesis Universe</span>
                        <div className="grid grid-cols-2 gap-3 bg-slate-900 p-1 rounded-xl">
                            <button
                                onClick={() => setMode('image')}
                                className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${mode === 'image' ? 'bg-fuchsia-800 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                            >
                                <Image size={14} /> Image Memory
                            </button>
                            <button
                                onClick={() => setMode('video')}
                                className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${mode === 'video' ? 'bg-fuchsia-800 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                            >
                                <Film size={14} /> Video Stream
                            </button>
                        </div>
                    </div>

                    {/* Quality presets */}
                    <div className="mb-6">
                        <span className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Model Configuration</span>
                        <div className="grid grid-cols-2 gap-3">
                            {mode === 'image' ? (
                                <>
                                    <button
                                        onClick={() => setQuality('standard')}
                                        className={`py-2 px-3 border rounded-xl font-bold text-xs transition-all ${quality === 'standard' ? 'border-fuchsia-500 bg-fuchsia-950/20 text-fuchsia-300' : 'border-slate-800 text-slate-400 hover:text-white'}`}
                                    >
                                        Standard (1K)
                                    </button>
                                    <button
                                        onClick={() => setQuality('pro')}
                                        className={`py-2 px-3 border rounded-xl font-bold text-xs transition-all ${quality === 'pro' ? 'border-fuchsia-500 bg-fuchsia-950/20 text-fuchsia-300' : 'border-slate-800 text-slate-400 hover:text-white'}`}
                                    >
                                        Pro (2K Render)
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setQuality('480p')}
                                        className={`py-2 px-3 border rounded-xl font-bold text-xs transition-all ${quality === '480p' ? 'border-fuchsia-500 bg-fuchsia-950/20 text-fuchsia-300' : 'border-slate-800 text-slate-400 hover:text-white'}`}
                                    >
                                        480p (Standard)
                                    </button>
                                    <button
                                        onClick={() => setQuality('720p')}
                                        className={`py-2 px-3 border rounded-xl font-bold text-xs transition-all ${quality === '720p' ? 'border-fuchsia-500 bg-fuchsia-950/20 text-fuchsia-300' : 'border-slate-800 text-slate-400 hover:text-white'}`}
                                    >
                                        720p (Cinematic HD)
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Resemblance Anchors */}
                    <div className="mb-6 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between mb-1">
                            <span className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                Resonance Anchors ({mode === 'video' ? 'Select 1 Image' : 'Select up to 3'})
                            </span>
                            {selectedAnchors.length > 0 && (
                                <button 
                                    onClick={() => setSelectedAnchors([])} 
                                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors"
                                >
                                    Clear Selected ({selectedAnchors.length})
                                </button>
                            )}
                        </div>
                        <span className="block text-[10px] text-slate-400 mb-3">Locks subjects' facial structure & settings coordinates.</span>
                        
                        {/* Active Seeds Strip */}
                        {selectedAnchors.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3 bg-slate-950/20 p-2 rounded-xl border border-white/5 items-center">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-1">Active Seeds:</span>
                                {selectedAnchors.map(anchor => (
                                    <div key={`seed-${anchor.id}`} className="relative w-10 h-10 rounded-lg overflow-hidden border border-emerald-500 group">
                                        <img src={anchor.url} alt="" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => toggleAnchor(anchor)}
                                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 hover:text-rose-300 transition-opacity"
                                            title="Remove reference seed"
                                        >
                                            <X size={10} strokeWidth={3} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Tab Headers */}
                        <div className="flex bg-slate-950/40 p-1 rounded-xl border border-white/5 gap-1 mb-3">
                            <button
                                type="button"
                                onClick={() => setAnchorSourceTab('tag')}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    anchorSourceTab === 'tag'
                                    ? 'bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                Tag Photos
                            </button>
                            <button
                                type="button"
                                onClick={() => setAnchorSourceTab('matrix')}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    anchorSourceTab === 'matrix'
                                    ? 'bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                Matrix Search
                            </button>
                            <button
                                type="button"
                                onClick={() => setAnchorSourceTab('upload')}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    anchorSourceTab === 'upload'
                                    ? 'bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                Upload Anchor
                            </button>
                        </div>

                        {/* Tab Contents */}
                        {anchorSourceTab === 'tag' && (
                            <div>
                                {tagImages.length === 0 ? (
                                    <div className="text-center py-6 text-[10px] font-bold text-slate-500 border border-dashed border-white/5 rounded-xl">
                                        No photos found for this tag. Try searching the Matrix or uploading.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                        {tagImages.map(item => {
                                            const isSelected = selectedAnchors.some(a => a.id === item.id);
                                            return (
                                                <div 
                                                    key={`tagimg-${item.id}`}
                                                    onClick={() => toggleAnchor(item)}
                                                    className={`aspect-square rounded-lg overflow-hidden border bg-slate-900 cursor-pointer relative transition-all ${isSelected ? 'border-emerald-500 scale-95 ring-2 ring-emerald-500/20' : 'border-slate-800 hover:border-slate-700'}`}
                                                >
                                                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                                                    {isSelected && (
                                                        <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-md">
                                                            <Check size={8} strokeWidth={4} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {anchorSourceTab === 'matrix' && (
                            <div className="space-y-2">
                                <div className="relative flex items-center">
                                    <Search className="absolute left-2.5 text-slate-500" size={12} />
                                    <input
                                        type="text"
                                        placeholder="Search by caption or filename..."
                                        value={matrixSearchQuery}
                                        onChange={(e) => setMatrixSearchQuery(e.target.value)}
                                        className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-fuchsia-500 placeholder-slate-600"
                                    />
                                </div>
                                {matrixSearchResults.length === 0 ? (
                                    <div className="text-center py-6 text-[10px] font-bold text-slate-500">
                                        {matrixSearchQuery ? 'No matching images found.' : 'Type to search the greater Matrix.'}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                        {matrixSearchResults.map(item => {
                                            const isSelected = selectedAnchors.some(a => a.id === item.id);
                                            return (
                                                <div 
                                                    key={`matrix-${item.id}`}
                                                    onClick={() => toggleAnchor(item)}
                                                    className={`aspect-square rounded-lg overflow-hidden border bg-slate-900 cursor-pointer relative transition-all ${isSelected ? 'border-emerald-500 scale-95 ring-2 ring-emerald-500/20' : 'border-slate-800 hover:border-slate-700'}`}
                                                >
                                                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                                                    {isSelected && (
                                                        <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-md">
                                                            <Check size={8} strokeWidth={4} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {anchorSourceTab === 'upload' && (
                            <div className="space-y-4">
                                <div className="border border-dashed border-white/5 rounded-xl p-4 flex flex-col items-center justify-center bg-slate-900/20">
                                    {isUploadingAnchor ? (
                                        <div className="flex flex-col items-center gap-2 py-4">
                                            <Loader2 size={24} className="animate-spin text-fuchsia-500" />
                                            <span className="text-[10px] font-bold text-slate-400">Accessioning to Cloud...</span>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center gap-2 cursor-pointer py-4 w-full text-center">
                                            <div className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300 transition-colors border border-slate-700">
                                                <Upload size={16} />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400">Click to Select and Upload Reference Image</span>
                                            <span className="text-[9px] text-slate-600">Saves to temp storage and auto-selects</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleUploadAnchor}
                                            />
                                        </label>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 px-1">
                                    <input
                                        type="checkbox"
                                        id="accession-upload-cb"
                                        checked={accessionUploadedAnchor}
                                        onChange={(e) => setAccessionUploadedAnchor(e.target.checked)}
                                        className="rounded border-slate-800 bg-slate-900 text-fuchsia-600 focus:ring-fuchsia-500/20 cursor-pointer"
                                    />
                                    <label htmlFor="accession-upload-cb" className="text-[10px] text-slate-400 font-bold select-none cursor-pointer">
                                        Accession to Matrix (Save permanently to my main database ledger)
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Prompt Builder */}
                    <div className="mb-6">
                        <span className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Memory Prompt Matrix</span>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-fuchsia-500 resize-none h-24 custom-scrollbar"
                            placeholder="Envision a what-if timeline..."
                        />
                    </div>

                    {/* Cost Calculator Indicator */}
                    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 mb-6 flex items-center justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1.5"><DollarSign size={14} /> Estimated Tokens Billing</span>
                        <span className="text-fuchsia-400 font-bold font-mono">${getEstimatedCost().toFixed(2)} USD</span>
                    </div>

                    {/* Actions */}
                    <button
                        disabled={isGenerating || !prompt.trim()}
                        onClick={handleDream}
                        className="w-full py-3 bg-gradient-to-r from-fuchsia-800 to-violet-800 hover:from-fuchsia-700 hover:to-violet-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-950/40 transition-all cursor-pointer"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 size={16} className="animate-spin" /> dreaming...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} /> DREAM RE-IMAGINED MEMORY
                            </>
                        )}
                    </button>

                    {generationError && (
                        <div className="mt-4 p-3 bg-rose-950/20 border border-rose-500/20 rounded-xl flex gap-2 items-start text-xs text-rose-300">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            <span>{generationError}</span>
                        </div>
                    )}
                </div>

                {/* Right Side: Output Canvas */}
                <div className="w-full md:w-1/2 p-6 md:p-8 bg-slate-950 flex flex-col justify-between overflow-y-auto custom-scrollbar min-h-[400px]">
                    <div className="flex-1 flex flex-col justify-center items-center">
                        {isGenerating ? (
                            <div className="text-center space-y-4 py-12 animate-pulse">
                                <Brain size={48} className="text-fuchsia-400 mx-auto animate-bounce" />
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Synthesizing Parallel Coordinates</h4>
                                    <p className="text-xs text-slate-500">Brita is rendering your prompt in grok xAI studios...</p>
                                </div>
                            </div>
                        ) : generatedUrl ? (
                            <div className="w-full space-y-5 animate-in zoom-in-95 duration-300">
                                <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-slate-800 bg-black relative group shadow-2xl">
                                    {mode === 'video' ? (
                                        <video
                                            src={generatedUrl}
                                            controls
                                            autoPlay
                                            loop
                                            playsInline
                                            className="w-full h-full object-contain"
                                        />
                                    ) : (
                                        <img src={generatedUrl} alt="Dream output" className="w-full h-full object-contain" />
                                    )}
                                </div>

                                {/* Video Extend controls */}
                                {mode === 'video' && videoDuration < 30 && (
                                    <div className="flex justify-between items-center bg-slate-900/50 border border-slate-800 p-3 rounded-xl">
                                        <span className="text-xs text-slate-400">Current Stream Duration: {videoDuration} seconds</span>
                                        <button
                                            onClick={handleExtend}
                                            className="px-3 py-1.5 bg-fuchsia-950/60 border border-fuchsia-800/40 text-fuchsia-300 font-bold rounded-lg text-xs hover:bg-fuchsia-900/50 transition-colors cursor-pointer"
                                        >
                                            Extend (+10s)
                                        </button>
                                    </div>
                                )}

                                {/* Narrative Box */}
                                <div className="space-y-2">
                                    <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Grounded Narrative</span>
                                    {isNarrativeLoading ? (
                                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 py-2">
                                            <Loader2 size={12} className="animate-spin" /> Synthesizing ledger narrative...
                                        </div>
                                    ) : (
                                        <textarea
                                            value={narrative}
                                            onChange={(e) => setNarrative(e.target.value)}
                                            className="w-full bg-slate-900/40 border border-slate-850 rounded-xl p-3 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none h-20 custom-scrollbar leading-relaxed"
                                        />
                                    )}
                                </div>

                                {/* Feedback Bar */}
                                <div className="space-y-2">
                                    <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Ledger Alignment Evaluation</span>
                                    <div className="flex gap-2">
                                        {[
                                            { score: 1, emoji: '😢', label: 'unusable' },
                                            { score: 2, emoji: '🙁', label: 'poor' },
                                            { score: 3, emoji: '😐', label: 'neutral' },
                                            { score: 4, emoji: '🙂', label: 'good' },
                                            { score: 5, emoji: '😄', label: 'aligned' }
                                        ].map(item => (
                                            <button
                                                key={item.score}
                                                onClick={() => setFeedbackScore(item.score)}
                                                className={`flex-1 py-2 text-lg rounded-xl border transition-all hover:scale-105 cursor-pointer ${feedbackScore === item.score ? 'bg-fuchsia-950/40 border-fuchsia-500' : 'bg-slate-900/20 border-slate-900 hover:border-slate-800'}`}
                                                title={item.label}
                                            >
                                                {item.emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-20 text-slate-600">
                                <Sparkles size={48} className="mx-auto mb-4 opacity-25 animate-pulse text-fuchsia-400" />
                                <h3 className="text-sm font-bold text-slate-400 mb-1">Synthesis Output Canvas</h3>
                                <p className="text-xs max-w-xs mx-auto">Tune coordinates on the left and trigger synthesis to observe parallel memory outcomes.</p>
                            </div>
                        )}
                    </div>

                    {generatedUrl && (
                        <div className="mt-6 pt-4 border-t border-slate-900 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                            >
                                Dismiss
                            </button>
                            <button
                                disabled={isSaving}
                                onClick={handleSave}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/20 transition-all cursor-pointer border border-emerald-500/20"
                            >
                                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />} ACCESSION TO FAMILY LEDGER
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WhatIfImaginator;
