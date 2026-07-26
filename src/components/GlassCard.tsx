import React from 'react';
import { GlassButton } from './GlassButton';
import { GlassAvatar } from './GlassAvatar';
import { Edit2, Trash2, Star } from 'lucide-react';

interface GlassCardProps {
    title?: string;
    subtitle?: string;
    image?: string;
    isPrimary?: boolean;
    onEdit?: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
    className?: string;
    onClick?: () => void;
    children?: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    title, subtitle, image, isPrimary, onEdit, onDelete, className = "", onClick, children
}) => {
    return (
        <div
            onClick={onClick}
            className={`group relative p-4 rounded-2xl bg-black/20 border border-white/5 hover:bg-white/5 hover:border-white/10 hover:shadow-lg hover:shadow-cyan-900/10 transition-all duration-300 backdrop-blur-md cursor-pointer ${className}`}
        >
            {children ? children : (
                <div className="flex items-center gap-4">
                    {/* Avatar Area using your existing GlassAvatar */}
                    <GlassAvatar
                        imageUrl={image}
                        altText={title || ''}
                        fallbackChar={title?.charAt(0) || '?'}
                        size="w-14 h-14"
                        className="shrink-0 border-2 border-white/10 shadow-inner group-hover:border-cyan-500/50 transition-colors"
                    />

                    {/* Content */}
                    <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-200 truncate group-hover:text-cyan-400 transition-colors">{title}</h3>
                            {isPrimary && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                                    <Star size={8} fill="currentColor" /> Primary
                                </span>
                            )}
                        </div>
                        {subtitle && <p className="text-xs text-slate-500 truncate font-mono mt-0.5 uppercase tracking-wide">{subtitle}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity transform translate-x-2 sm:translate-x-4 sm:group-hover:translate-x-0">
                        {onEdit && (
                            <GlassButton
                                onClick={(e) => { e.stopPropagation(); onEdit(e); }}
                                variant="secondary"
                                className="h-8 w-8 p-0 rounded-full flex items-center justify-center"
                            >
                                <Edit2 size={14} />
                            </GlassButton>
                        )}
                        {onDelete && (
                            <GlassButton
                                onClick={(e) => { e.stopPropagation(); onDelete(e); }}
                                variant="danger"
                                className="h-8 w-8 p-0 rounded-full flex items-center justify-center"
                            >
                                <Trash2 size={14} />
                            </GlassButton>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
