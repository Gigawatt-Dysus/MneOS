import React, { useState, useEffect } from 'react';
import { collection, getDocs, writeBatch, doc } from '../../services/sovereignDbAdapter';
import { db } from '../../firebaseConfig';
import { Loader2, Trash2, X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { GlassButton } from '../GlassButton';
import type { Media } from '../../types';

interface AvatarJanitorProps {
    userId: string;
    onClose: () => void;
}

export const AvatarJanitor: React.FC<AvatarJanitorProps> = ({ userId, onClose }) => {
    const [candidates, setCandidates] = useState<Media[]>([]);
    const [loading, setLoading] = useState(true);
    const [sweeping, setSweeping] = useState(false);
    const [complete, setComplete] = useState(false);

    useEffect(() => {
        scanForAvatars();
    }, [userId]);

    const scanForAvatars = async () => {
        setLoading(true);
        try {
            const mediaRef = collection(db, 'users', userId, 'media');
            // [ZEN FIX] Broad Scan
            // Firestore OR queries are limited, so we fetch all and filter in memory for complex patterns.
            // This is safe for admin tools (client-side filter) but not for user-facing views.
            const snapshot = await getDocs(mediaRef);
            
            const found = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as Media))
                .filter(m => {
                    // Skip items already marked as avatars
                    if ((m as any).isAvatar === true) return false;

                    const title = (m.title || '').toLowerCase();
                    const originalName = (m.originalName || '').toLowerCase();

                    // [ZEN FIX] Multiple signatures for "Junk Avatars"
                    return (
                        title === 'untitled asset' ||
                        title === 'untitled' ||
                        title.includes('avatar') ||
                        originalName.includes('avatar') ||
                        // Check for the "round crop" aspect ratio (usually 1:1) combined with generic names
                        (m.width === m.height && title.includes('untitled'))
                    );
                });

            setCandidates(found);
        } catch (error) {
            console.error("Scan failed:", error);
        } finally {
            setLoading(false);
        }
    };

    const performSweep = async () => {
        setSweeping(true);
        try {
            // Firestore batches limited to 500 ops. We chunk it just in case.
            const batchSize = 400; 
            for (let i = 0; i < candidates.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = candidates.slice(i, i + batchSize);
                
                chunk.forEach(media => {
                    const ref = doc(db, 'users', userId, 'media', media.id);
                    batch.update(ref, { isAvatar: true });
                });
                
                await batch.commit();
            }

            setComplete(true);
            setTimeout(onClose, 2000); 
        } catch (error) {
            console.error("Sweep failed:", error);
        } finally {
            setSweeping(false);
        }
    };

    // Helper to toggle a specific item OUT of the candidate list (Manual Override)
    const removeFromCandidates = (id: string) => {
        setCandidates(prev => prev.filter(c => c.id !== id));
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#0f1219] border border-white/10 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl relative overflow-hidden">
                
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Trash2 className="text-amber-500" /> Avatar Janitor
                        </h2>
                        <p className="text-xs text-slate-400 font-mono mt-1">
                            DETECTED SUSPICIOUS FILES. CLICK TO EXCLUDE FROM SWEEP.
                        </p>
                    </div>
                    <GlassButton onClick={onClose} variant="ghost"><X /></GlassButton>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-black/20">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500">
                            <Loader2 className="w-12 h-12 animate-spin mb-4 text-cyan-500" />
                            <span className="text-sm font-mono tracking-widest">SCANNING SECTOR...</span>
                        </div>
                    ) : complete ? (
                        <div className="h-full flex flex-col items-center justify-center text-emerald-400">
                            <CheckCircle2 className="w-16 h-16 mb-4" />
                            <h3 className="text-2xl font-bold">CLEANUP COMPLETE</h3>
                            <p className="text-slate-400 mt-2">{candidates.length} items hidden from Matrix.</p>
                        </div>
                    ) : candidates.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500">
                            <CheckCircle2 className="w-12 h-12 mb-4 text-emerald-500" />
                            <p className="text-lg">No clutter found.</p>
                            <p className="text-xs font-mono mt-2">System is clean.</p>
                            <GlassButton onClick={scanForAvatars} variant="ghost" className="mt-4">
                                <RefreshCw size={14} className="mr-2"/> Re-Scan
                            </GlassButton>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                            {candidates.map(img => (
                                <div 
                                    key={img.id} 
                                    onClick={() => removeFromCandidates(img.id)}
                                    className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group cursor-pointer hover:border-red-500 transition-colors"
                                    title="Click to KEEP this image (Remove from Sweep)"
                                >
                                    <img 
                                        src={img.thumbnailUrls?.small || img.url} 
                                        className="w-full h-full object-cover opacity-70 group-hover:opacity-40 transition-opacity" 
                                    />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X size={24} className="text-red-500 mb-1" />
                                        <span className="text-[9px] font-mono text-white bg-black/50 px-1 rounded">KEEP</span>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1">
                                        <p className="text-[8px] text-white truncate text-center">{img.title || img.originalName}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!loading && !complete && candidates.length > 0 && (
                    <div className="p-6 border-t border-white/10 bg-[#0f1219] flex justify-between items-center">
                        <div className="flex items-center gap-3 text-amber-400 text-xs">
                            <AlertTriangle size={16} />
                            <span>Found <strong>{candidates.length}</strong> potential avatars.</span>
                        </div>
                        <GlassButton 
                            onClick={performSweep} 
                            disabled={sweeping}
                            variant="primary"
                            className="bg-amber-600 hover:bg-amber-500 text-white border-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                        >
                            {sweeping ? <Loader2 className="animate-spin mr-2"/> : <Trash2 className="mr-2" size={16} />}
                            {sweeping ? 'Sweeping...' : 'Sweep & Hide All'}
                        </GlassButton>
                    </div>
                )}
            </div>
        </div>
    );
};