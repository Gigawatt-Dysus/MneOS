
import React, { useState } from 'react';
import type { User } from '../../types';
import { GlassButton } from '../GlassButton';
import { Shield, Eye, EyeOff, UserMinus, UserX, Globe } from 'lucide-react';

interface VertsTabProps {
    user?: User | null;
    onUserUpdate: (updatedUser: User) => Promise<void>;
}

const VertsSettingsTab: React.FC<VertsTabProps> = ({ user, onUserUpdate }) => {
    const [isUpdating, setIsUpdating] = useState(false);

    if (!user) {
        return <div className="p-4 text-slate-400">Loading neural profile...</div>;
    }

    const privacy = user.privacy || { visibility: 'public', autoShareTag: true };

    const handlePrivacyChange = async (key: 'visibility' | 'autoShareTag', value: any) => {
        setIsUpdating(true);
        try {
            const updatedUser: User = {
                ...user,
                privacy: {
                    ...privacy,
                    [key]: value
                }
            };
            await onUserUpdate(updatedUser);
        } catch (error) {
            console.error("Failed to update privacy:", error);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Privacy Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Shield size={18} className="text-cyan-400" />
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Social Geometry & Privacy</h3>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                    {/* Visibility */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex-1">
                            <p className="text-sm font-medium text-white">Vertex Visibility</p>
                            <p className="text-xs text-slate-400">Control how other Archivists discover your profile.</p>
                        </div>
                        <div className="flex flex-wrap gap-1 bg-black/40 p-1 rounded-lg border border-white/10 w-full sm:w-auto">
                            {[
                                { id: 'public', icon: Globe, label: 'Public' },
                                { id: 'verts_only', icon: Eye, label: 'Verts Only' },
                                { id: 'stealth', icon: EyeOff, label: 'Stealth' }
                            ].map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => handlePrivacyChange('visibility', mode.id)}
                                    disabled={isUpdating}
                                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${privacy.visibility === mode.id
                                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                        : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    <mode.icon size={12} />
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* Auto-Share */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-white">Auto-Share Identity</p>
                            <p className="text-xs text-slate-400">Automatically share your Person Tag when a new Link is established.</p>
                        </div>
                        <button
                            onClick={() => handlePrivacyChange('autoShareTag', !privacy.autoShareTag)}
                            disabled={isUpdating}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${privacy.autoShareTag ? 'bg-cyan-600' : 'bg-slate-700'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${privacy.autoShareTag ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </section>

            {/* Blocked Verts Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <UserX size={18} className="text-rose-400" />
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Restricted Vertices</h3>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    {!user.blockedVerts || Object.keys(user.blockedVerts).length === 0 ? (
                        <div className="text-center py-6">
                            <Shield size={32} className="mx-auto text-slate-600 mb-2 opacity-20" />
                            <p className="text-xs text-slate-500 italic">No blocked vertices in your archive.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {Object.entries(user.blockedVerts).map(([uid, level]) => (
                                <div key={uid} className="flex items-center justify-between bg-black/20 p-2 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 overflow-hidden">
                                            <span className="text-[10px] text-slate-400">UID</span>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-300">{uid}</p>
                                            <p className="text-[10px] text-rose-400/80 uppercase font-black">
                                                {level === 1 ? 'Request Block' : 'Total Blackout'}
                                            </p>
                                        </div>
                                    </div>
                                    <GlassButton
                                        variant="ghost"
                                        className="h-7 px-2 text-[10px] text-slate-400 hover:text-white"
                                        onClick={async () => {
                                            const newBlocked = { ...user.blockedVerts };
                                            delete newBlocked[uid];
                                            await onUserUpdate({ ...user, blockedVerts: newBlocked });
                                        }}
                                    >
                                        Unblock
                                    </GlassButton>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default VertsSettingsTab;
