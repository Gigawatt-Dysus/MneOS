import React, { useState } from 'react';
import { Portal } from '../Portal';
import { X, Play, Loader, ShieldOff, Image as ImageIcon, Sliders, AlertTriangle } from 'lucide-react';

interface EratoForgeModalProps {
    onClose: () => void;
}

type ForgeTier = 'light' | 'medium' | 'heavy';

const TIER_CONFIGS = {
    light: {
        model: 'bytedance/seedream-v5.0-lite/edit',
        guidance_scale: 6,
        description: 'Light / SFW / Swimwear. Preserves face naturally.'
    },
    medium: {
        model: 'bytedance/seedream-v5.0-lite/edit',
        guidance_scale: 7,
        description: 'Medium / Revealing. High prompt obedience, face remains locked.'
    },
    heavy: {
        model: 'bytedance/seedream-v4.5/edit',
        guidance_scale: 5,
        description: 'Heavy / Explicit. Uses v4.5 for high-res details. Low guidance to anchor face.'
    }
};

export const EratoForgeModal: React.FC<EratoForgeModalProps> = ({ onClose }) => {
    const [apiKey, setApiKey] = useState(import.meta.env.VITE_ATLASCLOUD_API_KEY || '');
    const [sourceUrl, setSourceUrl] = useState('');
    const [prompt, setPrompt] = useState('nude, full body, same face as source, identical facial features, same body proportions, same skin tone, same hair, photorealistic, 4k, natural lighting');
    const [tier, setTier] = useState<ForgeTier>('heavy');
    const [isGenerating, setIsGenerating] = useState(false);
    const [status, setStatus] = useState<string>('Standby');
    const [results, setResults] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!apiKey) {
            setError("API Key is required.");
            return;
        }
        if (!sourceUrl) {
            setError("Source Image URL is required.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setResults([]);
        
        try {
            const config = TIER_CONFIGS[tier];
            setStatus(`Transmitting to Atlas Cloud (${config.model})...`);

            const payload = {
                model: config.model,
                image: sourceUrl,
                prompt: prompt,
                guidance_scale: config.guidance_scale,
                num_inference_steps: 30
            };

            const response = await fetch("https://api.atlascloud.ai/api/v1/model/generateImage", {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errText}`);
            }

            const data = await response.json();
            
            // Handle instant URL return (some Atlas endpoints do this)
            if (data.url) {
                setResults([data.url]);
                setStatus('Generation Complete.');
                setIsGenerating(false);
                return;
            }

            // Handle polling (Prediction ID)
            if (data.data && data.data.id) {
                const predictionId = data.data.id;
                setStatus(`Job Accepted [ID: ${predictionId}]. Polling...`);
                await pollPrediction(predictionId);
            } else {
                throw new Error("Unexpected API Response format.");
            }

        } catch (err: any) {
            console.error("Erato Forge Error:", err);
            setError(err.message || "An unknown error occurred.");
            setStatus('Generation Failed.');
            setIsGenerating(false);
        }
    };

    const pollPrediction = async (predictionId: string) => {
        const pollUrl = `https://api.atlascloud.ai/api/v1/model/prediction/${predictionId}`;
        let isComplete = false;
        
        while (!isComplete) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const pollResponse = await fetch(pollUrl, {
                method: 'GET',
                headers: { "Authorization": `Bearer ${apiKey}` }
            });
            
            const pollData = await pollResponse.json();
            const jobStatus = pollData.data?.status;

            if (jobStatus === "completed") {
                isComplete = true;
                const outputs = pollData.data.outputs || [pollData.data.url];
                setResults(outputs.filter((url: string) => !!url));
                setStatus('Generation Complete.');
                setIsGenerating(false);
            } else if (jobStatus === "failed") {
                throw new Error(pollData.data?.error || "Silent failure on Atlas Cloud servers.");
            } else {
                setStatus(`Rendering... Status: ${jobStatus}`);
            }
        }
    };

    return (
        <Portal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                <div className="bg-slate-900 border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-900/20 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
                        <div className="flex items-center gap-3">
                            <ShieldOff className="text-purple-400 w-6 h-6" />
                            <h2 className="text-xl font-bold text-purple-100 tracking-wider font-mono">
                                ERATO FORGE <span className="text-sm text-purple-400/50">v1.0 (Rosetta Protocol)</span>
                            </h2>
                        </div>
                        <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Controls Column */}
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-white/50 uppercase tracking-widest font-mono flex items-center gap-2">
                                        Atlas API Key
                                        <span title="Only stored in memory for this session">
                                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                                        </span>
                                    </label>
                                    <input 
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="sk-..."
                                        className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none font-mono"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-white/50 uppercase tracking-widest font-mono">Source Image URL</label>
                                    <input 
                                        type="text"
                                        value={sourceUrl}
                                        onChange={(e) => setSourceUrl(e.target.value)}
                                        placeholder="https://..."
                                        className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                                    />
                                </div>

                                <div className="space-y-2 p-4 bg-black/30 border border-white/5 rounded-lg">
                                    <label className="text-xs text-white/50 uppercase tracking-widest font-mono flex items-center gap-2">
                                        <Sliders className="w-4 h-4" /> Rosetta Tier
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['light', 'medium', 'heavy'] as ForgeTier[]).map(t => (
                                            <button
                                                key={t}
                                                onClick={() => setTier(t)}
                                                className={`px-2 py-2 text-xs font-bold uppercase tracking-wider rounded border transition-all ${tier === t ? 'bg-purple-500/20 border-purple-500 text-purple-200' : 'bg-black/50 border-white/10 text-white/40 hover:bg-white/5'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-purple-300/60 font-mono mt-2">
                                        {TIER_CONFIGS[tier].description}<br/>
                                        <span className="text-white/40">Model: {TIER_CONFIGS[tier].model} | Guidance: {TIER_CONFIGS[tier].guidance_scale}</span>
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-white/50 uppercase tracking-widest font-mono">Prompt</label>
                                    <textarea 
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        rows={4}
                                        className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none resize-none font-mono"
                                    />
                                </div>

                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !sourceUrl || !apiKey}
                                    className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-white font-bold py-3 rounded shadow-lg shadow-purple-900/50 transition-all uppercase tracking-widest"
                                >
                                    {isGenerating ? <Loader className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                                    {isGenerating ? 'Forging...' : 'Initialize Forge'}
                                </button>

                                {error && (
                                    <div className="p-3 bg-red-900/30 border border-red-500/50 rounded text-red-200 text-xs font-mono">
                                        {error}
                                    </div>
                                )}
                            </div>

                            {/* Preview Column */}
                            <div className="bg-black/60 border border-white/5 rounded-lg flex flex-col items-center justify-center relative overflow-hidden min-h-[400px]">
                                {isGenerating && !results.length ? (
                                    <div className="flex flex-col items-center gap-4 text-purple-400">
                                        <Loader className="w-12 h-12 animate-spin" />
                                        <p className="font-mono text-sm tracking-widest animate-pulse">{status}</p>
                                    </div>
                                ) : results.length > 0 ? (
                                    <div className="absolute inset-0 overflow-y-auto p-4 flex flex-col gap-4">
                                        {results.map((url, i) => (
                                            <div key={i} className="relative group rounded overflow-hidden border border-white/10">
                                                <img src={url} alt="Generated Asset" className="w-full h-auto object-contain" />
                                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-end">
                                                    <a href={url} target="_blank" rel="noreferrer" className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-white backdrop-blur-md">
                                                        Open Full Res
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 text-white/20">
                                        <ImageIcon className="w-16 h-16" />
                                        <p className="font-mono text-sm tracking-widest">AWAITING TELEMETRY</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
};

export default EratoForgeModal;
