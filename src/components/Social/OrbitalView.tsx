import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, Search, Plus, X, Activity, Globe } from 'lucide-react';
import { GlassContainer } from '../GlassContainer';
import { GlassButton } from '../GlassButton';
import { User, Vert, View, Tag, Media } from '../../types';
import { GlassAvatar } from '../GlassAvatar';
import { useState, useEffect } from 'react';
import { SubHeader, SubHeaderAction } from '../SubHeader';

interface OrbitalViewProps {
    user: User;
    verts: Vert[];
    tags: Tag[];
    media: Media[];
    userPersonTagId: string | null;
    onNavigate: (view: View, data?: any) => void;
    addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    onOpenDiscovery: () => void;
}

export const OrbitalView: React.FC<OrbitalViewProps> = ({
    user,
    verts,
    tags,
    media,
    userPersonTagId,
    onNavigate,
    addToast,
    onOpenDiscovery
}) => {
    const [scaleMultiplier, setScaleMultiplier] = useState(1);
    const [selectedVertId, setSelectedVertId] = useState<string | null>(null);
    const [rotation, setRotation] = useState(0);

    // Dynamic Orbital Animation
    useEffect(() => {
        let frame: number;
        const animate = () => {
            setRotation(prev => (prev + 0.2) % 360);
            frame = requestAnimationFrame(animate);
        };
        if (!selectedVertId) frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, [selectedVertId]);

    // Responsive Scaling Logic
    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width < 640) setScaleMultiplier(0.5); // Mobile
            else if (width < 1024) setScaleMultiplier(0.8); // Tablet
            else setScaleMultiplier(1.0); // PC
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 1. Organize Verts by Valence
    const orbits = useMemo(() => {
        const linkedVerts = verts.filter(v => v.status === 'linked');
        return {
            1: linkedVerts.filter(v => (v.valence || 3) === 1), // K-Shell (Inner)
            2: linkedVerts.filter(v => (v.valence || 3) === 2), // L-Shell (Middle)
            3: linkedVerts.filter(v => (v.valence || 3) === 3), // M-Shell (Outer)
        };
    }, [verts]);

    // 2. Geometry constants (Scaled)
    const RADIUS_BASE = 160 * scaleMultiplier;
    const RADIUS_STEP = 140 * scaleMultiplier;

    return (
        <div className="h-full w-full flex flex-col items-center justify-start animate-in fade-in duration-500 overflow-hidden bg-black/20 backdrop-blur-md relative">
            {/* Background Atmosphere */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#111827_0%,_#030712_100%)]" />
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
            </div>

            <SubHeader
                className="w-full max-w-7xl"
                left={
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => onNavigate('dashboard')}
                            className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/5 transition-all"
                            title="Return to Dashboard"
                        >
                            <X size={20} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                <Globe size={18} className="text-blue-400" />
                            </div>
                            <div>
                                <h1 className="text-lg font-black text-white tracking-widest uppercase font-['Orbitron']">Orbital Network</h1>
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span className="text-[10px] font-bold text-slate-400 tracking-wider">TOPOLOGY_ACTIVE</span>
                                </div>
                            </div>
                        </div>
                    </div>
                }
                right={
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex flex-col items-end px-4 py-2 bg-black/30 rounded-xl border border-white/5">
                            <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase">Connectivity</span>
                            <span className="text-[10px] font-bold text-blue-400 uppercase">{verts.length} ADJACENT_NODES</span>
                        </div>
                        <SubHeaderAction
                            onClick={onOpenDiscovery}
                            variant="primary"
                            icon={<Plus size={16} />}
                            label="Discover Verts"
                        />
                    </div>
                }
            />

            <div className="flex-1 flex items-center justify-center relative select-none">
                {/* CENTERED ORBITAL RINGS */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {[1, 2, 3].map(level => (
                        <div
                            key={level}
                            className="absolute rounded-full border border-cyan-500/10"
                            style={{
                                width: (RADIUS_BASE + (level - 1) * RADIUS_STEP) * 2,
                                height: (RADIUS_BASE + (level - 1) * RADIUS_STEP) * 2,
                                borderStyle: level === 3 ? 'dashed' : (level === 2 ? 'dotted' : 'solid'),
                                opacity: selectedVertId ? 0.05 : 0.2
                            }}
                        />
                    ))}
                </div>

                {/* CENTER: SOLAR NUCLEUS (YOU) */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{
                        scale: selectedVertId ? 0.8 : 1,
                        opacity: selectedVertId ? 0.3 : 1
                    }}
                    className="relative z-20"
                >
                    <div className="relative">
                        <GlassAvatar
                            imageUrl={user.profilePictureUrl || `https://ui-avatars.com/api/?name=${user.firstName}&background=0D8ABC&color=fff`}
                            size="w-20 md:w-28 h-20 md:h-28"
                            className="planet"
                        />

                        {/* Status Capsule */}
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
                            <div className="px-3 py-1 bg-black/60 backdrop-blur-md border border-cyan-500/30 rounded-full shadow-lg whitespace-nowrap">
                                <span className="text-[10px] font-black text-cyan-400 tracking-[0.2em] uppercase italic">
                                    {user.preferredName || user.displayName || user.firstName}
                                </span>
                            </div>
                            <p className="text-[9px] text-white/40 font-mono mt-1 lowercase tracking-tighter">{user.email}</p>
                        </div>
                    </div>
                </motion.div>

                {/* VERTS IN ORBIT */}
                {Object.entries(orbits).map(([levelStr, levelVerts]) => {
                    const level = parseInt(levelStr);
                    const radius = RADIUS_BASE + (level - 1) * RADIUS_STEP;
                    const typedVerts = levelVerts as Vert[];

                    return typedVerts.map((vert, index) => {
                        const isSelected = selectedVertId === vert.uid;
                        const angleStep = (2 * Math.PI) / typedVerts.length;
                        const currentRotation = selectedVertId ? 0 : (rotation * (level === 1 ? 1 : (level === 2 ? -0.5 : 0.3)));
                        const angle = angleStep * index - (Math.PI / 2) + (currentRotation * (Math.PI / 180));

                        const x = isSelected ? 0 : radius * Math.cos(angle);
                        const y = isSelected ? -100 : radius * Math.sin(angle);

                        // [ZEN FIX] Resolve Avatar from Media Library or Tags
                        let avatarUrl = vert.profilePictureUrl;
                        const linkedTag = tags.find(t => t.id === vert.associatedTagId);

                        if (!avatarUrl && linkedTag) {
                            if (linkedTag.mainImageId) {
                                const foundMedia = media.find(m => m.id === linkedTag.mainImageId);
                                if (foundMedia?.url) {
                                    avatarUrl = foundMedia.url;
                                } else {
                                    const localMedia = linkedTag.mediaGallery?.find((m: any) => m.mediaId === linkedTag.mainImageId || m.id === linkedTag.mainImageId);
                                    avatarUrl = localMedia?.url || (linkedTag.mainImageId.startsWith('http') || linkedTag.mainImageId.startsWith('data:') ? linkedTag.mainImageId : '');
                                }
                            } else if (linkedTag.mediaGallery?.[0]?.url) {
                                avatarUrl = linkedTag.mediaGallery[0].url;
                            }
                        }
                        if (!avatarUrl) {
                            avatarUrl = `https://ui-avatars.com/api/?name=${vert.displayName}&background=334155&color=fff`;
                        }

                        // [ZEN FIX] Get Relationship Badge
                        let relationshipLabel = '';
                        if (linkedTag && linkedTag.type === 'person' && userPersonTagId) {
                            const rel = linkedTag.metadata?.relationships?.find(r => r.relatedPersonId === userPersonTagId);
                            relationshipLabel = rel?.type?.toUpperCase() || '';
                        }

                        return (
                            <motion.div
                                key={vert.uid}
                                layoutId={vert.uid}
                                initial={false}
                                animate={{
                                    x,
                                    y,
                                    scale: isSelected ? 1.5 : 1,
                                    zIndex: isSelected ? 50 : 10,
                                    opacity: selectedVertId && !isSelected ? 0.2 : 1
                                }}
                                className="absolute cursor-pointer group"
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    setSelectedVertId(isSelected ? null : vert.uid);
                                }}
                            >
                                {/* Spherical Planet Styling */}
                                <div className="relative transition-all duration-500">
                                    <div className="absolute -inset-4 bg-blue-400/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <GlassAvatar
                                        imageUrl={avatarUrl}
                                        size="w-12 md:w-16 h-12 md:h-16"
                                        className="planet shadow-[0_0_20px_rgba(0,180,255,0.2)] ring-2 ring-transparent group-hover:ring-cyan-400/50 transition-all"
                                    />

                                    {/* Interaction Labels */}
                                    <div className={`absolute left-1/2 -translate-x-1/2 mt-3 text-center transition-all ${isSelected ? 'opacity-100 scale-110' : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100'}`}>
                                        <p className="text-[11px] font-black text-white whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-['Orbitron'] tracking-tighter">
                                            {vert.displayName}
                                        </p>
                                        {relationshipLabel && (
                                            <p className="text-[8px] font-black text-cyan-400 tracking-[0.3em] mt-0.5 drop-shadow-md">
                                                {relationshipLabel}
                                            </p>
                                        )}
                                    </div>

                                    {/* Interaction Menu (The Catch) */}
                                    {isSelected && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                            animate={{ opacity: 1, scale: 1, y: 50 }}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            className="fixed top-1/2 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-64 z-[60]"
                                        >
                                            <GlassButton variant="primary" onClick={() => onNavigate('tagEditor', { tagId: vert.associatedTagId })}>
                                                <Users size={16} className="mr-2" /> VIEW_TAG_MATRIX
                                            </GlassButton>
                                            <GlassButton variant="secondary" onClick={() => onNavigate('interviews', { vertId: vert.uid, mode: 'peer' })}>
                                                <Activity size={16} className="mr-2" /> TRANSMIT_SIGNAL
                                            </GlassButton>
                                            <GlassButton variant="ghost" onClick={() => onNavigate('commsCenter', { filter: vert.displayName })}>
                                                <Globe size={16} className="mr-2" /> SUBSPACE_RECORDS
                                            </GlassButton>
                                            <GlassButton variant="danger" onClick={() => setSelectedVertId(null)} className="mt-2">
                                                <X size={16} className="mr-2" /> CLOSE_BRIDGE
                                            </GlassButton>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    });
                })}

                {verts.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <GlassContainer variant="bento" className="max-w-xs p-8 text-center border-white/10 bg-black/40">
                            <Users className="w-12 h-12 text-blue-500/20 mx-auto mb-4" />
                            <p className="text-white/40 text-[10px] font-black tracking-widest uppercase italic leading-relaxed">
                                NO_ADJACENT_SIGNALS_DETECTED<br />
                                <span className="text-[8px] opacity-60">SCANNING LOCAL MATRIX...</span>
                            </p>
                        </GlassContainer>
                    </div>
                )}
            </div>
        </div>
    );
};
