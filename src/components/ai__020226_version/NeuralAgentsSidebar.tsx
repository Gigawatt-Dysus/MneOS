import React, { useState } from 'react';
import { Bot, PenTool, X, RotateCcw, Trash2, History } from 'lucide-react';
import type { AiCompanion, ChatMessage } from '../../types';
import { GhostwriterModal } from './GhostwriterModal';

interface NeuralAgentsSidebarProps {
    agents: AiCompanion[];
    onAgentSelect: (agent: AiCompanion) => void;
    // [ZEN FIX] Add prop to handle the injection
    onInjectMessage: (msg: ChatMessage) => Promise<boolean>;
    // [ZEN V27] Chronos Buffer
    deletedMessagesBuffer?: (ChatMessage & { originalIndex: number })[];
    onRestore?: () => void;
}

export const NeuralAgentsSidebar: React.FC<NeuralAgentsSidebarProps> = ({ agents, onAgentSelect, onInjectMessage }) => {
    const [selectedAgent, setSelectedAgent] = useState<AiCompanion | null>(null);
    const [showGhostwriter, setShowGhostwriter] = useState(false);

    const handleAgentClick = (agent: AiCompanion) => {
        // Toggle selection
        if (selectedAgent?.id === agent.id) {
            setSelectedAgent(null);
        } else {
            setSelectedAgent(agent);
        }
    };

    return (
        <div className="h-full max-h-screen flex flex-col bg-slate-900/50 backdrop-blur-md border-r border-white/5 w-[80px] items-center py-4 relative z-50">

            <div className="mb-2 shrink-0">
                <Bot className="text-violet-400" size={24} />
            </div>

            {/* Scrollable Agent List */}
            <div className="flex-1 w-full flex flex-col items-center gap-4 overflow-y-auto custom-scrollbar p-2">
                {agents.map((agent) => (
                    <div key={agent.id} className="relative group shrink-0">
                        <button
                            onClick={() => handleAgentClick(agent)}
                            className={`w-12 h-12 rounded-full overflow-hidden transition-all duration-300 border-2 ${selectedAgent?.id === agent.id
                                ? 'border-violet-500 scale-110 shadow-[0_0_15px_rgba(139,92,246,0.5)]'
                                : 'border-white/10 hover:border-white/30 grayscale hover:grayscale-0'
                                }`}
                            title={agent.name}
                        >
                            <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
                        </button>

                        {/* Context Menu for Agent */}
                        {selectedAgent?.id === agent.id && (
                            <div className="absolute left-14 top-0 ml-2 bg-slate-900 border border-white/10 rounded-lg shadow-xl p-2 w-48 z-50 animate-in slide-in-from-left-2">
                                <h4 className="text-xs font-bold text-white mb-2 px-2 pb-2 border-b border-white/10">
                                    {agent.name}
                                </h4>

                                <button
                                    onClick={() => onAgentSelect(agent)}
                                    className="w-full text-left px-2 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/10 rounded flex items-center gap-2"
                                >
                                    <Bot size={12} /> Chat with {agent.name.split(' ')[0]}
                                </button>

                                {/* [ZEN FIX] Ghostwriter Trigger */}
                                <button
                                    onClick={() => setShowGhostwriter(true)}
                                    className="w-full text-left px-2 py-1.5 text-xs text-violet-300 hover:text-violet-200 hover:bg-violet-500/20 rounded flex items-center gap-2 mt-1"
                                >
                                    <PenTool size={12} /> Manual Input
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Ghostwriter Modal */}
            {showGhostwriter && selectedAgent && (
                <GhostwriterModal
                    agent={selectedAgent}
                    onClose={() => setShowGhostwriter(false)}
                    onSave={onInjectMessage}
                />
            )}
        </div>
    );
};
