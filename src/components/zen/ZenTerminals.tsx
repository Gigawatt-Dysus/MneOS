import React from 'react';
import { LucideActivity, LucideZap, LucideCpu } from 'lucide-react';
import type { DevConfig } from './ZenShared';

interface ZenTerminalsProps {
    config: DevConfig;
    issueType: string;
    setIssueType: (val: string) => void;
    module: string;
    setModule: (val: string) => void;
    priority: string;
    setPriority: (val: string) => void;
    model: string;
    setModel: (val: string) => void;
    description: string;
    setDescription: (val: string) => void;
    logs: string;
    setLogs: (val: string) => void;
    output: string;
    isGenerating: boolean;
    handleGenerate: () => void;
    copyToClipboard: () => void;
}

const ZenTerminals: React.FC<ZenTerminalsProps> = (props) => {
    // Sorted lists for dropdowns
    const sortedTypes = [...props.config.issueTypes].sort();
    const sortedModules = [...props.config.modules].sort();

    return (
        <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 min-h-0 overflow-hidden">
            
            {/* LEFT: INPUT CONSOLE */}
            <div className="flex flex-col gap-4 h-full">
                <div className="bg-[#000510]/80 border border-[#00ffcc]/30 p-4 rounded-lg flex-1 flex flex-col shadow-lg backdrop-blur-md">
                    <div className="flex justify-between items-center mb-4 border-b border-[#00ffcc]/20 pb-2">
                        <span className="text-xs font-bold tracking-[0.2em] text-[#00ffcc]/60">INPUT VECTOR</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div>
                            <label className="block text-[10px] uppercase text-[#00ffcc]/60 mb-1">Type</label>
                            <select value={props.issueType} onChange={e => props.setIssueType(e.target.value)} className="w-full bg-[#001020] border border-[#00ffcc]/40 text-[#00ffcc] p-2 rounded text-xs outline-none focus:border-[#00ffcc]">
                                {sortedTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase text-[#00ffcc]/60 mb-1">Module</label>
                            <select value={props.module} onChange={e => props.setModule(e.target.value)} className="w-full bg-[#001020] border border-[#00ffcc]/40 text-[#00ffcc] p-2 rounded text-xs outline-none focus:border-[#00ffcc]">
                                {sortedModules.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase text-[#00ffcc]/60 mb-1">Priority</label>
                            <select value={props.priority} onChange={e => props.setPriority(e.target.value)} className="w-full bg-[#001020] border border-[#00ffcc]/40 text-[#00ffcc] p-2 rounded text-xs outline-none focus:border-[#00ffcc]">
                                <option>Normal</option><option>High</option><option>Critical</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase text-[#00ffcc]/60 mb-1">Model</label>
                            <select value={props.model} onChange={e => props.setModel(e.target.value)} className="w-full bg-[#001020] border border-[#00ffcc]/40 text-[#00ffcc] p-2 rounded text-xs outline-none focus:border-[#00ffcc]">
                                <option value="grok">Grok</option>
                                <option value="local">Local</option>
                            </select>
                        </div>
                    </div>

                    <textarea 
                        value={props.description} 
                        onChange={e => props.setDescription(e.target.value)} 
                        className="flex-1 bg-[#001020] border border-[#00ffcc]/30 text-[#00ffcc] p-3 rounded text-sm font-mono resize-none focus:border-[#00ffcc] outline-none mb-4 placeholder-[#00ffcc]/20"
                        placeholder="// Enter directives here..."
                    />
                    <textarea 
                        value={props.logs} 
                        onChange={e => props.setLogs(e.target.value)} 
                        className="h-24 bg-[#001020] border border-[#00ffcc]/30 text-[#00ffcc] p-3 rounded text-xs font-mono resize-none focus:border-[#00ffcc] outline-none mb-4 placeholder-[#00ffcc]/20"
                        placeholder="// Paste error logs or trace data..."
                    />

                    <button 
                        onClick={props.handleGenerate} 
                        disabled={props.isGenerating}
                        className={`w-full py-2 font-bold tracking-[0.2em] border border-[#00ffcc] rounded transition-all ${props.isGenerating ? 'bg-[#00ffcc]/10 text-[#00ffcc]/50' : 'bg-[#00ffcc]/20 hover:bg-[#00ffcc] hover:text-black text-[#00ffcc]'}`}
                    >
                        {props.isGenerating ? <LucideActivity className="inline w-4 h-4 animate-spin"/> : <LucideZap className="inline w-4 h-4"/>} 
                        {props.isGenerating ? ' PROCESSING' : ' EXECUTE'}
                    </button>
                </div>
            </div>

            {/* RIGHT: OUTPUT LOG */}
            <div className="flex flex-col h-full">
                <div className="bg-[#000510]/80 border border-[#00ffcc]/30 p-4 rounded-lg h-full flex flex-col shadow-lg backdrop-blur-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-50 pointer-events-none">
                        <LucideCpu size={120} className="text-[#00ffcc]/5" />
                    </div>
                    <div className="flex justify-between items-center mb-2 z-10">
                        <span className="text-xs font-bold tracking-[0.2em] text-[#00ffcc]/60">SYSTEM OUTPUT</span>
                        <button onClick={props.copyToClipboard} className="text-[10px] border border-[#00ffcc]/40 px-2 py-1 rounded hover:bg-[#00ffcc]/20 text-[#00ffcc]">COPY</button>
                    </div>
                    <textarea 
                        value={props.output} 
                        readOnly 
                        className="flex-1 w-full bg-black/40 border border-[#00ffcc]/20 rounded p-4 font-mono text-xs text-[#00ffcc] focus:outline-none resize-none z-10" 
                    />
                </div>
            </div>
        </div>
    );
};

export default ZenTerminals;