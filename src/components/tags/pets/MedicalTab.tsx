import React from 'react';
import type { PetMetadata } from './types';
import { Stethoscope, ShieldCheck, Plus, X } from 'lucide-react';

interface MedicalTabProps {
    data: PetMetadata;
    onChange: (updates: Partial<PetMetadata>) => void;
}

export const MedicalTab: React.FC<MedicalTabProps> = ({ data, onChange }) => {
    
    const updateMedical = (field: keyof typeof data.medical, value: any) => {
        onChange({ medical: { ...data.medical, [field]: value } });
    };

    const addCondition = () => {
        const newCondition = prompt("Enter medical condition:");
        if (newCondition) {
            updateMedical('conditions', [...data.medical.conditions, newCondition]);
        }
    };

    const removeCondition = (index: number) => {
        const newConditions = [...data.medical.conditions];
        newConditions.splice(index, 1);
        updateMedical('conditions', newConditions);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                        <Stethoscope size={14} /> Veterinarian Name
                    </label>
                    <input 
                        type="text" 
                        value={data.medical.vetName} 
                        onChange={(e) => updateMedical('vetName', e.target.value)}
                        placeholder="Dr. Smith / Main Street Vet"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vet Phone / Contact</label>
                    <input 
                        type="text" 
                        value={data.medical.vetPhone} 
                        onChange={(e) => updateMedical('vetPhone', e.target.value)}
                        placeholder="555-0199"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                    />
                </div>
            </div>

            <div className="bg-slate-800/30 rounded-2xl p-4 border border-white/5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-blue-400" /> Insurance
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Provider</label>
                        <input 
                            type="text" 
                            value={data.medical.insuranceProvider} 
                            onChange={(e) => updateMedical('insuranceProvider', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-blue-500 outline-none"
                        />
                    </div>
                     <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Policy #</label>
                        <input 
                            type="text" 
                            value={data.medical.insurancePolicy} 
                            onChange={(e) => updateMedical('insurancePolicy', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-blue-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-end">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Known Conditions</label>
                    <button 
                        onClick={addCondition}
                        type="button"
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 bg-emerald-950/50 px-2 py-1 rounded-md border border-emerald-500/20"
                    >
                        <Plus size={12} /> ADD CONDITION
                    </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[50px] bg-slate-900/30 p-3 rounded-xl border border-slate-800 border-dashed">
                    {data.medical.conditions.length > 0 ? data.medical.conditions.map((c, i) => (
                        <span key={i} className="px-3 py-1 bg-red-900/30 border border-red-500/30 text-red-300 rounded-full text-xs font-bold flex items-center gap-2">
                            {c}
                            <button onClick={() => removeCondition(i)} className="hover:text-white"><X size={12} /></button>
                        </span>
                    )) : (
                        <span className="text-slate-600 text-xs italic">No known medical conditions.</span>
                    )}
                </div>
            </div>
        </div>
    );
};