import React from 'react';
import { User, Heart, Skull, ScanFace, CheckCircle2, Loader2 } from 'lucide-react';
import type { PersonTag } from '@/types'; // [ZEN] Note: 3 levels deep
import { formatHonorific, formatMiddleInitial, COMMON_HONORIFICS, COMMON_SUFFIXES, COMMON_CREDENTIALS } from '../../../utils/formatters';
import { GenderSelect, getSafeDate } from './PersonShared';

interface PersonIdentityProps {
    tag: PersonTag;
    meta: any;
    handleChange: (path: string, value: any) => void;
    onEnrollFace: () => void;
    isEnrolling: boolean;
    isEnrolled: boolean;
}

const PersonIdentity: React.FC<PersonIdentityProps> = ({ tag, meta, handleChange, onEnrollFace, isEnrolling, isEnrolled }) => {
    return (
        <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-sm font-bold text-violet-400 mb-1 flex items-center gap-2">
                             <ScanFace size={16}/> Biometrics
                        </h3>
                        <p className="text-xs text-slate-400">
                            Face ID allows the AI Scanner to recognize {tag.name || 'this person'} in photos.
                        </p>
                    </div>
                    <div>
                        {isEnrolled ? (
                             <div className="flex items-center gap-2 bg-green-900/30 border border-green-500/50 px-3 py-1.5 rounded-lg">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Enrolled</span>
                            </div>
                        ) : (
                            <button 
                                onClick={onEnrollFace} 
                                disabled={isEnrolling}
                                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-lg transition-all"
                            >
                                {isEnrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanFace className="w-4 h-4" />}
                                {isEnrolling ? "Scanning..." : "Enroll Face ID"}
                             </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2"><User size={16}/> Schema.org Identity</h3>
                <div className="grid grid-cols-6 gap-4 mb-4">
                    <div className="col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Prefix</label>
                        <input type="text" list="honorifics" placeholder="Dr." value={meta.honorificPrefix || ''} onChange={e => handleChange('honorificPrefix', e.target.value)} onBlur={e => handleChange('honorificPrefix', formatHonorific(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none" />
                        <datalist id="honorifics">{COMMON_HONORIFICS.map(h=><option key={h} value={h}/>)}</datalist>
                    </div>
                    <div className="col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">First Name</label>
                        <input type="text" placeholder="Jane" value={meta.givenName || ''} onChange={e => handleChange('givenName', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Middle</label>
                        <input type="text" placeholder="M." value={meta.additionalName || ''} onChange={e => handleChange('additionalName', e.target.value)} onBlur={e => handleChange('additionalName', formatMiddleInitial(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none" />
                    </div>
                </div>
                <div className="grid grid-cols-6 gap-4 mb-4">
                    <div className="col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Last Name</label>
                        <input type="text" placeholder="Doe" value={meta.familyName || ''} onChange={e => handleChange('familyName', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none" />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Suffix</label>
                        <input type="text" list="suffixes" placeholder="Jr." value={meta.suffix || ''} onChange={e => handleChange('suffix', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none" />
                        <datalist id="suffixes">{COMMON_SUFFIXES.map(s=><option key={s} value={s}/>)}</datalist>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Credentials</label>
                        <input type="text" list="credentials" placeholder="Ph.D." value={meta.honorificSuffix || ''} onChange={e => handleChange('honorificSuffix', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none" />
                        <datalist id="credentials">{COMMON_CREDENTIALS.map(c=><option key={c} value={c}/>)}</datalist>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nickname / Alias</label>
                    <input type="text" value={meta.alternateName || ''} onChange={e => handleChange('alternateName', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none" />
                </div>
            </div>
            
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2"><Heart size={16}/> Vitals</h3>
                <div className="grid grid-cols-2 gap-6 mb-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Date of Birth</label>
                        <input type="date" value={getSafeDate(meta.dates?.birth)} onChange={e => handleChange('dates.birth', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Pronouns / Gender</label>
                        <GenderSelect value={meta.gender} onChange={val => handleChange('gender', val)} />
                    </div>
                </div>
                
                <div className="border-t border-slate-700/50 pt-4 mt-2">
                     <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={meta.isDeceased || false} 
                            onChange={(e) => handleChange('isDeceased', e.target.checked)} 
                            className="w-5 h-5 rounded border-slate-500 bg-slate-800 text-violet-600 focus:ring-violet-500" 
                        />
                        <span className={`text-sm font-medium transition-colors ${meta.isDeceased ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>Person is deceased</span>
                    </label>
                    {meta.isDeceased && (
                        <div className="mt-4 animate-in slide-in-from-top-2 fade-in">
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-2"><Skull size={12}/> Date of Death</label>
                            <input 
                                type="date" 
                                value={getSafeDate(meta.dates?.death)} 
                                onChange={e => handleChange('dates.death', e.target.value)} 
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm outline-none focus:border-red-500 transition-colors" 
                            />
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};

export default PersonIdentity;