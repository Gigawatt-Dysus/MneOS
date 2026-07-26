import React from 'react';
import type { PetMetadata } from './types';
import { Calendar, Fingerprint, PawPrint, Hash, Skull } from 'lucide-react';

interface BasicInfoTabProps {
    data: PetMetadata;
    onChange: (updates: Partial<PetMetadata>) => void;
}

export const BasicInfoTab: React.FC<BasicInfoTabProps> = ({ data, onChange }) => {
    
    const updateDates = (field: keyof typeof data.dates, value: string) => {
        onChange({ dates: { ...data.dates, [field]: value } });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                        <PawPrint size={14} /> Species
                    </label>
                    <input 
                        type="text" 
                        value={data.species} 
                        onChange={(e) => onChange({ species: e.target.value })}
                        placeholder="e.g. Dog, Cat, Dragon"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all"
                    />
                </div>
                
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Breed / Mix</label>
                    <input 
                        type="text" 
                        value={data.breed} 
                        onChange={(e) => onChange({ breed: e.target.value })}
                        placeholder="e.g. Golden Retriever"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Color / Markings</label>
                    <input 
                        type="text" 
                        value={data.color} 
                        onChange={(e) => onChange({ color: e.target.value })}
                        placeholder="e.g. Black with white socks"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gender</label>
                    <select 
                        value={data.gender}
                        onChange={(e) => onChange({ gender: e.target.value as any })}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all"
                    >
                        <option value="Unknown">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                    </select>
                </div>
            </div>

            <div className="bg-slate-800/30 rounded-2xl p-4 border border-white/5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Calendar size={16} className="text-cyan-400" /> Important Dates
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Birthdate</label>
                        <input 
                            type="date" 
                            value={data.dates.birth} 
                            onChange={(e) => updateDates('birth', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-cyan-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Adoption Date</label>
                        <input 
                            type="date" 
                            value={data.dates.adoption} 
                            onChange={(e) => updateDates('adoption', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-cyan-500 outline-none"
                        />
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5">
                     <label className="flex items-center gap-3 cursor-pointer group w-fit">
                        <input 
                            type="checkbox" 
                            checked={data.isDeceased || false} 
                            onChange={(e) => onChange({ isDeceased: e.target.checked })} 
                            className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-cyan-600 focus:ring-cyan-500" 
                        />
                        <span className={`text-sm font-medium transition-colors ${data.isDeceased ? 'text-slate-200' : 'text-slate-400 group-hover:text-slate-300'}`}>
                            Pet has passed away
                        </span>
                    </label>
                    
                    {data.isDeceased && (
                        <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                             <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Skull size={10}/> Passing Date</label>
                                <input 
                                    type="date" 
                                    value={data.dates.passing} 
                                    onChange={(e) => updateDates('passing', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-red-500 outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Fingerprint size={14} /> Microchip ID / License #
                </label>
                <div className="relative">
                    <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                        type="text" 
                        value={data.medical.chipId} 
                        onChange={(e) => onChange({ medical: { ...data.medical, chipId: e.target.value } })}
                        placeholder="e.g. 985112000..."
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-200 focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all font-mono"
                    />
                </div>
            </div>
        </div>
    );
};