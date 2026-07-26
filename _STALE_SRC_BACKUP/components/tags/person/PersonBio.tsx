import React from 'react';
import { Heart, Tag as TagIcon } from 'lucide-react';
import { ArrayInput } from './PersonShared';

interface PersonBioProps {
    meta: any;
    handleChange: (path: string, value: any) => void;
}

const PersonBio: React.FC<PersonBioProps> = ({ meta, handleChange }) => {
    
    const handleArrayAdd = (field: string, value: string) => {
        if (!value.trim()) return;
        const current = Array.isArray((meta as any)[field]) ? (meta as any)[field] : [];
        handleChange(field, [...current, value]);
    };

    const handleArrayRemove = (field: string, index: number) => {
        const current = Array.isArray((meta as any)[field]) ? (meta as any)[field] : [];
        handleChange(field, current.filter((_: any, i: number) => i !== index));
    };

    const keywordsList = Array.isArray(meta.knowsAbout) ? meta.knowsAbout : [];

    return (
        <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 fade-in duration-300">
             <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                 <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2"><Heart size={16}/> Origin Story</h3>
                 <label className="block text-xs font-bold text-slate-400 uppercase mb-1">On the day we met...</label>
                 <textarea value={meta.howWeMet || ''} onChange={e => handleChange('howWeMet', e.target.value)} className="w-full bg-slate-900 border-slate-700 rounded p-3 text-white text-sm h-24 resize-none placeholder-slate-600 focus:border-violet-500 outline-none" />
             </div>
             <ArrayInput label="Keywords" placeholder="Golf, React, Chess" items={keywordsList} onAdd={(v: string) => handleArrayAdd('knowsAbout', v)} onRemove={(i: number) => handleArrayRemove('knowsAbout', i)} icon={TagIcon} />
        </div>
    );
};

export default PersonBio;