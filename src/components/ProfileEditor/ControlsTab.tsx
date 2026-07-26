import React from 'react';
import type { User, ImportStatus, View } from '../../types';
import { DisplaySettingsIcon, ClipboardIcon, RestoreIcon } from '../icons';
import { GlassButton } from '../GlassButton';
import { Cloud, Database, HardDrive, ShieldAlert, Bot, Activity } from 'lucide-react';

interface ControlsTabProps {
    user: User;
    setIsSettingsModalOpen: (v: boolean) => void;
    onCreateUserPersonTag: () => void;
    onNavigate: (view: View) => void;
    migrationStatus: { active: boolean, current: number, total: number };
    handleMigrateToCloud: () => void;
    localRescueCount: number;
    handleRescueLocalData: () => void;
    isRescuing: boolean;
    onExportAllData: () => void;
    onTriggerRestore: () => void;
    legacyImportFileRef: React.RefObject<HTMLInputElement>;
    handleLegacyFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
    legacyImportStatus: ImportStatus;
    handleStartLegacyImport: () => void;
    setLegacyImportStatus: (status: ImportStatus) => void;
    handleResetAndSeed: () => void;
    isResetting: boolean;
    handleConnectGooglePhotos: () => void;
    isGoogleLinked: boolean | null;
    handlePersonalIncinerate: () => void;
    isIncinerating: boolean;
    setIsPurificationModalOpen: (v: boolean) => void;
}

