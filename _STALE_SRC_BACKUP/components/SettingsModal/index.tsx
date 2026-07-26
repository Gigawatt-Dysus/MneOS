import React from 'react';
import type { Theme, Settings, User } from '@/types';
import { GlassButton } from '../GlassButton';
import { useSettingsLogic, SettingsTab } from './useSettingsLogic';
import { X, Save } from 'lucide-react';

// Tabs
import { FontsTab } from './FontsTab';
import { CompanionsTab } from './CompanionsTab';
import { InterfaceTab } from './InterfaceTab';
import { UtilsTab } from './UtilsTab';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: Settings;
    onSettingsChange: (newSettings: Settings) => void;
    theme: Theme;
    toggleTheme: () => void;
    onExport?: () => void;
    user?: User | null;
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

        // [ZEN NEW]
        handleHydrateMemory,
        hydrationStatus,
        isHydrating
    } = useSettingsLogic(props);

    if (!props.isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200" onClick={props.onClose}>
            <div
                className="bg-[#0f1219]/80 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >

                {/* Header */}
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/20">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-wide">System Configuration</h2>
                        <p className="text-xs text-slate-400 mt-1">Customize your neural interface.</p>
                    </div>
                    <GlassButton
                        onClick={props.onClose}
                        variant="ghost"
                        className="rounded-full h-8 w-8 p-0 flex items-center justify-center"
                    >
                        <X size={18} />
                    </GlassButton>
                </div>

                {/* Glass Tabs */}
                <div className="flex justify-center p-4 border-b border-white/5 bg-black/10">
                    <div className="flex p-1 space-x-1 bg-black/40 border border-white/10 rounded-xl backdrop-blur-md">
                        {['fonts', 'companions', 'interface', 'utils'].filter(tab => {
                            if (tab === 'utils') return props.user?.role === 'admin' || props.user?.role === 'root';
                            return true;
                        }).map((tab) => (
                            <GlassButton
                                key={tab}
                                onClick={() => setActiveTab(tab as SettingsTab)}
                                variant={activeTab === tab ? 'primary' : 'ghost'}
                                className="px-4 py-1.5 text-xs capitalize min-w-[80px] justify-center"
                            >
                                {tab}
                            </GlassButton>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-grow bg-transparent">

                    {activeTab === 'fonts' && (
                        <FontsTab
                            localSettings={localSettings}
                            handleSettingChange={handleSettingChange}
                        />
                    )}

                    {activeTab === 'companions' && (
                        <CompanionsTab
                            localSettings={localSettings}
                            handleSettingChange={handleSettingChange}
                        />
                    )}

                    {activeTab === 'interface' && (
                        <InterfaceTab
                            localSettings={localSettings}
                            handleGlassChange={handleGlassChange}
                            theme={props.theme}
                            toggleTheme={props.toggleTheme}
                            newEmoji={newEmoji}
                            setNewEmoji={setNewEmoji}
                            addEmoji={addEmoji}
                            currentEmojis={currentEmojis}
                            removeEmoji={removeEmoji}
                            resetEmojis={resetEmojis}
                        />
                    )}

                    {activeTab === 'utils' && (
                        <UtilsTab
                            // [ZEN FIX] Removed 'user={props.user}' as it is not part of UtilsTab props
                            allTags={allTags}
                            runScan={runScan}
                            scanStatus={scanStatus}
                            brokenLinks={brokenLinks}
                            duplicates={duplicates}
                            executePurge={executePurge}
                            localSettings={localSettings}
                            handleSettingChange={handleSettingChange}
                            onExport={props.onExport}
                            isUsingLocalStorage={isUsingLocalStorage}
                            handleClearConfig={handleClearConfig}
                            isForcedLocal={isForcedLocal}
                            firebaseConfigJson={firebaseConfigJson}
                            setFirebaseConfigJson={setFirebaseConfigJson}
                            configStatus={configStatus}
                            handleSaveConfig={handleSaveConfig}
                            // [ZEN NEW] Wired props
                            user={props.user}
                            onHydrateMemory={handleHydrateMemory}
                            hydrationStatus={hydrationStatus}
                            isHydrating={isHydrating}
                        />
                    )}

                </div>

                {/* Glass Footer */}
                <div className="p-5 border-t border-white/10 flex justify-end gap-3 bg-black/40 backdrop-blur-md">
                    <GlassButton onClick={props.onClose} variant="ghost">Cancel</GlassButton>
                    <GlassButton onClick={handleSaveChanges} variant="success" className="shadow-lg shadow-emerald-900/20">
                        <Save size={16} className="mr-2" /> Save Preferences
                    </GlassButton>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;