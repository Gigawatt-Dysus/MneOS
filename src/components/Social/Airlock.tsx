import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, UserPlus, Trash2, X, AlertTriangle, Check, ArrowRight, Wand2, Power } from 'lucide-react';
import { GlassButton } from '../GlassButton';
import { GlassCard } from '../GlassCard';
import { GlassContainer } from '../GlassContainer';
import { VertService } from '../../services/vertService';
import { User, Tag, PersonTag, AirlockRequest } from '../../types';
import { GlassAvatar } from '../GlassAvatar';
import { SubHeader } from '../SubHeader';

interface AirlockProps {
    requests: AirlockRequest[];
    onAccept: (request: AirlockRequest, valence: 1 | 2 | 3, selectedTagId?: string) => Promise<void>;
    onReject: (request: AirlockRequest, reason: string) => Promise<void>;
    onClose: () => void;
    existingTags: Tag[];
    user: User;
}

export const Airlock: React.FC<AirlockProps> = ({
    requests,
    onAccept,
    onReject,
    onClose,
    existingTags,
    user
}) => {
    const [selectedRequest, setSelectedRequest] = useState<AirlockRequest | null>(null);
    const [aiMatches, setAiMatches] = useState<any[]>([]);
    const [isVetting, setIsVetting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('I do not know you');
    const [showConfirmReject, setShowConfirmReject] = useState(false);
    const [animationState, setAnimationState] = useState<'idle' | 'granting' | 'venting'>('idle');
    const [selectedTagId, setSelectedTagId] = useState<string | undefined>(undefined);

    // Run AI Fuzzy Match when a request is selected
    useEffect(() => {
        if (selectedRequest) {
            vetIdentity(selectedRequest);
        } else {
            setAiMatches([]);
        }
    }, [selectedRequest]);

    const vetIdentity = async (req: AirlockRequest) => {
        setIsVetting(true);
        try {
            const result = await VertService.performAIFuzzyMatch(user, req, existingTags);
            setAiMatches(result.matches || []);
        } catch (e) {
            console.error("Vetting failed:", e);
        } finally {
            setIsVetting(false);
        }
    };

    const handleAccept = async (valence: 1 | 2 | 3) => {
        if (!selectedRequest) return;
        setAnimationState('granting');
        setTimeout(async () => {
            await onAccept(selectedRequest, valence, selectedTagId);
            setSelectedRequest(null);
            setAnimationState('idle');
        }, 1200);
    };

    const handleReject = async () => {
        if (!selectedRequest) return;
        setAnimationState('venting');
        setTimeout(async () => {
            await onReject(selectedRequest, rejectionReason);
            setSelectedRequest(null);
            setShowConfirmReject(false);
            setAnimationState('idle');
        }, 2000);
    };

    return (
        <div className="h-full flex flex-col items-center animate-in fade-in duration-500 overflow-y-auto custom-scrollbar bg-transparent">

            {/* --- STANDARDIZED CORE SUBHEADER --- */}
            <SubHeader>
                <div className="flex items-center justify-between w-full">
                    {/* Left side: Navigation & Title */}
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="p-1.5 sm:p-2 bg-red-500/10 rounded-xl border border-red-500/20">
                            <Shield size={16} className="text-red-500" />
                        </div>
                        <div>
                            <h1 className="text-xs sm:text-sm font-black text-white tracking-widest uppercase font-['Orbitron'] line-clamp-1">Airlock Control</h1>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 tracking-wider">SECURE_LINK_ACTIVE</span>
                            </div>
                        </div>
                    </div>

                    {/* Right side: Protocol & Action */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="hidden sm:flex items-center gap-4 px-3 py-2 bg-black/30 rounded-xl border border-white/5">
                            <div className="flex flex-col items-end">
                                <span className="text-[7px] font-black text-slate-500 tracking-widest uppercase">Protocol</span>
                                <span className="text-[8px] font-bold text-cyan-400 uppercase tracking-tighter">VETTING_L4</span>
                            </div>
                        </div>
                        <GlassButton
                            variant="secondary"
                            size="sm"
                            onClick={onClose}
                            className="h-8 sm:h-9 px-3 sm:px-4 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest"
                        >
                            <Power className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1.5 sm:mr-2" />
                            <span className="hidden sm:inline">EXIT SYSTEM</span>
                            <span className="sm:hidden">EXIT</span>
                        </GlassButton>
                    </div>
                </div>
            </SubHeader>

            {/* --- BENTO GRID LAYOUT --- */}
            <div className="w-full max-w-7xl flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 pb-4 min-h-0">

                {/* 1. Request Queue (Left) */}
                <GlassContainer variant="default" className="md:col-span-4 flex flex-col p-6 overflow-hidden border-white/5">
                    <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_cyan] animate-pulse"></span>
                            <h2 className="text-[10px] font-black tracking-[0.4em] text-slate-500 uppercase italic">Inbound Pulses</h2>
                        </div>
                        <span className="text-[10px] font-mono font-black text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-full">{requests.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                        {requests.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-white/10 italic">
                                <Shield className="w-16 h-16 mb-4 opacity-5 shadow-2xl" />
                                <p className="font-mono text-[10px] tracking-widest uppercase">Airlock Empty // System Idle</p>
                            </div>
                        ) : (
                            requests.map(req => (
                                <GlassContainer
                                    key={req.requestId}
                                    variant="bento"
                                    onClick={() => setSelectedRequest(req)}
                                    className={`p-4 group cursor-pointer border-white/5 transition-all ${selectedRequest?.requestId === req.requestId
                                        ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.1)] scale-[1.01]'
                                        : 'hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-black text-slate-200 group-hover:text-white transition-colors tracking-tight text-sm leading-tight uppercase truncate max-w-[150px]">
                                            {req.fromName}
                                        </div>
                                        <div className="text-[8px] font-mono text-cyan-500/60 font-black">
                                            {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div className="text-[8px] font-black text-slate-500 tracking-widest uppercase opacity-60">
                                        {req.type === 'share' ? 'ARTIFACT_TRANSFER' : 'IDENTITY_RESOLVE'}
                                    </div>
                                </GlassContainer>
                            ))
                        )}
                    </div>
                </GlassContainer>

                {/* 2. Main Inspection Vetting Area (Right) */}
                <GlassContainer variant="default" className="md:col-span-8 flex flex-col overflow-hidden bg-black/40 border-cyan-500/10">
                    <AnimatePresence mode="wait">
                        {!selectedRequest ? (
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="h-full flex flex-col items-center justify-center text-slate-600 p-12 text-center"
                            >
                                <AlertTriangle className="w-24 h-24 mb-6 opacity-10 animate-pulse" />
                                <h3 className="text-2xl font-black font-['Orbitron'] tracking-tighter uppercase italic opacity-20">Awaiting Signal Selection</h3>
                                <p className="font-mono text-xs tracking-widest mt-4 opacity-30">VETTING STATION 01 // READY FOR BIOMETRIC DATA</p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key={selectedRequest.requestId}
                                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }}
                                className="h-full flex flex-col p-8 relative"
                            >
                                {/* Animation Layer */}
                                <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden rounded-3xl">
                                    <AnimatePresence>
                                        {animationState === 'granting' && (
                                            <motion.div
                                                initial={{ y: '100%' }} animate={{ y: '-100%' }}
                                                transition={{ duration: 1.2, ease: "easeInOut" }}
                                                className="absolute inset-0 bg-cyan-500/20 backdrop-blur-sm flex items-center justify-center border-y-4 border-cyan-400"
                                            >
                                                <div className="text-8xl text-cyan-400 font-black font-['Orbitron'] tracking-[1em] rotate-90 opacity-20">ACCESS_GRANTED</div>
                                            </motion.div>
                                        )}
                                        {animationState === 'venting' && (
                                            <motion.div
                                                initial={{ scale: 1, opacity: 0 }}
                                                animate={{ scale: [1, 1.2, 0], opacity: [0, 1, 1, 0], rotate: [0, 0, 45] }}
                                                transition={{ duration: 2, times: [0, 0.2, 0.8, 1] }}
                                                className="absolute inset-0 flex items-center justify-center bg-red-500/50 backdrop-blur-md"
                                            >
                                                <div className="flex flex-col items-center gap-4">
                                                    <Trash2 className="w-48 h-48 text-white drop-shadow-[0_0_30px_red]" />
                                                    <div className="text-6xl text-white font-black font-['Orbitron'] tracking-tighter">VENTING TO SPACE</div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Subject HUD */}
                                <div className="flex items-end justify-between mb-8 pb-6 border-b border-white/5">
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-black tracking-[0.5em] text-cyan-400 italic uppercase opacity-60">Identity Inspection Suite</div>
                                        <h2 className="text-4xl font-black text-white tracking-tighter uppercase font-['Orbitron']">{selectedRequest.fromName}</h2>
                                        <div className="flex items-center gap-3 mt-4">
                                            <div className="bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full text-[9px] font-black tracking-widest border border-cyan-500/20 uppercase">
                                                {selectedRequest.type === 'share' ? 'Payload: Artifact' : 'Identity: Link Request'}
                                            </div>
                                            <div className="font-mono text-[9px] text-slate-500 uppercase tracking-widest opacity-60">
                                                Hub-07 // Verified Signature: [AES-256]
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2 p-4 bg-white/5 rounded-2xl border border-white/5 max-w-sm">
                                        <div className="text-[9px] font-black text-slate-500 tracking-widest uppercase mb-1 opacity-50">Inbound Comm</div>
                                        <p className="text-white/80 font-serif leading-relaxed text-right italic text-base line-clamp-3">
                                            "{selectedRequest.message || "Establishing connection request..."}"
                                        </p>
                                    </div>
                                </div>

                                <GlassContainer variant="flat" className="flex-1 p-6 mb-8 overflow-y-auto custom-scrollbar relative border-white/5">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className={`p-2 rounded-xl ${isVetting ? 'bg-cyan-500/10' : 'bg-purple-500/10'}`}>
                                            <Wand2 size={18} className={`${isVetting ? 'text-cyan-400 animate-spin' : 'text-purple-400'}`} />
                                        </div>
                                        <div>
                                            <h4 className="text-[10px] font-black tracking-[0.3em] text-purple-300 uppercase italic">GIGI_NEURAL_SIGHT</h4>
                                            <p className="text-[9px] font-mono text-slate-500 tracking-widest opacity-60">FUZZY CROSS-REF (V2.4)</p>
                                        </div>
                                    </div>

                                    {isVetting ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[1, 2].map(i => (
                                                <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse border border-white/5" />
                                            ))}
                                        </div>
                                    ) : aiMatches.length > 0 ? (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {aiMatches.map((match, i) => {
                                                const tag = existingTags.find(t => t.id === match.tagId);
                                                return (
                                                    <motion.div
                                                        key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                                                        className={`p-4 rounded-2xl border transition-all ${selectedTagId === match.tagId
                                                            ? 'bg-purple-500/10 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.1)] scale-[1.01]'
                                                            : 'bg-white/5 border-white/10 hover:border-white/20'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-4 mb-3">
                                                            <GlassAvatar
                                                                imageUrl={tag?.mediaGallery?.[0]?.url}
                                                                altText={tag?.name || 'Unknown'}
                                                                fallbackChar={tag?.name || '?'}
                                                                size="w-10 h-10"
                                                                className="border-2 border-purple-500/20"
                                                            />
                                                            <div className="flex-1">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <div className="font-black text-purple-200 tracking-tight text-sm uppercase truncate max-w-[100px]">{tag?.name || 'Unknown'}</div>
                                                                    <div className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/20">
                                                                        {(match.confidence * 100).toFixed(0)}% MATCH
                                                                    </div>
                                                                </div>
                                                                <div className="text-[8px] font-black text-slate-500 tracking-widest uppercase opacity-60">IDENTITY_CORRELATION</div>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-mono leading-relaxed mb-4 h-10 line-clamp-3 italic opacity-70">
                                                            {match.reasoning}
                                                        </p>
                                                        <GlassButton
                                                            onClick={(e) => { e.stopPropagation(); setSelectedTagId(match.tagId); }}
                                                            variant={selectedTagId === match.tagId ? "primary" : "secondary"}
                                                            className="w-full text-[9px] py-2 rounded-lg tracking-[0.2em] font-black italic uppercase"
                                                        >
                                                            {selectedTagId === match.tagId ? "LINKED" : "LINK PERSONA"}
                                                        </GlassButton>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center py-12 text-slate-600 opacity-40">
                                            <p className="font-mono text-[10px] tracking-widest text-center italic uppercase">IDENTITY_NULL // NO CORRELATIONS FOUND</p>
                                        </div>
                                    )}
                                </GlassContainer>

                                {/* Action Console */}
                                <div className="p-4 bg-black/40 rounded-3xl border border-white/10 flex items-center gap-4">
                                    {!showConfirmReject ? (
                                        <>
                                            <div className="flex-1 flex gap-4">
                                                <GlassButton
                                                    onClick={() => handleAccept(1)}
                                                    variant="primary"
                                                    title="Full Authorization: Grant subject entry into the system"
                                                    className="flex-1 h-14 rounded-2xl text-[10px] uppercase tracking-widest italic"
                                                >
                                                    <Shield className="mr-2" /> GRANT ACCESS
                                                </GlassButton>
                                                <GlassButton
                                                    onClick={() => handleAccept(2)}
                                                    variant="secondary"
                                                    title="Shadow Pass: Grant restricted proxy access"
                                                    className="flex-1 h-14 rounded-2xl text-[10px] border-cyan-500/20 text-cyan-400 uppercase tracking-widest italic"
                                                >
                                                    <Check className="mr-2" /> DIRECT PROXY
                                                </GlassButton>
                                            </div>

                                            <div className="w-px h-8 bg-white/10 mx-2" />

                                            <GlassButton
                                                onClick={() => setShowConfirmReject(true)}
                                                variant="danger"
                                                title="Open Rejection Protocol"
                                                className="w-14 h-14 p-0 rounded-2xl shrink-0"
                                            >
                                                <Trash2 />
                                            </GlassButton>
                                        </>
                                    ) : (
                                        <div className="flex-1 flex items-center gap-4 bg-red-900/10 p-2 pl-4 rounded-2xl animate-in slide-in-from-right-4 duration-300">
                                            <div className="flex-1">
                                                <div className="text-[9px] font-black text-red-400 tracking-widest uppercase mb-1">REJECTION_PROTOCOL_READY</div>
                                                <select
                                                    value={rejectionReason}
                                                    onChange={(e) => setRejectionReason(e.target.value)}
                                                    className="w-full bg-black/40 border-none px-3 py-1.5 text-white font-bold tracking-widest text-[10px] uppercase italic focus:outline-none cursor-pointer rounded-lg"
                                                >
                                                    <option value="I do not know you">Reason: Unknown Entity</option>
                                                    <option value="I do not recall you">Reason: Zero Correlation</option>
                                                    <option value="You have me confused with someone else">Reason: Collision Detected</option>
                                                    <option value="Custom">Custom Rejection</option>
                                                </select>
                                            </div>
                                            <div className="flex gap-2 pr-2">
                                                <GlassButton variant="ghost" title="Return to safe state" onClick={() => setShowConfirmReject(false)} className="text-[10px] uppercase">CANCEL</GlassButton>
                                                <GlassButton
                                                    onClick={handleReject}
                                                    variant="danger"
                                                    title="Warning: Permanent rejection of signal"
                                                    className="px-6 text-[10px] uppercase tracking-widest italic"
                                                >
                                                    VENT_SIGNAL
                                                </GlassButton>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </GlassContainer>
            </div>

            {/* --- SYSTEM STATUS BAR --- */}
            <div className="w-full max-w-7xl mt-4 px-2 py-3 rounded-xl bg-black/20 border border-white/5 flex justify-between items-center opacity-60">
                <div className="flex items-center gap-6 font-mono text-[9px] font-black tracking-[0.2em] text-cyan-500 uppercase italic">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_cyan] animate-pulse"></div>
                        <span>SYNC_STATUS: NOMINAL</span>
                    </div>
                    <span>CIPHER: AES_256_GCM</span>
                    <span>HUB: 07_ORBITAL</span>
                </div>
                <div className="font-mono text-[9px] font-black tracking-widest text-slate-500 uppercase">
                    © 2025 PROJECT_GIGI // AIRLOCK_SECURE_NODE
                </div>
            </div>
        </div>
    );
};
