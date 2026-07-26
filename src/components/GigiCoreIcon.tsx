import React from 'react';

interface GigiCoreIconProps {
    className?: string;
    size?: number;
}

export const GigiCoreIcon: React.FC<GigiCoreIconProps> = ({ className = "w-10 h-10", size }) => {
    const uid = React.useId().replace(/:/g, ""); 

    return (
        <svg 
            viewBox="0 0 500 500" 
            className={className} 
            style={{ width: size, height: size }}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                {/* Neon Blue Outer Glow */}
                <radialGradient id={`${uid}-gGlow`} cx="50%" cy="50%" r="70%">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity=".90"/> 
                    <stop offset="60%" stopColor="#06b6d4" stopOpacity=".30"/>
                    <stop offset="100%" stopColor="#000000" stopOpacity=".00"/>
                </radialGradient>

                {/* Intense Core (White -> Blue) */}
                <linearGradient id={`${uid}-gCore`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="1"/>
                    <stop offset="40%" stopColor="#3b82f6" stopOpacity="1"/>
                    <stop offset="100%" stopColor="#1e3a8a" stopOpacity="1"/>
                </linearGradient>

                <style>{`
                    @keyframes pulse-${uid} {
                        0%   { transform: scale(0.95); opacity: 0.9; }
                        50%  { transform: scale(1.05); opacity: 1; filter: brightness(1.3); }
                        100% { transform: scale(0.95); opacity: 0.9; }
                    }
                    .pulse-group-${uid} { transform-origin: 250px 240px; animation: pulse-${uid} 3s ease-in-out infinite; will-change: transform, opacity; }
                `}</style>
            </defs>

            {/* Dark background backing for contrast against dark UI */}
            <circle cx="250" cy="240" r="160" fill="#000000" opacity="0.3" />

            {/* Dark outer ring */}
            <circle cx="250" cy="240" r="150" fill="none" stroke="#0f172a" strokeWidth="16" opacity=".8"/>

            {/* Inner pulsing glow */}
            <g className={`pulse-group-${uid}`}>
                <circle cx="250" cy="240" r="120" fill={`url(#${uid}-gGlow)`} opacity=".9"/>
            </g>

            {/* Central pupil */}
            <circle cx="250" cy="240" r="50" fill={`url(#${uid}-gCore)`} stroke="#67e8f9" strokeWidth="4" opacity="1"/>

            {/* Cyan Ring */}
            <g className={`pulse-group-${uid}`} opacity="1">
                <circle cx="250" cy="240" r="80" fill="none" stroke="#06b6d4" strokeWidth="6" opacity=".7"/>
            </g>

            {/* Specular Highlight */}
            <g transform="translate(-6,-6)" opacity="1">
                <path d="M212 196 C226 186 244 184 258 194" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity=".95"/>
            </g>
        </svg>
    );
};