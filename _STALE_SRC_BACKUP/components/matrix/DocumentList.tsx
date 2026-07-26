import React from 'react';
import { FileText, Music, File, Trash2, ExternalLink, Calendar, HardDrive } from 'lucide-react';
import type { Media } from '@/types';
import { getMediaType } from './MatrixShared';

interface DocumentListProps {
    assets: Media[];
    selectedIds: Set<string>;
    isSelectionMode: boolean;
    onToggleSelection: (id: string) => void;
    onDeleteAsset: (id: string) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({ 
    assets, selectedIds, isSelectionMode, onToggleSelection, onDeleteAsset 
}) => {

    const getIcon = (type: string) => {
        if (type === 'pdf') return <FileText size={20} className="text-red-400" />;
        if (type === 'audio') return <Music size={20} className="text-purple-400" />;
        return <File size={20} className="text-slate-400" />;
    };

    const formatSize = (bytes?: number) => {
        if (!bytes) return '--';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="w-full max-w-6xl mx-auto">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <div className="col-span-1 text-center">Type</div>
                <div className="col-span-5">Filename / Caption</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Size</div>
                <div className="col-span-2 text-right">Actions</div>
            </div>

            <div className="divide-y divide-slate-800/50">
                {assets.map(asset => {
                    const type = getMediaType(asset);
                    const isSelected = selectedIds.has(asset.id);
                    
                    return (
                        <div 
                            key={asset.id} 
                            className={`grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-800/30 transition-colors group cursor-pointer ${isSelected ? 'bg-cyan-900/10 border-l-2 border-cyan-500' : ''}`}
                            onClick={() => {
                                if (isSelectionMode) onToggleSelection(asset.id);
                                else window.open(asset.url, '_blank');
                            }}
                        >
                            <div className="col-span-1 flex justify-center">
                                {isSelectionMode ? (
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-cyan-600 border-cyan-500' : 'border-slate-600'}`}>
                                        {isSelected && <span className="text-white text-xs">✓</span>}
                                    </div>
                                ) : (
                                    getIcon(type)
                                )}
                            </div>
                            
                            <div className="col-span-5 min-w-0">
                                <p className="text-sm font-bold text-slate-200 truncate">{asset.originalName || asset.fileName || 'Untitled'}</p>
                                {asset.caption && <p className="text-xs text-slate-500 truncate">{asset.caption}</p>}
                            </div>

                            <div className="col-span-2 flex items-center gap-2 text-xs text-slate-400">
                                <Calendar size={12} />
                                {new Date(asset.uploadDate).toLocaleDateString()}
                            </div>

                            <div className="col-span-2 flex items-center gap-2 text-xs text-slate-500 font-mono">
                                <HardDrive size={12} />
                                {formatSize(asset.size)}
                            </div>

                            <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); window.open(asset.url, '_blank'); }}
                                    className="p-2 text-cyan-400 hover:bg-cyan-900/20 rounded transition-colors"
                                    title="Open"
                                >
                                    <ExternalLink size={16} />
                                </button>
                                {!isSelectionMode && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteAsset(asset.id); }}
                                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {assets.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        No documents found.
                    </div>
                )}
            </div>
        </div>
    );
};