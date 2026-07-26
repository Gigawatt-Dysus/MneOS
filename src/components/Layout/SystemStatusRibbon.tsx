import React from 'react';

interface SystemStatusRibbonProps {
    isGlobalAIThinking: boolean;
    isLocalMode: boolean;
}

export const SystemStatusRibbon: React.FC<SystemStatusRibbonProps> = ({
    isGlobalAIThinking,
    isLocalMode
}) => {
    return (
        <div className="hidden md:flex px-6 h-8 justify-between items-center text-[9px] font-black text-slate-500 font-mono tracking-[0.2em] uppercase border-b border-white/5 bg-slate-950/20 backdrop-blur-md shrink-0 select-none z-40 w-full">
            <div className="flex gap-6 items-center">
                <span className="flex items-center gap-2">
                    System: 
                    <span className="text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.4)] animate-pulse font-black">
                        ONLINE
                    </span>
                </span>
                <span className="h-3 w-[1px] bg-white/10" />
                <span className="flex items-center gap-2">
                    AI Core: 
                    <span className={`font-black ${
                        isGlobalAIThinking 
                            ? "text-amber-400 animate-pulse drop-shadow-[0_0_5px_rgba(251,191,36,0.4)]" 
                            : "text-cyan-500"
                    }`}>
                        {isGlobalAIThinking ? "PROCESSING..." : "IDLE"}
                    </span>
                </span>
            </div>
            
            <div className="flex items-center gap-6">
                {isLocalMode && (
                    <span className="text-amber-500 font-black animate-pulse flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                        LOCAL ARCHIVE ONLY
                    </span>
                )}
                <span className="text-[8px] text-slate-600 font-bold lowercase tracking-wider">
                    {">"} secure core link active
                </span>
            </div>
        </div>
    );
};
