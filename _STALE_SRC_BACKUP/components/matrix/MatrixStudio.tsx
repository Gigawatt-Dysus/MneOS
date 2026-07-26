import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    Info, Edit3, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut
} from 'lucide-react';
import type { Media, User, Tag } from '@/types';
import { DeepDiveIcon } from '../icons/CustomIcons';
import { MediaInspector } from './MediaInspector';
import { getMediaType } from './MatrixShared';
import { GlassButton } from '../GlassButton';
import { GigiCoreIcon } from '../icons/GigiCoreIcon';

interface MatrixStudioProps {
    index: number;
    setIndex: (i: number) => void;
    assets: Media[];
    user: User;
    onClose: () => void;
    onDeepDive: (media: Media) => void;
    onDiscuss: (media: Media) => void;
    allTags: Tag[];
    onUpdateAsset: (asset: Media) => void;
    onNavigateToTag?: (id: string) => void;
    onTagCreated?: (tag: Tag) => void;
    slides?: any;
}

// [ZEN UI] The "Precision" Tooltip Button
const TooltipButton = ({ 
    onClick, icon: Icon, label, disabled = false, active = false, customClass, iconColor, isGigi
}: any) => (
    <div className="group relative flex items-center justify-center mx-1">
        <button 
            onClick={(e) => { 
                e.stopPropagation(); 
                if (!disabled) onClick(e); 
            }}
            className={`
                relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300
                shadow-[0_4px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] 
                active:translate-y-0.5 active:shadow-none
                ${disabled 
                    ? 'opacity-30 cursor-not-allowed bg-slate-800 border border-white/5 grayscale' 
                    : active
                        ? 'ring-2 ring-white/50 scale-105 brightness-125' 
                        : 'hover:scale-110 hover:-translate-y-1 hover:brightness-110'
                }
                ${customClass || 'bg-gradient-to-b from-slate-700 to-slate-900 border border-white/10'}
            `}
        >
            {isGigi ? (
                <GigiCoreIcon className={`w-6 h-6 ${iconColor || "text-cyan-400"} drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]`} />
            ) : (
                <Icon size={20} className={iconColor || "text-slate-300"} strokeWidth={2} />
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

export const MatrixViewer: React.FC<MatrixStudioProps> = ({
    index, setIndex, assets, user, onClose, onDeepDive, onDiscuss, allTags, onUpdateAsset,
    onNavigateToTag, onTagCreated
}) => {
    const currentAsset = assets[index];
    const [sidebarMode, setSidebarMode] = useState<'none' | 'meta' | 'tags'>('none');
    
    // Zoom & Pan
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    useEffect(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, [index]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [index, assets.length]);

    const nextSlide = () => { if (index < assets.length - 1) setIndex(index + 1); else setIndex(0); };
    const prevSlide = () => { if (index > 0) setIndex(index - 1); else setIndex(assets.length - 1); };

    const toggleSidebar = (mode: 'meta' | 'tags') => {
        setSidebarMode(prev => prev === mode ? 'none' : mode);
    };

    // Zoom Engine
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY * -0.002;
        const newScale = Math.min(Math.max(1, scale + delta), 5); 
        setScale(newScale);
        if (newScale === 1) setPosition({ x: 0, y: 0 }); 
    };

    const zoomIn = () => setScale(s => Math.min(s + 0.5, 5));
    const zoomOut = () => {
        setScale(s => {
            const next = Math.max(1, s - 0.5);
            if (next === 1) setPosition({ x: 0, y: 0 });
            return next;
        });
    };

    // Pan Engine
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

    const type = getMediaType(currentAsset);
    const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    return createPortal(
        <div className="fixed inset-0 z-[100000] bg-[#050505] flex font-sans overflow-hidden">
            
            {/* === STAGE (LEFT) === */}
            <div className="flex-1 flex flex-col h-full relative min-w-0">
                
                {/* Luminous Ambient Background */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 bg-slate-900/40" />
                    <img 
                        src={currentAsset.url} 
                        className="w-full h-full object-cover opacity-60 blur-[100px] scale-150 saturate-200" 
                        alt="Ambient"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
                </div>

                {/* Header */}
                <div className="h-20 flex items-center justify-between px-8 z-50">
                    <div className="flex flex-col drop-shadow-lg">
                        <span className="text-lg font-bold text-white truncate max-w-xl tracking-tight shadow-black drop-shadow-md">
                            {currentAsset?.title || currentAsset?.originalName}
                        </span>
                        {currentAsset?.logicalDate && (
                            <span className="text-xs text-cyan-200 font-mono tracking-widest opacity-90 uppercase drop-shadow-sm">
                                {formatDate(currentAsset.logicalDate)}
                            </span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-black/30 backdrop-blur-md rounded-full px-2 py-1 border border-white/10 shadow-lg">
                            <button onClick={zoomOut} className="p-2 hover:text-white text-slate-300 transition-colors"><ZoomOut size={18}/></button>
                            <span className="text-xs font-mono w-12 text-center text-slate-200 select-none">{Math.round(scale * 100)}%</span>
                            <button onClick={zoomIn} className="p-2 hover:text-white text-slate-300 transition-colors"><ZoomIn size={18}/></button>
                        </div>

                        {/* [ZEN FIX] Enhanced Close Button */}
                        <div className="group relative">
                            <button 
                                onClick={onClose} 
                                className="p-3 bg-red-500/10 hover:bg-red-500/80 text-red-400 hover:text-white rounded-full transition-all duration-300 backdrop-blur-md border border-red-500/30 hover:border-red-500 hover:shadow-[0_0_20px_rgba(220,38,38,0.6)]"
                            >
                                <X size={32} strokeWidth={2.5} />
                            </button>
                            {/* Tooltip */}
                            <div className="absolute top-full right-0 mt-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[100] flex flex-col items-end">
                                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-black/90 mr-4"></div>
                                <div className="bg-black/90 backdrop-blur-xl border border-white/20 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest text-white shadow-2xl uppercase whitespace-nowrap">
                                    Exit to Composer
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Canvas */}
                <div 
                    className="flex-1 relative w-full h-full overflow-hidden flex items-center justify-center z-10"
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                >
                    {/* Arrows */}
                    <button onClick={(e) => {e.stopPropagation(); prevSlide();}} className="absolute left-6 p-4 rounded-full bg-black/20 hover:bg-white/20 text-white/70 hover:text-white transition-all z-40 backdrop-blur-md border border-white/5 hover:scale-110 shadow-lg">
                        <ChevronLeft size={36} />
                    </button>
                    <button onClick={(e) => {e.stopPropagation(); nextSlide();}} className="absolute right-6 p-4 rounded-full bg-black/20 hover:bg-white/20 text-white/70 hover:text-white transition-all z-40 backdrop-blur-md border border-white/5 hover:scale-110 shadow-lg">
                        <ChevronRight size={36} />
                    </button>

                    {/* Media */}
                    <div 
                        className={`relative ${isDragging ? '' : 'transition-transform duration-200 ease-out'}`}
                        style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: 'center center' }}
                    >
                        {type === 'video' ? (
                            <video src={currentAsset.url} controls className="max-h-[75vh] max-w-[90vw] shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-lg" />
                        ) : (
                            <img 
                                src={currentAsset.url} 
                                alt="Asset" 
                                draggable={false}
                                className="max-h-[75vh] max-w-[90vw] shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-lg select-none pointer-events-none" 
                            />
                        )}
                    </div>
                </div>

                {/* Footer Toolbar - Metallic & Bright */}
                <div className="h-28 flex items-center justify-center z-50 pb-4 pointer-events-none">
                    <div className="pointer-events-auto flex items-center gap-4 px-6 py-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl ring-1 ring-white/5">
                        
                        {/* 1. AI CHAT - "Gigi Eye" (Cyan/Blue Metallic) */}
                        <TooltipButton 
                            onClick={() => onDiscuss(currentAsset)} 
                            isGigi={true}
                            label="Ask Gigi" 
                            customClass="bg-gradient-to-b from-cyan-900 to-blue-950 border-cyan-400/30 hover:border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                            iconColor="text-cyan-300"
                        />

                        {/* 2. DEEP DIVE - "Abyssal Green" (Emerald Metallic) */}
                        <TooltipButton 
                            onClick={() => onDeepDive(currentAsset)} 
                            icon={DeepDiveIcon} 
                            label="Deep Dive" 
                            customClass="bg-gradient-to-b from-emerald-900 to-green-950 border-emerald-400/30 hover:border-emerald-400/60 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                            iconColor="text-emerald-300"
                        />
                        
                        <div className="w-px h-8 bg-white/10 mx-1" />
                        
                        {/* 3. METADATA - "Titanium Blue" (Blue Metallic) */}
                        <TooltipButton 
                            onClick={() => toggleSidebar('meta')} 
                            icon={Info} 
                            label="Metadata" 
                            active={sidebarMode === 'meta'}
                            customClass={`bg-gradient-to-b from-blue-900 to-indigo-950 border-blue-400/30 hover:border-blue-400/60 shadow-[0_0_15px_rgba(59,130,246,0.2)] ${sidebarMode === 'meta' ? 'ring-2 ring-blue-400 brightness-110' : ''}`}
                            iconColor="text-blue-300"
                        />

                        {/* 4. EDIT TAGS - "Nebula Purple" (Purple Metallic) */}
                        <TooltipButton 
                            onClick={() => toggleSidebar('tags')} 
                            icon={Edit3} 
                            label="Edit Tags" 
                            active={sidebarMode === 'tags'}
                            customClass={`bg-gradient-to-b from-purple-900 to-fuchsia-950 border-purple-400/30 hover:border-purple-400/60 shadow-[0_0_15px_rgba(168,85,247,0.2)] ${sidebarMode === 'tags' ? 'ring-2 ring-purple-400 brightness-110' : ''}`}
                            iconColor="text-purple-300"
                        />
                    </div>
                </div>
            </div>

            {/* === INSPECTOR (RIGHT) === */}
            {sidebarMode !== 'none' && (
                <div className="w-[400px] border-l border-white/10 bg-[#0f1219]/90 backdrop-blur-xl shrink-0 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-300 relative z-50">
                    <MediaInspector 
                        mode={sidebarMode} 
                        media={currentAsset} 
                        allTags={allTags}
                        user={user}
                        onClose={() => setSidebarMode('none')}
                        onUpdateLocal={onUpdateAsset}
                        onNavigateToTag={onNavigateToTag}
                        onTagCreated={onTagCreated}
                    />
                </div>
            )}
        </div>,
        document.body
    );
};