import React from 'react';
import type { ThingTag } from '@/types';

interface ThingFormProps {
    tag: ThingTag;
    onMetadataChange: (metadata: any) => void;
}

const ThingForm: React.FC<ThingFormProps> = ({ tag, onMetadataChange }) => {
    return (
        <div className="space-y-4 max-w-3xl">
             <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Purpose</label><input type="text" value={tag.metadata.purpose || ''} onChange={e => onMetadataChange({ ...tag.metadata, purpose: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white placeholder-slate-600" /></div>
             <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Acquisition Date</label><input type="date" value={tag.metadata.acquisition?.date || ''} onChange={e => onMetadataChange({ ...tag.metadata, acquisition: { ...tag.metadata.acquisition, date: e.target.value } })} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white placeholder-slate-600" /></div>
        </div>
    );
};
export default ThingForm;