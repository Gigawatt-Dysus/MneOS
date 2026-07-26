import React, { useState, useMemo } from 'react';
import type { PetTag } from '@/types';
import { PET_SPECIES, BREEDS_BY_SPECIES } from '../../utils/petData';
import { ChevronDown, Skull, Heart } from 'lucide-react';

interface PetFormProps {
    tag: PetTag;
    onMetadataChange: (metadata: any) => void;
}

const PetForm: React.FC<PetFormProps> = ({ tag, onMetadataChange }) => {
    const meta = tag.metadata;
    const [speciesInput, setSpeciesInput] = useState(meta.species || '');
    const [breedInput, setBreedInput] = useState(meta.breed || '');
    
    // Determine if we are in "Custom" mode for species
    const isCustomSpecies = !PET_SPECIES.includes(speciesInput) && speciesInput !== '';

    const getSafeDate = (val: any): string => {
        if (!val) return '';
        try {
            if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000).toISOString().split('T')[0];
            if (val instanceof Date) return val.toISOString().split('T')[0];
            if (typeof val === 'string') return val.split('T')[0];
        } catch (e) { return ''; }
        return '';
    };

    const handleSpeciesChange = (val: string) => {
        setSpeciesInput(val);
        setBreedInput(''); 
        onMetadataChange({ ...meta, species: val, breed: '' });
    };

    const handleBreedChange = (val: string) => {
        setBreedInput(val);
        onMetadataChange({ ...meta, breed: val });
    };

    const handleChange = (field: string, value: any) => {
        onMetadataChange({ ...meta, [field]: value });
    };

    const handleDateChange = (dateField: 'birth' | 'adoption' | 'death', value: string) => {
        onMetadataChange({ 
            ...meta, 
            dates: { ...meta.dates, [dateField]: value } 
        });
    };

    // [ZEN FIX] Sort breeds alphabetically on the fly
    const availableBreeds = useMemo(() => {
        const breeds = BREEDS_BY_SPECIES[speciesInput] || [];
        // Create a copy via spread syntax to avoid mutating the original source, then sort
        return [...breeds].sort((a, b) => a.localeCompare(b));
    }, [speciesInput]);

    return (
        <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 fade-in duration-300">
             
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2">
                    <Heart size={16}/> Identity & Breed
                </h3>
                
                {/* SPECIES FIELD */}
                <div className="mb-4">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Species</label>
                    <div className="relative">
                         <select 
                            value={isCustomSpecies ? "Other (Exotic)" : speciesInput} 
                            onChange={(e) => handleSpeciesChange(e.target.value)}
                            className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-3 text-white text-sm placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none transition-all"
                        >
                            <option value="">-- Select Species --</option>
                            {PET_SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                    </div>
                    
                    {/* Conditional Text Input for Exotic/Other */}
                    {(speciesInput === "Other (Exotic)" || isCustomSpecies) && (
                        <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                             <input 
                                type="text" 
                                value={speciesInput === "Other (Exotic)" ? "" : speciesInput} 
                                onChange={(e) => handleSpeciesChange(e.target.value)}
                                placeholder="Enter specific species (e.g. Axolotl)..."
                                className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-3 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none"
                                 autoFocus
                            />
                        </div>
                    )}
                </div>

                {/* BREED FIELD */}
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                        {['Bird', 'Reptile', 'Fish'].includes(speciesInput) ? "Type / Common Name" : "Breed"}
                     </label>
                    
                    {availableBreeds.length > 0 ? (
                        <div className="space-y-3">
                            <div className="relative">
                                <select 
                                    value={availableBreeds.includes(breedInput) ? breedInput : "Other"} 
                                     onChange={(e) => handleBreedChange(e.target.value)}
                                    className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-3 text-white text-sm placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none transition-all"
                                >
                                    <option value="">-- Select --</option>
                                    {availableBreeds.map(b => <option key={b} value={b}>{b}</option>)}
                                     <option value="Other">Other / Unknown / Mix</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                            </div>

                            {(breedInput === "Other" || (!availableBreeds.includes(breedInput) && breedInput !== '')) && (
                                <input 
                                     type="text" 
                                    value={breedInput === "Other" ? "" : breedInput} 
                                    onChange={(e) => handleBreedChange(e.target.value)}
                                    placeholder="Enter specific breed..."
                                    className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-3 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none animate-in fade-in"
                                 />
                            )}
                        </div>
                    ) : (
                        <input 
                            type="text" 
                            value={breedInput} 
                             onChange={(e) => handleBreedChange(e.target.value)}
                            className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-3 text-white text-sm placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all"
                        />
                    )}
                </div>
            </div>

            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2">
                    <Heart size={16}/> Timeline
                </h3>
                 
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Adoption / Gotcha Date</label>
                        <input 
                            type="date" 
                            value={getSafeDate(meta.dates?.adoption)} 
                            onChange={e => handleDateChange('adoption', e.target.value)} 
                             className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-3 text-white text-sm placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all" 
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Birthday (Approx)</label>
                        <input 
                            type="date" 
                             value={getSafeDate(meta.dates?.birth)} 
                            onChange={e => handleDateChange('birth', e.target.value)} 
                            className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-3 text-white text-sm placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all" 
                        />
                    </div>
                </div>

                {/* Deceased Logic */}
                <div className="border-t border-slate-700/50 pt-4 mt-6">
                     <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={meta.isDeceased || false} 
                            onChange={(e) => handleChange('isDeceased', e.target.checked)} 
                            className="w-5 h-5 rounded border-slate-500 bg-slate-800 text-violet-600 focus:ring-violet-500"
                        />
                        <span className={`text-sm font-medium transition-colors ${meta.isDeceased ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                            Pet has passed away
                        </span>
                    </label>

                    {meta.isDeceased && (
                        <div className="mt-4 animate-in slide-in-from-top-2 fade-in">
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-2"><Skull size={12}/> Date of Passing</label>
                            <input 
                                 type="date" 
                                value={getSafeDate(meta.dates?.death)} 
                                onChange={e => handleDateChange('death', e.target.value)} 
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm outline-none focus:border-red-500 transition-colors" 
                            />
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};

export default PetForm;