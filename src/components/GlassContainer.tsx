import React from 'react';

interface GlassContainerProps {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'bento' | 'flat';
    onClick?: () => void;
}

export const GlassContainer: React.FC<GlassContainerProps> = ({
    children,
    className = "",
    variant = 'default',
    onClick
}) => {
    const variantClasses = {
        default: "gigi-glass-container",
        bento: "gigi-bento-card",
        flat: "bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl"
    };

    return (
        <div
            onClick={onClick}
            className={`${variantClasses[variant]} ${className}`}
        >
            {children}
        </div>
    );
};
