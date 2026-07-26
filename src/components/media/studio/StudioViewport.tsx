import React, { useState, useEffect, useRef } from 'react';
import { FileText, Move, Zap, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { UniversalMedia, isVideoAsset } from './types';
import ScrapbookViewport from './ScrapbookViewport';
import TranscriptView from './TranscriptView';

interface StudioViewportProps {
    asset: UniversalMedia;
    displayUrl: string;
    viewMode: 'original' | 'polished' | 'split';
    setViewMode: (mode: 'original' | 'polished' | 'split') => void;
    sliderPos: number;
    setSliderPos: (val: number) => void;
    isDragging: boolean;
    setIsDragging: (val: boolean) => void;
    handleMove: (e: React.MouseEvent | React.TouchEvent) => void;
    polishFilter: string;
    attachedMediaObjects: any[];
    narrative: string;
    setShowMatrixPicker: (val: boolean) => void;
    handleScrapbookUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleRemoveAttachment: (id: string) => void;
    isUploading: boolean;
    isCropping: boolean;
    setIsCropping: (val: boolean) => void;
    onResurrect: () => void;
    containerRef: React.RefObject<HTMLDivElement>;
    adjustments?: Record<string, number>;
    handleAdjustment?: (key: string, val: any) => void;
}

const StudioViewport = ({
    asset,
    displayUrl,
    viewMode,
    setViewMode,
    sliderPos,
    setSliderPos,
    isDragging,
    setIsDragging,
    handleMove,
    polishFilter,
    attachedMediaObjects,
    narrative,
    setShowMatrixPicker,
    handleScrapbookUpload,
    handleRemoveAttachment,
    isUploading,
    isCropping,
    setIsCropping,
    onResurrect,
    containerRef,
    adjustments,
    handleAdjustment
}: StudioViewportProps) => {
    const isVideo = isVideoAsset(asset);
    // Read canonical `rotation` first; fall back to legacy `orientation_flag` for older records
    const orientationFlagDeg = (() => {
        const flag = (asset as any).orientation_flag;
        if (!flag) return 0;
        if (flag === 'rotate_90') return 90;
        if (flag === 'rotate_180') return 180;
        if (flag === 'rotate_270') return 270;
        const parsed = parseInt(flag, 10);
        return isNaN(parsed) ? 0 : parsed;
    })();
    const rotation = asset.rotation || orientationFlagDeg;
    const isSideways = rotation === 90 || rotation === 270;
    
    // Video elements playback states
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isAudioReady, setIsAudioReady] = useState(false);
    
    const originalVideoRef = useRef<HTMLVideoElement>(null);
    const polishedVideoRef = useRef<HTMLVideoElement>(null);

    const videoWrapperClass = isVideo 
        ? "absolute top-0 left-0 right-0 bottom-44 flex items-center justify-center" 
        : "absolute inset-0 flex items-center justify-center";

    // Web Audio API hooks for precision delay/sync (Meow Nudge)
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const delayNodeRef = useRef<DelayNode | null>(null);
    const analyserNodeRef = useRef<AnalyserNode | null>(null);
    const boundVideoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const video = polishedVideoRef.current;
        if (!video) return;

        const delayMs = adjustments?.audioDelay || 0;
        


        try {
            if (!audioContextRef.current) {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                audioContextRef.current = new AudioCtx();
            }

            const ctx = audioContextRef.current;

            // Only create source node once per physical video element instance
            if (boundVideoRef.current !== video) {
                if (audioSourceRef.current) {
                    try { audioSourceRef.current.disconnect(); } catch (err) {}
                    try { delayNodeRef.current?.disconnect(); } catch (err) {}
                    try { analyserNodeRef.current?.disconnect(); } catch (err) {}
                    audioSourceRef.current = null;
                    delayNodeRef.current = null;
                    analyserNodeRef.current = null;
                }

                video.crossOrigin = "anonymous";
                audioSourceRef.current = ctx.createMediaElementSource(video);
                boundVideoRef.current = video;
            }

            if (!delayNodeRef.current && audioSourceRef.current) {
                delayNodeRef.current = ctx.createDelay(3.0); // max delay 3 seconds
                
                // Construct Analyser Node
                analyserNodeRef.current = ctx.createAnalyser();
                analyserNodeRef.current.fftSize = 64; // 32 equalizer bands

                audioSourceRef.current.connect(delayNodeRef.current);
                delayNodeRef.current.connect(analyserNodeRef.current);
                analyserNodeRef.current.connect(ctx.destination);
                
                setIsAudioReady(true);
            } else if (delayNodeRef.current && audioSourceRef.current && analyserNodeRef.current) {
                setIsAudioReady(true);
            }

            // Resume audio context if suspended by browser security model
            if (ctx.state === 'suspended') {
                const resume = () => {
                    ctx.resume();
                    window.removeEventListener('click', resume);
                    window.removeEventListener('keydown', resume);
                };
                window.addEventListener('click', resume);
                window.addEventListener('keydown', resume);
            }

            const delaySec = Math.max(0, delayMs / 1000);
            if (delayNodeRef.current) {
                delayNodeRef.current.delayTime.setValueAtTime(delaySec, ctx.currentTime);
                console.log(`[AudioSync] Applied HEVC audio delay offset of ${delaySec}s`);
            }
        } catch (e) {
            console.error("[AudioSync] Web Audio setup failed:", e);
        }
    }, [adjustments?.audioDelay, displayUrl]);

    // Sync master/slave videos in real-time
    const syncSlaveVideo = () => {
        const master = polishedVideoRef.current;
        const slave = originalVideoRef.current;
        if (!master || !slave) return;

        // Match playback state
        if (slave.paused !== master.paused) {
            if (master.paused) {
                slave.pause();
            } else {
                slave.play().catch(() => {});
            }
        }

        // Keep timelines perfectly aligned
        if (Math.abs(slave.currentTime - master.currentTime) > 0.05) {
            slave.currentTime = master.currentTime;
        }
    };

    // Handle Master video tick events
    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = e.currentTarget;
        setCurrentTime(video.currentTime);
        
        // Sync original video in split mode
        if (viewMode === 'split') {
            syncSlaveVideo();
        }

        // Dynamic Acoustic Drift Correction (VFR alignment)
        if (delayNodeRef.current && audioContextRef.current && video.duration) {
            const baseDelay = adjustments?.audioDelay || 0;
            const drift = adjustments?.audioDrift || 0;
            const progress = video.currentTime / video.duration;
            const currentDelayMs = baseDelay + (drift * progress);
            const delaySec = Math.max(0, currentDelayMs / 1000);
            
            delayNodeRef.current.delayTime.setValueAtTime(delaySec, audioContextRef.current.currentTime);
        }
        
        // Trimming boundaries auto-loop
        const start = adjustments?.trimStart || 0;
        const end = adjustments?.trimEnd || video.duration || video.duration;
        
        if (video.currentTime < start) {
            video.currentTime = start;
        }
        if (end > start && video.currentTime >= end) {
            video.currentTime = start;
            if (video.paused) {
                video.pause();
            } else {
                video.play().catch(() => {});
            }
        }
    };

    // Loop sync checks
    useEffect(() => {
        if (viewMode === 'split' && isPlaying) {
            const interval = setInterval(syncSlaveVideo, 100);
            return () => clearInterval(interval);
        }
    }, [viewMode, isPlaying]);

    // Premium HUD notifications for precise sync feedback
    const [hudMessage, setHudMessage] = useState<string | null>(null);
    const hudTimeoutRef = useRef<number | null>(null);

    const triggerHud = (msg: string) => {
        setHudMessage(msg);
        if (hudTimeoutRef.current) window.clearTimeout(hudTimeoutRef.current);
        hudTimeoutRef.current = window.setTimeout(() => setHudMessage(null), 1200);
    };

    const jogBackward = () => {
        const video = polishedVideoRef.current;
        if (!video) return;
        video.currentTime = Math.max(0, video.currentTime - 0.04);
        triggerHud(`Jog: -1 Frame (${video.currentTime.toFixed(2)}s)`);
    };

    const jogForward = () => {
        const video = polishedVideoRef.current;
        if (!video) return;
        video.currentTime = Math.min(duration || video.duration || 100, video.currentTime + 0.04);
        triggerHud(`Jog: +1 Frame (${video.currentTime.toFixed(2)}s)`);
    };

    // Keyboard Shortcuts Listener for high-productivity audio alignment
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
                return;
            }

            const video = polishedVideoRef.current;
            if (!video) return;

            if (e.key === ',' || e.key === '<') {
                e.preventDefault();
                jogBackward();
            } else if (e.key === '.' || e.key === '>') {
                e.preventDefault();
                jogForward();
            } else if (e.key === ' ') {
                e.preventDefault();
                togglePlayback();
            } else if (e.key === '[') {
                e.preventDefault();
                if (handleAdjustment) {
                    const step = e.shiftKey ? 250 : 50;
                    const current = adjustments?.audioDelay || 0;
                    const next = Math.max(-2000, current - step);
                    handleAdjustment('audioDelay', next);
                    triggerHud(`Sync Delay: ${next > 0 ? '+' : ''}${(next / 1000).toFixed(2)}s`);
                }
            } else if (e.key === ']') {
                e.preventDefault();
                if (handleAdjustment) {
                    const step = e.shiftKey ? 250 : 50;
                    const current = adjustments?.audioDelay || 0;
                    const next = Math.min(2000, current + step);
                    handleAdjustment('audioDelay', next);
                    triggerHud(`Sync Delay: ${next > 0 ? '+' : ''}${(next / 1000).toFixed(2)}s`);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [adjustments?.audioDelay, duration, handleAdjustment]);

    // Custom Studio HUD event listener to receive notifications from external drawers
    useEffect(() => {
        const handleHudEvent = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.message) {
                triggerHud(detail.message);
            }
        };
        window.addEventListener('studio-hud' as any, handleHudEvent);
        return () => window.removeEventListener('studio-hud' as any, handleHudEvent);
    }, []);

    const togglePlayback = () => {
        const master = polishedVideoRef.current;
        if (!master) return;
        
        if (master.paused) {
            master.play().catch(() => {});
            setIsPlaying(true);
        } else {
            master.pause();
            setIsPlaying(false);
        }
    };

    // Canvas Equalizer Animation loop based on AnalyserNode data
    useEffect(() => {
        const canvas = canvasRef.current;
        const analyser = analyserNodeRef.current;
        if (!canvas || !analyser) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let animId: number;

        const draw = () => {
            animId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            // Clear visualizer surface
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw glowing vertical equalizing bars
            const barWidth = (canvas.width / bufferLength);
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height * 0.9;
                
                // Color gradient transition from cyan to purple/pink
                const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
                gradient.addColorStop(0, 'rgba(6, 182, 212, 0.7)'); // glowing cyan
                gradient.addColorStop(1, 'rgba(168, 85, 247, 0.95)'); // hyper-violet
                
                ctx.fillStyle = gradient;
                
                // Draw sleek retro equalizer bars
                ctx.fillRect(x, canvas.height - barHeight, barWidth - 1.5, barHeight);
                x += barWidth;
            }
        };

        if (isPlaying) {
            draw();
        } else {
            // Draw static glowing dot bars representing idle state
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
            const barWidth = canvas.width / bufferLength;
            for (let i = 0; i < bufferLength; i++) {
                ctx.fillRect(i * barWidth, canvas.height - 2, barWidth - 1.5, 2);
            }
        }

        return () => {
            cancelAnimationFrame(animId);
        };
    }, [isPlaying, displayUrl, isAudioReady]);

    const handleScrub = (val: number) => {
        const master = polishedVideoRef.current;
        if (!master) return;
        
        master.currentTime = val;
        setCurrentTime(val);
        syncSlaveVideo();
    };

    const formatTime = (secs: number) => {
        if (isNaN(secs) || secs === null || secs === undefined) return '00:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex-1 relative bg-black/40 flex items-center justify-center p-12 overflow-hidden select-none">
            {(asset as any).type === 'event' ? (
                <ScrapbookViewport 
                    attachedMedia={attachedMediaObjects}
                    narrative={narrative}
                    onAddFromMatrix={() => setShowMatrixPicker(true)}
                    onUpload={handleScrapbookUpload}
                    onRemoveAttachment={handleRemoveAttachment}
                    isUploading={isUploading}
                />
            ) : (asset as any).type === 'messenger_log' || (asset as any).type === 'journal' ? (
                <TranscriptView asset={asset} />
            ) : (
                <div 
                    ref={containerRef} 
                    className={`relative w-full h-full flex items-center justify-center overflow-hidden transition-all duration-300 ${viewMode === 'split' ? 'cursor-ew-resize' : 'cursor-default'}`}
                    onMouseDown={() => viewMode === 'split' && setIsDragging(true)} 
                    onMouseUp={() => setIsDragging(false)} 
                    onMouseLeave={() => setIsDragging(false)}
                    onMouseMove={handleMove} 
                    onTouchMove={handleMove} 
                    onTouchStart={() => viewMode === 'split' && setIsDragging(true)} 
                    onTouchEnd={() => setIsDragging(false)}
                >
                    {displayUrl ? (
                        <>
                            {isVideo ? (
                                <>
                                    {/* POLISHED VIDEO (Master) */}
                                    <div className={`${videoWrapperClass} transition-opacity duration-300 ${viewMode === 'original' ? 'opacity-0' : 'opacity-100'}`}>
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            <video 
                                                ref={polishedVideoRef}
                                                src={displayUrl}
                                                crossOrigin="anonymous"
                                                loop
                                                muted={!!adjustments?.muteAudio}
                                                playsInline
                                                onLoadedMetadata={(e) => {
                                                    const video = e.currentTarget;
                                                    setDuration(video.duration);
                                                    if (handleAdjustment) {
                                                        handleAdjustment('duration', video.duration);
                                                        if (adjustments && adjustments.trimEnd === undefined) {
                                                            handleAdjustment('trimEnd', video.duration);
                                                        }
                                                    }
                                                }}
                                                onTimeUpdate={handleTimeUpdate}
                                                onPlay={() => setIsPlaying(true)}
                                                onPause={() => setIsPlaying(false)}
                                                className={`object-contain rounded-sm shadow-[0_0_120px_rgba(0,0,0,0.9)] ring-1 ring-white/10 ${isSideways ? 'max-w-[100vh] max-h-[100vw]' : 'w-full h-full'}`} 
                                                style={{ filter: polishFilter, transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }} 
                                            />
                                            {adjustments?.vignette && adjustments.vignette > 0 && (
                                                <div 
                                                    className="absolute inset-0 pointer-events-none rounded-sm"
                                                    style={{
                                                        background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${adjustments.vignette / 100}) 100%)`,
                                                        zIndex: 15
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* ORIGINAL VIDEO (Slave) */}
                                    {(viewMode === 'original' || viewMode === 'split') && (
                                        <div 
                                            className={`${videoWrapperClass} transition-all duration-300`} 
                                            style={{ 
                                                clipPath: viewMode === 'split' ? `inset(0 ${100 - sliderPos}% 0 0)` : 'none', 
                                                zIndex: viewMode === 'original' ? 20 : 10 
                                            }}
                                        >
                                            <video 
                                                ref={originalVideoRef}
                                                src={displayUrl}
                                                crossOrigin="anonymous"
                                                loop
                                                muted // Always muted to avoid echo feedback
                                                playsInline
                                                className={`object-contain rounded-sm pointer-events-none ${isSideways ? 'max-w-[100vh] max-h-[100vw]' : 'w-full h-full'}`} 
                                                style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }}
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* STATIC IMAGE VIEWS */}
                                    <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${viewMode === 'original' ? 'opacity-0' : 'opacity-100'}`}>
                                        <div className="relative max-w-full max-h-full flex items-center justify-center">
                                            <img 
                                                src={displayUrl} 
                                                alt="enhanced" 
                                                draggable={false} 
                                                className={`object-contain rounded-sm shadow-[0_0_120px_rgba(0,0,0,0.9)] ring-1 ring-white/10 pointer-events-none ${isSideways ? 'max-w-[80vh] max-h-[80vw]' : 'max-w-full max-h-full'}`} 
                                                style={{ filter: polishFilter, transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }} 
                                            />
                                            {adjustments?.vignette && adjustments.vignette > 0 && (
                                                <div 
                                                    className="absolute inset-0 pointer-events-none rounded-sm"
                                                    style={{
                                                        background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${adjustments.vignette / 100}) 100%)`,
                                                        zIndex: 15
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    {(viewMode === 'original' || viewMode === 'split') && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300" style={{ clipPath: viewMode === 'split' ? `inset(0 ${100 - sliderPos}% 0 0)` : 'none', zIndex: viewMode === 'original' ? 20 : 10 }}>
                                            <img src={displayUrl} alt="original" draggable={false} className={`object-contain rounded-sm opacity-100 pointer-events-none ${isSideways ? 'max-w-[80vh] max-h-[80vw]' : 'max-w-full max-h-full'}`} style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }} />
                                        </div>
                                    )}
                                </>
                            )}
                            {viewMode === 'split' && (
                                <div className="absolute top-0 bottom-0 w-[1px] bg-cyan-400 z-30 pointer-events-none shadow-[0_0_20px_rgba(6,182,212,0.6)]" style={{ left: `${sliderPos}%` }}>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-cyan-500 rounded-full border-4 border-[#020617] shadow-2xl flex items-center justify-center">
                                        <div className="flex gap-1">
                                            <div className="w-[1px] h-3 bg-white/40" />
                                            <div className="w-[1px] h-3 bg-white/40" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-slate-800">
                            <FileText size={100} className="opacity-10" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Artifact Null</span>
                        </div>
                    )}
                </div>
            )}

            {/* HUD Status Notification Overlay */}
            {hudMessage && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-5 py-2.5 bg-black/80 backdrop-blur-md border border-cyan-500/20 text-cyan-400 text-[10px] font-mono font-black uppercase tracking-widest rounded-2xl z-50 pointer-events-none shadow-2xl animate-in fade-in scale-in duration-200">
                    {hudMessage}
                </div>
            )}

            {/* Custom Video Playback Toolbar Overlay */}
            {isVideo && displayUrl && (
                <div className="absolute bottom-28 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3.5 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl z-40 shadow-2xl w-[90%] max-w-2xl animate-in slide-in-from-bottom-5 duration-300">
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button 
                            onClick={jogBackward}
                            title="Jog Back 1 Frame (,)"
                            className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all active:scale-90"
                        >
                            <SkipBack size={12} />
                        </button>
                        
                        <button 
                            onClick={togglePlayback}
                            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                            className="p-2.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl transition-all active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                        >
                            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                        </button>
                        
                        <button 
                            onClick={jogForward}
                            title="Jog Forward 1 Frame (.)"
                            className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all active:scale-90"
                        >
                            <SkipForward size={12} />
                        </button>
                    </div>
                    
                    <div className="text-[10px] font-mono text-slate-400 select-none shrink-0">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>

                    {/* Compact real-time Audio VU peak visualizer */}
                    <div className="flex flex-col items-center bg-black/60 border border-white/10 rounded-xl px-2 py-0.5 shrink-0 shadow-inner">
                        <canvas 
                            ref={canvasRef} 
                            width={70} 
                            height={16} 
                            className="w-[70px] h-4"
                        />
                        <span className="text-[5px] font-black tracking-widest text-slate-500 uppercase leading-none select-none">VU Peak</span>
                    </div>
                    
                    <div className="flex-1 flex items-center relative group/timeline">
                        {/* Trim visual indicator track */}
                        <div className="absolute inset-x-0 h-1 bg-white/5 rounded-full pointer-events-none" />
                        
                        {/* Visual highlight representing the trim window */}
                        {(() => {
                            const startPercent = duration > 0 ? ((adjustments?.trimStart || 0) / duration) * 100 : 0;
                            const endPercent = duration > 0 ? ((adjustments?.trimEnd || duration) / duration) * 100 : 100;
                            return (
                                <div 
                                    className="absolute h-1 bg-cyan-500/20 rounded-full pointer-events-none" 
                                    style={{ left: `${startPercent}%`, right: `${100 - endPercent}%` }}
                                />
                            );
                        })()}
                        
                        <input 
                            type="range"
                            min={0}
                            max={duration || 100}
                            step="0.05"
                            value={currentTime}
                            onChange={(e) => handleScrub(parseFloat(e.target.value))}
                            className="w-full h-1 bg-transparent rounded-full appearance-none accent-cyan-500 cursor-pointer relative z-10"
                        />
                    </div>
                </div>
            )}

            {/* Viewport Toolbar */}
            {!((asset as any).type === 'event' || (asset as any).type === 'messenger_log' || (asset as any).type === 'journal') && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl z-40 shadow-2xl">
                    <button 
                        onClick={() => setIsCropping(true)}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                    >
                        <Move size={14} />
                        Crop
                    </button>
                    <div className="w-[1px] h-4 bg-white/10" />
                    <button 
                        onClick={() => onResurrect()}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-cyan-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-cyan-400 transition-all"
                    >
                        <Zap size={14} />
                        Neural Resurrect
                    </button>
                </div>
            )}
        </div>
    );
};

export default StudioViewport;
