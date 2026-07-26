import React from 'react';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
    className = "",
    variant = 'primary',
    size = 'md',
    children,
    ...props
}) => {

    const variants = {
        primary: "bg-cyan-600/40 text-cyan-50 shadow-cyan-900/20 hover:bg-cyan-500/50",
        secondary: "bg-slate-700/40 text-slate-100 hover:bg-slate-600/50",
        danger: "bg-red-600/30 text-red-50 border-red-500/50 hover:bg-red-500/50",
        success: "bg-emerald-600/40 text-emerald-50 border-emerald-500/50 hover:bg-emerald-500/50",
        ghost: "bg-transparent border-transparent shadow-none hover:bg-white/10"
    };

    const sizes = {
        sm: "px-3 py-1.5 text-xs [&_svg]:w-4 [&_svg]:h-4",
        md: "px-4 py-2 text-sm [&_svg]:w-5 [&_svg]:h-5",
        lg: "px-6 py-3 text-base [&_svg]:w-6 [&_svg]:h-6"
    };

    return (
        <button
            type="button"
            // [ZEN FIX] Added shrink-0 to prevent text squashing in flex containers
            className={`gigi-glass-button font-bold flex items-center justify-center gap-2 shrink-0 [&_svg]:shrink-0 transition-all duration-200 active:scale-95 ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};