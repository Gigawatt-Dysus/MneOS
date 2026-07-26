import React, { useState, useEffect, useRef } from 'react';
import { X, Check, ArrowRight, Shield, Zap, BookOpen, Sparkles, Loader2, Database, LifeBuoy, Upload, AlertTriangle, CheckCircle2, Wand2, ShieldAlert } from 'lucide-react';
import { ArchiveMigrationService, type MigrationCluster } from '../../services/ai/ArchiveMigrationService';
import { reindexChatSegments } from '../../services/searchService';
import { GlassCard } from '../GlassCard';
import { GlassButton } from '../GlassButton';

interface MigrationWorkbenchModalProps {
    userId: string;
    onClose: () => void;
    addToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export const MigrationWorkbenchModal: React.FC<MigrationWorkbenchModalProps> = ({ userId, onClose, addToast }) => {
    const [auditProgress, setAuditProgress] = useState(0);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [scrubProgress, setScrubProgress] = useState({ current: 0, total: 0 });
    const [clusters, setClusters] = useState<MigrationCluster[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // [ZEN] Load and initial cluster discovery
    useEffect(() => {
        let isMounted = true;
        const discover = async () => {
            try {
                const initialClusters = await ArchiveMigrationService.clusterLegacyMessages(userId);
                if (!isMounted) return;
                setClusters(initialClusters);
                setIsLoading(false);
                
                // Start background audit for the first few
                auditNext(initialClusters, 0);
            } catch (err) {
                if (isMounted) {
                    addToast("Failed to discover legacy archive.", "error");
                    onClose();
                }
            }
        };
        discover();
        return () => { isMounted = false; };
    }, []);

    const handleNeuralScrub = async () => {
        if (!confirm("This will decontaminate all messages and regenerate vectors. It may take a few minutes. Proceed?")) return;
        setIsScrubbing(true);
        try {
            await reindexChatSegments(userId, true);
            addToast("Neural Scrub Complete. Vectors restored.", "success");
        } catch (e) {
            console.error("[Migration] Scrub failed:", e);
            addToast("Scrub failed. Check logs.", "error");
        } finally {
            setIsScrubbing(false);
        }
    };

    const auditNext = async (currentClusters: MigrationCluster[], index: number) => {
        if (index >= currentClusters.length) return;
        if (currentClusters[index].confidence > 0) return; // Already audited

        const audited = await ArchiveMigrationService.auditCluster(currentClusters[index]);
        setClusters(prev => {
            const copy = [...prev];
            copy[index] = audited;
            return copy;
        });
        
        if (index < currentClusters.length - 1) auditNext(currentClusters, index + 1);
    };

    const handleFileRecovery = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const recovered = JSON.parse(event.target?.result as string);
                // [ZEN] Pass through the new Singleton Prevention logic
                const cleaned = ArchiveMigrationService.preventSingletons(recovered);
                setClusters(cleaned);
                setIsLoading(false);
                addToast(`Insurance Manifest Injected (${cleaned.length} episodes). Ready.`, "success");
            } catch (err) {
                setIsLoading(false);
                addToast("Invalid JSON file format.", "error");
            }
        };
        reader.readAsText(file);
    };

    const handleExecute = async () => {
        setIsMigrating(true);
        try {
            await ArchiveMigrationService.executeMigration(userId, clusters);
            addToast("Neural Archive Migration Complete.", "success");
            onClose();
        } catch (err) {
            console.error("[Migration] Fatal Failure:", err);
            addToast("Migration failed. Check console for neural debris.", "error");
        } finally {
            setIsMigrating(false);
        }
    };

    const updateProposedSession = (clusterIndex: number, session: any) => {
        setClusters(prev => {
            const copy = [...prev];
            copy[clusterIndex].proposedSession = session;
            return copy;
        });
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl z-[200] flex items-center justify-center p-8 animate-in fade-in duration-500">
            <div className="w-full max-w-6xl h-[85vh] bg-[#0a0a0b] border border-white/10 rounded-[3rem] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                
                {/* Hidden File Input */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileRecovery} 
                    accept=".json,.txt" 
                    className="hidden" 
                />

                {/* Header */}
                <div className="p-10 border-b border-white/5 bg-white/[0.02] flex justify-between items-end">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Database className="text-cyan-400" size={32} />
                            <h2 className="text-4xl font-black uppercase tracking-tighter text-white">Neural Archive Sorcerer</h2>
                        </div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em]">Partitioning Legacy Context • {clusters.length} Episodes Discovered</p>
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 transition-all text-[10px] font-black uppercase tracking-widest"
                        >
                            <Upload size={14} />
                            Recovery Import
                        </button>
                        <button onClick={onClose} className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-all">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-6">
                            <Loader2 className="text-cyan-500 animate-spin" size={64} />
                            <p className="text-slate-400 font-mono text-sm animate-pulse">Scanning Neural Fragments...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {clusters.map((cluster, idx) => {
                                if (!cluster) return null;
                                return (
                                <div key={cluster.id} className={`p-8 rounded-[2rem] border transition-all duration-500 ${cluster.confidence > 0 ? 'bg-white/[0.03] border-white/10' : 'bg-black border-dashed border-white/5 opacity-50'}`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Episode {idx + 1}</span>
                                            <h3 className="text-lg font-bold text-white/90">
                                                {new Date(cluster.startTime).toLocaleDateString()} • {cluster.messages.length} Messages
                                            </h3>
                                        </div>
                                        {cluster.confidence > 0 ? (
                                            <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">{cluster.confidence}% Match</span>
                                            </div>
                                        ) : (
                                            <Loader2 className="text-slate-700 animate-spin" size={16} />
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        {cluster.summary ? (
                                            <p className="text-sm text-slate-300 leading-relaxed italic">"{cluster.summary}"</p>
                                        ) : (
                                            <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
                                        )}

                                        <div className="flex flex-wrap gap-2">
                                            {cluster.semanticTags.map(tag => (
                                                <span key={tag} className="px-2 py-0.5 bg-white/5 border border-white/5 rounded-md text-[9px] text-slate-500 uppercase font-bold tracking-wider">#{tag}</span>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter ${cluster.proposedSession === 'workshop' ? 'bg-blue-500/20 text-blue-400' :
                                                cluster.proposedSession === 'studio' ? 'bg-fuchsia-500/20 text-fuchsia-400' :
                                                    cluster.proposedSession === 'sanctuary' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-emerald-500/20 text-emerald-400'
                                                }`}>
                                                {cluster.proposedSession}
                                            </div>
                                            {cluster.structuralFailure && (
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded uppercase tracking-tighter animate-pulse">
                                                    <AlertTriangle size={10} />
                                                    Structural Failure
                                                </div>
                                            )}
                                            <span className="text-[10px] font-medium text-slate-500">
                                                {cluster.messages.length} messages • Confidence: {cluster.confidence}%
                                            </span>
                                        </div>

                                        <div className="pt-6 border-t border-white/5">
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { id: 'workshop', label: 'Workshop', icon: Zap, color: 'text-emerald-400', bg: 'hover:bg-emerald-500/10' },
                                                    { id: 'living_room', label: 'Living Room', icon: Shield, color: 'text-cyan-400', bg: 'hover:bg-cyan-500/10' },
                                                    { id: 'studio', label: 'Studio', icon: BookOpen, color: 'text-fuchsia-400', bg: 'hover:bg-fuchsia-500/10' },
                                                    { id: 'sanctuary', label: 'Sanctuary', icon: Sparkles, color: 'text-orange-400', bg: 'hover:bg-orange-500/10' }
                                                ].map(room => (
                                                    <button
                                                        key={room.id}
                                                        onClick={() => updateProposedSession(idx, room.id as any)}
                                                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${cluster.proposedSession === room.id ? `bg-white/10 border-white/20 shadow-lg` : `border-transparent ${room.bg} opacity-40 hover:opacity-100`}`}
                                                    >
                                                        <room.icon size={16} className={room.color} />
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${cluster.proposedSession === room.id ? 'text-white' : 'text-slate-500'}`}>{room.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-10 border-t border-white/5 bg-white/[0.01] flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <div className="flex -space-x-4">
                            {[1, 2, 3, 4].map(i => <div key={i} className="w-10 h-10 rounded-full border-4 border-[#0a0a0b] bg-slate-800" />)}
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Universal Vectorization Engine Ready</p>
                    </div>
                    
                    <button 
                        onClick={handleNeuralScrub}
                        disabled={isScrubbing}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                        {isScrubbing ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
                        {isScrubbing ? 'Scrubbing...' : 'Neural Scrub'}
                    </button>

                    <button
                        onClick={handleExecute}
                        disabled={isMigrating || isLoading}
                        className="px-12 py-5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-full font-black uppercase tracking-widest shadow-2xl shadow-cyan-500/20 flex items-center gap-4 transition-all active:scale-95"
                    >
                        {isMigrating ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                        <span>{isMigrating ? 'Forging Neural Fabric...' : 'Execute Great Migration'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
