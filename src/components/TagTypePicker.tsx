import React from 'react';
import { createPortal } from 'react-dom';
import { User, Dog, MapPin, Package, Calendar, Brain, X } from 'lucide-react';
import type { Tag } from '../types';

interface TagTypePickerProps {
    onSelect: (type: Tag['type']) => void;
    onClose: () => void;
}

// Matches the getTagColor map in TagGallery.tsx exactly.
const TYPE_OPTIONS: {
    type: Tag['type'];
    label: string;
    description: string;
    icon: React.ElementType;
    colorBg: string;
    colorBorder: string;
    colorIcon: string;
    glow: string;
}[] = [
    {
        type: 'person',
        label: 'Person',
        description: 'A human life — living, historical, or ancestral.',
        icon: User,
        colorBg: 'hover:bg-blue-600/15',
        colorBorder: 'border-blue-500/20 hover:border-blue-400/60',
        colorIcon: 'bg-blue-600/20 border-blue-500/30',
        glow: 'hover:shadow-[0_0_30px_rgba(37,99,235,0.12)]',
    },
    {
        type: 'pet',
        label: 'Pet',
        description: 'An animal companion — beloved or historical.',
        icon: Dog,
        colorBg: 'hover:bg-purple-600/15',
        colorBorder: 'border-purple-500/20 hover:border-purple-400/60',
        colorIcon: 'bg-purple-600/20 border-purple-500/30',
        glow: 'hover:shadow-[0_0_30px_rgba(147,51,234,0.12)]',
    },
    {
        type: 'place',
        label: 'Place',
        description: 'A location — geographic, historic, or fictional.',
        icon: MapPin,
        colorBg: 'hover:bg-emerald-600/15',
        colorBorder: 'border-emerald-500/20 hover:border-emerald-400/60',
        colorIcon: 'bg-emerald-600/20 border-emerald-500/30',
        glow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.12)]',
    },
    {
        type: 'thing',
        label: 'Thing',
        description: 'An object, artifact, or item of significance.',
        icon: Package,
        colorBg: 'hover:bg-yellow-500/15',
        colorBorder: 'border-yellow-500/20 hover:border-yellow-400/60',
        colorIcon: 'bg-yellow-500/20 border-yellow-500/30',
        glow: 'hover:shadow-[0_0_30px_rgba(234,179,8,0.12)]',
    },
    {
        type: 'event',
        label: 'Event',
        description: 'A moment in time — milestone, gathering, or occurrence.',
        icon: Calendar,
        colorBg: 'hover:bg-rose-500/15',
        colorBorder: 'border-rose-500/20 hover:border-rose-400/60',
        colorIcon: 'bg-rose-500/20 border-rose-500/30',
        glow: 'hover:shadow-[0_0_30px_rgba(239,68,68,0.12)]',
    },
    {
        type: 'concept',
        label: 'Concept',
        description: 'An idea, belief system, philosophy, or abstract theme.',
        icon: Brain,
        colorBg: 'hover:bg-indigo-600/15',
        colorBorder: 'border-indigo-500/20 hover:border-indigo-400/60',
        colorIcon: 'bg-indigo-600/20 border-indigo-500/30',
        glow: 'hover:shadow-[0_0_30px_rgba(99,102,241,0.12)]',
    },
];

export const TagTypePicker: React.FC<TagTypePickerProps> = ({ onSelect, onClose }) => {
    const modal = (
        <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[200] p-6"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-[#0d1117] border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-8 pb-2">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Create New Tag</h2>
                        <p className="text-slate-500 text-sm mt-1">Select the category of entity you are archiving.</p>
                    </div>
                    <button
                        onClick={onClose}
                        title="Cancel"
                        className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Six-card type grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-8 pt-6">
                    {TYPE_OPTIONS.map(({ type, label, description, icon: Icon, colorBg, colorBorder, colorIcon, glow }) => (
                        <button
                            key={type}
                            id={`tag-type-picker-${type}`}
                            onClick={() => onSelect(type)}
                            title={`Create a ${label} Tag`}
                            className={`
                                group relative flex flex-col items-start gap-3 p-5 rounded-2xl border
                                bg-black/30 ${colorBorder} ${colorBg} ${glow}
                                transition-all duration-200 hover:scale-[1.02] hover:shadow-xl
                                text-left focus:outline-none focus:ring-2 focus:ring-white/20
                            `}
                        >
                            {/* Icon badge */}
                            <div className={`p-2.5 rounded-xl border ${colorIcon} transition-colors`}>
                                <Icon
                                    size={22}
                                    className="text-white/70 group-hover:text-white transition-colors"
                                />
                            </div>

                            {/* Text */}
                            <div>
                                <div className="font-black text-white text-sm tracking-wide">{label}</div>
                                <div className="text-slate-500 text-xs mt-0.5 leading-relaxed group-hover:text-slate-400 transition-colors">
                                    {description}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modal, document.body);
};

export default TagTypePicker;
