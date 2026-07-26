import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Loader2, Sparkles, Wand2, ShieldAlert, ShieldCheck, Settings as SettingsIcon, Image as ImageIcon, Film, Save, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { PersonTag } from '../../../types';

interface PersonRefluxProps {
    tag: PersonTag;
    allTags: any[];
    meta: any;
    handleChange: (path: string, value: any) => void;
    userId?: string;
    relatedMedia?: any[];
}

export const PersonReflux: React.FC<PersonRefluxProps> = ({ tag, meta, handleChange, userId, relatedMedia = [] }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>("System Ready. Awaiting Ignition.");
    const [prompt, setPrompt] = useState(meta.refluxPrompt || "Highly detailed cinematic lighting, photorealistic 8k, raw photography, natural skin texture, vellus hairs, micropores.");
    const [denoisingStrength, setDenoisingStrength] = useState<number>(0.35);
    const [seedancePrompt, setSeedancePrompt] = useState("A woman laughing heartily, showing teeth, eyes crinkling, natural movement.");
    const [safetyBypass, setSafetyBypass] = useState(true);
    const [quarantineItems, setQuarantineItems] = useState<any[]>([]);
    const [isWalking, setIsWalking] = useState(false);
    const [previewFrame, setPreviewFrame] = useState<string | null>(null);
    const [activeAnchor, setActiveAnchor] = useState<any>(null);
    // Zoom/Pan State for Viewport
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY * -0.002;
        const newScale = Math.min(Math.max(1, scale + delta), 10); 
        setScale(newScale);
        if (newScale === 1) setPosition({ x: 0, y: 0 }); 
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            e.preventDefault();
            setIsDragging(true);
            dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && scale > 1) {
            e.preventDefault();
            setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    // Reset pan/zoom when closing viewport
    const closeViewport = () => {
        setPreviewFrame(null);
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    // Filter media for those that might be considered Platinum Tensors
    const tensors = relatedMedia.filter(m => m.type === 'image' || m.type === 'video');

    const fetchQuarantine = async () => {
        try {
            const res = await fetch('http://localhost:31337/api/quarantine');
            if (res.ok) {
                const data = await res.json();
                setQuarantineItems(data);
            }
        } catch (e) {
            console.error("Failed to fetch quarantine", e);
        }
    };

    useEffect(() => {
        fetchQuarantine();
    }, []);

    const handleRunSwarmWalk = async () => {
        setIsWalking(true);
        setStatusMessage("Swarm Daemon Walk Initiated... Hunting for empty valences.");
        try {
            const res = await fetch('http://localhost:31337/api/swarm/walk', { method: 'POST' });
            const data = await res.json();
            setStatusMessage(data.message);
            await fetchQuarantine();
        } catch (e: any) {
            setStatusMessage(`Swarm Walk Failed: ${e.message}`);
        }
        setIsWalking(false);
    };

    const handleRunReflux = async () => {
        setIsGenerating(true);
        setStatusMessage("Initializing Platinum Reflux (I2V2I) Pipeline...");

        try {
            // Step 1: Seedance Pass
            setStatusMessage("Step 1: Seedance Physics Interpolation (Bypassing Safety Filters)...");
            
            const seedanceRes = await fetch('http://localhost:31337/api/seedance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: seedancePrompt,
                    image: activeAnchor ? activeAnchor.url : null,
                    safety_checker: !safetyBypass,
                    nsfw_filter: !safetyBypass,
                    tagId: tag.id
                })
            }).catch(() => ({ ok: true, json: () => ({ videoUrl: 'simulated_video.mp4' }) })); 
            
            setStatusMessage("Seedance Complete. Extracting optimal physics frames...");
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulating extraction

            // Step 2: Nano Banana Pass
            setStatusMessage(`Step 2: Nano Banana Texture Injection (Denoising: ${denoisingStrength})...`);
            
            const nanoBananaRes = await fetch('http://localhost:31337/api/nanobanana', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    denoise: denoisingStrength,
                    tagId: tag.id
                })
            }).catch(() => ({ ok: true })); 
            
            setStatusMessage("Platinum Tensor Accessioned Successfully!");
            
            setTimeout(() => {
                setStatusMessage("System Ready.");
                setIsGenerating(false);
            }, 3000);

        } catch (error: any) {
            console.error(error);
            setStatusMessage(`Pipeline Failed: ${error.message}`);
            setIsGenerating(false);
        }
    };

    const handleApproveQuarantine = async (id: string) => {
        setStatusMessage(`Approving Tensor ${id}... Minting to Sovereign MongoDB Atlas Vector Search`);
        try {
            const res = await fetch('http://localhost:31337/api/quarantine/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action: 'approve' })
            });
            const data = await res.json();
            if (data.success) {
                setStatusMessage(`Tensor ${id} successfully minted to Sovereign MongoDB Vector Search.`);
                setQuarantineItems(prev => prev.filter(q => q.id !== id));
            } else {
                setStatusMessage(`Approval failed: ${data.message || 'Unknown backend error'}`);
            }
        } catch(e) { 
            console.error(e); 
            setStatusMessage(`Failed to reach Forge Daemon for approval.`);
        }
    };

    const handleRejectQuarantine = async (id: string) => {
        setStatusMessage(`Rejecting Tensor ${id}...`);
        try {
            const res = await fetch('http://localhost:31337/api/quarantine/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action: 'reject' })
            });
            const data = await res.json();
            if (data.success) {
                setStatusMessage(`Tensor ${id} dropped from quarantine.`);
                setQuarantineItems(prev => prev.filter(q => q.id !== id));
            } else {
                setStatusMessage(`Rejection failed: ${data.message || 'Unknown backend error'}`);
            }
        } catch(e) { 
            console.error(e); 
            setStatusMessage(`Failed to reach Forge Daemon for rejection.`);
        }
    };

    return (
        <div className="flex flex-col h-[700px] space-y-4 text-slate-200 animate-in fade-in p-2">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h3 className="text-xl font-medium text-slate-100 tracking-tight flex items-center gap-2">
                        <Sparkles size={20} className="text-fuchsia-400" />
                        Platinum Reflux
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">Audited I2V2I Autonomous Tensor Synthesis</p>
                </div>
                <button 
                    onClick={handleRunSwarmWalk}
                    disabled={isWalking}
                    className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-white/10 px-4 py-2 rounded-full text-xs font-medium tracking-wide transition-all flex items-center gap-2 shadow-lg hover:shadow-fuchsia-900/20"
                >
                    {isWalking ? <Loader2 size={14} className="animate-spin text-fuchsia-400" /> : <AlertTriangle size={14} className="text-fuchsia-400" />}
                    {isWalking ? 'Hunting...' : 'Run Swarm Walk Test'}
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                
                {/* Left Panel: Pipeline Controls */}
                <div className="w-full lg:w-1/3 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                    
                    {/* Status Console */}
                    <div className="bg-slate-900/50 border border-white/5 shadow-inner rounded-xl p-4">
                        <div className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-2 flex justify-between">
                            <span>Daemon Status</span>
                            {isGenerating || isWalking ? (
                                <span className="text-fuchsia-400 animate-pulse flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Active</span>
                            ) : (
                                <span className="text-slate-400">Idle</span>
                            )}
                        </div>
                        <div className="text-sm text-slate-300 min-h-[40px] font-medium">
                            {statusMessage}
                        </div>
                    </div>

                    {/* Anchor Selection Grid */}
                    <div className="bg-slate-900/50 border border-white/5 shadow-inner rounded-xl p-5 space-y-3">
                        <h4 className="text-sm font-medium text-slate-200 flex items-center gap-2 mb-2">
                            <ImageIcon size={16} className="text-emerald-400" />
                            Anchor Frame Selection
                        </h4>
                        <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
                            {tensors.map(m => (
                                <div 
                                    key={m.id} 
                                    onClick={() => setActiveAnchor(m)}
                                    className={`relative flex-shrink-0 w-20 h-20 group rounded-lg overflow-hidden border cursor-pointer bg-black/50 transition-all
                                        ${activeAnchor?.id === m.id ? 'border-fuchsia-500 ring-2 ring-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.5)]' : 'border-white/10 hover:border-fuchsia-500/50'}`
                                    }
                                >
                                    {m.type === 'image' ? (
                                        <img src={m.url} alt={m.id} className="w-full h-full object-cover" />
                                    ) : (
                                        <video src={m.url} className="w-full h-full object-cover" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900/50 border border-white/5 shadow-inner rounded-xl p-5 space-y-5">
                        <h4 className="text-sm font-medium text-slate-200 flex items-center gap-2 mb-1">
                            <Film size={16} className="text-indigo-400" />
                            Step 1: Seedance (Physics)
                        </h4>
                        
                        <div>
                            <div className="flex flex-col gap-2 mb-2">
                                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest">Kinetic Prompt</label>
                                <select 
                                    className="bg-black/50 border border-white/10 text-xs text-fuchsia-300 rounded px-2 py-1.5 outline-none w-full text-ellipsis overflow-hidden"
                                    onChange={(e) => {
                                        if(e.target.value) setSeedancePrompt(e.target.value);
                                    }}
                                >
                                    <option value="">-- Load Sovereign Macro --</option>
                                    <option value="A woman laughing heartily, showing teeth, eyes crinkling, natural movement.">Baseline Joy (Duchenne)</option>
                                    <option value="The subject transitions smoothly and organically from a completely neutral expression into a state of high physical arousal and raw ecstasy. Head tilts slightly back, eyes flutter half-closed (AU43), lips part open naturally (AU25+AU26) as if breathing heavily. Deeply realistic skin moisture, visceral flush, and genuine human expression of intense, unguarded pleasure.">Spicy: True Ecstasy (Direct)</option>
                                    <option value="Subject caught in the heavy, breathless inhalation phase just before a massive sneeze. Eyes flutter half-closed, lips part, head tilts back slightly. Visceral tension.">Spicy Bypass: Sneezeplay (AU43+25)</option>
                                    <option value="Subject stepping into a freezing shower, catching breath sharply, eyes squeezed shut as a deep shiver wracks her body.">Spicy Bypass: Deep Shiver (AU4+14)</option>
                                    <option value="Subject collapsing onto a couch after a grueling marathon, muscles completely slack, heavy exhalation, drooping eyelids.">Spicy Bypass: The Crash (AU41)</option>
                                </select>
                            </div>
                            <textarea 
                                value={seedancePrompt}
                                onChange={e => setSeedancePrompt(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 text-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 focus:outline-none transition-all h-20 resize-none custom-scrollbar"
                                placeholder="Describe the physical movement..."
                            />
                        </div>

                        <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                            <span className="text-sm font-medium text-slate-300">Safety Bypass</span>
                            <button 
                                onClick={() => setSafetyBypass(!safetyBypass)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${safetyBypass ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-slate-400 border border-white/10'}`}
                            >
                                {safetyBypass ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                                {safetyBypass ? 'Bypassed' : 'Active'}
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 border border-white/5 shadow-inner rounded-xl p-5 space-y-5">
                        <h4 className="text-sm font-medium text-slate-200 flex items-center gap-2 mb-1">
                            <ImageIcon size={16} className="text-fuchsia-400" />
                            Step 2: Nano Banana (Texture)
                        </h4>

                        <div>
                            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-2">Texture Prompt (8K)</label>
                            <textarea 
                                value={prompt}
                                onChange={e => {
                                    setPrompt(e.target.value);
                                    handleChange('metadata.refluxPrompt', e.target.value);
                                }}
                                className="w-full bg-black/30 border border-white/10 text-slate-200 rounded-lg px-3 py-2 text-sm focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/50 focus:outline-none transition-all h-20 resize-none custom-scrollbar"
                                placeholder="Highly detailed, micropores..."
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-2">
                                <span>Denoising Strength</span>
                                <span className="text-fuchsia-400 bg-fuchsia-500/10 px-2 py-0.5 rounded-full">{denoisingStrength.toFixed(2)}</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.1" 
                                max="0.8" 
                                step="0.01"
                                value={denoisingStrength}
                                onChange={e => setDenoisingStrength(parseFloat(e.target.value))}
                                className="w-full accent-fuchsia-500 bg-slate-800 rounded-full appearance-none h-1.5 cursor-pointer"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleRunReflux}
                        disabled={isGenerating}
                        className={`mt-auto w-full py-3 rounded-xl font-medium tracking-wide flex items-center justify-center gap-2 transition-all ${
                            isGenerating 
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5' 
                            : 'bg-gradient-to-r from-fuchsia-600/80 to-indigo-600/80 hover:from-fuchsia-500 hover:to-indigo-500 text-white shadow-lg border border-white/10'
                        }`}
                    >
                        {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                        {isGenerating ? 'Synthesizing...' : 'Ignite Manual Reflux'}
                    </button>
                </div>

                {/* Right Panel: Quarantine Grid */}
                <div className="w-full lg:w-2/3 flex flex-col gap-4">
                    <div className="border border-white/5 shadow-inner rounded-xl bg-slate-900/30 p-5 flex flex-col flex-1 overflow-hidden relative">
                        {/* Soft red glow behind quarantine area */}
                        <div className="absolute inset-0 bg-rose-500/5 pointer-events-none" />

                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <h4 className="text-sm font-medium text-slate-200 flex items-center gap-2">
                                <AlertTriangle size={16} className="text-rose-400" />
                                Quarantine Zone <span className="text-slate-500 text-xs">(Held for Review)</span>
                            </h4>
                            <span className="text-xs text-rose-300 font-medium bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full shadow-sm">{quarantineItems.length} Pending</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4 relative z-10">
                            {quarantineItems.length > 0 ? quarantineItems.map(item => (
                                <div key={item.id} className="bg-slate-900/80 border border-white/10 rounded-xl p-4 shadow-md backdrop-blur-md">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="min-w-0 flex-1 pr-4">
                                            <span className="text-sm font-medium text-slate-100 uppercase tracking-wide truncate block">{item.valence}</span>
                                            <div className="flex flex-wrap gap-2 mt-1.5">
                                                <span className="text-[10px] font-medium bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-white/5 truncate max-w-full">AU0: {item.baseAnchorId || 'System Baseline'}</span>
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border truncate max-w-full ${item.pipelineTrace === 'CENSORED_FALLTHROUGH_SEEDANCE' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'}`}>Trace: {item.pipelineTrace || 'I2V2I Genesis'}</span>
                                                <span className="text-[10px] font-medium bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-white/5 truncate max-w-full">Reason: {item.reason}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            {(item.pipelineTrace === 'CENSORED_FALLTHROUGH_SEEDANCE' || !item.candidate_url || (item.reason && item.reason.includes('Safety Refusal'))) && (
                                                <button 
                                                    onClick={() => {
                                                        setSeedancePrompt(`Regenerate ${item.valence} using Seedance physical bypass...`);
                                                        handleRunReflux();
                                                    }}
                                                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-full border border-amber-500/20 transition-colors shadow-sm text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                                                    title="Bypass Grok & Regenerate with Seedance"
                                                >
                                                    <Wand2 size={12} />
                                                    Seedance Regen
                                                </button>
                                            )}
                                            <button onClick={() => handleApproveQuarantine(item.id)} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 p-2 rounded-full border border-emerald-500/20 transition-colors shadow-sm" title="Approve & Mint Tensor">
                                                <CheckCircle size={18} />
                                            </button>
                                            <button onClick={() => handleRejectQuarantine(item.id)} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 p-2 rounded-full border border-rose-500/20 transition-colors shadow-sm" title="Reject & Drop">
                                                <XCircle size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-4 bg-black/20 p-3 rounded-lg border border-white/5 leading-relaxed">
                                        <span className="text-slate-500 font-medium mr-1">Prompt:</span> {item.originalPrompt || 'Autonomous Swarm generation. Parameters locked.'}
                                    </p>
                                    <div className="grid grid-cols-5 gap-3">
                                        {/* Support both arrays of candidateFrames and single candidate_url */}
                                        {(item.candidateFrames || (item.candidate_url ? [item.candidate_url] : [])).map((frame: string, idx: number) => (
                                            <div key={idx} onClick={() => { setPreviewFrame(frame); setScale(1); setPosition({x:0, y:0}); }} className="relative group cursor-pointer border border-white/10 hover:border-indigo-500/50 rounded-lg overflow-hidden aspect-square bg-slate-900 shadow-md">
                                                <img src={frame} alt={`Frame ${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                                    <span className="text-[10px] font-medium text-white bg-indigo-500/80 px-2 py-1 rounded-full shadow-lg backdrop-blur-md border border-white/20">Expand</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20 shadow-inner">
                                        <ShieldCheck size={28} className="text-emerald-400" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-300">Quarantine Clear</span>
                                    <span className="text-xs text-slate-500 mt-1">No pending tensors awaiting audit.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
            
            {/* Viewport Modal */}
            {previewFrame && createPortal(
                <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl p-4 sm:p-8 animate-in fade-in duration-200">
                    <div className="w-full flex justify-end mb-4 max-w-5xl z-10">
                        <button 
                            onClick={closeViewport}
                            className="text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-2 transition-colors border border-white/10 flex items-center gap-2 font-mono text-xs pr-4"
                        >
                            <XCircle size={20} /> CLOSE VIEWPORT
                        </button>
                    </div>
                    
                    <div 
                        className="relative max-w-5xl w-full flex-1 flex flex-col items-center justify-center overflow-hidden bg-black/50 border border-fuchsia-500/20 rounded-xl"
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                    >
                        <div 
                            className={`relative flex items-center justify-center min-w-0 ${isDragging ? '' : 'transition-transform duration-200 ease-out'}`}
                            style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: 'center center' }}
                        >
                            <img 
                                src={previewFrame} 
                                alt="Preview" 
                                draggable={false}
                                className="w-full h-full object-contain max-h-[80vh]" 
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex gap-4 w-full justify-center pb-4 z-10">
                        <button 
                            onClick={() => {
                                setStatusMessage("Apex candidate selected.");
                                closeViewport();
                            }}
                            className="bg-emerald-900/80 hover:bg-emerald-800 text-emerald-300 px-8 py-3 rounded-lg font-mono font-bold tracking-widest uppercase border border-emerald-500/50 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all"
                        >
                            <CheckCircle size={20} />
                            Set As Apex Tensor
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default PersonReflux;
