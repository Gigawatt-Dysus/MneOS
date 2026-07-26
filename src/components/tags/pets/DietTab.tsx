import React from 'react';
import type { PetMetadata } from './types';
import { Utensils, AlertOctagon, Heart, ThumbsDown, Plus, X } from 'lucide-react';

interface DietTabProps {
    data: PetMetadata;
    onChange: (updates: Partial<PetMetadata>) => void;
}

export const DietTab: React.FC<DietTabProps> = ({ data, onChange }) => {
    
    const updateDiet = (field: keyof typeof data.diet, value: any) => {
        onChange({ diet: { ...data.diet, [field]: value } });
    };

    const addToList = (field: 'allergies' | 'likes' | 'dislikes', promptText: string) => {
        const val = prompt(promptText);
        if (val) updateDiet(field, [...data.diet[field], val]);
    };

    const removeFromList = (field: 'allergies' | 'likes' | 'dislikes', index: number) => {
        const newList = [...data.diet[field]];
        newList.splice(index, 1);
        updateDiet(field, newList);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                        <Utensils size={14} /> Food Brand / Type
                    </label>
                    <input 
                        type="text" 
                        value={data.diet.foodBrand} 
                        onChange={(e) => updateDiet('foodBrand', e.target.value)}
                        placeholder="e.g. Royal Canin Hydrolyzed Protein"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Feeding Schedule</label>
                    <input 
                        type="text" 
                        value={data.diet.feedingSchedule} 
                        onChange={(e) => updateDiet('feedingSchedule', e.target.value)}
                        placeholder="e.g. 1 cup at 8am, 1 cup at 6pm"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                    />
                </div>
            </div>

            <div className="bg-red-950/10 rounded-2xl p-4 border border-red-500/10">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-red-400 uppercase flex items-center gap-2">
                        <AlertOctagon size={14} /> Allergies / Restrictions
                    </h3>
                    <button onClick={() => addToList('allergies', "Add Allergy:")} className="p-1 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"><Plus size={14}/></button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {data.diet.allergies.length > 0 ? data.diet.allergies.map((a, i) => (
                        <span key={i} className="px-2 py-1 bg-red-950 text-red-200 border border-red-800 rounded text-xs flex items-center gap-2">
                            {a} <button onClick={() => removeFromList('allergies', i)}><X size={10} /></button>
                        </span>
                    )) : <span className="text-xs text-slate-600 italic">No known allergies.</span>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-pink-400 uppercase flex items-center gap-1"><Heart size={12} /> Loves</label>
                        <button onClick={() => addToList('likes', "Add Like:")} className="text-slate-500 hover:text-pink-400"><Plus size={14}/></button>
                    </div>
                    <ul className="bg-slate-900/50 rounded-lg p-2 min-h-[80px] space-y-1">
                        {data.diet.likes.map((item, i) => (
                            <li key={i} className="text-xs text-slate-300 flex justify-between group">
                                {item}
                                <button onClick={() => removeFromList('likes', i)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400"><X size={10} /></button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><ThumbsDown size={12} /> Hates</label>
                        <button onClick={() => addToList('dislikes', "Add Dislike:")} className="text-slate-500 hover:text-slate-300"><Plus size={14}/></button>
                    </div>
                    <ul className="bg-slate-900/50 rounded-lg p-2 min-h-[80px] space-y-1">
                        {data.diet.dislikes.map((item, i) => (
                            <li key={i} className="text-xs text-slate-300 flex justify-between group">
                                {item}
                                <button onClick={() => removeFromList('dislikes', i)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400"><X size={10} /></button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

        </div>
    );
};