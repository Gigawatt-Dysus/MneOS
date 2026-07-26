import React, { useState, useMemo } from 'react';
import type { View, Media } from '../../types';
import { 
    Image as ImageIcon, Plus, CheckCircle2, AlertCircle, Filter, Fingerprint, HelpCircle, Clock 
} from 'lucide-react';
import { formatLifeOSDate, extractDateFromFilename } from '../../utils/dateSanitizer';
import { getMediaType } from '../matrix/MatrixShared';
import { ShimmerWindow } from '../shared/ShimmerWindow';

interface RecentArtifactsCardProps {
    media: Media[];
    onNavigate: (view: View, data?: any) => void;
}

export const RecentArtifactsCard: React.FC<RecentArtifactsCardProps> = ({ media, onNavigate }) => {
    // Mode State: 'inbox' (Show only what needs work) vs 'all' (Show recent 50)
    const [viewFilter, setViewFilter] = useState<'inbox' | 'all'>('inbox');

    const recentMedia = useMemo(() => {
        let sorted = [...media]
            .filter(m => !m.isAvatar && !m.id.startsWith('media-avatar-'))
            .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
        
        if (viewFilter === 'inbox') {
            sorted = sorted.filter(m => {
                if (m.isInboxDismissed) return false;
                
                // Definition of "Done" = Has Valid Date AND (Tags OR Context)
                // Relaxed logic: If you have a valid date and EITHER tags OR a description/caption, 
                // you have "worked" on the artifact enough to clear it from the inbox.
                const hasValidDate = m.logicalDate && new Date(m.logicalDate).getFullYear() > 1900;
                const hasTags = m.tagIds && m.tagIds.length > 0;
                const hasContext = (m.title && m.title.length > 0) || (m.caption && m.caption.length > 0) || (m.description && m.description.length > 0);
                const hasLocation = m.location && (m.location.address || m.location.lat);
                
                // Keep in inbox if: Date is invalid OR (No Tags AND No Context AND No Location)
                return !hasValidDate || (!hasTags && !hasContext && !hasLocation);
            });
        }
        
        return sorted.slice(0, 50); // Action List Depth
    }, [media, viewFilter]);

    return (
        <ShimmerWindow containerClassName="h-full min-h-[500px] shadow-2xl" className="gigi-bento-card p-6 relative overflow-hidden flex flex-col h-full">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-cyan-900/30 rounded-lg text-cyan-400 border border-cyan-800/50"><ImageIcon size={14} /></div>
                    <span className="text-sm font-bold text-white">Recent Artifacts</span>
                    
                    {/* UX Tooltip: Popping DOWNWARDS to avoid clipping */}
                    <div className="group relative flex items-center">
                        <HelpCircle size={12} className="text-slate-600 hover:text-cyan-400 cursor-help transition-colors ml-1" />
                        
                        {/* Tooltip Container: top-full pushes it DOWN */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 p-2.5 bg-[#1a1d26] border border-cyan-500/20 rounded-lg shadow-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            
                            {/* Arrow: pointing UP */}
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-cyan-500/20"></div>
                            
                            <p className="text-[10px] leading-tight text-slate-300 text-center relative z-10">
                                <span className="font-bold text-cyan-400 block mb-1">CLEARING THE INBOX</span>
                                An item is marked <span className="text-green-400">Done</span> when it has a <span className="text-white">Valid Date</span> AND either <span className="text-white">Tags</span> or a <span className="text-white">Description</span>.
                            </p>
                        </div>
                    </div>
                </div>
                
                {/* View Toggle */}
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                    <button 
                        onClick={() => setViewFilter('inbox')} 
                        className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${viewFilter === 'inbox' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        INBOX
                    </button>
                    <button 
                        onClick={() => setViewFilter('all')} 
                        className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${viewFilter === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        ALL
                    </button>
                </div>
            </div>
            
            {/* Custom scrollbar class applied here */}
            <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                {recentMedia.length > 0 ? recentMedia.map(m => {
                    // [ZEN] Smart Detection: If logicalDate is missing, check if the filename can save it.
                    let recoveredDate = null;
                    if (!m.logicalDate && m.originalName) {
                        recoveredDate = extractDateFromFilename(m.originalName);
                    }

                    const isInvalidDate = (!m.logicalDate && !recoveredDate) || 
                                        (m.logicalDate && new Date(m.logicalDate).getFullYear() < 1900);
                    const hasNoTags = !m.tagIds || m.tagIds.length === 0;
                    const hasNoContext = !m.caption && !m.description;

                    const displayDate = m.logicalDate || recoveredDate;

                    return (
                        <div 
                            key={m.id} 
                            onClick={() => onNavigate('theMatrix', { mediaId: m.id, mediaObject: m, returnTo: 'dashboard' })}
                            className="flex items-center gap-3 p-3 rounded-xl bg-black/20 hover:bg-black/40 backdrop-blur-md transition-colors cursor-pointer border border-white/5 group relative"
                        >
                            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 bg-black/20">
                                {(() => {
                                    let thumbUrl = m.thumbnailUrls?.small || m.thumbnailUrl || m.url;
                                    if (thumbUrl && thumbUrl.includes('media.gigiwatt.com/') && !thumbUrl.includes('/file/LifeOS-Media/')) {
                                        thumbUrl = thumbUrl.replace('media.gigiwatt.com/', 'media.gigiwatt.com/file/LifeOS-Media/');
                                    }
                                    const type = getMediaType(m);
                                    if (type === 'video' && (!m.thumbnailUrls || Object.keys(m.thumbnailUrls).length === 0)) {
                                        return (
                                            <video 
                                                src={m.url} 
                                                muted 
                                                loop 
                                                playsInline 
                                                autoPlay 
                                                className="w-full h-full object-cover shadow-sm group-hover:scale-105 transition-transform" 
                                            />
                                        );
                                    }
                                    return (
                                        <img 
                                            src={thumbUrl} 
                                            className="w-full h-full object-cover shadow-sm group-hover:scale-105 transition-transform" 
                                            alt="Thumb" 
                                            loading="lazy"
                                        />
                                    );
                                })()}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-200 truncate group-hover:text-cyan-400 transition-colors">
                                    {m.title || m.originalName || "Untitled"}
                                </p>
                                
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {isInvalidDate && (
                                        <span className="text-[9px] text-red-400 bg-red-950/30 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono border border-red-500/20">
                                            <AlertCircle size={8} /> Date
                                        </span>
                                    )}
                                    {hasNoTags && (
                                        <span className="text-[9px] text-amber-400 bg-amber-950/30 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono border border-amber-500/20">
                                            <Filter size={8} /> Tag
                                        </span>
                                    )}
                                    {hasNoContext && (
                                        <span className="text-[9px] text-blue-400 bg-blue-950/30 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono border border-blue-500/20">
                                            <Fingerprint size={8} /> Info
                                        </span>
                                    )}
                                    {!isInvalidDate && (
                                        <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1 uppercase tracking-tighter">
                                            <Clock size={10} className="opacity-50" />
                                            {displayDate ? formatLifeOSDate(displayDate, m.datePrecision || 'exact') : 'Unassigned'}
                                            {recoveredDate && <span className="text-[8px] text-cyan-500/50 ml-1">(RECOVERED)</span>}
                                        </p>
                                    )}
                                    <div className="ml-auto flex items-center pr-2">
                                        {m.url?.includes('media.gigiwatt.com') || m.url?.includes('backblazeb2.com') ? (
                                            <img src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/backblaze.svg" alt="Backblaze" className="w-3.5 h-3.5 opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all" title="Sovereign Backblaze B2 Storage" />
                                        ) : m.url?.includes('firebasestorage.googleapis.com') ? (
                                            <img src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/firebase.svg" alt="Firebase" className="w-3.5 h-3.5 opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all" title="Legacy Google Cloud Storage" />
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Visual Check if 'Done' (matches inbox logic) */}
                            {!isInvalidDate && (!hasNoTags || !hasNoContext) && (
                                <div className="text-green-500 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <CheckCircle2 size={16} />
                                </div>
                            )}
                        </div>
                    );
                }) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600">
                        {viewFilter === 'inbox' ? (
                            <>
                                <div className="w-12 h-12 rounded-full border-2 border-dashed border-emerald-800 flex items-center justify-center mb-2 opacity-50 text-emerald-500">
                                    <CheckCircle2 size={24} />
                                </div>
                                <p className="text-xs font-bold text-emerald-500">All Caught Up!</p>
                                <p className="text-[10px] text-slate-500">Inbox Zero achieved.</p>
                            </>
                        ) : (
                             <>
                                <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center mb-2 opacity-50">
                                    <Plus size={20} />
                                </div>
                                <p className="text-xs">No artifacts found.</p>
                            </>
                        )}
                    </div>
                )}
            </div>
             <button onClick={() => onNavigate('theMatrix')} className="w-full mt-4 py-3 bg-black/20 hover:bg-black/40 border border-white/5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all uppercase tracking-widest shrink-0">Open Matrix</button>
        </ShimmerWindow>
    );
};