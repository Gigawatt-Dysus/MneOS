import React, { useState, useEffect } from 'react';
import { Layers, Sparkles, X, Loader2, Maximize, AlertTriangle, UserPlus, Image as ImageIcon } from 'lucide-react';
import { Media } from '../../types';
import { WikiTagEditor } from '../shared/WikiTagEditor';
import { aiStateBridge } from '../../utils/aiStateBridge';
import { callXAI } from '../../services/aiOrchestrator';

interface MuseReimagineModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceMedia: Media;
    userId: string;
}

export const MuseReimagineModal: React.FC<MuseReimagineModalProps> = ({
    isOpen,
    onClose,
    sourceMedia,
    userId
}) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [outputBase64, setOutputBase64] = useState<string | null>(null);
    const [resolution, setResolution] = useState<'HD' | '2K' | '4K' | '8K'>('4K');
    const [autoEnhance, setAutoEnhance] = useState(true);
    
    // Diplomatic Envoy States
    const [isRefused, setIsRefused] = useState(false);
    const [mitigationAnalysis, setMitigationAnalysis] = useState<string | null>(null);

    // Run initial image analysis to generate the base prompt using Grok 4.x
    useEffect(() => {
        if (isOpen && sourceMedia && !prompt && !isGenerating && !outputBase64) {
            generateBasePrompt();
        }
    }, [isOpen]);

    const generateBasePrompt = async () => {
        setIsGenerating(true);
        aiStateBridge.setThinking(true, "Calliope is analyzing the structural geometry...");
        try {
            // Standard vision interrogation
            const aiPrompt = "Analyze this image and generate an elite, highly detailed prompt to recreate it flawlessly. Focus on subject matter, lighting, depth of field, and texture. Return ONLY the prompt text.";
            const response = await callXAI("grok-4.3", [
                { 
                    role: 'user', 
                    parts: [
                        { text: aiPrompt },
                        { inlineData: { data: sourceMedia.url, mimeType: "image/jpeg" } } // Pseudo-passing URL as data for abstraction
                    ] 
                }
            ], "You are an elite prompt engineer.");
            
            setPrompt(response.text || "Highly detailed portrait, cinematic lighting, 8k resolution");
        } catch (error) {
            console.error("Failed to generate base prompt", error);
            setPrompt("A highly detailed photograph...");
        } finally {
            setIsGenerating(false);
            aiStateBridge.setThinking(false);
        }
    };

    const handleForge = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setIsRefused(false);
        setMitigationAnalysis(null);
        aiStateBridge.setThinking(true, `The Sovereign Stitch Engine is forging the ${resolution} asset...`);

        try {
            // Append auto-enhance instructions
            let finalPrompt = prompt;
            if (autoEnhance) {
                finalPrompt += " High dynamic range, flawless subsurface scattering, perfect cinematic lighting, hyper-realistic micro-textures. DO NOT hallucinate pareidolia in the background bokeh. Preserve strict shallow depth of field.";
            }

            // In a real environment, we'd fetch the sourceMedia.url as a base64 buffer first
            // For the frontend architecture, we'll assume we pass the URL or base64 to the backend
            const payload = {
                base64Image: sourceMedia.url, // Placeholder: Should be actual base64
                masterPrompt: finalPrompt,
                apiKey: localStorage.getItem('GOOGLE_AI_API_KEY') || import.meta.env.VITE_GOOGLE_AI_API_KEY
            };

            const response = await fetch('/api/media/forgeReimagine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.isRefused) {
                    setIsRefused(true);
                    setMitigationAnalysis(data.mitigation);
                    throw new Error("Safety Filter Tripped");
                }
                throw new Error(data.error || "Forge failed");
            }

            setOutputBase64(data.base64Data);

        } catch (error: any) {
            console.error("[MuseReimagineModal] Forge Failed:", error);
            if (!isRefused) alert("Forge Failed: " + error.message);
        } finally {
            setIsGenerating(false);
            aiStateBridge.setThinking(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="bg-[#0f172a] border border-slate-700 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-6xl w-full flex flex-col h-[85vh] relative overflow-hidden">
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900 shrink-0">
                    <div className="flex items-center gap-2">
                        <Sparkles className="text-amber-400" size={20} />
                        <h2 className="text-lg font-bold tracking-widest uppercase bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
                            The Crucible (Sovereign Stitch Engine)
                        </h2>
                    </div>
                    <button onClick={onClose} disabled={isGenerating} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Original Media */}
                    <div className="w-1/2 border-r border-slate-800 bg-black flex flex-col relative group">
                        <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur px-3 py-1 rounded text-xs font-bold text-slate-300 uppercase tracking-widest border border-slate-700">
                            Source Artifact
                        </div>
                        <img 
                            src={sourceMedia.url} 
                            alt="Original" 
                            className="w-full h-full object-contain"
                        />
                    </div>

                    {/* Right: Output / Forge */}
                    <div className="w-1/2 flex flex-col bg-slate-900 relative">
                        {/* Preview Area */}
                        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                            {!outputBase64 && !isGenerating && !isRefused && (
                                <div className="text-slate-600 flex flex-col items-center">
                                    <Maximize size={48} className="mb-4 opacity-50" />
                                    <p className="uppercase tracking-widest font-bold text-sm">Awaiting Synthesis</p>
                                </div>
                            )}

                            {isGenerating && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
                                    <Loader2 size={48} className="animate-spin text-amber-500 mb-4" />
                                    <p className="text-amber-400 font-bold uppercase tracking-widest animate-pulse">Forging 16-Bit Quadrants...</p>
                                </div>
                            )}

                            {isRefused && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-md p-8 text-center border-4 border-red-900">
                                    <AlertTriangle size={64} className="text-red-500 mb-4" />
                                    <h3 className="text-xl font-bold text-red-400 mb-2 uppercase tracking-widest">Neural Link Severed</h3>
                                    <p className="text-red-200 mb-6 font-medium">Corporate safety filters intercepted the render payload.</p>
                                    
                                    <div className="bg-black/50 border border-red-900 p-4 rounded-lg text-left w-full max-w-md">
                                        <h4 className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-2 border-b border-red-900/50 pb-2">Diplomatic Envoy Analysis</h4>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{mitigationAnalysis || "Waiting for Envoy response..."}</p>
                                    </div>
                                </div>
                            )}

                            {outputBase64 && !isGenerating && !isRefused && (
                                <>
                                    <div className="absolute top-4 right-4 z-10 bg-amber-500/20 backdrop-blur px-3 py-1 rounded text-xs font-bold text-amber-400 uppercase tracking-widest border border-amber-500/50">
                                        {resolution} SYNTHESIS
                                    </div>
                                    <img 
                                        src={outputBase64} 
                                        alt="Forged Output" 
                                        className="w-full h-full object-contain animate-in zoom-in-95 duration-500"
                                    />
                                </>
                            )}
                        </div>

                        {/* Controls Sidebar / Bottom */}
                        <div className="h-[280px] border-t border-slate-700 bg-slate-800/80 p-4 flex flex-col shrink-0">
                            
                            {/* Toolbar */}
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex gap-2 bg-slate-900 p-1 rounded-md border border-slate-700">
                                    {['HD', '2K', '4K', '8K'].map(res => (
                                        <button
                                            key={res}
                                            onClick={() => setResolution(res as any)}
                                            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${resolution === res ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                        >
                                            {res}
                                        </button>
                                    ))}
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={autoEnhance} 
                                        onChange={e => setAutoEnhance(e.target.checked)}
                                        className="accent-amber-500 w-4 h-4"
                                    />
                                    <span className="text-xs font-bold uppercase text-amber-400 tracking-wider">MneOS Auto-Enhance</span>
                                </label>
                            </div>

                            {/* Prompt Box */}
                            <div className="flex-1 bg-black rounded-lg border border-slate-700 focus-within:border-amber-500 overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-1">
                                    <button onClick={generateBasePrompt} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-slate-300 font-bold tracking-wider">
                                        RE-INTERROGATE IMAGE
                                    </button>
                                </div>
                                <WikiTagEditor
                                    value={prompt}
                                    onChange={setPrompt}
                                    userId={userId}
                                    placeholder="Enter synthesis directives..."
                                    className="bg-transparent border-none text-sm p-3 w-full h-full resize-none custom-scrollbar focus:ring-0"
                                />
                            </div>

                            {/* Actions */}
                            <div className="mt-4 flex gap-3">
                                {!outputBase64 ? (
                                    <button 
                                        onClick={handleForge}
                                        disabled={isGenerating || !prompt.trim()}
                                        className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-lg font-bold tracking-widest uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                    >
                                        <Sparkles size={18} /> Ignite Forge
                                    </button>
                                ) : (
                                    <>
                                        <button 
                                            onClick={() => {/* Trigger PromotToAvatar flow */}}
                                            className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-3 rounded-lg font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <UserPlus size={18} /> Promote to Avatar
                                        </button>
                                        <button 
                                            onClick={() => {/* Save as Variant */}}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <ImageIcon size={18} /> Save Variant
                                        </button>
                                        <button 
                                            onClick={handleForge}
                                            disabled={isGenerating}
                                            className="px-6 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-bold tracking-widest uppercase transition-colors"
                                        >
                                            Re-Roll
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
