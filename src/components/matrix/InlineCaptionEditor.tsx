import React from 'react';
import { Focus, Camera, Wand2, ShieldAlert } from 'lucide-react';
import type { Media } from '../../types';
import { WikiText } from '../shared/WikiText';

export const InlineCaptionEditor = ({ 
    asset,
    onCiteAsset,
    onOpenAITriage,
}: { 
    asset: Media; 
    onCiteAsset?: (media: Media) => void;
    onOpenAITriage?: () => void;
}) => {
    return (
        <div 
            title="Caption / Description"
            className="group/caption bg-black/40 hover:bg-black/60 hover:border-fuchsia-500/30 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-lg text-sm text-slate-200 leading-relaxed font-light mb-1 relative w-full max-h-[60vh] overflow-y-auto custom-scrollbar"
            onWheel={(e) => e.stopPropagation()} 
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="pr-12">
                {(asset.caption || asset.description) ? (
                    <WikiText text={asset.caption || asset.description || ''} />
                ) : (
                    <span className="text-slate-500 italic">No caption at present.</span>
                )}

                {/* Forensic Targets Manifest */}
                {asset.metadata?.boundingBoxes && asset.metadata.boundingBoxes.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/10">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest mb-2">
                            <Focus size={12} />
                            <span>Forensic Targets ({asset.metadata.boundingBoxes.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {asset.metadata.boundingBoxes.map((box: any) => (
                                <div key={box.id} className="bg-fuchsia-900/30 border border-fuchsia-500/30 text-fuchsia-200 px-2 py-0.5 rounded text-[11px] font-medium tracking-wide shadow-inner">
                                    {box.tagName}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Forensic Camera Inference Block */}
                {(asset as any).aiInferredCamera?.model && (
                    <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                            <Camera size={14} />
                            <span>FORENSIC HARDWARE MATCH: {(asset as any).aiInferredCamera.model}</span>
                        </div>
                        {(asset as any).aiInferredCamera.reasoning && (
                            <p className="text-xs text-slate-400 leading-relaxed italic">
                                "{(asset as any).aiInferredCamera.reasoning}"
                            </p>
                        )}
                    </div>
                )}
            </div>
            <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-100 sm:opacity-0 group-hover/caption:opacity-100 transition-opacity">
                <button 
                    onClick={(e) => { e.stopPropagation(); if (onOpenAITriage) onOpenAITriage(); }}
                    className="p-1.5 bg-black/60 hover:bg-fuchsia-900/60 rounded-lg border border-white/10 hover:border-fuchsia-500/50 text-slate-400 hover:text-fuchsia-400 transition-all flex items-center justify-center"
                    title="AI Caption Editor"
                >
                    <Wand2 size={13} />
                </button>
                {onCiteAsset && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onCiteAsset(asset); }}
                        className="p-1.5 bg-black/60 hover:bg-rose-900/60 rounded-lg border border-white/10 hover:border-rose-500/50 text-slate-400 hover:text-rose-400 transition-all flex items-center justify-center"
                        title="Issue Forensic Citation (Audit Hallucinations)"
                    >
                        <ShieldAlert size={13} />
                    </button>
                )}
            </div>
        </div>
    );
};
