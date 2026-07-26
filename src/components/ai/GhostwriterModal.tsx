import React, { useState } from 'react';
import { createPortal } from 'react-dom'; 
import { Calendar, X, PenTool } from 'lucide-react';
import type { AiCompanion, ChatMessage } from '../../types';
import { MarkdownEditor } from '../shared/MarkdownEditor'; 

interface GhostwriterModalProps {
    agent: AiCompanion;
    onClose: () => void;
    onSave: (msg: ChatMessage) => Promise<boolean>;
    userId: string;
    userPresets?: any[];
}

export const GhostwriterModal: React.FC<GhostwriterModalProps> = ({ agent, onClose, onSave, userId, userPresets }) => {
    
    const getLocalISOString = () => {
        const now = new Date();
        const offsetMs = now.getTimezoneOffset() * 60000; 
        const localDate = new Date(now.getTime() - offsetMs);
        return localDate.toISOString().slice(0, 16);
    };

    const [content, setContent] = useState(''); // [ZEN FIX] Content State
    const [timestamp, setTimestamp] = useState(getLocalISOString());
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (textToSave: string) => {
        if (!textToSave.trim()) return;
        setIsSaving(true);

        const dateObj = new Date(timestamp);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const ms = dateObj.getMilliseconds().toString().padStart(3, '0');
        const dateStr = `${dateObj.getFullYear()}${pad(dateObj.getMonth() + 1)}${pad(dateObj.getDate())}`;
        const timeStr = `${pad(dateObj.getHours())}${pad(dateObj.getMinutes())}${pad(dateObj.getSeconds())}_${ms}`;
        const msgId = `msg_${dateStr}_${timeStr}_model_ghost`;

        // [ZEN FIX] Explicit cast to intersect type for 'id'
        const newMessage: ChatMessage & { id: string } = {
            id: msgId,
            role: 'model',
            content: textToSave,
            author: { name: agent.name, avatarUrl: agent.avatarUrl },
            timestamp: dateObj
        };

        const success = await onSave(newMessage);
        if (success) onClose();
        setIsSaving(false);
    };

    return createPortal(
        <div className="fixed inset-0 bg-[#050506]/90 backdrop-blur-md z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-[#12141c] border border-violet-500/30 rounded-[2rem] w-full max-w-2xl shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_40px_rgba(139,92,246,0.1)] animate-in zoom-in-95 duration-500 flex flex-col max-h-[85vh] overflow-hidden">
                
                {/* Header: Neural Identity Anchor */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-gradient-to-r from-violet-600/10 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-xl group-hover:bg-violet-500/40 transition-all duration-700" />
                            <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-violet-500/40 shadow-2xl">
                                <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-xl font-black text-white tracking-tight">{agent.name}</h3>
                                <span className="text-[9px] font-black bg-violet-500 text-white px-2.5 py-0.5 rounded-full tracking-[0.2em] uppercase shadow-lg shadow-violet-500/20">Ghostwriter</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Manual Narrative Inscription</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white group"
                    >
                        <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Body: The Writing Desk */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar bg-black/20">
                        
                        {/* Temporal Anchor */}
                        <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                            <label className="text-[10px] uppercase text-slate-600 font-black tracking-widest mb-3 flex items-center gap-2">
                                <Calendar size={12} className="text-violet-400" /> Temporal Displacement
                            </label>
                            <input 
                                type="datetime-local" 
                                value={timestamp}
                                onChange={(e) => setTimestamp(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none font-mono transition-all"
                            />
                            <p className="text-[9px] text-slate-700 mt-2 italic font-medium px-1">Adjust the timestamp to slot this memory precisely into the historical continuum.</p>
                        </div>

                        {/* Narrative Content */}
                        <div className="flex-1 min-h-[300px] flex flex-col">
                            <label className="text-[10px] uppercase text-slate-600 font-black tracking-widest mb-3 flex items-center gap-2 px-1">
                                <PenTool size={12} className="text-cyan-400" /> Neural Signal
                            </label>
                            <div className="flex-1 rounded-2xl border border-white/5 bg-black/40 overflow-hidden focus-within:border-violet-500/50 transition-all shadow-inner">
                                <MarkdownEditor 
                                    value={content}
                                    onChange={setContent}
                                    onSave={handleSave}
                                    onCancel={onClose}
                                    saveLabel={isSaving ? "Injecting..." : "Commit to History"}
                                    autoFocus={true}
                                    placeholder={`Compose ${agent.name.split(' ')[0]}'s response...`}
                                    userId={userId}
                                    userPresets={userPresets}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Decor */}
                <div className="p-3 bg-black/40 border-t border-white/5 flex justify-center items-center">
                    <div className="flex gap-1.5">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]' : 'bg-white/10'}`} />
                        ))}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};