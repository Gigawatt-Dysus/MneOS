import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react';
import { Media } from '../../types';
import { issueCitation } from '../../services/sovereignDbAdapter';
import { GlassButton } from '../GlassButton';

export interface CitationModalProps {
    isOpen: boolean;
    onClose: () => void;
    media: Media;
    userId: string;
    onTicketIssued?: () => void;
    healMediaViolator?: (media: Media, citationData?: any) => Promise<Media>;
}

export const CitationModal: React.FC<CitationModalProps> = ({ isOpen, onClose, media, userId, onTicketIssued, healMediaViolator }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Violation Categories
    const [violations, setViolations] = useState({
        countViolation: false,
        contextPresumption: false,
        phantomEntity: false,
        relationalAssumption: false,
        emotionalProjection: false,
        textFabrication: false,
        other: false
    });
    
    const [officerNotes, setOfficerNotes] = useState("");

    if (!isOpen) return null;

    const handleCheckboxChange = (field: keyof typeof violations) => {
        setViolations(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handleSubmit = async () => {
        const hasViolations = Object.values(violations).some(v => v);
        if (!hasViolations && !officerNotes.trim()) {
            alert("Please select at least one violation or provide officer notes.");
            return;
        }

        setIsSubmitting(true);
        try {
            if (healMediaViolator) {
                await healMediaViolator(media, {
                    violations,
                    officerNotes,
                    originalDescription: media.description || '',
                    aiModel: media.aiModel || 'unknown'
                });
            }
            if (onTicketIssued) onTicketIssued();
            onClose();
        } catch (error) {
            console.error("Failed to issue citation:", error);
            alert("Failed to issue citation. See console for details.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-[#0f1219] rounded-2xl border border-rose-500/30 shadow-[0_0_50px_rgba(244,63,94,0.1)] flex flex-col overflow-hidden max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-rose-500/20 bg-rose-500/5">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
                            <ShieldAlert className="text-rose-500 w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Issue Citation</h2>
                            <p className="text-xs text-rose-400/70 font-mono tracking-wider uppercase mt-1">Forensic Metadata Audit</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        disabled={isSubmitting}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
                    
                    {/* Media Preview (Compact) */}
                    <div className="flex gap-4 p-3 bg-black/40 rounded-xl border border-white/5">
                        <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-slate-900">
                            {(media as any).type === 'video' || media.fileType?.startsWith('video') ? (
                                <video src={media.url} className="w-full h-full object-cover opacity-80" />
                            ) : (
                                <img src={media.url} alt="Target" className="w-full h-full object-cover" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-slate-200 truncate">{media.originalName || (media as any).fileName || (media as any).filename}</h3>
                            <p className="text-xs font-mono text-cyan-500/70 mt-1 truncate">ID: {media.id}</p>
                            <div className="mt-2 text-xs text-slate-400 line-clamp-2 italic bg-white/5 p-2 rounded">
                                "{media.description || 'No description'}"
                            </div>
                        </div>
                    </div>

                    {/* Violation Checklist */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center">
                            <AlertTriangle size={14} className="mr-2 text-amber-500" />
                            Violation Categories
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Checkbox 
                                label="Count / Quantity Error" 
                                description="Incorrect number of people or objects."
                                checked={violations.countViolation} 
                                onChange={() => handleCheckboxChange('countViolation')} 
                            />
                            <Checkbox 
                                label="Contextual Presumption" 
                                description="Assumed context not supported by image."
                                checked={violations.contextPresumption} 
                                onChange={() => handleCheckboxChange('contextPresumption')} 
                            />
                            <Checkbox 
                                label="Phantom Entity" 
                                description="Hallucinated person or object that is not present."
                                checked={violations.phantomEntity} 
                                onChange={() => handleCheckboxChange('phantomEntity')} 
                            />
                            <Checkbox 
                                label="Relational Assumption" 
                                description="Assumed relationships (e.g. 'family', 'couple')."
                                checked={violations.relationalAssumption} 
                                onChange={() => handleCheckboxChange('relationalAssumption')} 
                            />
                            <Checkbox 
                                label="Emotional Projection" 
                                description="Assumed emotions (e.g. 'happily', 'angry')."
                                checked={violations.emotionalProjection} 
                                onChange={() => handleCheckboxChange('emotionalProjection')} 
                            />
                            <Checkbox 
                                label="Text/OCR Fabrication" 
                                description="Hallucinated or misread text in the image."
                                checked={violations.textFabrication} 
                                onChange={() => handleCheckboxChange('textFabrication')} 
                            />
                            <Checkbox 
                                label="Other / Misc" 
                                description="Other errors requiring judge review."
                                checked={violations.other} 
                                onChange={() => handleCheckboxChange('other')} 
                            />
                        </div>
                    </div>

                    {/* Officer Notes */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">Officer Notes (Optional)</h3>
                        <textarea
                            value={officerNotes}
                            onChange={(e) => setOfficerNotes(e.target.value)}
                            placeholder="Provide specific details for the Judge AI to consider during re-captioning..."
                            className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-slate-300 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 resize-none transition-all placeholder:text-slate-600"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-white/10 bg-black/40 flex justify-end gap-3">
                    <GlassButton variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </GlassButton>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold rounded-lg shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <span className="animate-pulse">Filing Docket...</span>
                        ) : (
                            <>
                                <CheckCircle size={18} className="mr-2" /> Submit Citation
                            </>
                        )}
                    </button>
                </div>
                
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

const Checkbox = ({ label, description, checked, onChange }: { label: string, description: string, checked: boolean, onChange: () => void }) => (
    <label className="flex items-start p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl cursor-pointer transition-colors group">
        <div className="relative flex items-center justify-center w-5 h-5 mt-0.5 rounded border border-slate-500 bg-black/50 group-hover:border-rose-400 transition-colors shrink-0">
            {checked && <CheckCircle size={14} className="text-rose-500" />}
            <input 
                type="checkbox" 
                className="opacity-0 absolute inset-0 cursor-pointer" 
                checked={checked} 
                onChange={onChange} 
            />
        </div>
        <div className="ml-3">
            <div className={`text-sm font-semibold transition-colors ${checked ? 'text-rose-400' : 'text-slate-300 group-hover:text-white'}`}>
                {label}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 leading-tight">
                {description}
            </div>
        </div>
    </label>
);
