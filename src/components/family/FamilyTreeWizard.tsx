import React, { useState, useMemo, useEffect } from 'react';
import { X, Brain, CheckCircle2, User, ChevronRight, AlertTriangle, ArrowRight, Save, History, RefreshCw } from 'lucide-react';
import type { Tag, PersonTag, PersonRelationship, Media } from '../../types';
import { InteractiveFamilyTree } from './tree';
import { getSuggestedRelationship, getInverseRelationship } from '../../utils/relationshipHeuristics';
import { getGroupedRoles, normalizeRole, isRoleCompatible } from '../../utils/gedcomRoles';
import { findMissingRelationships, RelationshipFix } from '../../utils/relationshipHealer';
import { GlassButton } from '../GlassButton';
import { generatePersonDescription, shouldGenerateDescription } from '../../services/ai/descriptionGenerator';

interface FamilyTreeWizardProps {
    allTags: Tag[];
    allMedia: Media[]; // [ZEN] Added to pass to InteractiveFamilyTree
    initialFocalId?: string;
    onClose: () => void;
    onUpdateTag: (tag: PersonTag) => void;
    currentTagOverride?: Tag;
    onEditTag?: (tag: Tag) => void; // [ZEN] Requesting parent to open edit modal
    currentUserPersonId?: string; // [ZEN] Logged in user's ID for relationship labels
}

