import React, { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import type { Media } from '../../types';
import { getPolishFilter } from '../../utils/mediaUtils';
import { formatLifeOSDate } from '../../utils/dateSanitizer';

interface AssetCardProps {
    media: Media; // [ZEN FIX] Normalized prop name to 'media'
    onClick?: () => void;
    selected?: boolean;
    onToggleSelect?: () => void;
    selectionMode?: boolean;
    viewMode?: 'grid' | 'list';
}

export const AssetCard: React.FC<AssetCardProps> = ({ 
    media, 
    onClick, 
    selected, 
    onToggleSelect, 
    selectionMode,
    viewMode = 'grid'
}) => {
    const [isHovered, setIsHovered] = useState(false);

    // Robust fallback to prevent "null" type error
    const imageUrl = media.thumbnailUrl || media.url || '';
    const title = media.title || media.originalName || "Untitled Asset";
    const dateStr = media.logicalDate 
        ? formatLifeOSDate(media.logicalDate, media.datePrecision) 
        : (media.uploadDate ? formatLifeOSDate(media.uploadDate, 'exact') : 'Unknown Date');

    // List View Layout
    if (viewMode === 'list') {
        return (
            <div 
                className={`
                    flex items-center gap-4 p-3 rounded-xl border transition-all duration-200 cursor-pointer group
                    ${selected 
                        ? 'bg-cyan-900/20 border-cyan-500/50' 
                        : 'bg-[#1a1d26] border-white/5 hover:border-white/20 hover:bg-[#252936]'}
                `}
                onClick={selectionMode ? onToggleSelect : onClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {selectionMode && (
                    <div className="flex-shrink-0" onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}>
                        {selected ? (
                            <CheckCircle2 className="w-5 h-5 text-cyan-400 fill-cyan-900/20" />
                        ) : (
                            <Circle className="w-5 h-5 text-slate-500 group-hover:text-slate-300" />
                        )}
                    </div>
                )}
                
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 bg-black/20 relative">
                    <img 
                        src={imageUrl || undefined} 
                        alt={title} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                        style={{ filter: getPolishFilter(media) }}
                    />
                    {media.adjustmentStack?.vignette && media.adjustmentStack.vignette > 0 && (
                        <div 
                            className="absolute inset-0 pointer-events-none rounded-lg"
                            style={{
                                background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${media.adjustmentStack.vignette / 100}) 100%)`,
                                zIndex: 15
                            }}
                        />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-bold truncate ${selected ? 'text-cyan-100' : 'text-slate-200'}`}>
                        {title}
                    </h4>
                    <p className="text-xs text-slate-500 truncate flex items-center gap-2">
                        <span>{dateStr}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                        <span className="uppercase">{media.fileType?.split('/')[1] || 'FILE'}</span>
                    </p>
                </div>

                <div className="text-xs text-slate-500 font-mono">
                    {media.size ? (media.size / 1024 / 1024).toFixed(2) + ' MB' : ''}
                </div>
            </div>
        );
    }

    // Grid View Layout
    return (
        <div 
            className={`
                group relative aspect-square rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 border
                ${selected 
                    ? 'border-cyan-500 ring-2 ring-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.3)]' 
                    : 'border-white/10 hover:border-white/30 hover:shadow-xl'}
                ${selectionMode ? 'hover:scale-[0.98]' : 'hover:scale-[1.02] hover:z-10'}
            `}
            onClick={selectionMode ? onToggleSelect : onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <img 
                src={imageUrl || undefined} 
                alt={title} 
                className={`
                    w-full h-full object-cover transition-transform duration-700 ease-out
                    ${isHovered ? 'scale-110' : 'scale-100'}
                    ${selected ? 'grayscale-[0.2]' : ''}
                `}
                loading="lazy"
                style={{ filter: getPolishFilter(media) }}
            />
            
            {media.adjustmentStack?.vignette && media.adjustmentStack.vignette > 0 && (
                <div 
                    className="absolute inset-0 pointer-events-none rounded-2xl animate-fade-in"
                    style={{
                        background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${media.adjustmentStack.vignette / 100}) 100%)`,
                        zIndex: 5
                    }}
                />
            )}
            
            {/* Gradient Overlay */}
            <div className={`
                absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent 
                transition-opacity duration-300 flex flex-col justify-end p-4
                ${isHovered || selected ? 'opacity-100' : 'opacity-0'}
            `}>
                <p className="text-white text-xs font-bold truncate tracking-wide drop-shadow-md">
                    {title}
                </p>
                <div className="flex justify-between items-center mt-1">
                    <p className="text-slate-300 text-[10px] font-medium truncate opacity-80">
                        {dateStr}
                    </p>
                    {media.fileType && (
                        <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded text-white backdrop-blur-sm uppercase">
                            {media.fileType.split('/')[1]}
                        </span>
                    )}
                </div>
            </div>

            {/* Selection Indicator */}
            {selectionMode && (
                <div className="absolute top-3 right-3 z-20 transition-transform duration-200" onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}>
                    <div className={`
                        w-6 h-6 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg transition-colors
                        ${selected 
                            ? 'bg-cyan-500 text-white border-none' 
                            : 'bg-black/40 border border-white/50 text-transparent hover:bg-black/60'}
                    `}>
                        <CheckCircle2 size={14} className={selected ? 'opacity-100' : 'opacity-0'} />
                    </div>
                </div>
            )}

            {/* Type Icon Badge */}
            {media.fileType?.startsWith('video/') && (
                <div className="absolute top-3 left-3 z-10 bg-black/50 backdrop-blur-md rounded-full p-1.5 border border-white/10">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </div>
            )}
        </div>
    );
};