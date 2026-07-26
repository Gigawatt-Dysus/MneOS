import React, { useState } from 'react';
import { Briefcase, GraduationCap, MapPin, Scroll, Plus, Trash2, Calendar, Sparkles, Edit2 } from 'lucide-react';
import type { PersonTag, LifeFact } from '../../../types';
import { v4 as uuidv4 } from 'uuid';

interface PersonLifeStoryProps {
    tag: PersonTag;
    meta: any;
    handleChange: (path: string, value: any) => void;
    aiName?: string;
    onOpenGedcom?: () => void; // [ZEN]
}

export const PersonLifeStory: React.FC<PersonLifeStoryProps> = ({ tag, meta, handleChange, aiName = "AI", onOpenGedcom }) => {

    // Ensure facts array exists
    const facts: LifeFact[] = meta.facts || [];

    const getIcon = (type: LifeFact['type']) => {
        switch (type) {
            case 'occupation': return <Briefcase size={14} className="text-amber-400" />;
            case 'education': return <GraduationCap size={14} className="text-blue-400" />;
            case 'residence': return <MapPin size={14} className="text-emerald-400" />;
            case 'military': return <Scroll size={14} className="text-slate-400" />;
            case 'vital': return <Sparkles size={14} className="text-rose-400" />;
            default: return <Calendar size={14} className="text-violet-400" />;
        }
    };

    const handleAddFact = (type: LifeFact['type'] = 'generic') => {
        const newFact: LifeFact = {
            id: uuidv4(),
            type,
            value: '',
            date: '',
            place: '',
            source: 'User'
        };
        handleChange('facts', [...facts, newFact]);
    };

    const handleUpdateFact = (id: string, field: keyof LifeFact, val: any) => {
        const updated = facts.map(f => f.id === id ? { ...f, [field]: val } : f);
        handleChange('facts', updated);
    };

    const handleDeleteFact = (id: string) => {
        if (confirm("Delete this fact?")) {
            handleChange('facts', facts.filter(f => f.id !== id));
        }
    };

    // [ZEN] Navigator Logic: Simple Heuristics for "Sparkles"
    // In the future this will be powered by real AI analysis
    const renderNavigatorHint = (fact: LifeFact) => {
        if (!fact.date && !fact.place) return null;

        return (
            <button
                onClick={onOpenGedcom}
                className="mt-2 flex items-center gap-2 opacity-50 hover:opacity-100 transition-all text-left group/hint hover:bg-cyan-950/30 px-2 py-1 rounded-lg -ml-2 w-full"
            >
                <Sparkles size={10} className="text-cyan-400 group-hover/hint:text-cyan-300" />
                <span className="text-[10px] text-cyan-300 group-hover/hint:text-cyan-200">
                    {aiName}: "Shall we look for records about this?"
                </span>
            </button>
        );
    };

    return (
        <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 fade-in duration-300">

            {/* Header / Intro */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <div>
                    <h3 className="text-sm font-bold text-cyan-400 mb-1 flex items-center gap-2">
                        <Scroll size={16} /> Life Story
                    </h3>
                    <p className="text-xs text-slate-400">
                        A chronological timeline of {tag.name}'s journey.
                    </p>
                </div>
                <div className="flex gap-2">
                    {onOpenGedcom && (
                        <button
                            onClick={onOpenGedcom}
                            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                        >
                            <Sparkles size={12} /> Enrich from GEDCOM
                        </button>
                    )}
                    <button
                        onClick={() => handleAddFact()}
                        className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                    >
                        <Plus size={12} /> Add Event
                    </button>
                </div>
            </div>

            {/* Timeline */}
            <div className="space-y-4 relative">
                {/* Vertical Line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-800 -z-10"></div>

                {facts.length === 0 && (
                    <div className="p-8 text-center border-2 border-dashed border-slate-800 rounded-xl">
                        <p className="text-slate-500 text-sm italic">No timeline events recorded yet.</p>
                        <button onClick={() => handleAddFact()} className="mt-2 text-cyan-400 text-xs font-bold hover:underline">Start the story</button>
                    </div>
                )}

                {facts.map((fact, index) => (
                    <div key={fact.id || index} className="relative pl-10 group">
                        {/* Dot */}
                        <div className={`absolute left-2 top-4 w-4 h-4 rounded-full border-2 border-[#0f1219] ${fact.confidence === 'low' ? 'bg-amber-500' : 'bg-slate-700'} shadow-lg z-10 flex items-center justify-center`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-white/50"></div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl hover:border-slate-700 transition-colors relative">
                            <button
                                onClick={() => handleDeleteFact(fact.id)}
                                className="absolute top-2 right-2 p-1.5 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={12} />
                            </button>

                            {/* Type Selector */}
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-slate-800 rounded-lg">
                                    {getIcon(fact.type)}
                                </div>
                                <select
                                    value={fact.type}
                                    onChange={(e) => handleUpdateFact(fact.id, 'type', e.target.value)}
                                    className="bg-transparent text-xs font-bold text-slate-300 uppercase tracking-wider outline-none cursor-pointer hover:text-white"
                                >
                                    <option value="generic" className="bg-slate-900 text-white">Event</option>
                                    <option value="occupation" className="bg-slate-900 text-white">Occupation</option>
                                    <option value="residence" className="bg-slate-900 text-white">Residence</option>
                                    <option value="education" className="bg-slate-900 text-white">Education</option>
                                    <option value="military" className="bg-slate-900 text-white">Military</option>
                                    <option value="religion" className="bg-slate-900 text-white">Religion</option>
                                    <option value="vital" className="bg-slate-900 text-white">Vital</option>
                                </select>

                                {fact.confidence === 'low' && (
                                    <span className="text-[10px] bg-amber-900/40 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded ml-auto">
                                        Needs Review
                                    </span>
                                )}
                            </div>

                            {/* Main Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                                <div className="relative group/input">
                                    <input
                                        type="text"
                                        placeholder="Event description (e.g. Teacher)"
                                        value={fact.value}
                                        onChange={(e) => handleUpdateFact(fact.id, 'value', e.target.value)}
                                        className="bg-transparent text-sm font-bold text-white placeholder-slate-600 outline-none border-b border-slate-700 hover:border-slate-500 focus:border-cyan-500 w-full py-1 transition-colors"
                                    />
                                    <Edit2 className="absolute right-0 top-1.5 text-slate-600 opacity-0 group-hover/input:opacity-100 pointer-events-none" size={10} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center gap-2 group/date">
                                    <Calendar size={12} className="text-slate-500 group-hover/date:text-cyan-400 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="1980, 1990-1995"
                                        value={fact.date || ''}
                                        onChange={(e) => handleUpdateFact(fact.id, 'date', e.target.value)}
                                        className="bg-transparent text-xs text-slate-300 placeholder-slate-700 outline-none w-full border-b border-transparent hover:border-slate-600 focus:border-cyan-500 transition-colors"
                                    />
                                </div>
                                <div className="flex items-center gap-2 group/place">
                                    <MapPin size={12} className="text-slate-500 group-hover/place:text-emerald-400 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Location"
                                        value={fact.place || ''}
                                        onChange={(e) => handleUpdateFact(fact.id, 'place', e.target.value)}
                                        className="bg-transparent text-xs text-slate-300 placeholder-slate-700 outline-none w-full border-b border-transparent hover:border-slate-600 focus:border-cyan-500 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Navigator Hint */}
                            {renderNavigatorHint(fact)}
                        </div>
                    </div>
                ))}

                <button
                    onClick={() => handleAddFact()}
                    className="ml-10 w-[calc(100%-2.5rem)] py-3 border border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-950/10 text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={14} /> Add Another Event
                </button>
            </div>
        </div>
    );
};
