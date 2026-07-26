import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Trash2, ArrowRight, Activity, Percent, Maximize, Zap, Loader2 } from 'lucide-react';
import { aiStateBridge } from '../../utils/aiStateBridge';
import { GlassButton } from '../GlassButton';

export interface ForgePair {
    id: string;
    proxyHash: string;
    masterHash: string;
    proxyPath: string;
    masterPath: string;
    proxySize: number;
    masterSize: number;
    proxyDimensions?: { w: number, h: number };
    masterDimensions?: { w: number, h: number };
    ssimScore?: number;
    satDiff?: number;
}

interface ForgeInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    pair: ForgePair | null;
    onDecision: (decision: 'PRUNE_PROXY' | 'KEEP_PROXY' | 'SKIP' | 'DELETE_PAIR') => void;
    isProcessing?: boolean;
    isReviewAuto?: boolean;
    stats?: any;
}

export const ForgeInspector: React.FC<ForgeInspectorProps> = ({
    isOpen,
    onClose,
    pair,
    onDecision,
    isProcessing = false,
    isReviewAuto = false,
    stats
}) => {
    const [sliderValue, setSliderValue] = useState<number>(50);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Reset delete confirmation when viewing a new pair
    useEffect(() => {
        setShowDeleteConfirm(false);
    }, [pair?.id]);

    // Announce to the heartbeat that the Forge is active
    useEffect(() => {
        if (isOpen) {
            aiStateBridge.setThinking(true, "Forge Inspector Active: Waiting for Human Decision");
        } else {
            aiStateBridge.setThinking(false);
        }
        return () => aiStateBridge.setThinking(false);
    }, [isOpen]);

    if (!isOpen || !pair) return null;

    // Helper to format bytes
    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const getSSIMColor = (score?: number) => {
        if (!score) return 'text-gray-400';
        if (score >= 0.95) return 'text-emerald-400';
        if (score >= 0.70) return 'text-amber-400';
        return 'text-rose-500';
    };

    const proxyUrl = `http://localhost:3001/api/preview?filepath=${encodeURIComponent(pair.proxyPath)}`;
    const masterUrl = `http://localhost:3001/api/preview?filepath=${encodeURIComponent(pair.masterPath)}`;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/95 backdrop-blur-sm p-4 font-mono select-none">
            
            {/* Header / HUD */}
            <div className="flex-none bg-slate-900 border-b border-slate-700 p-4 flex justify-between items-center rounded-t-xl shadow-2xl">
                <div className="flex items-center space-x-4">
                    {isReviewAuto ? (
                        <Zap className="w-6 h-6 text-rose-400 animate-pulse" />
                    ) : (
                        <Zap className="w-6 h-6 text-amber-400 animate-pulse" />
                    )}
                    <div>
                        <h2 className="text-xl font-bold text-slate-100">
                            {isReviewAuto ? "Quarantine Inspector" : "Forge Inspector"}
                        </h2>
                        <div className="text-xs text-slate-400 flex space-x-4 mt-1 items-center">
                            <span title="Structural Similarity Index: >0.95 is likely compression only.">
                                SSIM: <span className={getSSIMColor(pair.ssimScore)}>{pair.ssimScore ? pair.ssimScore.toFixed(3) : 'CALCULATING...'}</span>
                            </span>
                            <span title="Average Saturation Shift: >5 usually indicates Google Auto-Enhance.">
                                SAT SHIFT: <span className="text-cyan-400">{pair.satDiff !== undefined ? pair.satDiff.toFixed(2) : '---'}</span>
                            </span>
                            {stats?.quarantineCount !== undefined && (
                                <>
                                    <div className="w-px h-3 bg-slate-700"></div>
                                    <span title="Pairs remaining to be reviewed in Quarantine" className="flex items-center text-rose-300">
                                        <Trash2 size={12} className="mr-1 opacity-70" />
                                        REMAINING: <span className="text-rose-400 ml-1 font-bold">{stats.quarantineCount.toLocaleString()}</span>
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Main Viewport */}
            <div className="flex-1 relative bg-black/50 overflow-hidden flex items-center justify-center border-x border-slate-800">
                
                {/* Image Container */}
                <div className="relative w-full h-full max-w-6xl max-h-full aspect-video select-none">
                    
                    {/* Master Layer (Bottom) */}
                    <img 
                        src={masterUrl} 
                        alt="High-Res Master"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    />
                    
                    {/* Original Watermark (Right side, behind wiper) */}
                    {sliderValue < 95 && (
                        <div className="absolute inset-y-0 right-0 w-1/2 flex items-center justify-center pointer-events-none opacity-[0.15] mix-blend-screen transition-opacity duration-500">
                            <span className="text-5xl md:text-7xl font-black text-emerald-100 tracking-[0.3em] uppercase blur-[2px] select-none drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]">
                                Original
                            </span>
                        </div>
                    )}
                    
                    {/* Proxy Layer (Top) with Clip Path for Wiper Effect */}
                    <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{ clipPath: `polygon(0 0, ${sliderValue}% 0, ${sliderValue}% 100%, 0 100%)` }}
                    >
                        <img 
                            src={proxyUrl} 
                            alt="Google Proxy"
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        />
                        {/* Enhanced Watermark (Left side, clipped by wiper) */}
                        {sliderValue > 5 && (
                            <div className="absolute inset-y-0 left-0 w-[50vw] max-w-[50%] flex items-center justify-center pointer-events-none opacity-[0.15] mix-blend-screen transition-opacity duration-500">
                                <span className="text-5xl md:text-7xl font-black text-cyan-100 tracking-[0.3em] uppercase blur-[2px] select-none drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]">
                                    Enhanced
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Wiper Handle Line */}
                    <div 
                        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] pointer-events-none"
                        style={{ left: `${sliderValue}%`, transform: 'translateX(-50%)' }}
                    >
                        {/* Center Drag Knob */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-12 bg-white rounded-md shadow-lg flex items-center justify-center pointer-events-auto cursor-ew-resize hover:scale-110 transition-transform">
                            <div className="flex space-x-1">
                                <div className="w-0.5 h-6 bg-slate-400 rounded-full"></div>
                                <div className="w-0.5 h-6 bg-slate-400 rounded-full"></div>
                            </div>
                        </div>
                    </div>

                    {/* Invisible Range Slider controlling the Wiper */}
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={sliderValue}
                        onChange={(e) => setSliderValue(Number(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-50 m-0"
                    />
                </div>

                {/* Overlays to identify sides */}
                <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-2 rounded shadow-lg pointer-events-none">
                    <p className="text-xs text-rose-400 font-bold uppercase tracking-wider mb-1">Google Proxy (-edited)</p>
                    <p className="text-slate-300 text-xs font-mono">{formatBytes(pair.proxySize)}</p>
                </div>

                <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-2 rounded shadow-lg pointer-events-none text-right">
                    <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1">High-Res Master</p>
                    <p className="text-slate-300 text-xs font-mono">{formatBytes(pair.masterSize)}</p>
                </div>
            </div>

            {/* Action Bar (Glassmorphic) */}
            <div className="flex-none bg-slate-900/40 backdrop-blur-xl border-t border-white/10 p-4 rounded-b-xl shadow-[0_-10px_40px_rgba(0,0,0,0.3)] flex justify-between items-center relative z-50">
                
                {/* Left Side: Keep Proxy */}
                <div className="flex-1 flex justify-start">
                    <GlassButton 
                        variant="primary"
                        size="lg"
                        onClick={() => onDecision('KEEP_PROXY')}
                        disabled={isProcessing}
                        className="px-8"
                        title="The filter/crop is important. Forge this look onto the master or keep the proxy."
                    >
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                        <span>Keep Creative Edit</span>
                    </GlassButton>
                </div>

                {/* Center: Skip & Delete Gate */}
                <div className="flex-none flex flex-col items-center justify-center space-y-2">
                    <div className="flex items-center space-x-3 bg-white/5 p-1.5 rounded-2xl border border-white/5 backdrop-blur-sm">
                        <GlassButton 
                            variant="ghost"
                            size="md"
                            onClick={() => onDecision('SKIP')}
                            disabled={isProcessing}
                            title="Skip this pair and leave it in staging for now."
                        >
                            <ArrowRight className="w-4 h-4" />
                            <span>Skip</span>
                        </GlassButton>

                        <div className="w-px h-6 bg-white/10"></div>

                        {!showDeleteConfirm ? (
                            <GlassButton 
                                variant="danger"
                                size="md"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isProcessing}
                                title="Both images are terrible. Hard delete both from staging entirely."
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete Pair...</span>
                            </GlassButton>
                        ) : (
                            <GlassButton 
                                variant="danger"
                                size="md"
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    onDecision('DELETE_PAIR');
                                }}
                                disabled={isProcessing}
                                className="animate-pulse shadow-[0_0_15px_rgba(225,29,72,0.3)]"
                                title="Click again to confirm hard deletion."
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Are You Sure?</span>
                            </GlassButton>
                        )}
                    </div>
                </div>

                {/* Right Side: Keep Master */}
                <div className="flex-1 flex justify-end">
                    <GlassButton 
                        variant="success"
                        size="lg"
                        onClick={() => onDecision('PRUNE_PROXY')}
                        disabled={isProcessing}
                        className="px-8"
                        title="Trash the proxy. The master is the superior sovereign asset. (This trains the auto-pruner)"
                    >
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                        <span>Prune Proxy (Keep Master)</span>
                    </GlassButton>
                </div>
            </div>
        </div>,
        document.body
    );
};
