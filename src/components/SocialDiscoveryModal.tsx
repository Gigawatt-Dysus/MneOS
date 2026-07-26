import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Shield, X, Loader2, Globe, Check } from 'lucide-react';
import { VertService } from '../services/vertService';
import { GlassButton } from './GlassButton';
import { GlassAvatar } from './GlassAvatar';
import type { User } from '../types';

interface SocialDiscoveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
    onToast: (msg: string, type: 'success' | 'error') => void;
}

export const SocialDiscoveryModal: React.FC<SocialDiscoveryModalProps> = ({
    isOpen, onClose, currentUser, onToast
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sendingRequestId, setSendingRequestId] = useState<string | null>(null);
    const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
            setResults([]);
        }
    }, [isOpen]);

    const handleSearch = async () => {
        if (searchTerm.length < 3) return;
        setIsLoading(true);
        try {
            const users = await VertService.searchUsers(currentUser.id, searchTerm);
            setResults(users);
        } catch (error) {
            console.error("Search failed:", error);
            onToast("Discovery scan failed.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendRequest = async (targetUserId: string) => {
        setSendingRequestId(targetUserId);
        try {
            await VertService.sendVertRequest(currentUser, targetUserId);
            setSentRequests(prev => new Set(prev).add(targetUserId));
            onToast("Vertex request transmitted.", "success");
        } catch (error: any) {
            onToast(error.message || "Request failed.", "error");
        } finally {
            setSendingRequestId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[210] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-[#0f1219]/80 backdrop-blur-2xl border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Globe size={20} className="text-cyan-400" />
                            Social Discovery
                        </h2>
                        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Scanning the Archivist Network</p>
                    </div>
                    <GlassButton onClick={onClose} variant="ghost" className="rounded-full h-8 w-8 p-0">
                        <X size={18} />
                    </GlassButton>
                </div>

                {/* Search Input */}
                <div className="p-6 space-y-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Find Archivists by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full pl-12 pr-24 py-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-cyan-500 transition-all font-medium"
                        />
                        <GlassButton
                            onClick={handleSearch}
                            disabled={searchTerm.length < 3 || isLoading}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-4 text-xs font-bold"
                            variant="primary"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={14} /> : 'SCAN'}
                        </GlassButton>
                    </div>

                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5 px-2">
                        <Shield size={10} />
                        Only public profiles appearing in discovery scans.
                    </div>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 custom-scrollbar min-h-[200px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                            <Loader2 className="animate-spin text-cyan-500" size={32} />
                            <p className="text-xs font-bold uppercase tracking-tighter animate-pulse">Scanning Neural Paths...</p>
                        </div>
                    ) : results.length === 0 ? (
                        searchTerm.length >= 3 ? (
                            <div className="text-center py-10">
                                <Search size={40} className="mx-auto text-slate-700 mb-2 opacity-30" />
                                <p className="text-sm text-slate-500">No matching Archivists found.</p>
                            </div>
                        ) : (
                            <div className="text-center py-10 opacity-30">
                                <Globe size={40} className="mx-auto text-slate-700 mb-2" />
                                <p className="text-xs text-slate-500">Enter at least 3 characters to begin scanning.</p>
                            </div>
                        )
                    ) : (
                        results.map((user) => (
                            <div
                                key={user.id}
                                className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between group hover:border-cyan-500/30 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <GlassAvatar
                                        imageUrl={user.profilePictureUrl}
                                        altText={user.displayName}
                                        fallbackChar={user.displayName}
                                        size="w-10 h-10"
                                    />
                                    <div>
                                        <p className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                                            {user.displayName}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-mono italic">
                                            {user.email.replace(/(.{3})(.*)(?=@)/, "$1***")}
                                        </p>
                                    </div>
                                </div>

                                {sentRequests.has(user.id) ? (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
                                        <Check size={12} />
                                        Request Sent
                                    </div>
                                ) : (
                                    <GlassButton
                                        onClick={() => handleSendRequest(user.id)}
                                        disabled={sendingRequestId === user.id}
                                        variant="ghost"
                                        className="h-8 px-3 text-xs font-bold group-hover:bg-cyan-500/20 group-hover:text-cyan-300 group-hover:border-cyan-500/30"
                                    >
                                        {sendingRequestId === user.id ? (
                                            <Loader2 className="animate-spin" size={14} />
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <UserPlus size={14} />
                                                Send Request
                                            </div>
                                        )}
                                    </GlassButton>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-white/5 bg-black/20 text-center">
                    <p className="text-[10px] text-slate-600 italic font-mono uppercase">
                        GIGI Neural Social Protocol v2.1
                    </p>
                </div>
            </div>
        </div>
    );
};
