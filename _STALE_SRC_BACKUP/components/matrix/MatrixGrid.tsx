import React, { memo } from 'react';
import PhotoAlbum, { RenderPhotoProps } from 'react-photo-album';
import { Circle, CheckCircle2, Film, Music, FileText, File, Play, Edit2 } from 'lucide-react';
import type { Media } from '@/types'; 
import { getMediaType } from './MatrixShared';
import { GlassButton } from '../GlassButton';

interface MatrixGridProps {
    groupedAssets: { title: string; dateKey: number; assets: Media[] }[];
    viewMode: 'sm' | 'md' | 'lg';
    isSelectionMode: boolean;
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    onMediaClick: (asset: Media) => void;
    onEditAsset: (asset: Media) => void;
    loading?: boolean; // [ZEN] Added for search responsiveness
}

// [ZEN] The "Pulse" Skeleton to prevent main-thread freeze
const MatrixSkeleton: React.FC<{ viewMode: 'sm' | 'md' | 'lg' }> = ({ viewMode }) => {
    // Match the approximate density of the view mode
    const items = Array.from({ length: viewMode === 'sm' ? 40 : 20 });
    return (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 animate-in fade-in duration-200">
            {items.map((_, i) => (
                <div 
                    key={i} 
                    className="aspect-square bg-white/5 rounded-lg animate-pulse border border-white/5" 
                    style={{ animationDelay: `${i * 20}ms` }} 
                />
            ))}
        </div>
    );
};

