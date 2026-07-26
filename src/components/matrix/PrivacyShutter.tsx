import React, { useState, useEffect } from 'react';
import { ShieldAlert, ChevronDown } from 'lucide-react';
import type { Media, User } from '../../types';
import { doc, updateDoc } from '../../services/sovereignDbAdapter';
import { db } from '../../firebaseConfig';
import { typesenseService } from '../../services/typesenseService';
import { WikiTagEditor } from '../shared/WikiTagEditor';

export const PrivacyShutter = ({ asset, user, onUpdate, targetCollection }: { asset: Media; user: User; targetCollection?: string; onUpdate: (updates: Partial<Media>) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [pinEntry, setPinEntry] = useState('');
    const [pinError, setPinError] = useState(false);
    const [text, setText] = useState(asset.privateDetails || '');
    const [isSaving, setIsSaving] = useState(false);
    const [skipAI, setSkipAI] = useState(asset.aiModel === 'human-skip');

    useEffect(() => {
        setText(asset.privateDetails || '');
        setSkipAI(asset.aiModel === 'human-skip');
    }, [asset.privateDetails, asset.aiModel]);

    useEffect(() => {
        if (import.meta.env.VITE_DEV_UNLOCK_PRIVATE === 'true' || localStorage.getItem('zen_private_unlocked') === 'true') {
            setIsUnlocked(true);
        }
    }, []);

    const handleUnlock = () => {
        const correctPin = import.meta.env.VITE_PRIVATE_VAULT_PIN || 'zen';
        if (pinEntry === correctPin) {
            setIsUnlocked(true);
            setPinError(false);
            localStorage.setItem('zen_private_unlocked', 'true');
        } else {
            setPinError(true);
            setPinEntry('');
        }
    };

    const handleSave = async () => {
        if (text === asset.privateDetails && skipAI === (asset.aiModel === 'human-skip')) return;
        setIsSaving(true);
        try {
            // Update Firestore directly
            const mediaRef = doc(db, 'users', user.id, targetCollection || 'media', asset.id);
            const updates: any = { privateDetails: text };
            
            // If Skip AI is checked, forcefully tell the pipeline it's "processed"
            if (skipAI) {
                updates.aiProcessed = true;
                updates.aiModel = 'human-skip';
            } else if (asset.aiModel === 'human-skip') {
                updates.aiProcessed = false;
                updates.aiModel = '';
            }
            
            await updateDoc(mediaRef, updates);
            
            // Sync Typesense
            const updatedAsset = { ...asset, ...updates };
            await typesenseService.updateMedia(updatedAsset);
            
            // Update local UI state
            onUpdate(updates);
        } catch (e) {
            console.error('Failed to save private details', e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full mt-2" onWheel={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
                className={`flex items-center justify-between w-full text-left text-[11px] font-bold transition-all shadow-lg px-4 py-2 border ${isOpen ? 'bg-red-900/40 border-red-500/50 text-red-300 rounded-t-xl rounded-b-none' : 'bg-black/60 backdrop-blur-md border-red-900/40 text-red-500 hover:bg-red-950/40 hover:border-red-500/30 rounded-xl'}`}
            >
                <span className="uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert size={14} />
                    Private Details
                </span>
                <ChevronDown size={14} className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>
            
            {isOpen && (
                <div className="bg-black/80 backdrop-blur-xl border border-red-500/50 border-t-0 rounded-b-xl p-4 shadow-[0_10px_40px_rgba(220,38,38,0.15)] animate-in slide-in-from-top-2 duration-200" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                    {!isUnlocked ? (
                        <div className="flex flex-col items-center py-4 space-y-4">
                            <ShieldAlert size={24} className="text-red-500/50" />
                            <div className="text-center">
                                <h4 className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">Vault Locked</h4>
                                <p className="text-[10px] text-red-300/60">Enter vault PIN to access private details.</p>
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="password" 
                                    value={pinEntry}
                                    onChange={e => setPinEntry(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleUnlock();
                                        e.stopPropagation();
                                    }}
                                    placeholder="••••"
                                    className={`w-24 bg-black/60 border ${pinError ? 'border-red-500' : 'border-red-900/50'} text-red-100 px-3 py-1.5 rounded-lg text-center tracking-widest focus:outline-none focus:border-red-500/80 text-sm`}
                                    autoFocus
                                />
                                <button 
                                    onClick={handleUnlock}
                                    className="bg-red-900/40 hover:bg-red-600 text-red-300 hover:text-white px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-red-900/50 hover:border-red-500"
                                >
                                    Unlock
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <WikiTagEditor 
                                value={text}
                                onChange={setText}
                                userId={user.id}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        handleSave();
                                    }
                                    e.stopPropagation();
                                }}
                                placeholder="Enter sensitive details here..."
                                className="border-red-950/40 bg-[#111318] focus-within:border-red-500/50 focus-within:shadow-[0_0_15px_rgba(239,68,68,0.15)] shadow-inner [&_div]:text-red-100/90 rounded-lg"
                            />
                            
                            <div className="flex items-center justify-between mt-4">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={skipAI}
                                        onChange={e => setSkipAI(e.target.checked)}
                                        className="rounded border-red-900/50 bg-black/50 text-red-500 focus:ring-red-500/50 cursor-pointer"
                                    />
                                    <span className="text-[10px] text-red-300/80 uppercase tracking-widest font-bold group-hover:text-red-300 transition-colors">
                                        Skip AI Ingestion
                                    </span>
                                </label>
                                
                                <div className="flex items-center gap-3">
                                    <span className="text-[9px] text-red-900/60 uppercase tracking-widest font-bold">Cmd+Enter to Save</span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleSave(); }}
                                        disabled={isSaving}
                                        className="text-[10px] font-bold uppercase tracking-wider bg-red-900/40 hover:bg-red-600 text-red-300 hover:text-white px-4 py-1.5 rounded-lg transition-colors border border-red-900/50 hover:border-red-500"
                                    >
                                        {isSaving ? 'Locking...' : 'Save & Lock'}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