export const ControlsTab: React.FC<ControlsTabProps> = ({
    user, setIsSettingsModalOpen, onCreateUserPersonTag, onNavigate, migrationStatus, handleMigrateToCloud,
    localRescueCount, handleRescueLocalData, isRescuing, onExportAllData, onTriggerRestore,
    legacyImportFileRef, handleLegacyFileSelected, legacyImportStatus, handleStartLegacyImport, setLegacyImportStatus,
    handleResetAndSeed, isResetting, handleConnectGooglePhotos, isGoogleLinked,
    handlePersonalIncinerate, isIncinerating, setIsPurificationModalOpen
}) => {
    const handleLegacyRouteBlock = () => {
        alert("This function is legacy and locked to protect the active Sovereign MongoDB Atlas cluster.");
    };

    return (
        <div className="space-y-6">
            {/* Settings Header */}
            <div className="flex justify-between items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="flex-grow">
                    <h3 className="text-lg font-bold text-white">System Configuration</h3>
                    <p className="text-xs text-slate-400 mt-1 font-mono">Manage UI preferences and AI behaviors.</p>
                </div>
                <GlassButton onClick={() => setIsSettingsModalOpen(true)} variant="secondary" className="h-10 w-10 p-0 flex items-center justify-center rounded-full">
                    <DisplaySettingsIcon className="w-5 h-5" />
                </GlassButton>
            </div>

            {/* Diagnostics */}
            <div className="p-5 border border-white/10 rounded-2xl bg-[#0f1219]">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Cloud size={14} /> Cloud Diagnostics
                </h4>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 font-mono text-xs space-y-2 text-slate-400">
                    <div className="flex justify-between items-center">
                        <span>UID:</span>
                        <span className="text-slate-200 select-all">{user.id}</span>
                        <button onClick={() => navigator.clipboard.writeText(user.id)} className="text-cyan-500 hover:text-cyan-400"><ClipboardIcon className="w-3 h-3" /></button>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>EMAIL:</span>
                        <span className="text-slate-200">{user.email}</span>
                    </div>
                </div>
            </div>

            {/* Link Profile */}
            {!user.personTagId && (
                <div className="p-5 border border-emerald-500/30 bg-emerald-900/10 rounded-2xl">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Profile Link Missing</h4>
                    <GlassButton onClick={onCreateUserPersonTag} variant="success" className="w-full justify-center">
                        Create & Link Person Tag
                    </GlassButton>
                </div>
            )}

            {/* AI Management */}
            <div className="p-5 border border-white/10 rounded-2xl bg-[#0f1219]">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Bot size={14} /> Intelligence
                </h4>
                <GlassButton onClick={() => onNavigate('aiCompanionEditor')} variant="primary" className="w-full justify-center">
                    Manage AI Companions
                </GlassButton>
            </div>

            {/* External Connections */}
            <div className="p-5 border border-white/10 rounded-2xl bg-[#0f1219]">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Cloud size={14} className="text-amber-500" /> External Services
                </h4>
                <div className="flex flex-col gap-3">
                    <GlassButton
                        onClick={handleConnectGooglePhotos}
                        variant={isGoogleLinked ? "success" : "secondary"}
                        className={`w-full justify-center h-12 ${isGoogleLinked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                    >
                        <Cloud className={`w-4 h-4 mr-2 ${isGoogleLinked ? 'text-emerald-400' : 'text-blue-400'}`} />
                        {isGoogleLinked === null ? "Checking connection..." : (isGoogleLinked ? "Google Photos Linked" : "Link Google Photos")}
                    </GlassButton>
                    <p className="text-[10px] text-slate-500 font-mono text-center px-4">
                        {isGoogleLinked ? "Credentials are persisted. No need to re-authenticate." : "Required for non-developer archiving and cross-device import verification."}
                    </p>
                </div>
            </div>

            {/* Cloud Optimization */}
            <div className="p-5 border border-white/10 rounded-2xl bg-[#0f1219]">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Database size={14} /> Optimization
                </h4>
                <GlassButton 
                    onClick={handleLegacyRouteBlock} 
                    variant="secondary" 
                    disabled={true} 
                    className="w-full justify-center opacity-40 cursor-not-allowed"
                >
                    Migrate Local Images to Cloud
                </GlassButton>
            </div>

            {/* Local Rescue */}
            {localRescueCount > 0 && (
                <div className="p-5 border border-amber-500/30 bg-amber-900/10 rounded-2xl">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                        <HardDrive size={14} /> Data Rescue
                    </h4>
                    <p className="text-xs text-amber-200/70 mb-4">Found {localRescueCount} items stranded on this device.</p>
                    <GlassButton
                        onClick={handleRescueLocalData}
                        disabled={isRescuing}
                        variant="secondary"
                        className="w-full justify-center bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30 hover:text-amber-200"
                    >
                        {isRescuing ? "Merging..." : "Merge Device Data to Cloud"}
                    </GlassButton>
                </div>
            )}

            {/* Data Management */}
            <div className="p-5 border border-white/10 rounded-2xl bg-[#0f1219]">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Data Operations</h4>
                <div className="flex flex-col gap-3">
                    <GlassButton onClick={onExportAllData} variant="secondary" className="justify-center">
                        Export Options...
                    </GlassButton>
                    <GlassButton 
                        onClick={handleLegacyRouteBlock} 
                        variant="secondary" 
                        disabled={true} 
                        className="justify-center opacity-40 cursor-not-allowed"
                    >
                        <RestoreIcon className="w-4 h-4 mr-2" /> Restore / Migrate from Backup
                    </GlassButton>
                    <GlassButton 
                        onClick={() => setIsPurificationModalOpen(true)} 
                        variant="primary" 
                        className="justify-center bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                    >
                        🧬 Core Data Schematic Purification Workbench
                    </GlassButton>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="grid grid-cols-1 gap-6">
                <div className="p-5 border border-red-500/30 bg-red-900/10 rounded-2xl">
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <ShieldAlert size={14} /> Danger Zone
                    </h4>
                    <GlassButton
                        onClick={handleLegacyRouteBlock}
                        disabled={true}
                        variant="danger"
                        className="w-full justify-center opacity-40 cursor-not-allowed"
                    >
                        Factory Reset
                    </GlassButton>
                </div>
            </div>

            {/* NEURAL MATRIX CONTEXT PURGE */}
            <div className="p-8 border-2 border-red-500/30 bg-red-950/20 rounded-3xl space-y-6 shadow-[0_0_50px_rgba(239,68,68,0.1)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <ShieldAlert size={80} className="text-red-500" />
                </div>

                <div className="relative z-10">
                    <h3 className="text-lg font-black text-red-400 uppercase tracking-[0.3em] flex items-center gap-3 mb-2">
                        <Activity size={24} className="animate-pulse" /> Neural Matrix Context Purge
                    </h3>
                    <p className="text-xs text-red-200/60 leading-relaxed font-bold uppercase tracking-widest max-w-md">
                        Permanently purge your AI conversational context from the cloud.
                        <span className="block mt-1 text-red-500">System will automatically trigger an archive backup.</span>
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-4 relative z-10">
                    <GlassButton
                        onClick={handleLegacyRouteBlock}
                        disabled={true}
                        variant="danger"
                        className="flex-1 py-4 bg-red-600/40 hover:bg-red-600/40 shadow-xl shadow-red-900/40 text-xs font-black tracking-[0.2em] border-none opacity-40 cursor-not-allowed"
                    >
                        <ShieldAlert size={18} className="mr-2" />
                        ACTIVATE QUANTUM SNAP
                    </GlassButton>
                </div>

                <p className="text-[10px] text-slate-500 font-mono italic">
                    Note: This ONLY affects your conversational data with AI companions. Your personal P2P transmissions, life events, and Matrix assets are preserved.
                </p>
            </div>
        </div>
    );
};
