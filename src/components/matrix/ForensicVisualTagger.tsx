import React, { useState, useRef, useEffect } from 'react';
import { WikiTagEditor } from '../shared/WikiTagEditor';

export interface BoundingBox {
    id: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    width: number; // percentage 0-100
    height: number; // percentage 0-100
    tagId?: string;
    tagName?: string;
    tagType?: string;
}

interface ForensicVisualTaggerProps {
    src: string;
    userId: string;
    existingBoxes?: BoundingBox[];
    onChange?: (boxes: BoundingBox[]) => void;
    imageStyle?: React.CSSProperties;
}

export const ForensicVisualTagger: React.FC<ForensicVisualTaggerProps> = ({ src, userId, existingBoxes = [], onChange, imageStyle }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [boxes, setBoxes] = useState<BoundingBox[]>(existingBoxes);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentRect, setCurrentRect] = useState<{x: number, y: number, w: number, h: number} | null>(null);
    const [taggingBoxId, setTaggingBoxId] = useState<string | null>(null);
    const [tempTagInput, setTempTagInput] = useState('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const prevBoxesRef = useRef<string>('');

    useEffect(() => {
        const boxesStr = JSON.stringify(existingBoxes);
        if (boxesStr !== prevBoxesRef.current) {
            // Only update local boxes if the actual DB state changed (ignoring reference identity)
            // But we must preserve the current tagging box if it exists
            const dbBoxes = existingBoxes;
            setBoxes(prev => {
                if (taggingBoxId) {
                    const activeBox = prev.find(b => b.id === taggingBoxId);
                    return activeBox ? [...dbBoxes, activeBox] : dbBoxes;
                }
                return dbBoxes;
            });
            prevBoxesRef.current = boxesStr;
        }
    }, [existingBoxes, taggingBoxId]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // If we are currently tagging a box, ignore new draws
        if (taggingBoxId) return;
        
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        
        // Calculate percentages
        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
        const yPct = ((e.clientY - rect.top) / rect.height) * 100;
        
        setIsDrawing(true);
        setStartPos({ x: xPct, y: yPct });
        setCurrentRect({ x: xPct, y: yPct, w: 0, h: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !containerRef.current || !currentRect) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        const currentXPct = ((e.clientX - rect.left) / rect.width) * 100;
        const currentYPct = ((e.clientY - rect.top) / rect.height) * 100;

        // Allow drawing in any direction by tracking min/max
        const x = Math.min(startPos.x, Math.max(0, currentXPct));
        const y = Math.min(startPos.y, Math.max(0, currentYPct));
        const w = Math.abs(currentXPct - startPos.x);
        const h = Math.abs(currentYPct - startPos.y);

        setCurrentRect({ x, y, w, h });
    };

    const handleMouseUp = () => {
        if (!isDrawing || !currentRect) return;
        setIsDrawing(false);

        // Ignore tiny accidental clicks
        if (currentRect.w < 2 || currentRect.h < 2) {
            setCurrentRect(null);
            return;
        }

        const newBoxId = `box_${Date.now()}`;
        const newBox: BoundingBox = {
            id: newBoxId,
            x: currentRect.x,
            y: currentRect.y,
            width: currentRect.w,
            height: currentRect.h
        };

        const updatedBoxes = [...boxes, newBox];
        setBoxes(updatedBoxes);
        setCurrentRect(null);
        setTaggingBoxId(newBoxId);
        setTempTagInput('');
        // DO NOT save to DB yet to prevent orphaned ghost boxes on early exit
    };

    const handleTagSubmit = () => {
        if (!taggingBoxId) return;
        
        // Extract tag ID and Name from WikiTag format: [Name](tag://person:id)
        let parsedTagName = tempTagInput || 'Unknown Target';
        let parsedTagType = 'concept';
        let parsedTagId = undefined;

        const match = /\[([^\]]+)\]\((tag:\/\/[^)]+)\)/.exec(tempTagInput);
        if (match) {
            parsedTagName = match[1];
            const parts = match[2].split(':');
            parsedTagType = parts[1].replace('//', '');
            parsedTagId = parts.slice(2).join(':');
        }

        const updatedBoxes = boxes.map(b => 
            b.id === taggingBoxId 
            ? { ...b, tagName: parsedTagName, tagId: parsedTagId, tagType: parsedTagType } 
            : b
        );
        
        setBoxes(updatedBoxes);
        setTaggingBoxId(null);
        setTempTagInput('');
        
        // SAVE TO DB NOW that it's locked
        if (onChange) onChange(updatedBoxes);
        showToast(`Target [${parsedTagName}] Locked to Matrix`);
    };

    const handleCancelTagging = () => {
        if (!taggingBoxId) return;
        const updatedBoxes = boxes.filter(b => b.id !== taggingBoxId);
        setBoxes(updatedBoxes);
        setTaggingBoxId(null);
        setTempTagInput('');
        if (onChange) onChange(updatedBoxes);
    };

    const handleDeleteBox = (boxId: string) => {
        const updatedBoxes = boxes.filter(b => b.id !== boxId);
        setBoxes(updatedBoxes);
        if (onChange) onChange(updatedBoxes);
    };

    // Intercept Escape key to cancel tagging instead of closing the modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && taggingBoxId) {
                e.stopPropagation();
                handleCancelTagging();
            }
        };
        // Use capture phase to intercept before MatrixViewer
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [taggingBoxId, boxes]);

    const getBorderColor = (type?: string) => {
        switch(type) {
            case 'person': return 'border-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.6)]';
            case 'pet': return 'border-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.6)]';
            case 'place': return 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.6)]';
            case 'event': return 'border-rose-400 shadow-[0_0_15px_rgba(251,113,133,0.6)]';
            default: return 'border-fuchsia-400 shadow-[0_0_15px_rgba(232,121,249,0.6)]';
        }
    };

    // Extract transform from imageStyle to apply to the container instead of just the image
    // This ensures the SVG coordinate space rotates WITH the image pixels
    const { transform, transition, ...restImageStyle } = imageStyle || {};
    const containerStyle: React.CSSProperties = { transform, transition, transformOrigin: 'center center' };

    return (
        <div 
            className={`relative w-full h-full flex items-center justify-center bg-black/80 select-none group/tagger ${isDrawing ? 'cursor-crosshair' : ''}`}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            
            {/* HUD Instructional Overlay (Anchored to Screen, not Canvas) */}
            <div className="absolute top-8 right-8 z-[100] pointer-events-none animate-in fade-in duration-1000 delay-500 fill-mode-both">
                <div className="bg-black/60 backdrop-blur-xl text-white/60 px-4 py-2 rounded-xl border border-white/10 text-[11px] uppercase tracking-widest font-bold flex flex-col items-end gap-1 shadow-2xl ring-1 ring-white/5">
                    <span className="text-white/90">Draw to identify targets</span>
                    <span className="text-pink-400/80">Click reticle icon below to exit</span>
                </div>
            </div>

            {/* Premium Glassmorphic Toast Notification (Uncoupled from canvas) */}
            {toastMessage && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[999] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
                    <div className="bg-slate-900/60 backdrop-blur-xl text-slate-100 px-6 py-2.5 rounded-full border border-white/10 shadow-[0_15px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(139,92,246,0.1)] flex items-center gap-3 text-xs font-medium tracking-wide">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                        {toastMessage}
                    </div>
                </div>
            )}
            
            {/* The Canvas Container - tightly bounds the image, rotates as a single mathematical unit */}
            <div 
                ref={containerRef}
                className="relative cursor-crosshair inline-block max-w-full"
                onMouseDown={handleMouseDown}
                style={containerStyle}
            >
                <img 
                    src={src} 
                    alt="Forensic Target" 
                    className="max-w-full max-h-[75vh] object-contain pointer-events-none" 
                    draggable={false} 
                    style={{ ...restImageStyle, transition }}
                />
                
                {/* SVG Overlay for active Marching Ants */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                    {/* The actively drawn box */}
                    {isDrawing && currentRect && (
                        <rect
                            x={`${currentRect.x}%`}
                            y={`${currentRect.y}%`}
                            width={`${currentRect.w}%`}
                            height={`${currentRect.h}%`}
                            fill="rgba(255, 255, 255, 0.1)"
                            stroke="#fff"
                            strokeWidth="2"
                            strokeDasharray="6 6"
                        >
                            <animate attributeName="stroke-dashoffset" values="12;0" dur="0.5s" repeatCount="indefinite" />
                        </rect>
                    )}
                </svg>

                {/* Render locked boxes */}
                {boxes.map(box => (
                    <div 
                        key={box.id}
                        className={`absolute border-2 rounded-sm transition-all duration-300 pointer-events-none group/box
                            ${box.tagName ? getBorderColor(box.tagType) : 'border-dashed border-white/70'}
                        `}
                        style={{
                            left: `${box.x}%`,
                            top: `${box.y}%`,
                            width: `${box.width}%`,
                            height: `${box.height}%`,
                        }}
                    >
                        {/* Box Label */}
                        {box.tagName && (
                            <div className={`absolute ${box.y < 15 ? 'top-1 left-1' : '-top-6 left-0'} bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap border border-white/20 z-40`}>
                                {box.tagName}
                            </div>
                        )}

                        {/* Delete Box Button (Hover anywhere on image) */}
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteBox(box.id); }}
                            className={`absolute ${box.y < 15 ? 'top-1' : '-top-3'} ${box.x + box.width > 85 ? 'right-1' : '-right-3'} w-6 h-6 bg-red-600 hover:bg-red-500 rounded-full border border-white/20 flex items-center justify-center opacity-0 group-hover/tagger:opacity-100 transition-opacity pointer-events-auto z-40 shadow-lg`}
                            title="Delete Target"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>

                        {/* Tagging Popup */}
                        {taggingBoxId === box.id && (() => {
                            const isNearBottom = box.y + box.height > 85;
                            const isNearTop = box.y < 15;
                            const isHuge = isNearBottom && isNearTop;
                            
                            let positionClass = 'top-full mt-3 left-1/2 -translate-x-1/2';
                            if (isHuge) {
                                positionClass = 'bottom-3 left-1/2 -translate-x-1/2'; // Render inside at the bottom
                            } else if (isNearBottom) {
                                positionClass = 'bottom-full mb-3 left-1/2 -translate-x-1/2'; // Render above
                            }
                            return (
                                <div className={`absolute ${positionClass} z-50 min-w-[340px] bg-black/60 backdrop-blur-2xl border border-fuchsia-500/30 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8),0_0_20px_rgba(217,70,239,0.2)] p-3 pointer-events-auto flex flex-col gap-2 cursor-default`}>
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse shadow-[0_0_10px_rgba(217,70,239,0.8)]" />
                                        <div className="text-[10px] text-fuchsia-300 font-bold uppercase tracking-[0.2em]">Target Acquired</div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1 bg-black/40 rounded-xl border border-white/10 overflow-visible shadow-inner focus-within:border-fuchsia-500/50 focus-within:bg-white/10 transition-colors relative z-50">
                                            <WikiTagEditor
                                                value={tempTagInput}
                                                onChange={setTempTagInput}
                                                userId={userId}
                                                placeholder="Identify entity..."
                                                className="bg-transparent border-none text-sm text-white px-3 py-2 w-full outline-none placeholder:text-white/30"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') {
                                                        e.stopPropagation();
                                                        handleCancelTagging();
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleCancelTagging(); }}
                                                className="bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 p-2 rounded-xl transition-all border border-white/10 hover:border-red-500/30"
                                                title="Discard Target (Esc)"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleTagSubmit(); }}
                                                className="bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-[0_0_15px_rgba(217,70,239,0.4)] hover:shadow-[0_0_25px_rgba(217,70,239,0.6)] tracking-wider"
                                            >
                                                LOCK
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                ))}
            </div>
        </div>
    );
};
