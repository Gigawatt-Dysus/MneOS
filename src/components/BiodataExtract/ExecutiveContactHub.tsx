import React, { useState } from 'react';
import { Mail, Phone, Calendar, ArrowRight, ShieldCheck, Copy, Check, X, Bot } from 'lucide-react';
import { Portal } from '../Portal';

interface ExecutiveContactHubProps {
    isOpen: boolean;
    onClose: () => void;
    user: {
        email: string;
        phoneNumber?: string;
        lifeOsEmail?: string;
        firstName?: string;
    };
}

export const ExecutiveContactHub: React.FC<ExecutiveContactHubProps> = ({ isOpen, onClose, user }) => {
    const [revealPhone, setRevealPhone] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md transition-opacity duration-300">
                {/* Backdrop Click */}
                <div className="absolute inset-0" onClick={onClose} />

                {/* Main Hub Container */}
                <div className="relative w-full max-w-xl bg-[#0a0c10] border border-emerald-500/30 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(16,185,129,0.15)] animate-in slide-in-from-bottom duration-500">
                    
                    {/* Header with Agent Status */}
                    <div className="bg-gradient-to-r from-emerald-900/20 to-transparent p-6 border-b border-emerald-500/20 relative">
                        <div className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors cursor-pointer" onClick={onClose}>
                            <X size={24} />
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                                <Bot className="text-emerald-400" size={24} />
                            </div>
                            <div>
                                <h3 className="text-white font-bold tracking-widest uppercase text-base">Executive Contact Hub</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] text-emerald-500/80 font-mono tracking-widest uppercase">Emissary Guard System Active</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        
                        {/* Option: LifeOS Secure Email */}
                        {user.lifeOsEmail && (
                            <div className="group bg-emerald-950/10 border border-emerald-500/10 p-5 rounded-2xl hover:border-emerald-500/40 transition-all shadow-inner">
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-4">
                                        <div className="mt-1 text-emerald-400"><ShieldCheck size={20} /></div>
                                        <div>
                                            <h4 className="text-emerald-100 font-bold text-sm tracking-wide">LifeOS Secure Messaging</h4>
                                            <p className="text-xs text-slate-500 font-medium mt-1">AI-Grounded Protection // Verified Requests Only</p>
                                            <div className="mt-4 flex items-center gap-2 text-emerald-300 font-mono text-sm group-hover:text-emerald-200 transition-colors">
                                                {user.lifeOsEmail}
                                                <button onClick={() => handleCopy(user.lifeOsEmail!, 'lifeos')} className="p-1.5 hover:bg-emerald-500/10 rounded-lg transition-colors">
                                                    {copiedId === 'lifeos' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="opacity-50" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <a href={`mailto:${user.lifeOsEmail}`} className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl hover:bg-emerald-500 transition-all hover:text-black">
                                        <ArrowRight size={20} />
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Option: Protected Phone */}
                        {user.phoneNumber && (
                            <div className="group bg-white/5 border border-white/5 p-5 rounded-2xl hover:border-white/20 transition-all shadow-inner">
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-4">
                                        <div className="mt-1 text-cyan-400"><Phone size={20} /></div>
                                        <div>
                                            <h4 className="text-slate-100 font-bold text-sm tracking-wide">Direct Voice/SMS Line</h4>
                                            <p className="text-xs text-slate-500 font-medium mt-1">Personal Communication Terminal</p>
                                            
                                            {revealPhone ? (
                                                <div className="mt-4 flex items-center gap-2 text-cyan-300 font-mono text-sm animate-in fade-in slide-in-from-left duration-300">
                                                    {user.phoneNumber}
                                                    <button onClick={() => handleCopy(user.phoneNumber!, 'phone')} className="p-1.5 hover:bg-cyan-500/10 rounded-lg transition-colors">
                                                        {copiedId === 'phone' ? <Check size={14} className="text-cyan-500" /> : <Copy size={14} className="opacity-50" />}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => setRevealPhone(true)}
                                                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl text-[10px] font-bold tracking-widest uppercase hover:bg-cyan-500/20 transition-all shadow-[0_0_15px_rgba(34,211,238,0.1)]"
                                                >
                                                    Request Direct Access
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {revealPhone && (
                                        <a href={`tel:${user.phoneNumber}`} className="bg-cyan-500/10 text-cyan-400 p-3 rounded-xl hover:bg-cyan-500 transition-all hover:text-black">
                                            <ArrowRight size={20} />
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Option: Legacy Email */}
                        <div className="group bg-white/5 border border-white/5 p-5 rounded-2xl hover:border-white/20 transition-all shadow-inner">
                            <div className="flex items-start justify-between">
                                <div className="flex gap-4">
                                    <div className="mt-1 text-indigo-400"><Mail size={20} /></div>
                                    <div>
                                        <h4 className="text-slate-100 font-bold text-sm tracking-wide">Professional Email</h4>
                                        <p className="text-xs text-slate-500 font-medium mt-1">Standard Direct Handoff</p>
                                        <p className="mt-4 text-slate-400 font-mono text-sm">{user.email}</p>
                                    </div>
                                </div>
                                <a href={`mailto:${user.email}`} className="bg-indigo-500/10 text-indigo-400 p-3 rounded-xl hover:bg-indigo-500 transition-all hover:text-black">
                                    <ArrowRight size={20} />
                                </a>
                            </div>
                        </div>

                        {/* Future: Request Interview */}
                        <div className="group bg-indigo-950/20 border border-indigo-500/20 p-5 rounded-2xl opacity-80 cursor-not-allowed">
                            <div className="flex items-start justify-between">
                                <div className="flex gap-4">
                                    <div className="mt-1 text-indigo-400"><Calendar size={20} /></div>
                                    <div>
                                        <h4 className="text-indigo-100 font-bold text-sm tracking-wide">Request Interview (Beta)</h4>
                                        <p className="text-xs text-slate-500 font-medium mt-1">Emissary Managed Calendar Link</p>
                                        <div className="mt-3 inline-flex px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[9px] text-indigo-400 font-mono tracking-widest uppercase">
                                            Syncing with Host Matrix...
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Warning */}
                    <div className="bg-black/40 p-6 border-t border-white/5">
                        <p className="text-[10px] text-slate-500 font-medium text-center leading-relaxed">
                            {user.firstName || 'The user'} has authorized the Emissary to triage incoming communications. <br/>
                            Inquiry logs are preserved to maintain the sanctity of the communication protocol.
                        </p>
                    </div>
                </div>
            </div>
        </Portal>
    );
};
