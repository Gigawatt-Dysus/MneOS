import React, { RefObject } from 'react';
import { Camera, Crop, Sparkles, MapPin, TrashIcon } from 'lucide-react';
import { GlassAvatar } from '../GlassAvatar';
import { GlassButton } from '../GlassButton';

interface TagEditorSidebarProps {
    avatarPreview: string | null;
    tagName: string;
    tagType: string;
    hasCoords: boolean;
    staticMapUrl: string;
    metaAddressLocality?: string;
    metaAddressRegion?: string;
    fileInputRef: RefObject<HTMLInputElement>;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onTriggerFileInput: () => void;
    onShowMatrixSelector: () => void;
    onRemoveAvatar: () => void;
    onReCrop: () => void;
    onGenerateTheme: () => void;
    onMapClick: () => void;
}

export const TagEditorSidebar: React.FC<TagEditorSidebarProps> = ({
    avatarPreview,
    tagName,
    tagType,
    hasCoords,
    staticMapUrl,
    metaAddressLocality,
    metaAddressRegion,
    fileInputRef,
    onFileSelect,
    onTriggerFileInput,
    onShowMatrixSelector,
    onRemoveAvatar,
    onReCrop,
    onGenerateTheme,
    onMapClick
}) => {
    return (
        // [ZEN FIX] Changed from fixed width to responsive:
        // - w-full md:w-72 (full width on mobile, 288px on desktop)
        // - border-b md:border-b-0 (bottom border on mobile, none on desktop)
        // - md:border-r (right border only on desktop)
        // - max-h-[40vh] md:max-h-none (limit height on mobile for stacking)
        <div className="w-full md:w-72 p-4 md:p-6 pb-6 md:pb-6 border-b md:border-b-0 md:border-r border-white/5 flex flex-col items-center bg-[#0a0c10] overflow-y-auto custom-scrollbar shrink-0">
            
            {/* GLASS AVATAR CONTAINER */}
            {/* [ZEN FIX] Responsive avatar size: w-32 h-32 on mobile, w-48 h-48 on desktop */}
            <GlassAvatar 
                imageUrl={avatarPreview}
                altText={tagName}
                fallbackChar={tagName}
                size="w-32 h-32 md:w-48 md:h-48"
                className="mb-4 md:mb-6 shrink-0 cursor-pointer"
                onClick={onTriggerFileInput}
            >
                 <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 rounded-full">
                   <Camera size={30} className="text-white drop-shadow-lg" />
                </div>
            </GlassAvatar>

            {/* [ZEN FIX] Button grid: 2 columns on mobile, 1 column on desktop */}
            <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-3 w-full mb-6">
                <GlassButton onClick={onTriggerFileInput} variant="secondary" className="w-full text-xs col-span-2 md:col-span-1">
                    <Camera size={14} /> Change Avatar
                </GlassButton>
                
                {/* Matrix Selector Button */}
                <button 
                    type="button" 
                    onClick={onShowMatrixSelector} 
                    className="flex items-center justify-center gap-2 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-slate-300 transition-colors"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
                    </svg>
                    Select from Matrix
                </button>

                {avatarPreview && (
                    <>
                        <GlassButton onClick={onReCrop} variant="secondary" className="w-full text-xs text-cyan-400">
                            <Crop size={14} /> Reposition
                        </GlassButton>
                        <button 
                            type="button" 
                            onClick={onRemoveAvatar} 
                            className="flex items-center justify-center gap-2 w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-xs font-bold text-red-400 transition-colors"
                        >
                            <TrashIcon size={14} /> Remove
                        </button>
                    </>
                )}
                
                <GlassButton onClick={onGenerateTheme} variant="secondary" className="w-full text-xs text-emerald-400 col-span-2 md:col-span-1">
                    <Sparkles size={14} /> Auto-Gen Theme
                </GlassButton>
            </div>
            
            <input type="file" ref={fileInputRef} onChange={onFileSelect} className="hidden" accept="image/*" />

            {/* Map - Hidden on mobile to save space, visible on desktop */}
            {tagType !== 'pet' && (
                <div className="w-full mt-4 p-4 bg-[#1a1d26] rounded-2xl border border-white/5 hidden md:block">
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2 tracking-widest"><MapPin size={12}/> Location Map</div>
                    <div 
                        className="w-full aspect-square rounded-xl overflow-hidden border border-white/10 bg-[#0f1219] relative group cursor-pointer hover:border-cyan-500 transition-colors"
                        onClick={onMapClick}
                    >
                        <img 
                            src={staticMapUrl} 
                            alt="Location Map" 
                            className={`w-full h-full object-cover ${!hasCoords ? 'p-8 opacity-50 grayscale' : ''}`} 
                            style={!hasCoords ? { objectFit: 'contain' } : {}}
                        />
                         {hasCoords && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                <span className="text-[10px] font-bold text-white bg-black/60 px-3 py-1.5 rounded-full flex items-center gap-1 border border-white/20 uppercase tracking-wide"><MapPin size={10}/> Interact</span>
                            </div>
                        )}
                    </div>
                    {hasCoords && <div className="text-[10px] text-slate-500 mt-2 text-center font-mono">{metaAddressLocality}, {metaAddressRegion}</div>}
                </div>
            )}
        </div>
    );
};