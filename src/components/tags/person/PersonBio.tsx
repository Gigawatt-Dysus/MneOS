import React from 'react';
import { Heart, Tag as TagIcon, BookOpen } from 'lucide-react';
import { ArrayInput } from './PersonShared';
import { WikiTagEditor } from '../../shared/WikiTagEditor';
import type { Tag } from '../../../types';

interface PersonBioProps {
    meta: any;
    handleChange: (path: string, value: any) => void;
    userId?: string;
    onTagCreated?: (tag: Tag) => void;
}

const PersonBio: React.FC<PersonBioProps> = ({ meta, handleChange, userId, onTagCreated }) => {
    
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
                 <WikiTagEditor 
                    value={meta.howWeMet || ''} 
                    onChange={value => handleChange('howWeMet', value)} 
                    userId={userId || ''}
                    onTagCreated={onTagCreated}
                    placeholder="Describe how you first crossed paths..."
                    rows={6}
                 />
             </div>

             <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                 <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2"><BookOpen size={16}/> Research Notes / Dossier</h3>
                 <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Raw background and external research data...</label>
                 <WikiTagEditor 
                    value={meta.researchNotes || ''} 
                    onChange={value => handleChange('researchNotes', value)} 
                    userId={userId || ''}
                    onTagCreated={onTagCreated}
                    placeholder="Paste dossier, background details, or raw research notes here..."
                    rows={12}
                 />
             </div>

             <ArrayInput label="Keywords" placeholder="Golf, React, Chess" items={keywordsList} onAdd={(v: string) => handleArrayAdd('knowsAbout', v)} onRemove={(i: number) => handleArrayRemove('knowsAbout', i)} icon={TagIcon} />
        </div>
    );
};

export default PersonBio;