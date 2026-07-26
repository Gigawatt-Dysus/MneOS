import React from 'react';
import { Mail, Phone, Globe, Link as LinkIcon } from 'lucide-react';
import { formatPhoneNumber, normalizeEmail, formatUrl } from '../../../utils/formatters';
import { ArrayInput } from './PersonShared';

interface PersonContactProps {
    meta: any;
    handleChange: (path: string, value: any) => void;
}

const PersonContact: React.FC<PersonContactProps> = ({ meta, handleChange }) => {
    
    // Helpers required inside component to access meta/handleChange
    const handleArrayAdd = (field: string, value: string) => {
        if (!value.trim()) return;
        const current = Array.isArray((meta as any)[field]) ? (meta as any)[field] : [];
        handleChange(field, [...current, value]);
    };

    const handleArrayRemove = (field: string, index: number) => {
        const current = Array.isArray((meta as any)[field]) ? (meta as any)[field] : [];
        handleChange(field, current.filter((_: any, i: number) => i !== index));
    };

    const emailsList = Array.isArray(meta.emails) ? meta.emails : [];
    const phonesList = Array.isArray(meta.telephone) ? meta.telephone : [];
    const socialsList = Array.isArray(meta.sameAs) ? meta.sameAs : [];

    return (
        <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2"><Mail size={16}/> Contact Points</h3>
                <ArrayInput label="Emails" items={emailsList} onAdd={(v: string) => handleArrayAdd('emails', v)} onRemove={(i: number) => handleArrayRemove('emails', i)} icon={Mail} formatter={normalizeEmail} placeholder="name@example.com"/>
                <ArrayInput label="Phones" items={phonesList} onAdd={(v: string) => handleArrayAdd('telephone', v)} onRemove={(i: number) => handleArrayRemove('telephone', i)} icon={Phone} formatter={formatPhoneNumber} placeholder="+1 (555) 000-0000"/>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2"><Globe size={16}/> Digital</h3>
                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Website</label>
                    <input type="text" value={meta.url || ''} onChange={e => handleChange('url', e.target.value)} onBlur={e => handleChange('url', formatUrl(e.target.value))} className="w-full bg-slate-900 border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none"/>
                </div>
                <ArrayInput label="Socials" items={socialsList} onAdd={(v: string) => handleArrayAdd('sameAs', v)} onRemove={(i: number) => handleArrayRemove('sameAs', i)} icon={LinkIcon} formatter={formatUrl} placeholder="LinkedIn, Twitter URL"/>
            </div>
        </div>
    );
};

export default PersonContact;