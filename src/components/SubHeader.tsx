import React from 'react';
import { GlassButton } from './GlassButton';

interface SubHeaderProps {
    children?: React.ReactNode;
    left?: React.ReactNode;
    center?: React.ReactNode;
    right?: React.ReactNode;
    className?: string;
    sticky?: boolean;
    mobileOffset?: string; // e.g. "top-[68px]"
    desktopOffset?: string; // e.g. "top-0"
}

/**
 * [ZEN] Modular SubHeader component for consistent layout and styling across core GIGI views.
 * Enforces design system standards and handles responsive positioning.
 */
export const SubHeader: React.FC<SubHeaderProps> = ({
    children,
    left,
    center,
    right,
    className = "",
    sticky = true,
    mobileOffset = "top-0",
    desktopOffset = "md:top-0"
}) => {
    const stickyClasses = sticky ? `sticky ${mobileOffset} ${desktopOffset} z-30` : "";

    return (
        <header className={`${stickyClasses} w-full bg-[#0f1219]/90 backdrop-blur-xl border-b border-white/10 shrink-0 transition-all duration-300 ${className}`}>
            <div className="container mx-auto px-4 md:px-6 py-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
                    {children ? children : (
                        <>
                            <div className="flex-1 flex items-center gap-4 w-full md:w-auto">
                                {left}
                            </div>
                            {center && (
                                <div className="flex-none md:flex-1 flex justify-center items-center w-full md:w-auto">
                                    {center}
                                </div>
                            )}
                            <div className="flex-1 flex items-center gap-2 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                                {right}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

interface SubHeaderActionProps {
    onClick: (e: React.MouseEvent) => void;
    icon?: React.ReactNode;
    label?: string;
    title?: string;
    variant?: 'primary' | 'secondary' | 'danger';
    className?: string;
    disabled?: boolean;
    children?: React.ReactNode;
}

/**
 * Standardized action button for SubHeaders.
 * Automatically uses GlassButton and GIGI design tokens.
 */
export const SubHeaderAction: React.FC<SubHeaderActionProps> = ({
    onClick,
    icon,
    label,
    title,
    variant = 'secondary',
    className = "",
    disabled = false,
    children
}) => {
    return (
        <GlassButton
            onClick={onClick}
            variant={variant}
            disabled={disabled}
            title={title}
            className={`flex-1 md:flex-none whitespace-nowrap text-xs h-10 px-4 flex items-center justify-center gap-2 font-bold tracking-widest uppercase transition-all shadow-lg ${className}`}
        >
            {icon}
            {label}
            {children}
        </GlassButton>
    );
};

export default SubHeader;
