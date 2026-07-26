import React from 'react';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
    children: React.ReactNode;
}

export const GlassButton: React.FC<GlassButtonProps> = ({ 
    className = "", 
    variant = 'primary', 
    children, 
    ...props 
}) => {
    
    // Tint layers on top of the base glass
    const variants = {
        primary: "bg-cyan-600/40 text-cyan-50 shadow-cyan-900/20 hover:bg-cyan-500/50",
        secondary: "bg-slate-700/40 text-slate-100 hover:bg-slate-600/50",
        danger: "bg-red-600/30 text-red-50 border-red-500/50 hover:bg-red-500/50",
        success: "bg-emerald-600/40 text-emerald-50 border-emerald-500/50 hover:bg-emerald-500/50",
        ghost: "bg-transparent border-transparent shadow-none hover:bg-white/10"
    };

    return (
        <button 
            className={`gigi-glass-button px-4 py-2 font-bold text-sm flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};