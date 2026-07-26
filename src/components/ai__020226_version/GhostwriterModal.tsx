import React, { useState } from 'react';
import { createPortal } from 'react-dom'; 
import { Calendar, X } from 'lucide-react';
import type { AiCompanion, ChatMessage } from '../../types';
import { MarkdownEditor } from '../shared/MarkdownEditor'; 

interface GhostwriterModalProps {
    agent: AiCompanion;
    onClose: () => void;
    onSave: (msg: ChatMessage) => Promise<boolean>;
}

export const GhostwriterModal: React.FC<GhostwriterModalProps> = ({ agent, onClose, onSave }) => {
    
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-violet-500/30 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-violet-500/50">
                            <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold flex items-center gap-2">
                                {agent.name} <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30 tracking-wider">GHOSTWRITER</span>
                            </h3>
                            <p className="text-xs text-slate-400">Manual Neural Injection</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 bg-black/20">
                    <div className="bg-black/20 p-3 rounded-xl border border-white/5 mb-4">
                        <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-2 flex items-center gap-1">
                            <Calendar size={12} /> Injection Time
                        </label>
                        <input 
                            type="datetime-local" 
                            value={timestamp}
                            onChange={(e) => setTimestamp(e.target.value)}
                            className="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-violet-500 outline-none font-mono"
                        />
                    </div>

                    {/* [ZEN FIX] Updated Props for Controlled Component */}
                    <MarkdownEditor 
                        value={content}
                        onChange={setContent}
                        onSave={handleSave}
                        onCancel={onClose}
                        saveLabel={isSaving ? "Injecting..." : "Inject"}
                        autoFocus={true}
                        placeholder={`What should ${agent.name.split(' ')[0]} say?`}
                    />
                </div>
            </div>
        </div>,
        document.body
    );
};