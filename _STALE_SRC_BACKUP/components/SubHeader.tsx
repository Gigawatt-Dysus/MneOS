
import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface SubHeaderProps {
    title: string;
    onBack?: () => void;
    children?: React.ReactNode;
    showBack?: boolean;
}

interface SubHeaderActionProps {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    active?: boolean;
    disabled?: boolean;
    title?: string;
}

export const SubHeader: React.FC<SubHeaderProps> = ({ title, onBack, children, showBack = true }) => {
    return (
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40 h-16">
            <div className="flex items-center gap-4">
                {showBack && (
                    <button
                        onClick={onBack}
                        disabled={!onBack}
                        className={`p-2 -ml-2 rounded-full transition-colors ${onBack ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'text-slate-600 cursor-default'}`}
                    >
                        <ChevronLeft size={20} />
                    </button>
                )}
                <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
            </div>

            <div className="flex items-center gap-2">
                {children}
            </div>
        </div>
    );
};

export const SubHeaderAction: React.FC<SubHeaderActionProps> = ({
    label,
    onClick,
    icon,
    active,
    disabled,
    title
}) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`
            px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all
            ${active
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
    >
        {icon && <span className="w-4 h-4">{icon}</span>}
        {label}
    </button>
);
