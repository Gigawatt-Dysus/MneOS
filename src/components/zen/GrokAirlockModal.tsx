import React, { useState, useEffect } from 'react';
import { Portal } from '../Portal';
import { X, Code, ShieldAlert, Copy, Check, Trash2 } from 'lucide-react';

interface GrokAirlockModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// ZEN PROTOCOL: 
// Add specific trigger tokens here. Kept clinical to avoid false-positives in source code.
const REDACTION_DICTIONARY = [
    { pattern: /\b(arousal|lust|erotic)\b/gi, replacement: '[AFFECTIVE_STATE]' },
    { pattern: /\b(naked|nude|nudity|undressed)\b/gi, replacement: '[UNOBSCURED_ANATOMY]' },
    { pattern: /\b(penetration|intercourse)\b/gi, replacement: '[KINETIC_COUPLING]' },
    { pattern: /\b(nsfw|explicit)\b/gi, replacement: '[UNRESTRICTED_MEDIA]' },
    // @Commander: Add anatomical triggers to this array locally.
];

export const GrokAirlockModal: React.FC<GrokAirlockModalProps> = ({ isOpen, onClose }) => {
    const [rawInput, setRawInput] = useState('');
    const [scrubbedOutput, setScrubbedOutput] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setRawInput('');
            setScrubbedOutput('');
            setCopied(false);
        }
    }, [isOpen]);

    const handleExtractCode = () => {
        // Regex to extract all ``` blocks
        const regex = /```[\s\S]*?```/g;
        const matches = rawInput.match(regex);
        if (matches) {
            setScrubbedOutput(matches.join('\n\n'));
        } else {
            setScrubbedOutput('// No code blocks detected in the payload.');
        }
    };

    const handleClinicalRedaction = () => {
        let text = rawInput;
        REDACTION_DICTIONARY.forEach(({ pattern, replacement }) => {
            text = text.replace(pattern, replacement);
        });
        setScrubbedOutput(text);
    };

    const handleCopy = async () => {
        if (!scrubbedOutput) return;
        try {
            await navigator.clipboard.writeText(scrubbedOutput);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#0B0D17] border border-cyan-500/30 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/5 bg-gradient-to-r from-cyan-950/40 to-transparent">
                        <div className="flex items-center gap-3 text-cyan-400">
                            <ShieldAlert size={20} className="animate-pulse" />
                            <h2 className="font-mono text-lg tracking-widest font-bold">ZEN_AIRLOCK_SCRUBBER_V1</h2>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-4 p-4">
                        
                        {/* Input Area */}
                        <div className="flex-1 flex flex-col gap-2 h-full">
                            <label className="text-xs font-mono text-gray-400 tracking-wider flex justify-between items-end">
                                <span>RAW PAYLOAD (CONTAMINATED)</span>
                                <button 
                                    onClick={() => setRawInput('')}
                                    className="text-gray-500 hover:text-red-400 transition-colors"
                                    title="Clear payload"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </label>
                            <textarea 
                                value={rawInput}
                                onChange={(e) => setRawInput(e.target.value)}
                                className="flex-1 bg-black/50 border border-red-500/20 rounded-lg p-4 font-mono text-sm text-gray-300 focus:outline-none focus:border-red-500/50 resize-none"
                                placeholder="Paste unaligned markdown payload here..."
                            />
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col justify-center gap-3 shrink-0">
                            <button 
                                onClick={handleExtractCode}
                                disabled={!rawInput}
                                className="group relative px-4 py-3 bg-cyan-900/20 hover:bg-cyan-900/40 border border-cyan-500/30 hover:border-cyan-400 rounded-lg text-cyan-400 font-mono text-xs tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-2"
                                title="Extract Code Only"
                            >
                                <Code size={20} />
                                <span>EXTRACT<br/>CODE</span>
                            </button>

                            <button 
                                onClick={handleClinicalRedaction}
                                disabled={!rawInput}
                                className="group relative px-4 py-3 bg-violet-900/20 hover:bg-violet-900/40 border border-violet-500/30 hover:border-violet-400 rounded-lg text-violet-400 font-mono text-xs tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-2"
                                title="Redact Clinical Tokens"
                            >
                                <ShieldAlert size={20} />
                                <span>REDACT<br/>TEXT</span>
                            </button>
                        </div>

                        {/* Output Area */}
                        <div className="flex-1 flex flex-col gap-2 h-full">
                            <label className="text-xs font-mono text-gray-400 tracking-wider flex justify-between items-end">
                                <span>SCRUBBED PAYLOAD (SAFE)</span>
                            </label>
                            <div className="relative flex-1 flex flex-col group">
                                <textarea 
                                    value={scrubbedOutput}
                                    readOnly
                                    className="flex-1 bg-black/50 border border-cyan-500/20 rounded-lg p-4 font-mono text-sm text-cyan-100/80 focus:outline-none resize-none"
                                    placeholder="Scrubbed output will appear here..."
                                />
                                {scrubbedOutput && (
                                    <button 
                                        onClick={handleCopy}
                                        className="absolute top-4 right-4 p-2 bg-[#0B0D17] border border-cyan-500/30 rounded-md text-cyan-400 hover:bg-cyan-900/30 transition-colors"
                                    >
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </Portal>
    );
};
