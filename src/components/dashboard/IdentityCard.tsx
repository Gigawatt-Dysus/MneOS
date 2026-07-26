import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { View, User, Tag, Media } from '../../types';
import { Fingerprint, Globe, AlertTriangle, Hand, Database, Cloud } from 'lucide-react';
import { GlassAvatar } from '../GlassAvatar';
import { MasterStatusBoard } from './MasterStatusBoard';
import { motion, AnimatePresence } from 'framer-motion';
import { migrateChatHistory } from '../../services/dataRepairChat';
import { ShimmerWindow } from '../shared/ShimmerWindow';
import { MapLibreMap } from '../MapLibreMap';

const SpatialEntitiesMap: React.FC<{ tags: Tag[], onNavigate: (view: View, data?: any) => void, interactive?: boolean }> = ({ tags, onNavigate, interactive }) => {
    return (
        <div className="w-full h-full animate-in fade-in duration-700">
            <MapLibreMap tags={tags} onNavigate={onNavigate} interactive={interactive} />
        </div>
    );
};


interface IdentityCardProps {
    user: User;
    media: Media[];
    tagCount: number;
    eventCount: number;
    vertCount: number;
    stagedCount: number;
    airlockCount: number;
    shoeboxCount: number;
    messengerCount: number;
    chatCount: number; // [ZEN] Local Chat total count
    neuralTemperature: number;
    onNavigate: (view: View, data?: any) => void;
    tags: Tag[];
    apiKey?: string;
    ragConnections?: number;
    ragTokens?: number;
}

export const IdentityCard: React.FC<IdentityCardProps> = ({ user, media, tagCount, eventCount, vertCount, stagedCount, airlockCount, shoeboxCount, messengerCount, chatCount, neuralTemperature, onNavigate, tags, apiKey, ragConnections, ragTokens }) => {
    // State to control map interaction shield
    const [isMapInteractive, setIsMapInteractive] = useState(false);

    const storageStats = useMemo(() => {
        const total = media.length;
        const backblaze = media.filter(m => m.url?.includes('media.gigiwatt.com') || m.url?.includes('backblazeb2.com')).length;
        const firebase = total - backblaze;
        return { total, backblaze, firebase };
    }, [media]);

    return (
        <ShimmerWindow containerClassName="shadow-xl hover:shadow-2xl transition-all duration-300 group" className="gigi-bento-card relative overflow-hidden bg-slate-900/40 backdrop-blur-xl border border-white/5 p-6 h-full transition-all duration-300 hover:border-white/10">
            <div
                className="absolute inset-0 z-0"
                title="Double-click to Edit Profile"
                onDoubleClick={() => onNavigate('profile')}
            />
            {/* Active Scanline Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
            <motion.div 
                animate={{ translateY: [-100, 400] }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-20 w-full"
            />

            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-5">
                    {/* Avatar with Neural Ring */}
                    <div className="relative">
                        <div className="absolute -inset-1.5 pointer-events-none">
                            <svg className="w-full h-full" viewBox="0 0 100 100">
                                <circle
                                    cx="50" cy="50" r="48"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className={`${
                                        neuralTemperature > 80 ? 'text-red-500/40' :
                                        neuralTemperature > 40 ? 'text-amber-500/30' :
                                        'text-emerald-500/30'
                                    }`}
                                />
                            </svg>
                        </div>
                        
                        <GlassAvatar
                            imageUrl={user?.profilePictureUrl}
                            altText={user?.displayName || 'User'}
                            fallbackChar={user?.displayName || 'User'}
                            size="w-16 h-16"
                            className="text-2xl font-bold border-2 border-white/10 relative z-10"
                        />

                        {/* Status LED */}
                        <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-slate-900 z-20 ${
                            neuralTemperature > 80 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
                        }`} />
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <h2 className="text-xl lg:text-2xl font-black text-white tracking-tighter leading-none">{user?.displayName || 'User'}</h2>
                            <div className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                                <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">Active Sync</span>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 text-slate-400">
                                    <Fingerprint size={12} className="text-violet-400" />
                                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold">Architect</span>
                                </div>
                                <div className="h-3 w-[1px] bg-white/10" />
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em]">Lvl</span>
                                    <span className="text-xs font-black text-white font-mono">12</span>
                                </div>
                            </div>
                            
                            {/* Neural Stability / Progress Bar */}
                            <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden relative">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: '65%' }}
                                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-600 to-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                                />
                                {neuralTemperature > 60 && (
                                    <motion.div 
                                        animate={{ opacity: [0, 1, 0] }}
                                        transition={{ duration: 0.2, repeat: Infinity }}
                                        className="absolute inset-0 bg-red-500/20"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Master Status Board (Christmas Tree) */}
                <div className="relative z-30">
                    <MasterStatusBoard 
                        vertCount={vertCount}
                        tagCount={tagCount}
                        eventCount={eventCount}
                        mediaCount={storageStats.total}
                        stagedCount={stagedCount}
                        airlockCount={airlockCount}
                        shoeboxCount={shoeboxCount}
                        messengerCount={messengerCount}
                        chatCount={chatCount}
                        onNavigate={onNavigate}
                        ragConnections={ragConnections}
                        ragTokens={ragTokens}
                    />
                </div>
            </div>
        </ShimmerWindow>
    );
};