export const FamilyTreeWizard: React.FC<FamilyTreeWizardProps> = ({ allTags, allMedia, initialFocalId, onClose, onUpdateTag, currentTagOverride, onEditTag, currentUserPersonId }) => {

    // 1. Identify Focal Person
    const [focalId, setFocalId] = useState<string>(initialFocalId || '');

    // Find valid Person tags
    const personTags = useMemo(() => {
        const persons = allTags.filter(t => t.type === 'person') as PersonTag[];
        return persons.sort((a, b) => a.name.localeCompare(b.name));
    }, [allTags]);

    // [ZEN] History Stack for Navigation
    const [focalStack, setFocalStack] = useState<string[]>([]);
    const [showRescueConfirm, setShowRescueConfirm] = useState(false);

    // Default to first person if none selected
    useEffect(() => {
        if (!focalId && personTags.length > 0) {
            // ... (existing logic)
            // prefer override or "Eric"
            if (currentTagOverride && currentTagOverride.type === 'person') {
                setFocalId(currentTagOverride.id);
                return;
            }
            const me = personTags.find(p => p.name.includes('Eric')) || personTags[0];
            setFocalId(me.id);
        }
    }, [allTags, focalId, currentTagOverride, personTags]);

    // [ZEN] Handle Navigation (Drill Down)
    const handleNodeClick = (tag: Tag) => {
        if (tag.id === focalId) return;
        // Push current to stack
        setFocalStack(prev => [...prev, focalId]);
        setFocalId(tag.id);
    };

    const handleBack = () => {
        if (focalStack.length === 0) return;
        const prev = focalStack[focalStack.length - 1];
        setFocalStack(curr => curr.slice(0, -1));
        setFocalId(prev);
    };

    // [ZEN] Listen for "Edit" event from TreeWeave
    useEffect(() => {
        const handleEditRequest = (e: Event) => {
            const customEvent = e as CustomEvent;
            const id = customEvent.detail?.id;
            if (id && onEditTag) {
                const tag = personTags.find(t => t.id === id);
                if (tag) onEditTag(tag);
            }
        };

        window.addEventListener('tree-node-edit', handleEditRequest);
        return () => window.removeEventListener('tree-node-edit', handleEditRequest);
    }, [personTags, onEditTag]);

    // [ZEN FIX] Source of Truth Logic
    const focalPerson = useMemo(() => {
        // 1. If the focal ID matches our override (the tag being edited), USE THE OVERRIDE.
        // This ensures uncommitted changes (like new relationships) are seen by the Wizard immediately.
        if (currentTagOverride && currentTagOverride.id === focalId && currentTagOverride.type === 'person') {
            return currentTagOverride as PersonTag;
        }
        // 2. Otherwise fall back to the generic list
        return personTags.find(p => p.id === focalId);
    }, [focalId, personTags, currentTagOverride]);

    // 2. Build Verification Queue
    const relationshipQueue = useMemo(() => {
        if (!focalPerson || !focalPerson.metadata.relationships) return [];

        const verificationQueue = focalPerson.metadata.relationships.map((rel, idx) => {
            const relative = personTags.find(p => p.id === rel.relatedPersonId);
            if (!relative) return null;

            // RUN LOGIC
            let suggestion = getSuggestedRelationship(focalPerson, relative, rel.type, allTags);

            // [ZEN] FUZZY MATCH LOGIC
            // Use isRoleCompatible to prevent "Half-Brother" vs "Brother" conflicts.
            // If the user manually set "Half-Brother", and heuristics suggest "Brother", it's a MATCH.
            const isFuzzyMatch = isRoleCompatible(suggestion.type, rel.type) || isRoleCompatible(rel.type, suggestion.type);
            const isMatch = isFuzzyMatch;

            // [ZEN] Check for GEDCOM Standardization
            // If logic matches but text is non-standard (e.g., 'dad' vs 'Father'), flag it.
            const normalized = normalizeRole(rel.type);
            const isStandard = normalized === rel.type;

            let status = 'match'; // 'match' | 'conflict' | 'standardize'

            if (!isMatch) {
                status = 'conflict';
            } else if (!isStandard && normalized) {
                status = 'standardize';
                suggestion = { ...suggestion, type: normalized, reasoning: "Standardizing format to GEDCOM 7.0 (e.g. 'dad' -> 'Father')" };
            }

            if (status === 'match') return null;

            return {
                id: rel.relatedPersonId, // Unique ID for queue key
                originalRel: rel,
                relative,
                suggestion,
                status,
                isMatch: status === 'match',
                index: idx,
                type: 'verify' // [ZEN] Explicit Verification
            };
        }).filter(Boolean) as any[];

        // [ZEN] PHASE 2: SELF-HEALING (Missing Links)
        // Check if the FOCAL PERSON is missing reciprocal links to others
        const healingSuggestions = findMissingRelationships(allTags).filter(fix => fix.id === focalPerson?.id);

        const healingQueue = healingSuggestions.map((fix, idx) => {
            const relative = personTags.find(p => p.id === fix.targetId);
            if (!relative) return null;

            return {
                id: fix.targetId,
                relative,
                suggestion: {
                    type: fix.missingType,
                    reasoning: fix.reasoning
                },
                status: 'missing', // Distinct status
                type: 'heal',
                index: 1000 + idx
            };
        }).filter(Boolean);

        return [...verificationQueue, ...healingQueue];
    }, [focalPerson, personTags, allTags]);

    // State for interactive wizard flow
    const [activeIndex, setActiveIndex] = useState(0);
    const [isOverrideOpen, setIsOverrideOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(''); // [ZEN] New search state
    const [isSidebarOpen, setIsSidebarOpen] = useState(true); // [ZEN] Sidebar Toggle State

    // [ZEN] Manual Override State (Select-Then-Confirm)
    // If the user selects an override, store it here temporarily.
    // If set, the Green Button will confirm THIS value instead of the suggestion.
    const [manualSelection, setManualSelection] = useState<{ type: string, label: string } | null>(null);

    const activeItem = relationshipQueue[activeIndex];

    // [ZEN] Reset temporary states when changing items
    useEffect(() => {
        setIsOverrideOpen(false);
        setManualSelection(null);
        setSearchTerm('');
    }, [activeIndex]);

    // [ZEN] Grouped Roles
    const groupedRoles = useMemo(() => getGroupedRoles(), []);

    // [ZEN] Auto-Generate Description State
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

    // [ZEN FIX] Ref to track latest focalPerson to prevent Stale Closure Overwrites during async ops
    const latestFocalPersonRef = React.useRef(focalPerson);
    useEffect(() => {
        latestFocalPersonRef.current = focalPerson;
    }, [focalPerson]);

    // [ZEN] Effect: Check for auto-generation when queue is empty (All Clear)
    useEffect(() => {
        const checkAndGenerate = async () => {
            const currentPerson = latestFocalPersonRef.current;
            // Only run if:
            // 1. Queue is empty (All Clear)
            // 2. We have a focal person
            // 3. Not currently generating
            // 4. Description needs generation (empty or placeholder)
            if (!activeItem && currentPerson && !isGeneratingDesc && shouldGenerateDescription(currentPerson.description)) {

                // [ZEN FIX] Do NOT generate if relationships are empty. 
                // This prevents "Generic Relative" descriptions and allows the Rescue button to remain visible.
                if (!currentPerson.metadata.relationships || currentPerson.metadata.relationships.length === 0) {
                    console.log("[FamilyTree] Skipping Auto-Description: No relationships found.");
                    return;
                }

                console.log("[FamilyTree] Logic Verified. Attempting Auto-Description...");
                setIsGeneratingDesc(true);

                // Use the *current* person for generation context to ensure accuracy
                const newDesc = await generatePersonDescription(currentPerson, allTags);

                if (newDesc) {
                    // [ZEN FIX] CRITICAL: Re-fetch the LATEST person from ref before saving.
                    // This ensures that if a "Rescue" happened while we were generating, we don't overwrite it.
                    const freshPerson = latestFocalPersonRef.current;
                    if (!freshPerson) return;

                    // Update and Save
                    const updated = { ...freshPerson, description: newDesc };
                    onUpdateTag(updated);
                }

                setIsGeneratingDesc(false);
            }
        };

        const timer = setTimeout(checkAndGenerate, 1000); // Small delay to allow UI to settle
        return () => clearTimeout(timer);
    }, [activeItem, focalPerson?.id, allTags]); // Removed focalPerson from dependency to rely on ref for data, but kept ID for switching


    // [ZEN FIX] Data Rescue Operation
    // Scans ALL tags to find who claims to be related to 'focalPerson', then reconstructs the focal person's list.
    const handleRescueRelationships = () => {
        if (!focalPerson) return;

        console.log(`[Rescue] Scanning for lost connections for ${focalPerson.name}...`);

        const recovered: PersonRelationship[] = [];
        const personTags = allTags.filter(t => t.type === 'person') as PersonTag[]; // [ZEN] Use validated Person list

        personTags.forEach(other => {
            if (other.id === focalPerson.id) return;
            const rels = other.metadata.relationships || [];

            // Does 'other' claim to know 'focal'?
            const link = rels.find(r => r.relatedPersonId === focalPerson.id);
            if (link) {
                // Determine Inverse
                // e.g. Eric says Leota is "Grandmother".
                // We need Leota to say Eric is "Grandson".
                const inverseType = getInverseRelationship(link.type, focalPerson.metadata.gender || 'unknown');

                recovered.push({
                    relatedPersonId: other.id,
                    type: inverseType
                });
                console.log(`[Rescue] Found link: ${other.name} calls her "${link.type}" -> Inverse: "${inverseType}"`);
            }
        });

        if (recovered.length > 0) {
            const updated = {
                ...focalPerson,
                metadata: { ...focalPerson.metadata, relationships: recovered }
            };
            onUpdateTag(updated);
            alert(`⛑️ Rescue Successful! Recovered ${recovered.length} connections.`);
        } else {
            alert("No lost connections found in the archive.");
        }
    };

    // Actions
    const handleConfirmSuggestion = (item: any) => {
        if (!focalPerson) return;

        // [ZEN] Use Manual Selection if present, otherwise use Suggestion
        const finalType = manualSelection ? manualSelection.type : item.suggestion.type;

        // 1. Update the relationship in the Tag object
        const newRels = [...(focalPerson.metadata.relationships || [])];
        const targetRelIndex = newRels.findIndex(r => r.relatedPersonId === item.relative.id);

        if (targetRelIndex !== -1) {
            newRels[targetRelIndex] = {
                relatedPersonId: item.relative.id,
                type: finalType
            };
        } else {
            console.log(`[Healer] Adding NEW relationship: ${finalType} with ${item.relative.name}`);
            newRels.push({ relatedPersonId: item.relative.id, type: finalType });
        }

        const updatedTag = {
            ...focalPerson,
            metadata: { ...focalPerson.metadata, relationships: newRels }
        };

        // 2. Commit
        onUpdateTag(updatedTag);

        // [ZEN] Reset UI State
        setManualSelection(null);
        setSearchTerm('');
    };

    const handleManualOverride = (item: any, newType: string, newLabel: string) => {
        setManualSelection({ type: newType, label: newLabel });
        setIsOverrideOpen(false);
    };

    if (!focalPerson) return <div className="p-8 text-white">Loading Family Data...</div>;

    return (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-black/40 w-full max-w-[95vw] h-[90vh] rounded-2xl border border-white/10 shadow-2xl flex overflow-hidden animate-in zoom-in-95 backdrop-blur-xl">

                {/* --- LEFT COLUMN: FAMILY TREE VISUALIZER --- */}
                <div className={`flex flex-col border-r border-white/10 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[calc(100%-400px)]' : 'w-full'}`}>

                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-transparent relative z-20">
                        <div className="absolute top-4 left-4 z-20 flex items-center gap-4 bg-black/40 backdrop-blur-md p-2 rounded-xl border border-white/5 shadow-2xl">
                            <h2 className="text-2xl font-black text-white flex items-center gap-2 drop-shadow-lg">
                                <User className="text-violet-500" size={24} />
                                <span className="hidden sm:inline bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">{focalPerson.name}'s Family Tree</span>
                            </h2>

                            {/* [ZEN] Back Button */}
                            {
                                focalStack.length > 0 && (
                                    <GlassButton onClick={handleBack} variant="secondary" className="text-xs px-3 py-1.5 gap-2 h-8">
                                        <ArrowRight size={14} className="rotate-180" /> Back
                                    </GlassButton>
                                )
                            }

                            <div className="relative">
                                <select
                                    value={focalId}
                                    onChange={e => {
                                        setFocalStack(prev => [...prev, focalId]);
                                        setFocalId(e.target.value);
                                    }}
                                    className="appearance-none bg-slate-800/80 border border-slate-600/50 rounded-lg pl-3 pr-8 py-1.5 text-sm text-white outline-none focus:border-violet-500 cursor-pointer hover:bg-slate-700transition-colors shadow-inner"
                                >
                                    {personTags.map(p => (
                                        <option key={p.id} value={p.id} className="bg-slate-900 text-slate-300">
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none rotate-90" size={14} />
                            </div>
                        </div>

                        {/* Sidebar Toggle Button */}
                        <div className="absolute top-4 right-4 z-20">
                            <GlassButton
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                variant="secondary"
                                className="text-xs px-4 py-2"
                            >
                                {isSidebarOpen ? <ChevronRight size={16} /> : null}
                                {isSidebarOpen ? 'Expand Tree' : 'Show Tools'}
                                {!isSidebarOpen ? <ArrowRight size={16} /> : null}
                            </GlassButton>
                        </div>
                    </div >

                    {/* Canvas Area */}
                    < div className="flex-1 relative bg-transparent overflow-hidden" >
                        {/* Grid Pattern Overlay for Depth */}
                        < div className="absolute inset-0 pointer-events-none opacity-20"
                            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }}>
                        </div >

                        <InteractiveFamilyTree
                            centerTag={focalPerson}
                            allTags={allTags}
                            allMedia={allMedia}
                            onNodeClick={handleNodeClick}
                            highlightId={activeItem?.relative.id}
                            userPersonTagId={currentUserPersonId || (personTags.find(p => p.name.includes('Eric'))?.id) || personTags[0]?.id}
                        />
                    </div >

                    <div className="p-3 border-t border-white/10 bg-black/20 text-slate-400 text-[10px] backdrop-blur-sm flex justify-between">
                        <p>Tip: Click any node to re-center. Drag to pan. Scroll to zoom.</p>
                        <p className="opacity-50">TreeWeave™ Engine v2.1</p>
                    </div>
                </div >


                {/* --- RIGHT COLUMN: LOGIC INTERROGATOR --- */}
                < div
                    className={`flex flex-col bg-black/20 backdrop-blur-md transition-all duration-300 ease-in-out border-l border-white/5 overflow-hidden
                    ${isSidebarOpen ? 'w-[400px] opacity-100' : 'w-0 opacity-0'}`}
                >
                    <div className="p-4 border-b border-white/10 flex justify-end">
                        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10"><X size={20} /></button>
                    </div>

                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar min-w-[400px]">
                        <div className="max-w-md mx-auto">

                            <div className="mb-8 text-center">
                                <h3 className="text-2xl font-black text-white tracking-tight mb-2">Relationship Check</h3>
                                <p className="text-slate-400">Reviewing {relationshipQueue.length} connections for <span className="text-cyan-400 font-bold">{focalPerson.name}</span>.</p>
                            </div>

                            {activeItem ? (
                                <div key={activeItem.id} className="animate-in slide-in-from-right-8 fade-in duration-300">

                                    {/* QUESTION CARD */}
                                    <div className="bg-[#1a1d26] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                                        {/* Status Badge */}
                                        <div className={`absolute top-0 right-0 p-3 rounded-bl-2xl text-[10px] font-bold uppercase tracking-widest ${activeItem.status === 'match' ? 'bg-emerald-900/30 text-emerald-400' : (activeItem.status === 'missing' ? 'bg-violet-900/30 text-violet-400' : (activeItem.status === 'standardize' ? 'bg-blue-900/30 text-blue-400' : 'bg-amber-900/30 text-amber-500'))} border-b border-l border-white/5`}>
                                            {activeItem.status === 'match' ? 'Logic Verified' : (activeItem.status === 'missing' ? 'Missing Link Detected' : (activeItem.status === 'standardize' ? 'Format Update' : 'Conflict Detected'))}
                                        </div>

                                        <div className="flex flex-col items-center mb-6">
                                            <div className={`w-20 h-20 bg-slate-800 rounded-full mb-3 flex items-center justify-center text-2xl font-bold border-2 border-white/10 text-slate-500 overflow-hidden relative`}>
                                                {activeItem.relative.metadata.coverPhoto || activeItem.relative.metadata.avatar ? (
                                                    <img
                                                        src={activeItem.relative.metadata.coverPhoto || activeItem.relative.metadata.avatar}
                                                        alt={activeItem.relative.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    activeItem.relative.name.charAt(0)
                                                )}
                                            </div>
                                            <h4 className="text-xl font-bold text-white mb-1">{activeItem.relative.name}</h4>
                                            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Born: {activeItem.relative.metadata.dates?.birth ? new Date((activeItem.relative.metadata.dates.birth as any).seconds ? (activeItem.relative.metadata.dates.birth as any).seconds * 1000 : activeItem.relative.metadata.dates.birth).getFullYear() : 'Unknown Data'}</p>
                                        </div>

                                        <div className="bg-[#0a0c10] p-4 rounded-xl border border-white/10 mb-6">
                                            <p className="text-center text-lg text-slate-200 leading-relaxed">
                                                {activeItem.status === 'missing' ? 'Add Missing Relationship:' : 'Is this person your'} <br />
                                                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                                                    {manualSelection ? manualSelection.label : activeItem.suggestion.type}?
                                                </span>
                                            </p>

                                            {/* Reasoning */}
                                            {manualSelection ? (
                                                <div className="mt-4 flex gap-3 text-xs text-emerald-400 bg-white/5 p-3 rounded-lg border border-emerald-500/20">
                                                    <CheckCircle2 className="shrink-0" size={16} />
                                                    <p>Selected Manually</p>
                                                </div>
                                            ) : (
                                                <div className="mt-4 flex gap-3 text-xs text-slate-400 bg-white/5 p-3 rounded-lg">
                                                    <Brain className="shrink-0 text-cyan-500" size={16} />
                                                    <p>{activeItem.suggestion.reasoning}</p>
                                                </div>
                                            )}

                                            {/* [ZEN] Healer Message */}
                                            {activeItem.status === 'missing' && (
                                                <div className="mt-4 flex gap-3 text-xs text-violet-300 bg-violet-900/20 p-3 rounded-lg border border-violet-500/20">
                                                    <Brain className="shrink-0 text-violet-400" size={16} />
                                                    <p>
                                                        <strong>Proactive Healing:</strong> {activeItem.suggestion.reasoning}<br />
                                                        Adding this will fix the family tree structure.
                                                    </p>
                                                </div>
                                            )}

                                            {/* Conflict Warning (Hidden if manual override active or if it's a missing link OR Step-Relation match) */}
                                            {!manualSelection && activeItem.status !== 'match' && activeItem.status !== 'missing' && activeItem.originalRel && !activeItem.originalRel.type.includes('Step-' + activeItem.suggestion.type) && (
                                                <div className={`mt-2 flex gap-3 text-xs p-3 rounded-lg border ${activeItem.status === 'standardize' ? 'text-blue-300 bg-blue-900/20 border-blue-500/20' : 'text-amber-300 bg-amber-900/20 border-amber-500/20'}`}>
                                                    <AlertTriangle className="shrink-0" size={16} />
                                                    <p>
                                                        Current Tag: <strong>"{activeItem.originalRel.type}"</strong><br />
                                                        Logic suggests: <strong>"{activeItem.suggestion.type}"</strong>
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            {/* PRIMARY ACTION BUTTON */}
                                            <GlassButton
                                                onClick={() => handleConfirmSuggestion(activeItem)}
                                                className={`w-full text-center justify-center py-4 text-base ${activeItem.status === 'standardize' && !manualSelection ? 'bg-blue-600/20 border-blue-500/50 hover:bg-blue-600 text-blue-300 hover:text-white' : 'bg-emerald-600/20 border-emerald-500/50 hover:bg-emerald-600 text-emerald-300 hover:text-white'}`}
                                            >
                                                <CheckCircle2 className="mr-2" /> Yes, Update to {manualSelection ? manualSelection.label : activeItem.suggestion.type}
                                            </GlassButton>

                                            <div className="relative">
                                                <button
                                                    onClick={() => setIsOverrideOpen(!isOverrideOpen)}
                                                    className={`w-full text-xs py-3 transition-colors rounded-lg border ${isOverrideOpen ? 'bg-slate-800 text-white border-slate-600' : 'text-slate-500 border-transparent hover:text-white hover:bg-slate-800/50'}`}
                                                >
                                                    {isOverrideOpen ? 'Close Menu' : (manualSelection ? 'Change Selection...' : 'No, select something else...')}
                                                </button>
                                                {/* Dropdown for manual override */}
                                                {isOverrideOpen && (
                                                    <div className="absolute bottom-full left-0 right-0 bg-[#252936] border border-white/10 rounded-xl shadow-2xl max-h-80 overflow-y-auto mb-2 custom-scrollbar p-1 z-50 animate-in fade-in slide-in-from-bottom-2 flex flex-col">
                                                        {/* Search Bar */}
                                                        <div className="sticky top-0 bg-[#252936] p-2 border-b border-white/5 z-10">
                                                            <input
                                                                type="text"
                                                                placeholder="Search relationships..."
                                                                className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                                                                autoFocus
                                                                value={searchTerm}
                                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>

                                                        {Object.entries(groupedRoles).map(([group, roles]) => {
                                                            const filteredRoles = roles.filter(role =>
                                                                role.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                                (role.gedcomTag && role.gedcomTag.toLowerCase().includes(searchTerm.toLowerCase()))
                                                            );

                                                            if (filteredRoles.length === 0) return null;

                                                            return (
                                                                <div key={group} className="mb-2">
                                                                    <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-black/20 rounded mb-1 mx-1 mt-2">
                                                                        {group}
                                                                    </div>
                                                                    {filteredRoles.map(role => (
                                                                        <button
                                                                            key={role.value}
                                                                            onClick={() => {
                                                                                handleManualOverride(activeItem, role.value, role.label);
                                                                                setIsOverrideOpen(false);
                                                                                setSearchTerm('');
                                                                            }}
                                                                            className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-violet-600 hover:text-white rounded-lg transition-colors flex justify-between items-center"
                                                                        >
                                                                            {role.label}
                                                                            {role.gedcomTag && <span className="text-[9px] opacity-40 font-mono tracking-tighter">{role.gedcomTag.toUpperCase()}</span>}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })}
                                                        {Object.values(groupedRoles).flat().every(r => !r.label.toLowerCase().includes(searchTerm.toLowerCase())) && (
                                                            <div className="p-4 text-center text-xs text-slate-500">
                                                                No matching relationships found.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex justify-between text-xs text-slate-600 font-mono">
                                        <span>Progress: {activeIndex + 1} / {relationshipQueue.length}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => activeIndex > 0 && setActiveIndex(prev => prev - 1)} className="hover:text-white">Previous</button>
                                            <button onClick={() => activeIndex < relationshipQueue.length - 1 && setActiveIndex(prev => prev + 1)} className="hover:text-white">Skip</button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 flex flex-col items-center">
                                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-4 animate-bounce">
                                        <CheckCircle2 size={40} />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">All Clear!</h3>
                                    <p className="text-slate-400 mb-8">No remaining relationships to check for {focalPerson.name}.</p>

                                    {isGeneratingDesc && (
                                        <div className="mb-6 p-4 bg-violet-900/20 border border-violet-500/30 rounded-xl flex items-center gap-3 animate-pulse">
                                            <RefreshCw className="animate-spin text-violet-400" size={20} />
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-violet-300">AI Enhancement Active</p>
                                                <p className="text-xs text-violet-400/70">Writing profile description based on verified logic...</p>
                                            </div>
                                        </div>
                                    )}

                                    {showRescueConfirm ? (
                                        <div className="mb-4 p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl max-w-sm relative animate-in fade-in zoom-in duration-200">
                                            <button
                                                className="absolute top-2 right-2 text-amber-500/50 hover:text-amber-500 transition-colors"
                                                onClick={() => setShowRescueConfirm(false)}
                                            >
                                                <X size={14} />
                                            </button>
                                            <h4 className="text-amber-400 font-bold mb-2 flex items-center gap-2 justify-center"><AlertTriangle size={16} /> Confirm Rescue?</h4>
                                            <p className="text-xs text-amber-300/70 mb-4">This forces a deep heuristic scan of all tags to find missing links. It may be slow.</p>
                                            <GlassButton onClick={handleRescueRelationships} variant="danger" className="w-full text-center justify-center">
                                                ⛑️ Yes, Force Scan
                                            </GlassButton>
                                        </div>
                                    ) : (
                                        <GlassButton onClick={() => setShowRescueConfirm(true)} variant="secondary" className="mb-4 w-full text-center justify-center border-amber-500/20 text-amber-500/80 hover:bg-amber-900/20 hover:text-amber-400">
                                            <AlertTriangle size={14} className="mr-2" /> Force Recheck
                                        </GlassButton>
                                    )}

                                    <GlassButton onClick={() => setActiveIndex(0)} variant="secondary" className="mb-4">
                                        <RefreshCw size={14} className="mr-2" /> Review Again
                                    </GlassButton>

                                    <p className="text-xs text-slate-600">Select another person from the tree (left) to check their logic.</p>
                                </div>
                            )}

                        </div>
                    </div>
                </div >
            </div >
        </div >
    );
};
