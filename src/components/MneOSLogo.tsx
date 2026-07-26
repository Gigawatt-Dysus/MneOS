import React from 'react';

interface MneOSLogoProps {
    variant?: 'icon' | 'full' | 'hero';
    className?: string;
    size?: number;
}

const MneOSLogo: React.FC<MneOSLogoProps> = ({ variant = 'full', className = '', size = 300 }) => {
    const cyan = '#22d3ee'; // cyan-400
    const deepCyan = '#0891b2'; // cyan-600
    const white = '#ffffff';
    const violet = '#8b5cf6'; // violet-500
    const slate400 = '#94a3b8';

    // Calculate dynamic scaling and viewBox parameters based on the variant
    const viewBoxWidth = variant === 'icon' ? 120 : (variant === 'hero' ? 600 : 450);
    const viewBoxHeight = variant === 'icon' ? 120 : (variant === 'hero' ? 200 : 150);

    return (
        <div className={`flex flex-col items-center justify-center ${className} select-none pointer-events-none`}>
            <svg
                width={variant === 'icon' ? size : '100%'}
                height={variant === 'icon' ? size : (size / 3)}
                viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                xmlns="http://www.w3.org/2000/svg"
                style={{ maxWidth: '100%', height: 'auto' }}
            >
                <defs>
                    <filter id="os-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    
                    <filter id="helix-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feFlood floodColor={cyan} floodOpacity="0.7" result="glowCol" />
                        <feComposite in="glowCol" in2="blur" operator="in" result="shadow" />
                        <feMerge>
                            <feMergeNode in="shadow" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    <linearGradient id="human-trail" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={violet} />
                        <stop offset="50%" stopColor={cyan} />
                        <stop offset="100%" stopColor={deepCyan} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* The Radical I Icon */}
                <g 
                    transform={`translate(${variant === 'icon' ? 60 : 40}, ${variant === 'icon' ? 60 : 70})`} 
                    filter="url(#helix-glow)"
                >
                    {/* The Radical (Mathematical Square Root) */}
                    <path
                        d="M -20 -5 L -5 25 L 18 -40 L 55 -40"
                        fill="none"
                        stroke={cyan}
                        strokeWidth="8"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                        strokeMiterlimit="4"
                    />
                    
                    {/* The 'i' (Mathematical Imaginary Unit) */}
                    <text 
                        x="37" 
                        y="18" 
                        fill={white} 
                        fontSize="64" 
                        fontFamily="'Times New Roman', Times, serif" 
                        fontStyle="italic"
                        fontWeight="bold"
                        textAnchor="middle"
                        filter="url(#os-glow)"
                    >
                        i
                    </text>
                </g>

                {/* Wordmark (Only visible in 'full' or 'hero' mode) */}
                {variant !== 'icon' && (
                    <g transform={`translate(100, ${variant === 'hero' ? 110 : 90})`} className="font-['Orbitron',_sans-serif]">
                        {/* 'Life' text */}
                        <text
                            x="0"
                            y="0"
                            fill={white}
                            fontSize={variant === 'hero' ? "96" : "64"}
                            fontWeight="800"
                            letterSpacing="4"
                            filter="url(#os-glow)"
                        >
                            Mne
                        </text>
                        
                        {/* Stencil 'O' */}
                        <g transform={`translate(${variant === 'hero' ? 245 : 165}, ${variant === 'hero' ? -70 : -45}) scale(${variant === 'hero' ? 1.5 : 1})`} filter="url(#os-glow)">
                            <path d="M 20 0 A 25 25 0 0 0 20 50" fill="none" stroke={cyan} strokeWidth="6" strokeLinecap="square" />
                            <path d="M 30 50 A 25 25 0 0 0 30 0" fill="none" stroke={cyan} strokeWidth="6" strokeLinecap="square" />
                        </g>

                        {/* 'S' text */}
                        <text
                            x={variant === 'hero' ? "330" : "225"}
                            y="0"
                            fill={cyan}
                            fontSize={variant === 'hero' ? "90" : "60"}
                            fontWeight="800"
                            filter="url(#os-glow)"
                        >
                            S
                        </text>

                        {/* Tagline */}
                        <text
                            x={variant === 'hero' ? "220" : "150"}
                            y={variant === 'hero' ? "45" : "30"}
                            textAnchor="middle"
                            fill={slate400}
                            fontFamily="monospace"
                            fontSize={variant === 'hero' ? "14" : "11"}
                            letterSpacing={variant === 'hero' ? "8" : "5"}
                            className="uppercase tracking-widest font-bold"
                        >
                            Solving for I
                        </text>

                        {/* Underline structural accent */}
                        <line 
                            x1={variant === 'hero' ? "-20" : "-10"} 
                            y1={variant === 'hero' ? "65" : "45"} 
                            x2={variant === 'hero' ? "460" : "310"} 
                            y2={variant === 'hero' ? "65" : "45"} 
                            stroke={cyan} 
                            strokeWidth="1" 
                            strokeOpacity="0.5" 
                        />
                    </g>
                )}
            </svg>
        </div>
    );
};

export default MneOSLogo;
