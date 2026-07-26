import React from 'react';

const ZenOrb: React.FC<{ size?: number, className?: string }> = ({ size = 24, className = "" }) => {
    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            <svg 
                width={size} 
                height={size} 
                viewBox="0 0 100 100" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="animate-[spin_10s_linear_infinite]"
            >
                {/* Outer Ring */}
                <circle cx="50" cy="50" r="45" stroke="#00ffcc" strokeWidth="2" strokeDasharray="20 10" opacity="0.5" />
                
                {/* Inner Ring (Counter Spin via CSS is complex in SVG, so we keep it simple/static relative to outer) */}
                <circle cx="50" cy="50" r="35" stroke="#00d2ff" strokeWidth="4" strokeDasharray="60 100" opacity="0.8" />
                
                {/* Core */}
                <circle cx="50" cy="50" r="20" fill="#00ffcc" fillOpacity="0.2" stroke="#00ffcc" strokeWidth="2">
                    <animate attributeName="r" values="20;22;20" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite" />
                </circle>
            </svg>
            
            {/* Glow Effect */}
            <div className="absolute inset-0 rounded-full bg-[#00ffcc] opacity-20 blur-xl animate-pulse pointer-events-none"></div>
        </div>
    );
};

export default ZenOrb;