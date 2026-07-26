import React from 'react';
import { Briefcase, GraduationCap, Trash2, Plus } from 'lucide-react';
import type { EducationEntry, JobEntry, Settings } from '../../../types';
import { AddressAutocomplete, AddressData } from '../../AddressAutocomplete';
import { COMMON_MAJORS, COMMON_DEGREES } from './PersonShared';

interface PersonLifeProps {
    meta: any;
    handleChange: (path: string, value: any) => void;
    settings?: Settings;
}

const PersonLife: React.FC<PersonLifeProps> = ({ meta, handleChange }) => {
    
    const safeAddress: AddressData = {
        streetAddress: meta.address?.streetAddress || '',
        addressLocality: meta.address?.addressLocality || '',
        addressRegion: meta.address?.addressRegion || '',
        postalCode: meta.address?.postalCode || '',
        addressCountry: meta.address?.addressCountry || 'USA',
        coordinates: meta.address?.coordinates
    };

    const alumniList = Array.isArray(meta.alumniOf) ? meta.alumniOf : [];
    const pastJobsList = Array.isArray(meta.pastJobs) ? meta.pastJobs : [];

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
        handleChange('alumniOf', current.filter((_: any, i: number) => i !== index));
    };

    const handleAddJob = () => {
        const current = Array.isArray(meta.pastJobs) ? meta.pastJobs : [];
        const newJob: JobEntry = { jobTitle: '', companyName: '', startDate: '', endDate: '', isCurrent: false, description: '' };
        handleChange('pastJobs', [...current, newJob]);
    };

    const handleJobChange = (index: number, field: keyof JobEntry, value: any) => {
        const current = [...(Array.isArray(meta.pastJobs) ? meta.pastJobs : [])];
        current[index] = { ...current[index], [field]: value };
        handleChange('pastJobs', current);
    };

    const handleRemoveJob = (index: number) => {
        const current = Array.isArray(meta.pastJobs) ? meta.pastJobs : [];
        handleChange('pastJobs', current.filter((_: any, i: number) => i !== index));
    };

    return (
        <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                 <AddressAutocomplete 
                    value={safeAddress} 
                    onChange={(addr) => handleChange('address', addr)} 
                />
            </div>

            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2"><Briefcase size={16}/> Work</h3>
                
                {/* PRIMARY OCCUPATION CARD */}
                <div className="p-4 bg-slate-900/90 border-2 border-violet-500/30 rounded-lg relative mb-6 shadow-lg shadow-violet-950/20">
                    <div className="absolute -top-2.5 left-3 px-2 py-0.5 bg-violet-900 border border-violet-400 rounded text-[9px] font-bold text-violet-200 tracking-wider uppercase">
                        Primary Occupation
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mt-2 mb-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Job Title / Role</label>
                            <input type="text" value={meta.jobTitle || ''} onChange={e => handleChange('jobTitle', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm focus:border-violet-500 outline-none" placeholder="Cake Decorator"/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Current Company</label>
                            <input type="text" value={meta.worksFor || ''} onChange={e => handleChange('worksFor', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm focus:border-violet-500 outline-none" placeholder="Victoria's Cakery"/>
                        </div>
                    </div>

                    <div className="mb-3 bg-slate-950/40 p-3 rounded-lg border border-white/5">
                        <AddressAutocomplete
                            label="Employer Address"
                            value={{
                                streetAddress: meta.workLocation?.streetAddress || '',
                                addressLocality: meta.workLocation?.addressLocality || '',
                                addressRegion: meta.workLocation?.addressRegion || '',
                                postalCode: meta.workLocation?.postalCode || '',
                                addressCountry: meta.workLocation?.addressCountry || 'USA',
                                coordinates: meta.workLocation?.coordinates
                            }}
                            onChange={(addr) => handleChange('workLocation', addr)}
                        />
                    </div>

                    <div className="mb-3">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description / Achievements</label>
                        <textarea rows={2} value={meta.primaryJobDescription || ''} onChange={e => handleChange('primaryJobDescription', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs focus:border-violet-500 outline-none placeholder-slate-600 resize-none custom-scrollbar" placeholder="Lead cake designer, special client consults..." />
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-end">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From</label>
                            <input type="date" value={meta.primaryJobStartDate || ''} onChange={e => handleChange('primaryJobStartDate', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs focus:border-violet-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To (Leave blank if Current)</label>
                            <input type="date" value={meta.primaryJobEndDate || ''} onChange={e => handleChange('primaryJobEndDate', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs focus:border-violet-500 outline-none" />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider border-t border-slate-700/50 pt-4 mb-2">Employment History</label>
                    {pastJobsList.map((job: JobEntry, i: number) => (
                        <div key={i} className="p-4 bg-slate-900 border border-slate-700 rounded-lg relative">
                            <button onClick={() => handleRemoveJob(i)} className="absolute top-2 right-2 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                            
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Role / Title</label>
                                    <input type="text" value={job.jobTitle} onChange={e => handleJobChange(i, 'jobTitle', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm focus:border-violet-500 outline-none" placeholder="Senior Baker" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Company / Organization</label>
                                    <input type="text" value={job.companyName} onChange={e => handleJobChange(i, 'companyName', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm focus:border-violet-500 outline-none" placeholder="Sweet Treats Cafe" />
                                </div>
                            </div>

                            <div className="mb-3 bg-slate-950/40 p-3 rounded-lg border border-white/5">
                                <AddressAutocomplete
                                    label="Employer Address"
                                    value={{
                                        streetAddress: job.location?.streetAddress || '',
                                        addressLocality: job.location?.addressLocality || '',
                                        addressRegion: job.location?.addressRegion || '',
                                        postalCode: job.location?.postalCode || '',
                                        addressCountry: job.location?.addressCountry || 'USA',
                                        coordinates: job.location?.coordinates
                                    }}
                                    onChange={(addr) => handleJobChange(i, 'location', addr)}
                                />
                            </div>

                            <div className="mb-3">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description / Achievements</label>
                                <textarea rows={2} value={job.description || ''} onChange={e => handleJobChange(i, 'description', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs focus:border-violet-500 outline-none placeholder-slate-600 resize-none custom-scrollbar" placeholder="Managed orders, designed custom multi-tiered cakes..." />
                            </div>

                            <div className="grid grid-cols-3 gap-3 items-end">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">From</label>
                                    <input type="date" value={job.startDate || ''} onChange={e => handleJobChange(i, 'startDate', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs focus:border-violet-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">To</label>
                                    <input type="date" value={job.endDate || ''} onChange={e => handleJobChange(i, 'endDate', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs focus:border-violet-500 outline-none" />
                                </div>
                                <div className="flex items-center h-10">
                                    <input type="checkbox" checked={job.isCurrent || false} onChange={e => handleJobChange(i, 'isCurrent', e.target.checked)} className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-violet-600 mr-2" />
                                    <label className="text-xs text-slate-300">Currently works here</label>
                                </div>
                            </div>
                        </div>
                    ))}
                    <button onClick={handleAddJob} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors"><Plus size={14}/> Add Job</button>
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