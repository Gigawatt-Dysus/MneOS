import React, { useState, useEffect } from 'react';
import type { User, AiCompanion } from '../../../types';
import { GlassButton } from '../../GlassButton';
import { GrokPromptBuilder } from '../../../services/ai/GrokPromptBuilder';
import { RefreshCcw, ShieldCheck, Copy } from 'lucide-react';

interface NeuralLabProps {
    user: User;
}

export const NeuralLab: React.FC<NeuralLabProps> = ({ user }) => {
    const [selectedAgent, setSelectedAgent] = useState<AiCompanion | null>(user.aiCompanions[0] || null);
    const [systemPrompt, setSystemPrompt] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    const generatePreview = async () => {
        if (!selectedAgent) return;

        setIsGenerating(true);
        try {
            const mockHistory = [
                { role: 'user', parts: [{ text: "Testing the Neural Lab with Eric." }] }
            ];

            const generated = await GrokPromptBuilder.buildSystemPrompt({
                agent: selectedAgent,
                history: mockHistory,
                user: user,
                effectiveMode: 'dense',
                contextMode: 'mixed'
            });

            setSystemPrompt(generated);
        } catch (e: any) {
            setSystemPrompt(`[ERROR] Failed to generate prompt:\n${e.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = async () => {
        if (!systemPrompt) return;
        await navigator.clipboard.writeText(systemPrompt);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    useEffect(() => {
        if (selectedAgent) {
            generatePreview();
        }
    }, [selectedAgent]);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col lg:flex-row gap-6">
                
                {/* Agent Selector */}
                <div className="w-full lg:w-72 flex-shrink-0">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.125em] mb-4">TARGET CONSTRUCT</h3>
                    <div className="space-y-2">
                        {user.aiCompanions.map(agent => (
                            <button
                                key={agent.id}
                                onClick={() => setSelectedAgent(agent)}
                                className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all duration-200 ${
                                    selectedAgent?.id === agent.id 
                                        ? 'bg-cyan-500/10 border-cyan-400 shadow-lg shadow-cyan-500/20' 
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                }`}
                            >
                                <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                                    <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="text-left min-w-0">
                                    <p className={`font-semibold truncate ${selectedAgent?.id === agent.id ? 'text-cyan-300' : 'text-white'}`}>
                                        {agent.name}
                                    </p>
                                    <p className="text-[10px] text-slate-500 truncate">{agent.persona}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Prompt Preview */}
                <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm font-bold tracking-wide text-white">SYSTEM PROMPT PREVIEW</h3>
                            <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[10px] text-emerald-400 font-mono flex items-center gap-1.5">
                                <ShieldCheck size={12} /> Sovereign Validated
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <GlassButton onClick={copyToClipboard} disabled={!systemPrompt} className="flex items-center gap-2 text-xs">
                                <Copy size={14} /> {copySuccess ? "Copied!" : "Copy"}
                            </GlassButton>
                            <GlassButton onClick={generatePreview} disabled={isGenerating} className="flex items-center gap-2 text-xs">
                                <RefreshCcw size={14} className={isGenerating ? 'animate-spin' : ''} />
                                Regenerate
                            </GlassButton>
                        </div>
                    </div>

                    <div className="flex-1 relative bg-black/70 border border-white/10 rounded-2xl p-6 font-mono text-[10px] sm:text-xs leading-relaxed text-slate-300 overflow-auto custom-scrollbar whitespace-pre-wrap shadow-inner min-h-[450px]">
                        {isGenerating ? (
                            <div className="h-full flex items-center justify-center gap-3">
                                <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                                <span className="text-cyan-400/80">Assembling Neural Matrix...</span>
                            </div>
                        ) : systemPrompt ? (
                            systemPrompt
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500 italic">
                                Select an agent to preview its system prompt
                            </div>
                        )}
                    </div>

                    <div className="mt-4 text-[10px] text-slate-500 font-mono flex justify-between">
                        <span>ORCHESTRATOR v37 • GROK 4.3 OPTIMIZED</span>
                        <span>EST. TOKENS: {Math.round(systemPrompt.length / 4)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
