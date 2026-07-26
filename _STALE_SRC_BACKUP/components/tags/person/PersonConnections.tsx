import React, { useState, useMemo } from 'react';
import { Users, Edit2, Trash2, Brain, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Tag, PersonTag, PersonRelationship, AiCompanion } from '@/types';
import { deduceRelationship } from '../../../services/ai/relationshipAgent';
import { GigiCoreIcon } from '../../icons/GigiCoreIcon';
import { RELATIONSHIP_PRIORITY, getRelationshipSortKey } from './PersonShared';

interface PersonConnectionsProps {
    tag: PersonTag;
    allTags: Tag[];
    meta: any;
    handleChange: (path: string, value: any) => void;
    primaryCompanion: AiCompanion;
}

const PersonConnections: React.FC<PersonConnectionsProps> = ({ tag, allTags, meta, handleChange, primaryCompanion }) => {
    
    // Smart Linker State
    const [newRelPersonId, setNewRelPersonId] = useState('');
    const [relContext, setRelContext] = useState('');
    const [isDeducing, setIsDeducing] = useState(false);
    
    // Result & Override State
    const [deductionResult, setDeductionResult] = useState<{ type: string; reasoning: string; warning?: string } | null>(null);
    const [manualOverrideType, setManualOverrideType] = useState('');
    const [deductionError, setDeductionError] = useState<string | null>(null);

    const allRelationshipTypes = Object.keys(RELATIONSHIP_PRIORITY).sort();

    const sortedRelationships = useMemo(() => {
        if (!meta.relationships || !Array.isArray(meta.relationships)) return [];
        return [...meta.relationships].sort((a: any, b: any) => getRelationshipSortKey(a.type) - getRelationshipSortKey(b.type));
    }, [meta.relationships]);

    const eligibleEntities = useMemo(() => {
        return allTags
            .filter(t => t.id !== tag.id && ['person', 'pet', 'place', 'thing'].includes(t.type))
            .sort((a, b) => {
                const typeCompare = a.type.localeCompare(b.type);
                if (typeCompare !== 0) return typeCompare;
                return a.name.localeCompare(b.name);
            });
    }, [allTags, tag.id]);

    const handleAskGigi = async () => {
        if (!newRelPersonId) return;
        setIsDeducing(true);
        setDeductionResult(null);
        setDeductionError(null);
        
        try {
            const targetEntity = allTags.find(t => t.id === newRelPersonId);
            if (targetEntity) {
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("AI connection timed out")), 15000));
                
                const result: any = await Promise.race([
                    deduceRelationship(tag, targetEntity, relContext || "Guess based on data", primaryCompanion),
                    timeoutPromise
                ]);

                setDeductionResult(result);
                setManualOverrideType(result.type); 
            }
        } catch (e: any) {
            setDeductionError(e.message || "Failed to contact AI.");
        } finally {
            setIsDeducing(false);
        }
    };

    const confirmRelationship = () => {
        if (!newRelPersonId) return;
        
        const finalType = manualOverrideType.trim().toLowerCase();
        if (!finalType) return;

        const newRel: PersonRelationship = { relatedPersonId: newRelPersonId, type: finalType };
        const currentRels = Array.isArray(meta.relationships) ? meta.relationships : [];
        const filteredRels = currentRels.filter((r: any) => r.relatedPersonId !== newRelPersonId);
        const updatedRels = [...filteredRels, newRel].sort((a, b) => getRelationshipSortKey(a.type) - getRelationshipSortKey(b.type));
        
        handleChange('relationships', updatedRels);
        
        setNewRelPersonId(''); 
        setRelContext('');
        setDeductionResult(null);
        setManualOverrideType('');
    };

    const removeRelationship = (index: number) => {
        const currentRels = Array.isArray(meta.relationships) ? meta.relationships : [];
        const updatedRels = currentRels.filter((_: any, i: number) => i !== index);
        handleChange('relationships', updatedRels);
    };

    const editRelationship = (rel: PersonRelationship) => {
        setNewRelPersonId(rel.relatedPersonId);
        setManualOverrideType(rel.type);
        setRelContext(`(Editing existing relationship: ${rel.type})`);
        
        setDeductionResult({
            type: rel.type,
            reasoning: "Loaded from existing data. Update the type below or ask me to re-evaluate.",
            warning: undefined
        });
    };

    return (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 animate-in fade-in">
           <h4 className="text-sm font-bold text-violet-400 mb-3 flex items-center gap-2"><Users size={16}/> Relationships</h4>
           
           <div className="space-y-2 mb-6 max-h-64 overflow-y-auto custom-scrollbar pr-2">
               {sortedRelationships.map((rel: any, idx: number) => {
                   const relative = allTags.find(t => t.id === rel.relatedPersonId);
                   return (
                       <div key={idx} className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800 group">
                           <div className="flex items-center gap-2">
                               <span className="text-xs font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded min-w-[80px] text-center capitalize">{rel.type}</span>
                               <span className="text-sm text-white truncate">{relative?.name || 'Unknown Entity'}</span>
                           </div>
                           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={() => editRelationship(rel)} className="p-1.5 text-slate-500 hover:text-cyan-400 transition-colors" title="Edit Relationship"><Edit2 size={14}/></button>
                               <button onClick={() => removeRelationship(idx)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors" title="Remove"><Trash2 size={14}/></button>
                           </div>
                       </div>
                   );
               })}
               {sortedRelationships.length === 0 && <p className="text-xs text-slate-500 italic">No relationships defined.</p>}
           </div>
           
           <div className="bg-slate-900 p-4 rounded-xl border border-slate-700/50 space-y-3">
               <label className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2"><Brain size={14}/> Smart Linker</label>
               
               <div className="flex gap-2">
                   <select 
                        value={newRelPersonId} 
                        onChange={e => setNewRelPersonId(e.target.value)} 
                        className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white flex-1 focus:border-cyan-500 outline-none"
                    >
                        <option value="">Select Entity...</option>
                        {eligibleEntities.map(t => (
                            <option key={t.id} value={t.id} label={`${t.name} [${t.type.toUpperCase()}]`}>
                                {t.name} [{t.type.toUpperCase()}]
                            </option>
                         ))}
                   </select>
               </div>

               <div className="relative">
                   <textarea 
                        value={relContext}
                        onChange={e => setRelContext(e.target.value)}
                        placeholder={`Tell ${primaryCompanion.name} about the connection... (e.g., 'He is my bio-dad's son', 'We worked at IBM together')`}
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-sm text-white focus:border-cyan-500 outline-none resize-none h-20 custom-scrollbar"
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAskGigi())}
                   />
                   
                   <button 
                        onClick={handleAskGigi}
                        disabled={!newRelPersonId || isDeducing}
                        className="absolute bottom-2 right-2 p-1 rounded-full bg-cyan-600/20 hover:bg-cyan-600 hover:text-white text-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed group border border-cyan-500/30"
                        title={`Ask ${primaryCompanion.name}`}
                   >
                       {isDeducing ? (
                           <Loader2 className="w-8 h-8 animate-spin p-1.5" />
                       ) : (
                           <GigiCoreIcon className="w-8 h-8 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] group-hover:scale-110 transition-transform" />
                       )}
                   </button>
               </div>

               {deductionError && (
                   <div className="flex items-center gap-2 text-xs text-red-300 bg-red-900/20 px-3 py-2 rounded border border-red-500/30">
                       <AlertTriangle size={14} /> {deductionError}
                   </div>
               )}

               {deductionResult && (
                    <div className="animate-in fade-in slide-in-from-top-2 bg-indigo-900/30 border border-indigo-500/50 rounded-xl p-4 mt-2">
                       <div className="flex flex-col gap-3">
                           <div className="flex items-start gap-3">
                               <div className="bg-indigo-500/20 p-2 rounded-full text-indigo-400 mt-1"><Brain size={16}/></div>
                               <div>
                                   <p className="text-sm font-bold text-white mb-1">Suggestion from {primaryCompanion.name}:</p>
                                   <p className="text-xs text-slate-300 italic">"{deductionResult.reasoning}"</p>
                               </div>
                           </div>

                           {deductionResult.warning && (
                               <div className="text-xs text-amber-400 bg-amber-900/20 px-2 py-1 rounded border border-amber-500/30">
                                   Note: {deductionResult.warning}
                               </div>
                           )}

                           <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Relationship Type (Editable)</label>
                               <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                         list="relationshipTypes" 
                                        value={manualOverrideType} 
                                        onChange={(e) => setManualOverrideType(e.target.value)}
                                        className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none capitalize"
                                    />
                                     <datalist id="relationshipTypes">
                                        {allRelationshipTypes.map(t => <option key={t} value={t} />)}
                                    </datalist>
                                    
                                    <button 
                                         onClick={confirmRelationship}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg"
                                    >
                                        <CheckCircle2 size={14}/> Confirm
                                    </button>
                                </div>
                           </div>
                       </div>
                   </div>
               )}
           </div>
       </div>
    );
};

export default PersonConnections;