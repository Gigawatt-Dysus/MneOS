import React from 'react';
import { Briefcase, GraduationCap, Trash2, Plus } from 'lucide-react';
import type { EducationEntry, Settings } from '@/types';
import { AddressAutocomplete, AddressData } from '../../AddressAutocomplete';
import { COMMON_MAJORS, COMMON_DEGREES } from './PersonShared';

interface PersonLifeProps {
    meta: any;
    handleChange: (path: string, value: any) => void;
    settings?: Settings;
}

const PersonLife: React.FC<PersonLifeProps> = ({ meta, handleChange, settings }) => {
    const apiKey = settings?.googleMapsApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    
    const safeAddress: AddressData = {
        streetAddress: meta.address?.streetAddress || '',
        addressLocality: meta.address?.addressLocality || '',
        addressRegion: meta.address?.addressRegion || '',
        postalCode: meta.address?.postalCode || '',
        addressCountry: meta.address?.addressCountry || 'USA',
        coordinates: meta.address?.coordinates
    };

    const alumniList = Array.isArray(meta.alumniOf) ? meta.alumniOf : [];

    const handleAddEducation = () => {
        const current = Array.isArray(meta.alumniOf) ? meta.alumniOf : [];
        const newEdu: EducationEntry = { schoolName: '', startDate: '', endDate: '', isGraduated: false, degree: '', major: '' };
        handleChange('alumniOf', [...current, newEdu]);
    };

    const handleEducationChange = (index: number, field: keyof EducationEntry, value: any) => {
        const current = [...(Array.isArray(meta.alumniOf) ? meta.alumniOf : [])];
        current[index] = { ...current[index], [field]: value };
        handleChange('alumniOf', current);
    };

    const handleRemoveEducation = (index: number) => {
        const current = Array.isArray(meta.alumniOf) ? meta.alumniOf : [];
        // [ZEN FIX] Explicitly typed callback arguments to resolve TS7006 implicit 'any' error
        handleChange('alumniOf', current.filter((_: any, i: number) => i !== index));
    };

    return (
        <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                 <AddressAutocomplete 
                    value={safeAddress} 
                    onChange={(addr) => handleChange('address', addr)} 
                    apiKey={apiKey} 
                />
            </div>

            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2"><Briefcase size={16}/> Work</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Job Title</label>
                        <input type="text" value={meta.jobTitle || ''} onChange={e => handleChange('jobTitle', e.target.value)} className="w-full bg-slate-900 border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Company</label>
                        <input type="text" value={meta.worksFor || ''} onChange={e => handleChange('worksFor', e.target.value)} className="w-full bg-slate-900 border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none"/>
                    </div>
                </div>
            </div>
            
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2"><GraduationCap size={16}/> Education</h3>
                <div className="space-y-4">
                     {alumniList.map((edu: EducationEntry, i: number) => (
                        <div key={i} className="p-4 bg-slate-900 border border-slate-700 rounded-lg relative">
                             <button onClick={() => handleRemoveEducation(i)} className="absolute top-2 right-2 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                             
                             <div className="mb-3">
                                 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">School / Institution</label>
                                  <input type="text" value={edu.schoolName} onChange={e => handleEducationChange(i, 'schoolName', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm focus:border-violet-500 outline-none" placeholder="University of Life" />
                             </div>
                             
                             <div className="grid grid-cols-2 gap-3 mb-3">
                                 <div>
                                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Degree</label>
                                     <input type="text" list="degree-list" value={edu.degree || ''} onChange={e => handleEducationChange(i, 'degree', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm focus:border-violet-500 outline-none" />
                                      <datalist id="degree-list">{COMMON_DEGREES.map(d => <option key={d} value={d} />)}</datalist>
                                 </div>
                                 <div>
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Major / Field</label>
                                    <input type="text" list="major-list" value={edu.major || ''} onChange={e => handleEducationChange(i, 'major', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm focus:border-violet-500 outline-none" />
                                      <datalist id="major-list">{COMMON_MAJORS.map(m => <option key={m} value={m} />)}</datalist>
                                 </div>
                             </div>

                             <div className="grid grid-cols-3 gap-3 items-end">
                                 <div>
                                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">From</label>
                                      <input type="date" value={edu.startDate || ''} onChange={e => handleEducationChange(i, 'startDate', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs focus:border-violet-500 outline-none" />
                                 </div>
                                 <div>
                                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">To</label>
                                     <input type="date" value={edu.endDate || ''} onChange={e => handleEducationChange(i, 'endDate', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs focus:border-violet-500 outline-none" />
                                 </div>
                                 <div className="flex items-center h-10">
                                     <input type="checkbox" checked={edu.isGraduated || false} onChange={e => handleEducationChange(i, 'isGraduated', e.target.checked)} className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-violet-600 mr-2" />
                                      <label className="text-xs text-slate-300">Graduated?</label>
                                 </div>
                             </div>
                         </div>
                    ))}
                    <button onClick={handleAddEducation} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors"><Plus size={14}/> Add Education</button>
                 </div>
            </div>
        </div>
    );
};

export default PersonLife;