import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Shield, Search, CheckCircle2 } from 'lucide-react';
import { GlassButton } from '../GlassButton';
import { GlassCard } from '../GlassCard';
import { Vert } from '../../types';

interface ShareRecipientModalProps {
    verts: Vert[];
    onShare: (recipientUid: string) => Promise<void>;
    onClose: () => void;
    itemCount: number;
}

export const ShareRecipientModal: React.FC<ShareRecipientModalProps> = ({
    verts,
    onShare,
    onClose,
    itemCount
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUid, setSelectedUid] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);

    const filteredVerts = verts.filter(v =>
        v.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.localNickname?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleShare = async () => {
        if (!selectedUid) return;
        setIsSharing(true);
        try {
            await onShare(selectedUid);
            onClose();
        } catch (error) {
            console.error("Sharing failed:", error);
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <GlassCard className="p-6 border-cyan-500/30">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-cyan-500/20 p-2 rounded-lg">
                                <Share2 className="text-cyan-400 w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Share Artifacts</h3>
                                <p className="text-xs text-cyan-400/60 font-mono italic">
                                    TRANSMITTING {itemCount} ITEMS
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search Verts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                        />
                    </div>

                    <div className="max-h-[300px] overflow-y-auto mb-6 custom-scrollbar pr-2 flex flex-col gap-2">
                        {filteredVerts.length === 0 ? (
                            <div className="py-8 text-center text-white/20 italic text-sm">
                                <Shield className="w-8 h-8 mx-auto mb-2 opacity-10" />
                                No active Verts found
                            </div>
                        ) : (
                            filteredVerts.map(vert => (
                                <button
                                    key={vert.uid}
                                    onClick={() => setSelectedUid(vert.uid)}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${selectedUid === vert.uid
                                            ? 'bg-cyan-500/20 border-cyan-500/50 text-white'
                                            : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:border-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-xs font-bold text-white uppercase">
                                            {vert.displayName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm">
                                                {vert.localNickname || vert.displayName}
                                            </div>
                                            {vert.localNickname && (
                                                <div className="text-[10px] opacity-40 uppercase tracking-tighter">
                                                    @{vert.displayName}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {selectedUid === vert.uid && (
                                        <CheckCircle2 className="text-cyan-400 w-5 h-5" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    <div className="flex gap-3">
                        <GlassButton
                            onClick={onClose}
                            className="flex-1"
                        >
                            CANCEL
                        </GlassButton>
                        <GlassButton
                            onClick={handleShare}
                            disabled={!selectedUid || isSharing}
                            className={`flex-1 ${selectedUid ? 'bg-cyan-500 text-white border-none' : 'opacity-50'}`}
                        >
                            {isSharing ? 'TRANSMITTING...' : 'SEND TO AIRLOCK'}
                        </GlassButton>
                    </div>
                </GlassCard>
            </motion.div>
        </div>
    );
};
