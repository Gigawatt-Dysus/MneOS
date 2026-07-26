import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { NeuralRewriter } from './NeuralRewriter';

interface NeuralBridgeProps {
    value: string;
    onChange: (newValue: string) => void;
    userId: string;
    userPresets?: any[];
    label?: string;
    className?: string;
}

export const NeuralBridge: React.FC<NeuralBridgeProps> = ({
    value, onChange, userId, userPresets, label, className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 text-violet-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-violet-500/20 hover:bg-violet-500/20 hover:border-violet-500/50 transition-all group ${className}`}
                title="Neural Bridge: Ask Brita to rewrite this"
            >
                <Sparkles size={12} className="group-hover:scale-110 group-hover:rotate-12 transition-transform" />
                {label || 'Sparkle'}
            </button>

            {isOpen && createPortal(
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="fixed inset-0" onClick={() => setIsOpen(false)} />
                    <div className="relative z-10 w-full max-w-lg">
                        <NeuralRewriter
                            initialText={value}
                            userId={userId}
                            userPresets={userPresets}
                            onApply={(newText) => {
                                onChange(newText);
                                setIsOpen(false);
                            }}
                            onClose={() => setIsOpen(false)}
                            title="Neural Handshake"
                        />
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