const MatrixGridComponent: React.FC<MatrixGridProps> = ({
    groupedAssets, viewMode, isSelectionMode, selectedIds, onToggleSelection, onMediaClick, onEditAsset, loading = false
}) => {
    
    // [ZEN] 1. Hard Cut: Immediate Skeleton Return
    if (loading) {
        return <MatrixSkeleton viewMode={viewMode} />;
    }

    if (groupedAssets.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                <FileText size={48} className="mb-4" />
                <p className="text-sm font-mono uppercase tracking-widest">No Artifacts Found</p>
            </div>
        );
    }

    const targetRowHeight = viewMode === 'sm' ? 120 : viewMode === 'md' ? 220 : 400;

    // [ZEN RESTORED] The "Singleton Row" Fix
    // This prevents a single image from stretching 100% width
    const getContainerConstraint = (count: number) => {
        if (count === 1) {
            if (viewMode === 'sm') return { maxWidth: '250px' };
            if (viewMode === 'md') return { maxWidth: '400px' };
            if (viewMode === 'lg') return { maxWidth: '600px' };
        }
        return {};
    };

    const renderPhoto = ({ photo, imageProps, wrapperStyle }: RenderPhotoProps<any>) => {
        // Safe Cast
        const asset = photo as unknown as Media;
        const isSelected = selectedIds.has(asset.id);
        const type = getMediaType(asset);
        
        const altText = asset.title || asset.caption || asset.originalName || "";
        const imgSrc = asset.thumbnailUrls?.medium || asset.thumbnailUrls?.small || asset.url || imageProps.src;
        const rotation = (asset as any).rotation || 0;
        
        return (
            <div style={{ ...wrapperStyle, padding: 0 }} className="flex items-center justify-center relative">
                <div 
                    className={`relative overflow-hidden rounded-lg bg-slate-900 transition-all duration-300 group w-full h-full ${isSelected ? 'ring-4 ring-cyan-500 scale-95 z-10' : ''}`}
                >
                    {/* Media Render */}
                    {type === 'image' || (type === 'video' && imgSrc) ? (
                        <div 
                            className="relative w-full h-full"
                            onClick={(e) => {
                                if (isSelectionMode) {
                                    e.stopPropagation();
                                    onToggleSelection(asset.id);
                                } else {
                                    onMediaClick(asset);
                                }
                            }}
                        >
                            {/* [ZEN] Loading placeholder behind image */}
                            <div className="absolute inset-0 bg-slate-800 animate-pulse pointer-events-none" />

                            <img 
                                {...imageProps} 
                                src={imgSrc} 
                                alt={altText}
                                loading="lazy"
                                decoding="async"
                                style={{ ...imageProps.style, width: '100%', height: '100%', objectFit: 'cover', transform: `rotate(${rotation}deg)` }}
                                className={`transition-transform duration-500 relative z-10 ${!isSelectionMode ? 'hover:scale-110 cursor-pointer' : 'cursor-pointer'}`}
                            />
                            
                            {type === 'video' && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                    <div className="bg-black/50 rounded-full p-3 border border-white/20 backdrop-blur-sm shadow-lg group-hover:scale-110 transition-transform">
                                        <Play size={24} className="text-white fill-white ml-1" />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div 
                            className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors cursor-pointer border border-slate-700"
                            onClick={(e) => {
                                if (isSelectionMode) {
                                    e.stopPropagation();
                                    onToggleSelection(asset.id);
                                } else {
                                    onMediaClick(asset);
                                }
                            }}
                        >
                            {type === 'audio' && <Music size={48} className="mb-2 text-purple-500" />}
                            {type === 'pdf' && <FileText size={48} className="mb-2 text-red-500" />}
                            {type === 'unknown' && <File size={48} className="mb-2 text-slate-500" />}
                            {type === 'video' && <Film size={48} className="mb-2 text-cyan-500" />}
                            <span className="text-[10px] uppercase tracking-widest font-bold opacity-70 px-2 text-center truncate w-full">{type}</span>
                        </div>
                    )}

                    {/* Selection & Edit Controls Overlay */}
                    <div className="absolute inset-0 pointer-events-none z-30">
                        {/* Selection Checkbox */}
                        <div 
                            onClick={(e) => { e.stopPropagation(); onToggleSelection(asset.id); }} 
                            className={`absolute top-2 left-2 pointer-events-auto cursor-pointer transition-all duration-200 ${isSelectionMode || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                            {isSelected ? 
                                <div className="bg-cyan-500 text-white rounded-full p-1 shadow-lg border border-cyan-400"><CheckCircle2 size={18} className="text-white" /></div> : 
                                <div className="bg-black/40 hover:bg-black/60 text-white/70 hover:text-white rounded-full p-1 border-2 border-white/50 hover:border-white backdrop-blur-sm transition-all"><Circle size={18} /></div>
                            }
                        </div>

                         {/* Edit Button */}
                         <div className="absolute bottom-2 right-2 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            <GlassButton 
                                onClick={(e) => { e.stopPropagation(); onEditAsset(asset); }}
                                variant="ghost" 
                                className="h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-cyan-500 hover:text-white border border-white/20"
                            >
                                <Edit2 size={14} />
                            </GlassButton>
                        </div>
                    </div>

                    {isSelected && <div className="absolute inset-0 bg-cyan-900/20 pointer-events-none z-10" />}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-[1800px] mx-auto pb-20">
            {groupedAssets.map((group) => {
                const groupKey = `${group.title}-${group.assets.length}`;
                const groupId = `matrix-group-${group.dateKey}`;
                
                return (
                    <div key={groupKey} id={groupId} className="animate-in fade-in slide-in-from-bottom-4 duration-700 scroll-mt-28 mb-8">
                        <div className="z-20 bg-[#0f1219] backdrop-blur-xl py-2 px-4 border-b border-white/10 flex items-baseline gap-3 sticky top-0 shadow-lg">
                            <h3 className="text-lg font-bold text-slate-200 tracking-wide">{group.title}</h3>
                            <span className="text-[10px] font-mono text-slate-500 bg-[#1a1d26] px-2 py-0.5 rounded-full border border-white/5">{group.assets.length}</span>
                        </div>
                        {/* [ZEN RESTORED] Application of the Singleton Constraint */}
                        <div className="pt-4 px-4" style={getContainerConstraint(group.assets.length)}>
                            <PhotoAlbum
                                layout="rows"
                                photos={group.assets.map(a => ({ 
                                    ...a, 
                                    src: a.thumbnailUrls?.medium || a.thumbnailUrls?.small || a.url, 
                                    width: a.width && a.width > 0 ? a.width : 800, 
                                    height: a.height && a.height > 0 ? a.height : 600,
                                    key: a.id
                                }))}
                                targetRowHeight={targetRowHeight}
                                renderPhoto={renderPhoto}
                                onClick={({ photo }) => {
                                    if (isSelectionMode) {
                                        onToggleSelection((photo as any).id);
                                    } else {
                                        onMediaClick(photo as unknown as Media);
                                    }
                                }}
                                spacing={12}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export const MatrixGrid = memo(MatrixGridComponent);