import React from 'react';
import { GigiCoreIcon } from '../icons/GigiCoreIcon';

export const TooltipButton = ({ 
    onClick, icon: Icon, label, disabled = false, active = false, customClass, iconColor, isGigi, badgeCount
}: any) => (
    <div className="group relative flex items-center justify-center mx-1">
        <button 
            onClick={(e) => { 
                e.stopPropagation(); 
                if (!disabled) onClick(e); 
            }}
            className={`
                relative overflow-hidden flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300
                ${disabled 
                    ? 'opacity-30 cursor-not-allowed bg-black/20 shadow-none grayscale' 
                    : active
                        ? 'bg-white/10 backdrop-blur-md shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] border border-white/20 scale-95' 
                        : 'bg-black/30 backdrop-blur-sm border border-white/5 shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:bg-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:border-white/30 hover:-translate-y-1'
                }
                ${customClass || ''}
                group/button
            `}
        >
            {/* Hover Shimmer Effect */}
            {!disabled && <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover/button:animate-[shimmer_1s_ease-out] pointer-events-none" />}
            {isGigi ? (
                <GigiCoreIcon className={`w-6 h-6 ${iconColor || "text-cyan-400"} drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]`} />
            ) : (
                <Icon className={`w-[22px] h-[22px] ${iconColor || "text-slate-300"}`} strokeWidth={1.5} />
            )}
            
            {badgeCount > 0 && (
                <div className="absolute -top-1.5 -right-1.5 bg-fuchsia-600 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center border border-fuchsia-300/30 shadow-[0_0_10px_rgba(217,70,239,0.5)] z-20">
                    {badgeCount}
                </div>
            )}
        </button>
        
        {!active && (
            <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[100] flex flex-col items-center">
                <div className="bg-black/90 backdrop-blur-xl border border-white/20 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest text-white shadow-2xl uppercase whitespace-nowrap">
                    {label}
                </div>
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black/90 mt-[-1px]"></div>
            </div>
        )}
    </div>
);
