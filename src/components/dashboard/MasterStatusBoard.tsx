import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Fingerprint, Database, Cloud, 
    MessageSquare, MessageCircle, Tag, Calendar, Image as ImageIcon, Wand2, Archive, Microscope 
} from 'lucide-react';
import type { View } from '../../types';
import { AI_TriageModal } from '../TakeoutAirlock/AI_TriageModal';
import { collection, query, where, limit, getDocs, doc, updateDoc, db, orderBy } from '../../services/sovereignDbAdapter';
import { useUser } from '@clerk/clerk-react';

interface MSBProps {
    vertCount: number;
    tagCount: number;
    eventCount: number;
    mediaCount: number;
    stagedCount: number;
    airlockCount: number;
    shoeboxCount: number;
    messengerCount: number;
    chatCount: number; // [ZEN] Local Chat total index count
    onNavigate: (view: View, data?: any) => void;
    ragConnections?: number;
    ragTokens?: number;
}

export const MasterStatusBoard: React.FC<MSBProps> = ({
    vertCount, tagCount, eventCount, mediaCount, stagedCount, airlockCount, shoeboxCount, messengerCount, chatCount, onNavigate, ragConnections, ragTokens
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
    const [isTriageOpen, setIsTriageOpen] = useState(false);
    const [triageDoc, setTriageDoc] = useState<any>(null);
    const [triageMode, setTriageMode] = useState<'pending' | 'recent'>('pending');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const { user } = useUser();

    // Click-outside-to-close
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                triggerRef.current && !triggerRef.current.contains(target) &&
                popoverRef.current && !popoverRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleTriggerClick = () => {
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPopoverPos({
                top: rect.bottom + 10,
                left: rect.left - 140,
            });
        }
        setIsOpen(prev => !prev);
    };

    const handleNavigate = (view: View, data?: any) => {
        setIsOpen(false);
        onNavigate(view, data);
    };

    const fetchTriageDoc = async (mode: 'pending' | 'recent' = 'pending') => {
        if (!user) return;
        setTriageMode(mode);
        try {
            let q;
            if (mode === 'recent') {
                q = query(
                    collection(db, 'users', user.id, 'media'),
                    where('aiProcessed', '==', true),
                    { type: 'orderBy', args: ['aiProcessedAt', 'desc'] },
                    limit(20)
                );
            } else {
                q = query(collection(db, 'users', user.id, 'media'), where('reviewStatus', '==', 'pending_review'), limit(1));
            }
            
            const snap = await getDocs(q);
            if (!snap.empty) {
                if (mode === 'recent') {
                    // Find a doc where NO version of it has been completed (handling dual-write ghost docs)
                    const doc = snap.docs.find((d: any) => {
                        if (d.data().reviewStatus === 'completed') return false;
                        const duplicates = snap.docs.filter((dup: any) => dup.id === d.id);
                        const isAlreadyCompleted = duplicates.some((dup: any) => dup.data().reviewStatus === 'completed');
                        return !isAlreadyCompleted;
                    });
                    if (doc) {
                        setTriageDoc({ _id: doc.id, ...doc.data() });
                        setIsTriageOpen(true);
                        setIsOpen(false);
                    } else {
                        alert('No recent unreviewed AI captions found in the last 20 sweeps.');
                    }
                } else {
                    setTriageDoc({ _id: snap.docs[0].id, ...snap.docs[0].data() });
                    setIsTriageOpen(true);
                    setIsOpen(false);
                }
            } else {
                alert(mode === 'recent' ? 'No recently processed AI documents found.' : 'No pending review documents found! Queue is clear.');
            }
        } catch (e) {
            console.error("Failed to fetch triage doc:", e);
        }
    };

    const handleAdoptTriage = async (docId: string, finalCaption: string, rotation?: number) => {
        if (!user) return;
        try {
            const updates: any = {
                aiDescription: finalCaption,
                reviewStatus: 'completed'
            };
            if (rotation !== undefined) {
                updates.rotation = rotation;
            }
            await updateDoc(doc(db, 'users', user.id, 'media', docId), updates);
            setTriageDoc(null);
            fetchTriageDoc(triageMode); // Load next automatically
        } catch (e) {
            console.error("Failed to adopt caption:", e);
        }
    };

    const stats = [
        { label: 'Verts', count: vertCount, icon: Fingerprint, color: 'text-violet-400', view: 'archivists' as View },
        { label: 'Tags', count: tagCount, icon: Tag, color: 'text-cyan-400', view: 'tags' as View },
        { label: 'Events', count: eventCount, icon: Calendar, color: 'text-emerald-400', view: 'timeVortex' as View },
        { label: 'Media', count: mediaCount, icon: ImageIcon, color: 'text-blue-400', view: 'theMatrix' as View },
        { label: 'Gateway', count: stagedCount, icon: Wand2, color: 'text-amber-400', view: 'staging' as View },
        { label: 'Airlock', count: airlockCount, icon: Database, color: 'text-orange-400', view: 'airlock' as View },
        { label: 'Shoebox', count: shoeboxCount, icon: Archive, color: 'text-cyan-500', view: 'theMatrix' as View, data: { view: 'shoebox' } },
        { label: 'Chat', count: chatCount, icon: MessageCircle, color: 'text-teal-400', view: 'interviews' as View },
        { label: 'Messenger', count: messengerCount, icon: MessageSquare, color: 'text-pink-400', view: 'commsCenter' as View },
    ];

    return (
        <>
            {/* Christmas Tree Trigger Button */}
            <button
                ref={triggerRef}
                onClick={handleTriggerClick}
                title="Open Master Status Board" // Override parent card title tooltip!
                aria-label="Open Master Status Board"
                aria-expanded={isOpen}
                className={`w-10 h-10 rounded-xl bg-black/40 border transition-all duration-200 flex items-center justify-center cursor-pointer overflow-hidden relative group ${
                    isOpen
                        ? 'border-cyan-500/60 bg-cyan-950/30'
                        : 'border-white/10 hover:border-cyan-500/50 hover:bg-black/60'
                }`}
            >
                <div className="grid grid-cols-3 gap-1 pointer-events-none">
                    {[...Array(9)].map((_, i) => (
                        <motion.div
                            key={i}
                            animate={{
                                opacity: [0.4, 1, 0.4],
                                scale: [1, 1.2, 1],
                            }}
                            transition={{
                                duration: 2 + (i * 0.3),
                                repeat: Infinity,
                                delay: i * 0.15,
                            }}
                            className={`w-1 h-1 rounded-full ${
                                i % 3 === 0 ? 'bg-emerald-500' :
                                i % 3 === 1 ? 'bg-cyan-500' :
                                'bg-violet-500'
                            } shadow-[0_0_5px_rgba(34,211,238,0.5)]`}
                        />
                    ))}
                </div>

                {/* Scanning overlay — pointer-events-none so it doesn't interfere */}
                <motion.div
                    animate={{ translateY: [-40, 40] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent pointer-events-none"
                />
            </button>

            {/* Popover Portal */}
            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            ref={popoverRef}
                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            style={{
                                position: 'fixed',
                                top: popoverPos.top,
                                left: popoverPos.left,
                                zIndex: 9999,
                            }}
                            className="w-[320px] bg-[#0a0a0b]/95 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden"
                        >
                            <div className="p-4 bg-gradient-to-b from-white/5 to-transparent">
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                        Master Status Board
                                    </span>
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {/* RAG Stats — full-width row */}
                                    {ragConnections !== undefined && ragTokens !== undefined && (
                                        <div className="col-span-2 flex items-center justify-between p-3 rounded-2xl bg-cyan-950/20 border border-cyan-500/20">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-black/40 text-cyan-400">
                                                    <Database size={16} />
                                                </div>
                                                <div>
                                                    <span className="block text-lg font-bold text-white leading-none">
                                                        {ragTokens.toLocaleString()}
                                                    </span>
                                                    <span className="text-[9px] text-cyan-500 uppercase font-black tracking-widest">
                                                        RAG Tokens (Vol)
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <span className="block text-lg font-bold text-white leading-none">
                                                        {ragConnections.toLocaleString()}
                                                    </span>
                                                    <span className="text-[9px] text-violet-500 uppercase font-black tracking-widest">
                                                        Neural Links
                                                    </span>
                                                </div>
                                                <div className="p-2 rounded-xl bg-black/40 text-violet-400">
                                                    <Cloud size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Navigation stat tiles */}
                                    {stats.map((stat) => (
                                        <button
                                            key={stat.label}
                                            onClick={() => handleNavigate(stat.view, stat.data)}
                                            className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-left group/tile"
                                        >
                                            <div className={`p-2 rounded-xl bg-black/40 ${stat.color} group-hover/tile:brightness-125 transition-all`}>
                                                <stat.icon size={16} />
                                            </div>
                                            <div>
                                                <span className="block text-lg font-bold text-white leading-none">
                                                    {stat.count}
                                                </span>
                                                <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">
                                                    {stat.label}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-3 pt-3 border-t border-white/10 px-2 flex flex-col gap-2">
                                    <button
                                        onClick={() => fetchTriageDoc('pending')}
                                        className="w-full flex items-center justify-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider transition-all"
                                    >
                                        <Microscope size={14} />
                                        Pending Triage Queue
                                    </button>
                                    <button
                                        onClick={() => fetchTriageDoc('recent')}
                                        className="w-full flex items-center justify-center gap-2 p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider transition-all"
                                    >
                                        <Microscope size={14} />
                                        Review Recent Sweeps
                                    </button>
                                </div>
                            </div>

                            {/* Chromatic footer bar */}
                            <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-cyan-500 to-emerald-500 opacity-50" />
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            <AI_TriageModal 
                isOpen={isTriageOpen} 
                onClose={() => setIsTriageOpen(false)}
                document={triageDoc}
                onAdopt={handleAdoptTriage}
            />
        </>
    );
};
