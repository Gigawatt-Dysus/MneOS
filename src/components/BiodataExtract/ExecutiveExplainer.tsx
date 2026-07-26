import React, { useState, useEffect } from 'react';
import { Portal } from '../Portal';
import { GlassButton } from '../GlassButton';
import { generateExperiencePitch } from '../../services/aiOrchestrator';
import { User, CareerNode } from '../../types';
import { X, Bot, Zap, ShieldCheck, ArrowRight, User as UserIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ExecutiveSynthesis3D as NeuralSynthesis3D } from './ExecutiveSynthesis3D';

// [ZEN NEW] Isolated Scribe Component to prevent full-modal re-renders
const NeuralScribe: React.FC<{ text: string; finished?: () => void }> = ({ text, finished }) => {
    const [displayPitch, setDisplayPitch] = useState('');
    
    useEffect(() => {
        if (!text) return;
        let i = 0;
        const interval = setInterval(() => {
            setDisplayPitch(text.substring(0, i));
            i += 5;
            if (i >= text.length + 10) {
                clearInterval(interval);
                if (finished) finished();
            }
        }, 30);
        return () => clearInterval(interval);
    }, [text, finished]);

    return (
        <div className="prose prose-invert max-w-none 
            prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-6
            prose-headings:text-emerald-400 prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter prose-headings:mb-4 prose-headings:mt-8
            prose-strong:text-emerald-400 prose-strong:font-bold
            prose-ul:text-slate-400 prose-li:mb-2 prose-li:marker:text-emerald-500/50
            font-sans text-[15px]">
            <ReactMarkdown>{displayPitch}</ReactMarkdown>
        </div>
    );
};

interface ExecutiveExplainerProps {
    node: CareerNode;
    user: User;
    visitorContext: { name: string, title: string, company: string, role: string };
    onClose: () => void;
    onPitchGenerated?: (title: string, pitch: string) => void;
}

export const ExecutiveExplainer: React.FC<ExecutiveExplainerProps> = ({ node, user, visitorContext, onClose, onPitchGenerated }) => {
    const [fullPitch, setFullPitch] = useState<string>('');
    const [isTyping, setIsTyping] = useState(true);

    useEffect(() => {
        // [ZEN STABILIZATION] The Asynchronous Synchronicity Shield
        let ignore = false;
        
        setFullPitch('');
        setIsTyping(true);

        const getPitch = async () => {
            try {
                const result = await generateExperiencePitch(node, user.biography || '', visitorContext, user);
                if (!ignore) {
                    setFullPitch(result);
                    if (onPitchGenerated) {
                        onPitchGenerated(node.title, result);
                    }
                }
            } catch (err) {
                console.error("Pitch Gen Error:", err);
                if (!ignore) {
                    setFullPitch("The Emissary was unable to synthesize an executive briefing at this time. Network protocol disruption detected.");
                }
            } finally {
                if (!ignore) {
                    setIsTyping(false);
                }
            }
        };
        getPitch();
        
        return () => {
            ignore = true;
        };
    }, [node.id, user.id, visitorContext.company]); // Dependencies stabilized to IDs 

    return (
        <Portal>
            <div className="fixed inset-0 z-[110] flex items-start md:items-center justify-center p-2 md:p-8 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300 overscroll-contain overflow-y-auto pt-10 pb-10">
                <div className="fixed inset-0" onClick={onClose} />
                
                <div className="relative w-full max-w-5xl h-auto md:max-h-[85vh] bg-[#0a0c10] border border-emerald-500/30 rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(16,185,129,0.2)] flex flex-col md:flex-row animate-in zoom-in-95 duration-500 pointer-events-auto">
                    <button onClick={onClose} className="absolute top-4 right-4 md:top-6 md:right-6 text-slate-500 hover:text-white transition-colors z-50 p-2 bg-black/40 rounded-full border border-white/10">
                        <X size={20} />
                    </button>

                    {/* Left: Original Record */}
                    <div className="w-full md:w-2/5 p-6 md:p-8 bg-black/50 border-r border-white/5 overflow-y-auto custom-scrollbar shrink-0">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                <UserIcon className="text-emerald-400" size={20} />
                            </div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Original Record</h3>
                        </div>
                        
                        <h2 className="text-2xl font-bold text-white mb-2">{node.title}</h2>
                        <div className="text-emerald-400 font-mono text-sm tracking-widest uppercase mb-4">{node.organization}</div>
                        <div className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-slate-500 mb-8 uppercase tracking-widest">
                            {node.startDate} - {node.endDate}
                        </div>

                        <ul className="space-y-4">
                            {node.bullets?.map((b, i) => (
                                <li key={i} className="text-sm text-slate-400 leading-relaxed pl-5 relative before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:bg-emerald-500/30 before:rounded-full">
                                    {b}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right: The Pitch */}
                    <div className="w-full md:w-3/5 p-6 md:p-8 relative flex flex-col bg-gradient-to-br from-emerald-950/10 to-transparent min-h-0">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                    <Bot className="text-emerald-400" size={28} />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg tracking-tight">Emissary Executive Pitch</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className={`w-2 h-2 rounded-full bg-emerald-500 ${isTyping ? 'animate-pulse' : ''}`} />
                                        <span className="text-[10px] text-emerald-500/70 font-mono tracking-widest uppercase">Protocol: Recruiter-to-Recruiter Briefing</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl p-6 font-mono text-[13px] text-emerald-50/90 leading-relaxed overflow-y-auto custom-scrollbar shadow-inner relative min-h-[300px] md:min-h-[400px]">
                            {!fullPitch ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <NeuralSynthesis3D />
                                </div>
                            ) : (
                                <NeuralScribe key={fullPitch} text={fullPitch} />
                            )}
                        </div>

                        <div className="mt-8 flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="text-emerald-500/50" size={20} />
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Briefing tailored for</p>
                                    <p className="text-xs text-emerald-400 font-bold">{visitorContext.name} @ {visitorContext.company}</p>
                                </div>
                            </div>
                            <GlassButton onClick={onClose} variant="primary" className="bg-emerald-600/20 text-emerald-400 border-emerald-500/20 group">
                                Acknowledgement Recorded
                                <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                            </GlassButton>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
};
