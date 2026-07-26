import React from 'react';
import { Check, Loader2 } from 'lucide-react';

interface VantablackShieldProps {
    mode: 'white' | 'grey' | 'black';
    onChange: (newMode: 'white' | 'grey' | 'black') => void;
    syncState?: 'idle' | 'syncing' | 'synced'; // [ZEN V32] Sync feedback
    className?: string;
}

export const VantablackShield: React.FC<VantablackShieldProps> = ({
    mode = 'white',
    onChange,
    syncState = 'idle',
    className = ''
}) => {
    // Cycle: White -> Grey -> Black -> White
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (syncState === 'syncing') return; // Block clicks during sync
        if (mode === 'white') onChange('grey');
        else if (mode === 'grey') onChange('black');
        else onChange('white');
    };

    const getTooltip = () => {
        if (syncState === 'syncing') return "Syncing...";
        switch (mode) {
            case 'white': return "Public: Open to AI Creative Mode";
            case 'grey': return "Passive: Mention-only. AI only sees if you type it.";
            case 'black': return "Protected: Vantablack. Entity is redacted from Creative Mode.";
            default: return "Public";
        }
    };

    const getColors = () => {
        switch (mode) {
            case 'white': return { fill: '#FFFFFF', stroke: '#000000', label: 'OPEN' };
            case 'grey': return { fill: '#888888', stroke: 'none', label: 'PASSIVE' };
            case 'black': return { fill: '#000000', stroke: 'none', label: 'SECURE' };
            default: return { fill: '#FFFFFF', stroke: '#000000', label: 'OPEN' };
        }
    };

    const colors = getColors();

    return (
        <button
            onClick={handleClick}
            title={getTooltip()}
            disabled={syncState === 'syncing'}
            className={`relative group transition-transform active:scale-95 ${syncState === 'syncing' ? 'cursor-wait opacity-70' : ''} ${className}`}
        >
            <div className={`p-1 transition-all rounded-full ${mode === 'white' ? 'bg-white/10 hover:bg-white/20' : ''}`}>
                {/* Main Shield Icon */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth="1.5"
                    className={syncState === 'syncing' ? 'opacity-50' : ''}
                >
                    <path fillRule="evenodd" d="M11.606 2.08a1 1 0 0 1 .788 0l6.394 2.741A2 2 0 0 1 20 6.66v6.86a7 7 0 0 1-3.527 6.077l-3.977 2.272a1 1 0 0 1-.992 0l-3.977-2.272A7 7 0 0 1 4 13.518V6.66a2 2 0 0 1 1.212-1.838zm-.899 7.213a1 1 0 0 0-1.414 1.414L10.586 12l-1.293 1.293a1 1 0 1 0 1.414 1.414L12 13.414l1.293 1.293a1 1 0 0 0 1.414-1.414L13.414 12l1.293-1.293a1 1 0 0 0-1.414-1.414L12 10.586z" clipRule="evenodd" />
                </svg>
            </div>

            {/* Sync State Overlay */}
            {syncState === 'syncing' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={12} className="text-cyan-400 animate-spin" />
                </div>
            )}
            {syncState === 'synced' && (
                <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5 animate-in zoom-in duration-200">
                    <Check size={8} className="text-white" />
                </div>
            )}

            {/* Status indicator ring for better visibility on dark backgrounds when black */}
            {mode === 'black' && (
                <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none"></div>
            )}
        </button>
    );
};
