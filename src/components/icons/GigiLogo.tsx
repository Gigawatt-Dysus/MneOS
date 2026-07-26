import React from 'react';

// Define the interface to fix the TS2304 error
interface GigiLogoProps {
    size?: number;
    className?: string;
}

// Rename the component to GigiLogo and use the new interface
const GigiLogo: React.FC<GigiLogoProps> = ({ size = 400, className }) => {
  const cyan = '#00d2ff';
  const slate400 = '#94a3b8';
  const white = '#ffffff';

  return (
    <div className={`flex items-center justify-center ${className || ''}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 425 425"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-pulse-slow"
      >
        <defs>
          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          <filter id="text-glow" x="-50%" y="-50%" width="200%" height="200%">
             <feGaussianBlur stdDeviation="3" result="blur" />
             <feFlood floodColor={cyan} floodOpacity="0.6" result="color" />
             <feComposite in="color" in2="blur" operator="in" result="shadow" />
             <feMerge>
                <feMergeNode in="shadow" />
                <feMergeNode in="SourceGraphic" />
             </feMerge>
          </filter>
        </defs>

        <circle
          cx="200"
          cy="200"
          r="180"
          fill="none"
          stroke={cyan}
          strokeWidth="8"
          filter="url(#ring-glow)"
          opacity="0.9"
        />

        <g className="font-sans">
            <text
                x="200"
                y="210"
                textAnchor="middle"
                fill={white}
                fontFamily="Impact, sans-serif"
                fontSize="110"
                letterSpacing="2"
                filter="url(#text-glow)"
            >
                G.I.G.I.
            </text>

            <line
                x1="80"
                y1="210"
                x2="320"
                y2="210"
                stroke={cyan}
                strokeWidth="3"
                filter="url(#ring-glow)"
            />

            <text
                x="200"
                y="245"
                textAnchor="middle"
                fill={slate400}
                fontFamily="Montserrat, sans-serif"
                fontWeight="bold"
                fontSize="18"
                letterSpacing="4"
            >
                GUIDED INTELLIGENCE
            </text>

            <text
                x="200"
                y="260"
                textAnchor="middle"
                fill={slate400}
                fontFamily="Montserrat, sans-serif"
                fontWeight="bold"
                fontSize="14"
                letterSpacing="3"
            >
                GENEALOGICAL INTERFACE
            </text>
        </g>
      </svg>
    </div>
  );
};

export default GigiLogo;