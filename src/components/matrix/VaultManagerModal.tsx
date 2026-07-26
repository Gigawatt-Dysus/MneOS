import React, { useState, useEffect } from 'react';
import { Shield, Plus, Lock, Ghost, Globe, Trash2, X, Check, Loader2 } from 'lucide-react';
import { GlassButton } from '../GlassButton';
import { db, collection, addDoc, getDocs, query, where, deleteDoc, doc } from '../../services/sovereignDbAdapter';
import type { Bucket } from '../../types';

interface VaultManagerModalProps {
    userId: string;
    onClose: () => void;
    onVaultsChanged: () => void;
}

export const VaultManagerModal: React.FC<VaultManagerModalProps> = ({ userId, onClose, onVaultsChanged }) => {
    const [vaults, setVaults] = useState<Bucket[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    
    // New Vault Form
    const [newName, setNewName] = useState('');
    const [newPrivacy, setNewPrivacy] = useState<'standard' | 'restricted' | 'ghost'>('standard');
    const [newPassword, setNewPassword] = useState('');
    
    useEffect(() => {
        loadVaults();
    }, [userId]);

    const loadVaults = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'buckets'), where('userId', '==', userId));
            const snap = await getDocs(q);
            const loaded: Bucket[] = [];
            snap.forEach(d => loaded.push({ id: d.id, ...d.data() } as Bucket));
            setVaults(loaded.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (err) {
            console.error("Failed to load vaults:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setIsCreating(true);
        try {
            const newVault: Omit<Bucket, 'id'> = {
                userId,
                name: newName.trim(),
                privacyLevel: newPrivacy,
                createdAt: Date.now()
            };
            
            // In a real production app, use bcrypt here. For now, store a basic string/hash
            if ((newPrivacy === 'restricted' || newPrivacy === 'ghost') && newPassword) {
                // TODO: Wire to a sovereign Bcrypt hashing service in the future
                newVault.passwordHash = btoa(newPassword); 
            }
            
            await addDoc(collection(db, 'buckets'), newVault);
            setNewName('');
            setNewPassword('');
            setNewPrivacy('standard');
            await loadVaults();
            onVaultsChanged();
        } catch (err) {
            console.error("Failed to create vault:", err);
            alert("Error creating vault");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (vault: Bucket) => {
        if (confirm(`CRITICAL WARNING: Destroying "${vault.name}" will obliterate the vault.\n\nMedia inside will NOT be automatically moved back to the timeline. Proceed?`)) {
            try {
                await deleteDoc(doc(db, 'buckets', vault.id));
                // TODO: Bulk delete or detach all media items linked to this bucketId
                await loadVaults();
                onVaultsChanged();
            } catch(err) {
                console.error("Failed to delete vault:", err);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md" 
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                    <h3 className="text-lg font-black text-white tracking-widest flex items-center gap-3">
                        <Shield className="text-cyan-400" size={24} /> 
                        VAULT MANAGER
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Create New Column */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-2">Architect New Vault</h4>
                        
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Vault Name</label>
                            <input 
                                type="text" 
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="e.g. Writing Concepts, Golf, Ex-Wife"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Security Clearance</label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setNewPrivacy('standard')}
                                    className={`flex-1 py-2 rounded-lg border text-[10px] uppercase font-bold tracking-wider flex flex-col items-center gap-1 transition-all ${newPrivacy === 'standard' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-black/40 border-white/10 text-slate-500 hover:bg-white/5'}`}
                                >
                                    <Globe size={14} /> Standard
                                </button>
                                <button 
                                    onClick={() => setNewPrivacy('restricted')}
                                    className={`flex-1 py-2 rounded-lg border text-[10px] uppercase font-bold tracking-wider flex flex-col items-center gap-1 transition-all ${newPrivacy === 'restricted' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-black/40 border-white/10 text-slate-500 hover:bg-white/5'}`}
                                >
                                    <Lock size={14} /> Restricted
                                </button>
                                <button 
                                    onClick={() => setNewPrivacy('ghost')}
                                    className={`flex-1 py-2 rounded-lg border text-[10px] uppercase font-bold tracking-wider flex flex-col items-center gap-1 transition-all ${newPrivacy === 'ghost' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-black/40 border-white/10 text-slate-500 hover:bg-white/5'}`}
                                >
                                    <Ghost size={14} /> Ghost
                                </button>
                            </div>
                        </div>

                        {(newPrivacy === 'restricted' || newPrivacy === 'ghost') && (
                            <div className="animate-in slide-in-from-top-2 fade-in">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Passphrase / PIN</label>
                                <input 
                                    type="password" 
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Required for secure vault..."
                                    className="w-full bg-rose-950/20 border border-rose-500/30 rounded-xl px-4 py-3 text-sm text-rose-200 focus:border-rose-500 outline-none"
                                />
                            </div>
                        )}

                        <GlassButton 
                            onClick={handleCreate} 
                            disabled={!newName.trim() || isCreating || ((newPrivacy !== 'standard') && !newPassword)}
                            variant="primary" 
                            className="w-full py-3 justify-center mt-4 border-cyan-500/30"
                        >
                            {isCreating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Plus className="mr-2" size={16} />}
                            {isCreating ? 'CONSTRUCTING...' : 'CONSTRUCT VAULT'}
                        </GlassButton>
                    </div>

                    {/* Existing Vaults Column */}
                    <div className="border-l border-white/5 pl-8">
                        <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-4">Active Silos</h4>
                        
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {loading ? (
                                <div className="flex items-center justify-center p-8 text-cyan-500">
                                    <Loader2 className="animate-spin" />
                                </div>
                            ) : vaults.length === 0 ? (
                                <div className="text-center p-6 text-slate-600 text-xs italic">
                                    No custom vaults constructed yet. All media resides in the Global Matrix.
                                </div>
                            ) : (
                                vaults.map(v => (
                                    <div key={v.id} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-xl group hover:border-white/20 transition-all">
                                        <div className="flex items-center gap-3">
                                            {v.privacyLevel === 'standard' && <Globe size={16} className="text-cyan-400" />}
                                            {v.privacyLevel === 'restricted' && <Lock size={16} className="text-rose-400" />}
                                            {v.privacyLevel === 'ghost' && <Ghost size={16} className="text-purple-400" />}
                                            <span className="text-sm font-medium text-slate-200">{v.name}</span>
                                        </div>
                                        <button 
                                            onClick={() => handleDelete(v)}
                                            title="Destroy Vault"
                                            className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
