import React, { useState, useEffect } from 'react';
import { Save, X, Loader2, AlertCircle } from 'lucide-react';
import { doc, updateDoc } from '../../services/sovereignDbAdapter';
import { db } from '../../firebaseConfig';
import { updateSingleMedia } from '../../services/vectorBackfill';
import { Media } from '../../types';

interface NarrativeEditorProps {
    asset: Media;
    userId: string;
    onClose: () => void;
}

export const NarrativeEditor: React.FC<NarrativeEditorProps> = ({ asset, userId, onClose }) => {
    const [narrative, setNarrative] = useState((asset as any).narrative || '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!narrative.trim()) return;
        setIsSaving(true);
        setError(null);

        try {
            // 1. Update Firestore
            const docRef = doc(db, 'users', userId, 'media', asset.id);
            await updateDoc(docRef, {
                narrative: narrative.trim(),
                isManualNarrative: true, // Flag for UI
                metadataVersion: 'v3-manual', // [ZEN EWO 009] Human Supremacy Lock
                lastEditedAt: new Date().toISOString()
            });

            // 2. Trigger Instant Vector Re-indexing
            const vectorSuccess = await updateSingleMedia(userId, asset.id);
            if (!vectorSuccess) {
                console.warn('[NarrativeEditor] Vector update failed silently');
            }

            onClose();
        } catch (err: any) {
            console.error('[NarrativeEditor] Save failed:', err);
            setError('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="absolute inset-x-0 bottom-0 top-auto z-50 p-2 bg-slate-900/95 backdrop-blur-md border-t border-white/10 animate-in slide-in-from-bottom-2">
            <div className="relative">
                <textarea
                    value={narrative}
                    onChange={(e) => setNarrative(e.target.value)}
                    className="w-full h-24 bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 resize-none font-mono leading-relaxed"
                    placeholder="Enter narrative description..."
                    autoFocus
                />

                {error && (
                    <div className="absolute top-2 right-2 text-red-400 text-[10px] flex items-center gap-1 bg-red-950/50 px-2 py-1 rounded">
                        <AlertCircle size={10} />
                        {error}
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center mt-2">
                <button
                    onClick={onClose}
                    className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
                >
                    <X size={14} />
                </button>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono tracking-tight">
                        {narrative.length} chars
                    </span>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !narrative.trim()}
                        className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-md transition-all shadow-lg shadow-cyan-900/20"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={12} className="animate-spin" />
                                Vectorizing...
                            </>
                        ) : (
                            <>
                                <Save size={12} />
                                Save & Index
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
