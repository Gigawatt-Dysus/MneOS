import React, { useState, useEffect } from 'react';
import { Brain, Check, X, ShieldAlert, CheckCircle, Sparkles } from 'lucide-react';
import type { Tag, User } from '../../../types';
import { GlassAvatar } from '../../GlassAvatar';
import { appDataService } from '../../../services/serviceManager';

interface InferencesSubTabProps {
    allTags: Tag[];
    user: User | null;
}

export const InferencesSubTab: React.FC<InferencesSubTabProps> = ({ allTags, user }) => {
    const [pendingTags, setPendingTags] = useState<Tag[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        const filtered = allTags.filter(t => t.pendingInferences && t.pendingInferences.trim() !== "");
        setPendingTags(filtered);
    }, [allTags]);

    const handleApprove = async (tag: Tag) => {
        if (!user?.id) return;
        setProcessingId(tag.id);
        try {
            const updatedTag = {
                ...tag,
                inferences: tag.pendingInferences,
                pendingInferences: "",
                inferencesLastUpdated: new Date().toISOString()
            };
            await appDataService.saveTag(user.id, updatedTag);
            setPendingTags(prev => prev.filter(t => t.id !== tag.id));
        } catch (e) {
            console.error("Failed to approve visual inference:", e);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (tag: Tag) => {
        if (!user?.id) return;
        setProcessingId(tag.id);
        try {
            const updatedTag = {
                ...tag,
                pendingInferences: "",
                inferencesLastUpdated: new Date().toISOString()
            };
            await appDataService.saveTag(user.id, updatedTag);
            setPendingTags(prev => prev.filter(t => t.id !== tag.id));
        } catch (e) {
            console.error("Failed to reject visual inference:", e);
        } finally {
            setProcessingId(null);
        }
    };

    if (pendingTags.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500 animate-in fade-in duration-500">
                <CheckCircle size={48} className="text-emerald-500 mb-4 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse" />
                <h3 className="text-lg font-bold text-white mb-1">Curation Clear</h3>
                <p className="text-xs text-slate-400 max-w-sm">No pending visual inferences require calibration. G.I.G.I. is fully aligned with active RAG context.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-amber-950/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
                <ShieldAlert className="text-amber-500 shrink-0" size={20} />
                <div className="text-xs">
                    <span className="text-amber-400 font-bold block mb-0.5">Sovereign Quarantine Sandbox Active</span>
                    <span className="text-slate-400">These inferences are temporarily isolated and will not influence RAG queries or system daydreams until approved below.</span>
                </div>
            </div>

            <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                Pending Calibrations ({pendingTags.length})
            </div>

            <div className="space-y-4">
                {pendingTags.map(tag => (
                    <div 
                        key={tag.id}
                        className="bg-slate-900/60 border border-white/5 rounded-xl p-5 hover:border-slate-800 transition-all flex flex-col md:flex-row gap-5 items-start md:items-center justify-between"
                    >
                        <div className="flex items-center gap-4 flex-1">
                            <GlassAvatar
                                imageUrl={tag.mainImageId ? tag.mediaGallery?.find(m => m.url.includes(tag.mainImageId!))?.url : undefined}
                                altText={tag.name}
                                fallbackChar={tag.name}
                                size="w-12 h-12"
                            />
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-white truncate flex items-center gap-2">
                                    {tag.name}
                                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-cyan-400 uppercase tracking-widest font-black">
                                        {tag.type}
                                    </span>
                                </h4>
                                <div className="mt-2 text-xs text-slate-300 bg-black/40 border border-white/5 rounded-lg p-3 whitespace-pre-wrap font-sans leading-relaxed">
                                    {tag.pendingInferences}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 self-end md:self-center shrink-0">
                            <button
                                disabled={processingId === tag.id}
                                onClick={() => handleApprove(tag)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors border border-emerald-500/20"
                            >
                                <Check size={14} /> Approve
                            </button>
                            <button
                                disabled={processingId === tag.id}
                                onClick={() => handleReject(tag)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-rose-400 border border-slate-700 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors"
                            >
                                <X size={14} /> Reject
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
