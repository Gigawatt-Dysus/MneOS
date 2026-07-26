import React, { useState, useEffect } from 'react';
import { EnrichmentProposal } from '../../services/ai/generators/gedcomEnrichment';
import { Check, X, AlertTriangle, Sparkles, ArrowRight, Edit2 } from 'lucide-react';

interface EnrichmentReviewModalProps {
    proposal: EnrichmentProposal;
    onApply: (selectedChanges: EnrichmentProposal['changes']) => void;
    onClose: () => void;
}

export const EnrichmentReviewModal: React.FC<EnrichmentReviewModalProps> = ({ proposal, onApply, onClose }) => {

    // [ZEN V15] Local Mutable State for Manual Corrections
    const [changes, setChanges] = useState<EnrichmentProposal['changes']>([]);

    // Default: Check all HIGH confidence items
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    useEffect(() => {
        const safeChanges = proposal.changes || [];
        setChanges(safeChanges);

        const defaults = new Set<number>();
        safeChanges.forEach((change, idx) => {
            if (change.confidence === 'HIGH') defaults.add(idx);
        });
        setSelectedIndices(defaults);
    }, [proposal]);

    const [showLowConfidence, setShowLowConfidence] = useState(false);
    const [editingIdx, setEditingIdx] = useState<number | null>(null); // Track which row is being edited

    const toggleSelection = (idx: number) => {
        const next = new Set(selectedIndices);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        setSelectedIndices(next);
    };

    const handleApply = () => {
        // [ZEN] Flatten the changes. If newValue is an array, we must apply each item. 
        // The current architecture expects objects matching the structure.
        // We pass the *modified* changes from local state.
        const toApply = changes.filter((_, idx) => selectedIndices.has(idx));
        onApply(toApply);
    };

    const handleEditChange = (idx: number, subIndex: number, field: string, val: string) => {
        setChanges(prev => prev.map((c, i) => {
            if (i !== idx) return c;

            // Deep clone to avoid mutation
            const updated = { ...c };

            // Handle array of facts (which is what we usually get for 'facts')
            if (Array.isArray(updated.newValue)) {
                const newArr = [...updated.newValue];
                newArr[subIndex] = { ...newArr[subIndex], [field]: val };
                updated.newValue = newArr;
            } else if (typeof updated.newValue === 'object') {
                // Single object case
                updated.newValue = { ...updated.newValue, [field]: val };
            } else {
                // Primitive case (unlikely for facts, possible for other fields)
                updated.newValue = val;
            }
            return updated;
        }));
    };

    const formatValue = (val: any): string => {
        if (val === null || val === undefined) return 'Empty';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    const renderChangeRow = (change: EnrichmentProposal['changes'][0], idx: number) => {
        const isSelected = selectedIndices.has(idx);
        const isEditing = editingIdx === idx;

        // Helper to render the editable fields for a fact
        const renderFactInput = (fact: any, subIndex: number) => (
            <div key={subIndex} className="flex gap-2 items-center mt-1">
                <input
                    className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white w-24 focus:border-blue-500 outline-none"
                    value={fact.date || ''}
                    placeholder="Date"
                    onChange={(e) => handleEditChange(idx, subIndex, 'date', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                />
                <input
                    className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white flex-1 focus:border-blue-500 outline-none"
                    value={fact.value || ''}
                    placeholder="Value / Location"
                    onChange={(e) => handleEditChange(idx, subIndex, 'value', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        );

        // Helper to render static view
        const renderFactStatic = (fact: any, subIndex: number) => (
            <div key={subIndex} className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 text-xs w-20 truncate">{fact.date || 'No Date'}</span>
                <span className="text-white font-medium truncate flex-1">{fact.value}</span>
            </div>
        );

        const newValues = Array.isArray(change.newValue) ? change.newValue : [change.newValue];

        return (
            <div
                key={idx}
                className={`flex gap-4 p-3 rounded-lg border transition-all ${isSelected
                    ? 'bg-blue-900/20 border-blue-500/50'
                    : 'bg-gray-800/50 border-gray-700'
                    }`}
            >
                <div className="pt-1 cursor-pointer" onClick={() => toggleSelection(idx)}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-500 text-transparent'
                        }`}>
                        <Check size={14} strokeWidth={3} />
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{change.field}</span>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${change.confidence === 'HIGH' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-500'
                                }`}>
                                {change.confidence}
                            </span>
                            <button
                                onClick={() => setEditingIdx(isEditing ? null : idx)}
                                className={`p-1 rounded hover:bg-white/10 ${isEditing ? 'text-blue-400' : 'text-gray-500'}`}
                            >
                                <Edit2 size={12} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        {/* Old Value (Reference) */}
                        {change.currentValue && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 pl-2 border-l-2 border-gray-700">
                                <span className="uppercase text-[10px]">Current:</span>
                                <span className="line-through">{formatValue(change.currentValue)}</span>
                            </div>
                        )}

                        {/* New Value (Editable or Static) */}
                        <div className="space-y-1">
                            {newValues.map((val, i) => isEditing ? renderFactInput(val, i) : renderFactStatic(val, i))}
                        </div>
                    </div>

                    <div className="mt-2 text-xs text-blue-300/80 italic">
                        {change.reason}
                    </div>
                </div>
            </div>
        );
    };

    const highConfChanges = changes.map((c, i) => ({ ...c, originalIdx: i })).filter(c => c.confidence === 'HIGH');
    const lowConfChanges = changes.map((c, i) => ({ ...c, originalIdx: i })).filter(c => c.confidence !== 'HIGH');

    return (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="p-5 border-b border-gray-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles className="text-blue-400" size={20} />
                        Enrichment Analysis
                    </h2>
                    <p className="text-sm text-gray-400 mt-2 bg-gray-800 p-3 rounded-lg border border-gray-700">
                        "{proposal.rationale}"
                    </p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">

                    {/* High Confidence */}
                    <div>
                        <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            Likely Improvements
                            <span className="bg-gray-800 text-gray-400 px-1.5 rounded-full text-[10px]">{highConfChanges.length}</span>
                        </h3>
                        {highConfChanges.length > 0 ? (
                            <div className="space-y-2">
                                {highConfChanges.map(c => renderChangeRow(c, c.originalIdx))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 italic">No high confidence changes found.</div>
                        )}
                    </div>

                    {/* Low Confidence */}
                    {lowConfChanges.length > 0 && (
                        <div className="pt-4 border-t border-gray-800">
                            <button
                                onClick={() => setShowLowConfidence(!showLowConfidence)}
                                className="w-full flex items-center justify-between text-xs font-bold text-yellow-500/80 uppercase tracking-widest mb-3 hover:text-yellow-400"
                            >
                                <span className="flex items-center gap-2">
                                    <AlertTriangle size={14} /> Potential Noise / Conflicts
                                    <span className="bg-gray-800 text-gray-400 px-1.5 rounded-full text-[10px]">{lowConfChanges.length}</span>
                                </span>
                                <span>{showLowConfidence ? 'Hide' : 'Show'}</span>
                            </button>

                            {showLowConfidence && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    {lowConfChanges.map(c => renderChangeRow(c, c.originalIdx))}
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-gray-900 rounded-b-xl flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                        {selectedIndices.size} changes selected
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={selectedIndices.size === 0}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
                        >
                            Apply Selection
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
