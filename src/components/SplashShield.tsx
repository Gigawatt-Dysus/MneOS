import React, { useEffect, useState } from 'react';
import { Terminal, Shield, Cpu, Activity, Zap } from 'lucide-react';

interface SplashShieldProps {
    isVisible: boolean;
    eventsCount?: number;
    tagsCount?: number;
    mediaCount?: number;
    vertsCount?: number;
}

const CHRONO_MESSAGES = [
    "Synchronizing MneOS Cognitive Core...",
    "Aligning Personality Islands...",
    "Buffering Neural Matrix...",
    "Calibrating Chrono-Link...",
    "Establishing Secure Archivist Bridge...",
    "Harmonizing Temporal Frequency...",
    "Stabilizing Quantum Entanglement...",
    "Defragmenting Core Memories...",
    "Scanning Social Vertices...",
    "Initializing Sovereign Guard..."
];

const MAINTENANCE_MESSAGES = [
    "Optimizing Synaptic Pathways...",
    "Pruning Redundant Narrative Threads...",
    "Indexing Temporal Nodes...",
    "Polishing the Matrix Grid...",
    "Cleaning Chrono-Link Dust...",
    "Rerouting Tachyons...",
    "Refreshing Neural Cache...",
    "Hardening Sovereign Encryption..."
];

export const SplashShield: React.FC<SplashShieldProps> = ({ 
    isVisible, 
    eventsCount = 0, 
    tagsCount = 0, 
    mediaCount = 0,
    vertsCount = 0
}) => {
    const [messages, setMessages] = useState<string[]>([]);
    const [localVisible, setLocalVisible] = useState(true);
    const [shouldRender, setShouldRender] = useState(true);
    const mountTime = React.useRef(Date.now());

    // Minimum display duration and fade logic
    useEffect(() => {
        const MIN_DURATION = 4500; // 4.5 seconds minimum display time
        
        if (!isVisible) {
            const timeElapsed = Date.now() - mountTime.current;
            const delay = Math.max(0, MIN_DURATION - timeElapsed);
            
            const hideTimer = setTimeout(() => {
                setLocalVisible(false); // Trigger CSS fade out
                setTimeout(() => setShouldRender(false), 1000); // Unmount after fade
            }, delay);
            
            return () => clearTimeout(hideTimer);
        } else {
            setLocalVisible(true);
            setShouldRender(true);
        }
    }, [isVisible]);

    // BIOS Console Message Stream
    useEffect(() => {
        if (!localVisible) return;

        let currentIndex = 0;
        const initialBatch = [...CHRONO_MESSAGES];

        const interval = setInterval(() => {
            setMessages(prev => {
                let nextMsg = "";
                if (currentIndex < initialBatch.length) {
                    nextMsg = initialBatch[currentIndex];
                } else {
                    // [ZEN] Infinite Telemetry & Maintenance Loop
                    const isTelemetry = Math.random() > 0.6;
                    if (isTelemetry) {
                        const types = ['Events', 'Tags', 'Media', 'Vertices'];
                        const type = types[Math.floor(Math.random() * types.length)];
                        const count = type === 'Events' ? eventsCount : 
                                      type === 'Tags' ? tagsCount : 
                                      type === 'Media' ? mediaCount : vertsCount;
                        nextMsg = `Hydrating ${type}... (${count} nodes synced)`;
                    } else {
                        nextMsg = MAINTENANCE_MESSAGES[Math.floor(Math.random() * MAINTENANCE_MESSAGES.length)];
                    }
                }
                currentIndex++;
                return [...prev.slice(-12), nextMsg];
            });
        }, 500); // Sped up slightly for a denser waterfall effect

        return () => clearInterval(interval);
    }, [localVisible, eventsCount, tagsCount, mediaCount, vertsCount]);

    if (!shouldRender) return null;

    return (
        <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-end transition-opacity duration-1000 overflow-hidden ${localVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            
            {/* Titaness Splash Image */}
            <div 
                className="absolute inset-0 z-0 bg-cover bg-top bg-no-repeat scale-[1.02] origin-top animate-in fade-in duration-1000"
                style={{ backgroundImage: `url("/assets/Mnemosyne%20Avatars/MneOS%202-0__Splash_Screen__01.jpg")` }}
            >
                {/* Gradient vignette to ground the text at her feet */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90" />
            </div>

            {/* Ghostly Console Window at Feet */}
            <div className="relative z-10 w-full max-w-2xl px-6 pb-12">
                {/* Console Content */}
                <div className="font-mono text-[11px] leading-relaxed text-center">
                    <div className="space-y-1.5 h-40 overflow-hidden flex flex-col justify-end">
                        {messages.map((msg, i) => (
                            <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-700">
                                <span className={i === messages.length - 1 ? "text-cyan-100 font-bold tracking-widest drop-shadow-[0_0_8px_rgba(0,255,255,0.8)] text-[12px]" : "text-cyan-100/40 tracking-wider"}>
                                    {msg}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Hardware Stats Footer */}
                    <div className="flex justify-center gap-6 pt-6 mt-6 border-t border-cyan-500/20 text-[9px] text-cyan-200/50 tracking-[0.2em] uppercase">
                        <div className="flex items-center gap-2">
                            <Cpu size={12} className="text-cyan-400/60 animate-pulse" />
                            <span>CPU: ACTIVE</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Activity size={12} className="text-cyan-400/60 animate-pulse" />
                            <span>NET: HYDRATING</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Zap size={12} className="text-cyan-400/60" />
                            <span>PWR: OPTIMAL</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Shield size={12} className="text-cyan-400/60" />
                            <span>SSL: SECURE</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ghostly Loading Bar */}
            <div className="absolute bottom-0 left-0 h-1 w-full bg-transparent z-10">
                <div className="h-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent animate-pulse w-full" />
            </div>
        </div>
    );
};
