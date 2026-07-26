import React, { useState } from 'react';
import type { Theme, Settings, User, SettingsTab } from '../../types';
import { GlassButton } from '../GlassButton';
import { useSettingsLogic } from './useSettingsLogic';
import { X, Save, Settings as SettingsIcon } from 'lucide-react';
import { reindexChatSegments } from '../../services/searchService';
import { getAuth } from 'firebase/auth'; // Direct Auth Access

// Tabs
import { FontsTab } from './FontsTab';
import { CompanionsTab } from './CompanionsTab';
import { InterfaceTab } from './InterfaceTab';
import { UtilsTab } from './UtilsTab';
import VertsSettingsTab from './VertsSettingsTab';
import { appDataService } from '../../services/serviceManager';
import { Portal } from '../Portal'; // [PACT] Breaking Stacking Contexts

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: Settings;
    onSettingsChange: (newSettings: Settings) => void;
    theme: Theme;
    toggleTheme: () => void;
    onExport?: () => void;
    user?: User | null;
    initialTab?: SettingsTab;
}

const SettingsModal: React.FC<SettingsModalProps> = (props) => {
    const {
        activeTab, setActiveTab,
        localSettings,
        handleSettingChange,
        handleGlassChange,
        handleSaveChanges,

        firebaseConfigJson, setFirebaseConfigJson,
        configStatus, isUsingLocalStorage, isForcedLocal,
        handleClearConfig, handleSaveConfig,

        newEmoji, setNewEmoji, addEmoji, removeEmoji, resetEmojis, currentEmojis,

        allTags,
        brokenLinks, duplicates, scanStatus,
        runScan, executePurge,

        handleHydrateMemory,
        hydrationStatus,
        isHydrating
    } = useSettingsLogic({ ...props });

    // [ZEN FIX] Local Override for Deep Database Hydration
    const [deepHydrating, setDeepHydrating] = useState(false);
    const [deepStatus, setDeepStatus] = useState("");

    const performDeepHydration = async () => {
        // [ZEN FIX] SAFELY RESOLVE USER ID (Fixes TS Error)
        // We check (user as any).id, (user as any).uid, then fallback to Firebase Auth
        const authUser = getAuth().currentUser;
        const uid = (props.user as any)?.id || (props.user as any)?.uid || authUser?.uid;

        if (!uid) {
            setDeepStatus("Error: User ID missing (Not logged in?)");
            return;
        }

        if (!confirm("This will read ALL chat history from Firestore and index it to Typesense. This may take a moment. Continue?")) return;

        setDeepHydrating(true);
        setDeepStatus("Scanning Firestore...");

        try {
            const result = await reindexChatSegments(uid);
            if (result.success) {
                setDeepStatus(`Indexed ${result.count} memories.`);
            } else {
                setDeepStatus(`Error: ${result.error}`);
            }
        } catch (e: any) {
            setDeepStatus(`Critical Fail: ${e.message}`);
        } finally {
            setDeepHydrating(false);
        }
    };

    if (!props.isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 w-full h-full bg-black/95 backdrop-blur-[60px] flex items-center justify-center z-[1000] p-2 md:p-4 animate-in fade-in duration-300" onClick={props.onClose}>
                <div
                    className="gigi-glass-container relative w-full max-w-4xl h-[90vh] grid grid-rows-[auto_auto_1fr_auto] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                >

                    {/* 1. Header Area: Robust padding to avoid clipping */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40 z-50">
                        <div className="flex flex-col">
                            <h2 className="text-xl font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                                <SettingsIcon className="text-cyan-400" size={24} />
                                Interface Settings
                            </h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-60">Neural Config Protocol</p>
                        </div>
                        <GlassButton
                            onClick={props.onClose}
                            variant="ghost"
                            className="rounded-full h-10 w-10 p-0 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95"
                        >
                            <X size={20} />
                        </GlassButton>
                    </div>

                    {/* 2. Navigation Area: Centered, no-overlap architecture */}
                    <div className="flex justify-start sm:justify-center items-center py-6 border-b border-white/5 bg-black/20 z-40 overflow-x-auto no-scrollbar scroll-smooth">
                        <div className="flex p-2 px-6 sm:px-2 space-x-2 bg-black/60 border border-white/10 rounded-2xl backdrop-blur-md min-w-max shadow-xl mx-auto">
                            {(['fonts', 'companions', 'interface', 'utils', 'verts'] as SettingsTab[])
                                .map((tab) => (
                                    <GlassButton
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        variant={activeTab === tab ? 'primary' : 'ghost'}
                                        className="px-4 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] min-w-[90px] sm:min-w-[110px] justify-center"
                                    >
                                        {tab}
                                    </GlassButton>
                                ))}
                        </div>
                    </div>

                    {/* 3. Content Area: Flexible, scrollable, max headroom */}
                    <div className="overflow-y-auto custom-scrollbar bg-transparent p-6 sm:p-8 pt-4">
                        <div className="max-w-4xl mx-auto min-h-full">
                            {activeTab === 'fonts' && <FontsTab localSettings={localSettings} handleSettingChange={handleSettingChange} />}
                            {activeTab === 'companions' && <CompanionsTab localSettings={localSettings} handleSettingChange={handleSettingChange} user={props.user} />}
                            {activeTab === 'interface' && <InterfaceTab localSettings={localSettings} handleSettingChange={handleSettingChange} handleGlassChange={handleGlassChange} theme={props.theme} toggleTheme={props.toggleTheme} newEmoji={newEmoji} setNewEmoji={setNewEmoji} addEmoji={addEmoji} currentEmojis={currentEmojis} removeEmoji={removeEmoji} resetEmojis={resetEmojis} />}
                            {activeTab === 'utils' && <UtilsTab allTags={allTags} runScan={runScan} scanStatus={scanStatus} brokenLinks={brokenLinks} duplicates={duplicates} executePurge={executePurge} localSettings={localSettings} handleSettingChange={handleSettingChange} onExport={props.onExport} isUsingLocalStorage={isUsingLocalStorage} handleClearConfig={handleClearConfig} isForcedLocal={isForcedLocal} firebaseConfigJson={firebaseConfigJson} setFirebaseConfigJson={setFirebaseConfigJson} configStatus={configStatus} handleSaveConfig={handleSaveConfig} onHydrateMemory={performDeepHydration} hydrationStatus={deepStatus || hydrationStatus} isHydrating={isHydrating || deepHydrating} onBackup={props.onExport || (() => { })} onRepair={() => { console.log("Repair not implemented"); }} isRepairing={false} user={props.user} />}
                            {activeTab === 'verts' && <VertsSettingsTab user={props.user} onUserUpdate={async (u: User) => { await appDataService.updateUserProfile(u.id, u); }} />}
                        </div>
                    </div>

                    {/* 4. Footer Area */}
                    <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-black/60 backdrop-blur-md z-50">
                        <GlassButton onClick={props.onClose} variant="ghost" className="px-8">Close</GlassButton>
                        <GlassButton onClick={handleSaveChanges} variant="success" className="px-8 shadow-lg shadow-emerald-900/40">
                            <Save size={18} className="mr-2" /> Save & Commit
                        </GlassButton>
                    </div>
                </div>
            </div>
        </Portal>
    );
};

export default SettingsModal;