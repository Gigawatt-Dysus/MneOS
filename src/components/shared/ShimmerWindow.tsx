import React, { ReactNode } from 'react';
import BorderGlow from './BorderGlow';

interface ShimmerWindowProps {
    children: ReactNode;
    className?: string;
    containerClassName?: string;
}

export const ShimmerWindow: React.FC<ShimmerWindowProps> = ({ children, className = '', containerClassName = '' }) => {
    return (
        <BorderGlow 
            className={`${containerClassName} ${className}`} 
            glowColor="192 100% 50%" // Cyan-ish glow
            backgroundColor="#040b16" // Match the native glass color to block gradient bleed
            borderRadius={22}
            glowRadius={60}
            glowIntensity={0.8}
            fillOpacity={0}
        >
            {children}
        </BorderGlow>
    );
};
