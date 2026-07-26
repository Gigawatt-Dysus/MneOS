import React, { useState } from 'react';
import { useChatSessions } from '../../context/ChatSessionContext';
import { Plus, MessageSquare, Trash2, X, Clock, Search } from 'lucide-react';

interface SessionsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SessionsDrawer: React.FC<SessionsDrawerProps> = ({ isOpen, onClose }) => {
    const { sessions, currentSessionId, setCurrentSessionId, createNewSession, handleDeleteSession } = useChatSessions();
    const [isCreating, setIsCreating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredSessions = sessions.filter(s => 
        (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (s.preview || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateNew = async () => {
        setIsCreating(true);
        try {
            await createNewSession('New Conversation');
            if (window.innerWidth < 768) {
                onClose();
            }
        } finally {
            setIsCreating(false);
        }
    };

    const handleSelectSession = (id: string) => {
        setCurrentSessionId(id);
        if (window.innerWidth < 768) {
            onClose();
        }
    };

    return (
        <div 
            className={`fixed top-0 bottom-0 left-0 w-[320px] bg-[#0f1219]/95 backdrop-blur-3xl border-r border-white/5 z-[90] shadow-[20px_0_50px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${isOpen ? 'translate-x-0 md:translate-x-[80px]' : '-translate-x-full'}`}
        >
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.02]">
                <div>
                    <h2 className="text-sm font-bold tracking-widest text-white uppercase font-['Orbitron']">Neural Threads</h2>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">Isolated State Sessions</p>
                </div>
                <button 
                    onClick={onClose}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="p-4 space-y-3 border-b border-white/5">
                <button 
                    onClick={handleCreateNew}
                    disabled={isCreating}
                    className="w-full py-3 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 rounded-xl flex items-center justify-center gap-2 text-xs font-bold tracking-wide uppercase transition-all disabled:opacity-50 hover:shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                >
                    <Plus size={16} />
                    {isCreating ? 'Initializing...' : 'New Uplink Thread'}
                </button>
                
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={14} className="text-slate-500" />
                    </div>
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search threads..."
                        className="w-full bg-[#0a0d14] border border-white/10 rounded-lg py-2 pl-9 pr-3 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar-thin p-2 space-y-1">
                {filteredSessions.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-slate-500 gap-2 opacity-50">
                        <MessageSquare size={24} />
                        <span className="text-xs">{searchQuery ? 'No matching threads' : 'No active threads'}</span>
                    </div>
                ) : (
                    filteredSessions.map(session => {
                        const isActive = currentSessionId === session.id;
                        return (
                            <div 
                                key={session.id}
                                onClick={() => handleSelectSession(session.id)}
                                className={`group relative w-full p-3 rounded-xl cursor-pointer transition-all border ${isActive ? 'bg-violet-500/10 border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'}`}
                            >
                                <div className="flex justify-between items-start mb-1.5">
                                    <h3 className={`text-sm font-bold truncate pr-6 ${isActive ? 'text-violet-300' : 'text-slate-300 group-hover:text-white'}`}>
                                        {session.title || 'Untitled Thread'}
                                    </h3>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if(window.confirm('Delete this entire neural thread?')) handleDeleteSession(session.id);
                                        }}
                                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/20 rounded-md transition-all"
                                        title="Purge Thread"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                
                                {session.preview && (
                                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-2">
                                        {session.preview}
                                    </p>
                                )}

                                <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-mono uppercase tracking-wider">
                                    <Clock size={10} />
                                    {new Date(session.lastUpdatedAt).toLocaleString(undefined, {
                                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                    })}
                                </div>

                                {isActive && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-violet-500 rounded-r-full shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
