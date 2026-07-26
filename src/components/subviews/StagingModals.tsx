import React from 'react';
import SettingsModal from '../SettingsModal';
import BackupImportModal from '../BackupImportModal';
import ExportModal from '../ExportModal';
import DevPatchModal from '../DevPatchModal';
import ZenWhispererModal from '../ZenWhispererModal';
import DataRescueModal from '../DataRescueModal';
import { ShareRecipientModal } from '../Social/ShareRecipientModal';
import { SocialDiscoveryModal } from '../SocialDiscoveryModal';
import { VertService } from '../../services/vertService';
import type { User, Settings, SettingsTab } from '../../types';

interface StagingModalsProps {
    user: User | null;
    showSettingsModal: boolean;
    setShowSettingsModal: (open: boolean) => void;
    settingsTab: SettingsTab;
    settings: Settings;
    setSettings: (settings: Settings) => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    handleExportRequest: () => void;
    
    backupImportStatus: any;
    setBackupImportStatus: (status: any) => void;
    
    showExportModal: boolean;
    setShowExportModal: (open: boolean) => void;
    handleConfirmExport: (type: 'full' | 'data-only', includeConfig: boolean) => Promise<void>;
    
    showDevPatch: boolean;
    setShowDevPatch: (open: boolean) => void;
    godModeSettings: any;
    setGodModeSettings: (settings: any) => void;
    
    showDevTools: boolean;
    setShowDevTools: (open: boolean) => void;
    
    showRescueModal: boolean;
    setShowRescueModal: (open: boolean) => void;
    localRescueCount: number;
    handleRescueConfirm: () => void;
    isRescuing: boolean;

    showShareModal: boolean;
    setShowShareModal: (open: boolean) => void;
    matrixSelection: string[];
    clearMatrixSelection: () => void;
    verts: any[];
    addToast: (msg: string, type: any) => void;

    showSocialDiscovery: boolean;
    setShowSocialDiscovery: (open: boolean) => void;
}

export const StagingModals: React.FC<StagingModalsProps> = ({
    user,
    showSettingsModal,
    setShowSettingsModal,
    settingsTab,
    settings,
    setSettings,
    theme,
    toggleTheme,
    handleExportRequest,
    backupImportStatus,
    setBackupImportStatus,
    showExportModal,
    setShowExportModal,
    handleConfirmExport,
    showDevPatch,
    setShowDevPatch,
    godModeSettings,
    setGodModeSettings,
    showDevTools,
    setShowDevTools,
    showRescueModal,
    setShowRescueModal,
    localRescueCount,
    handleRescueConfirm,
    isRescuing,
    showShareModal,
    setShowShareModal,
    matrixSelection,
    clearMatrixSelection,
    verts,
    addToast,
    showSocialDiscovery,
    setShowSocialDiscovery
}) => {
    return (
        <>
            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                initialTab={settingsTab}
                settings={settings}
                onSettingsChange={setSettings}
                theme={theme}
                toggleTheme={toggleTheme}
                onExport={handleExportRequest}
                user={user}
            />

            {backupImportStatus.type !== 'idle' && (
                <BackupImportModal
                    status={backupImportStatus}
                    onConfirm={() => { }}
                    onClose={() => setBackupImportStatus({ type: 'idle' })}
                    currentUser={user}
                />
            )}

            {showExportModal && (
                <ExportModal
                    onConfirm={handleConfirmExport}
                    onCancel={() => setShowExportModal(false)}
                />
            )}

            {user && (
                <DevPatchModal
                    isOpen={showDevPatch}
                    onClose={() => setShowDevPatch(false)}
                    currentSettings={godModeSettings}
                    onSave={setGodModeSettings}
                    user={user}
                />
            )}

            {showDevTools && user && (
                <ZenWhispererModal
                    isOpen={showDevTools}
                    onClose={() => setShowDevTools(false)}
                    user={user}
                />
            )}

            {showRescueModal && (
                <DataRescueModal
                    count={localRescueCount}
                    userEmail={user?.email}
                    onConfirm={handleRescueConfirm}
                    onDismiss={() => setShowRescueModal(false)}
                    isSyncing={isRescuing}
                />
            )}

            {showShareModal && (
                <ShareRecipientModal
                    itemCount={matrixSelection.length}
                    verts={verts}
                    onClose={() => setShowShareModal(false)}
                    onShare={async (recipientUid) => {
                        if (user) {
                            await VertService.sendShareRequest(user, recipientUid, matrixSelection);
                            addToast(`Transmitting ${matrixSelection.length} artifacts to the recipient's Airlock.`, "success");
                            clearMatrixSelection();
                        }
                    }}
                />
            )}

            {showSocialDiscovery && (
                <SocialDiscoveryModal
                    isOpen={true}
                    onClose={() => setShowSocialDiscovery(false)}
                    currentUser={user!}
                    onToast={addToast}
                />
            )}
        </>
    );
};
