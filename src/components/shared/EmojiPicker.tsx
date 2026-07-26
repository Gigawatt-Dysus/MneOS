import React, { useState } from 'react';
import { EMOJI_CATEGORIES, SPICY_EMOJIS } from '../../types';

interface EmojiPickerProps {
    onEmojiSelect: (emoji: string) => void;
    showSpicy?: boolean;
    className?: string;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, showSpicy, className }) => {
    const [activeEmojiTab, setActiveEmojiTab] = useState<keyof typeof EMOJI_CATEGORIES>('smileys');

    const tabs = [
        { key: 'smileys' as const, icon: '😀', label: 'Smileys' },
        { key: 'gestures' as const, icon: '👋', label: 'Gestures' },
        { key: 'hearts' as const, icon: '❤️', label: 'Hearts' },
        { key: 'nature' as const, icon: '🐶', label: 'Nature' },
        { key: 'food' as const, icon: '☕', label: 'Food' },
        { key: 'activities' as const, icon: '⚽', label: 'Activities' },
        { key: 'objects' as const, icon: '💻', label: 'Objects' },
        { key: 'symbols' as const, icon: '✨', label: 'Symbols' }
    ];

    return (
        <div className={`flex flex-col h-full ${className || ''}`}>
            {/* Tab Bar */}
            <div className="flex gap-1 overflow-x-auto pb-2 mb-2 border-b border-white/10 scrollbar-hide shrink-0">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveEmojiTab(tab.key)}
                        className={`flex-shrink-0 px-2 py-1 rounded text-lg transition-colors ${
                            activeEmojiTab === tab.key 
                                ? 'bg-violet-600/30 border border-violet-500/50' 
                                : 'hover:bg-white/5'
                        }`}
                        title={tab.label}
                    >
                        {tab.icon}
                    </button>
                ))}
            </div>

            {/* Grid Area */}
            <div className="grid grid-cols-8 gap-1 overflow-y-auto custom-scrollbar flex-grow content-start">
                {EMOJI_CATEGORIES[activeEmojiTab].map((emoji, idx) => (
                    <button 
                        key={`${activeEmojiTab}-${idx}`} 
                        onClick={() => onEmojiSelect(emoji)}
                        className="hover:bg-white/10 rounded p-1.5 text-xl transition-colors h-10 w-10 flex items-center justify-center"
                    >
                        {emoji}
                    </button>
                ))}
            </div>

            {/* Spicy Extension */}
            {showSpicy && (
                <div className="border-t border-red-500/30 mt-2 pt-2 shrink-0">
                    <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                        🌶️ Spicy
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                        {SPICY_EMOJIS.map((emoji, idx) => (
                            <button 
                                key={`spicy-${idx}`}
                                onClick={() => onEmojiSelect(emoji)}
                                className="hover:bg-red-500/10 rounded p-1 text-lg transition-colors h-8 w-8 flex items-center justify-center"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};