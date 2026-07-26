import React from 'react';
import { User, Heart, Skull, ScanFace, CheckCircle2, Loader2, MapPin } from 'lucide-react';
// [ZEN FIX] Explicit types for PersonTag and imported Tag type
import type { PersonTag, Tag } from '../../../types';
import { formatHonorific, formatMiddleInitial, COMMON_HONORIFICS, COMMON_SUFFIXES, COMMON_CREDENTIALS } from '../../../utils/formatters';
import { GenderSelect, getSafeDate } from './PersonShared';
import { MultiverseCoords } from '../MultiverseCoords';
import { WikiTagEditor } from '../../shared/WikiTagEditor';

interface PersonIdentityProps {
    tag: PersonTag;
    allTags: Tag[];
    meta: any;
    handleChange: (path: string, value: any) => void;
    onEnrollFace: () => void;
    isEnrolling: boolean;
    isEnrolled: boolean;
    onRootChange?: (field: keyof Tag, value: any) => void;
    userId?: string;
}

const PersonIdentity: React.FC<PersonIdentityProps> = ({ tag, allTags, meta, handleChange, onEnrollFace, isEnrolling, isEnrolled, onRootChange, userId }) => {
    const getFieldBorderClass = (currentValue: any, defaultClass: string, isLarge: boolean = false, isTextarea: boolean = false) => {
        if (tag.isVariant && currentValue !== undefined && currentValue !== null && currentValue !== '') {
            if (isLarge) {
                return "w-full bg-slate-900 border border-amber-500/50 rounded-xl p-4 text-amber-200 text-xl font-bold placeholder-slate-700 focus:border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)] outline-none transition-all";
            }
            if (isTextarea) {
                return "w-full bg-slate-900 border border-amber-500/50 rounded p-3 text-amber-200 text-sm leading-relaxed placeholder-slate-600 focus:border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.15)] outline-none min-h-[14rem] transition-all custom-scrollbar";
            }
            return "w-full bg-slate-900 border border-amber-500/50 rounded p-2 text-amber-200 text-sm placeholder-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all";
        }
        return defaultClass;
    };

    const renderOverloadBadge = (val: any) => {
        if (tag.isVariant && val !== undefined && val !== null && val !== '') {
            return (
                <span className="text-[9px] font-black text-amber-400 flex items-center gap-0.5 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                    ⚡ Overload
                </span>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 fade-in duration-300">
            <MultiverseCoords tag={tag} allTags={allTags} onChange={onRootChange || (() => {})} />

            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-sm font-bold text-violet-400 mb-1 flex items-center gap-2">
                            <ScanFace size={16} /> Biometrics
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
                <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2"><User size={16} /> Schema.org Identity</h3>
                
                <div className="mb-6">
                    <label className="block text-xs font-black text-cyan-400 uppercase tracking-[0.2em] mb-2 italic flex items-center justify-between">
                        <span>Gallery Display Name</span>
                        {renderOverloadBadge(meta.displayName)}
                    </label>
                    <input 
                        type="text" 
                        placeholder="e.g. Lizzie, Dottie, Dad" 
                        value={meta.displayName || ''} 
                        onChange={e => handleChange('displayName', e.target.value)} 
                        className={getFieldBorderClass(meta.displayName, "w-full bg-slate-900 border border-cyan-500/30 rounded-xl p-4 text-white text-xl font-bold placeholder-slate-700 focus:border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.1)] outline-none transition-all", true)} 
                    />
                    <p className="text-[10px] text-slate-500 mt-2 font-medium">This is how the person will appear and sort in your Tag Gallery.</p>
                </div>

                <div className="grid grid-cols-6 gap-4 mb-4">
                    <div className="col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                            <span>Prefix</span>
                            {renderOverloadBadge(meta.honorificPrefix)}
                        </label>
                        <input type="text" list="honorifics" placeholder="Dr." value={meta.honorificPrefix || ''} onChange={e => handleChange('honorificPrefix', e.target.value)} onBlur={e => handleChange('honorificPrefix', formatHonorific(e.target.value))} className={getFieldBorderClass(meta.honorificPrefix, "w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none")} />
                        <datalist id="honorifics">{COMMON_HONORIFICS.map(h => <option key={h} value={h} />)}</datalist>
                    </div>
                    <div className="col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                            <span>First Name</span>
                            {renderOverloadBadge(meta.givenName)}
                        </label>
                        <input type="text" placeholder="Jane" value={meta.givenName || ''} onChange={e => handleChange('givenName', e.target.value)} className={getFieldBorderClass(meta.givenName, "w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none")} />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                            <span>Middle</span>
                            {renderOverloadBadge(meta.additionalName)}
                        </label>
                        <input type="text" placeholder="M." value={meta.additionalName || ''} onChange={e => handleChange('additionalName', e.target.value)} onBlur={e => handleChange('additionalName', formatMiddleInitial(e.target.value))} className={getFieldBorderClass(meta.additionalName, "w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none")} />
                    </div>
                </div>
                <div className="grid grid-cols-6 gap-4 mb-4">
                    <div className="col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                            <span>Last Name</span>
                            {renderOverloadBadge(meta.familyName)}
                        </label>
                        <input type="text" placeholder="Doe" value={meta.familyName || ''} onChange={e => handleChange('familyName', e.target.value)} className={getFieldBorderClass(meta.familyName, "w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none")} />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                            <span>Suffix</span>
                            {renderOverloadBadge(meta.suffix)}
                        </label>
                        <input type="text" list="suffixes" placeholder="Jr." value={meta.suffix || ''} onChange={e => handleChange('suffix', e.target.value)} className={getFieldBorderClass(meta.suffix, "w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none")} />
                        <datalist id="suffixes">{COMMON_SUFFIXES.map(s => <option key={s} value={s} />)}</datalist>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                            <span>Credentials</span>
                            {renderOverloadBadge(meta.honorificSuffix)}
                        </label>
                        <input type="text" list="credentials" placeholder="Ph.D." value={meta.honorificSuffix || ''} onChange={e => handleChange('honorificSuffix', e.target.value)} className={getFieldBorderClass(meta.honorificSuffix, "w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none")} />
                        <datalist id="credentials">{COMMON_CREDENTIALS.map(c => <option key={c} value={c} />)}</datalist>
                    </div>
                </div>
                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center justify-between">
                        <span>Nickname / Alias</span>
                        {renderOverloadBadge(meta.alternateName)}
                    </label>
                    <input type="text" value={meta.alternateName || ''} onChange={e => handleChange('alternateName', e.target.value)} className={getFieldBorderClass(meta.alternateName, "w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none")} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center justify-between">
                        <span>Profile Description / Headline</span>
                        {renderOverloadBadge(tag.description)}
                    </label>
                    <WikiTagEditor
                        value={tag.description || ''}
                        onChange={(text) => onRootChange && onRootChange('description', text)}
                        placeholder="E.g. 'My grandfather', 'The cool aunt'"
                        userId={userId || 'anonymous'}
                        className={getFieldBorderClass(tag.description, "w-full bg-slate-900 border border-slate-700 rounded p-3 text-white text-sm leading-relaxed placeholder-slate-600 focus:border-violet-500 outline-none min-h-[14rem] transition-all custom-scrollbar", false, true)}
                    />
                </div>
            </div>

            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-violet-400 mb-4 flex items-center gap-2"><Heart size={16} /> Vitals</h3>

                {/* Birth Row */}
                {(() => {
                    const resolvedBirth = typeof meta.dates === 'string' ? meta.dates : meta.dates?.birth;
                    const resolvedDeath = typeof meta.dates === 'string' ? '' : meta.dates?.death;
                    
                    return (
                        <div className="grid grid-cols-2 gap-6 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Date of Birth</label>
                                <input 
                                    type="date" 
                                    value={getSafeDate(resolvedBirth)} 
                                    onChange={e => handleChange('dates.birth', e.target.value)} 
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Place of Birth</label>
                                <div className="relative">
                                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Falls Church, VA"
                                        value={meta.birthPlace || ''}
                                        onChange={e => handleChange('birthPlace', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 pl-9 text-white text-sm placeholder-slate-600 focus:border-violet-500 outline-none transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })()}

                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Pronouns / Gender</label>
                    <GenderSelect value={meta.gender} onChange={val => handleChange('gender', val)} />
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
                        <div className="mt-4 animate-in slide-in-from-top-2 fade-in grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-2"><Skull size={12} /> Date of Death</label>
                                <input
                                    type="date"
                                    value={getSafeDate(typeof meta.dates === 'string' ? '' : meta.dates?.death)}
                                    onChange={e => handleChange('dates.death', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm outline-none focus:border-red-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-2"><MapPin size={12} /> Place of Death</label>
                                <input
                                    type="text"
                                    placeholder="City, State"
                                    value={meta.deathPlace || ''}
                                    onChange={e => handleChange('deathPlace', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-red-500 outline-none transition-colors"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PersonIdentity;