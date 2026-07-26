import React, { useRef } from 'react';
import { Sparkles, Database, ImageIcon, Loader2 } from 'lucide-react';
import MarkdownRenderer from '../../ai/MarkDownRenderer';

interface ScrapbookViewportProps {
    attachedMedia: any[];
    narrative: string;
    onAddFromMatrix: () => void;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveAttachment: (id: string) => void;
    isUploading: boolean;
}

const ScrapbookViewport = ({ 
    attachedMedia, narrative, onAddFromMatrix, onUpload, onRemoveAttachment, isUploading 
}: ScrapbookViewportProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="w-full h-full flex flex-col p-12 overflow-y-auto custom-scrollbar bg-black/40">
            <div className="max-w-4xl mx-auto w-full space-y-12">
                
                {/* [ZEN] JOG THE JOT: Context Header */}
                <div className="relative group">
                    <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 to-violet-500/10 rounded-3xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="relative bg-slate-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md shadow-2xl">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles size={14} className="text-cyan-400" />
                            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Memory Context</span>
                        </div>
                        <div className="text-slate-300 text-sm leading-relaxed font-medium italic opacity-90 max-h-[300px] overflow-y-auto custom-scrollbar">
                            <MarkdownRenderer content={narrative || 'No narrative text found...'} onNavigate={() => {}} />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Narrative Scrapbook</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Assemble the visual context for this memory</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={onAddFromMatrix}
                            className="px-6 py-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500/20 transition-all flex items-center gap-3"
                        >
                            <Database size={14} />
                            Add from Matrix
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="px-6 py-3 bg-violet-500/10 text-violet-400 border border-violet-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-500/20 transition-all flex items-center gap-3 disabled:opacity-50"
                        >
                            {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                            Upload New
                        </button>
                        <input type="file" ref={fileInputRef} onChange={onUpload} className="hidden" multiple />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-20">
                    {attachedMedia.map((m) => (
                        <div key={m.id} className="group relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-2xl hover:border-cyan-500/50 transition-all hover:scale-[1.02]">
                            <img src={m.thumbnailUrl || m.url} alt="attachment" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                <button 
                                    onClick={() => onRemoveAttachment(m.id)}
                                    className="w-full py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-red-500/40 transition-all"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                    
                    {attachedMedia.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl bg-white/2">
                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                <ImageIcon size={32} className="text-slate-700" />
                            </div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No Media Tethered Yet</span>
                            <p className="text-[9px] text-slate-700 mt-2 max-w-[200px] text-center leading-relaxed">Select photos from your Matrix or upload new ones to bring this narrative to life.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScrapbookViewport;
