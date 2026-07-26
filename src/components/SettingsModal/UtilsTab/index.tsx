import React, { useState, useEffect } from 'react';
import { Key, List, Terminal, Activity, AlertTriangle, BookOpen, HelpCircle, Wrench, Brain } from 'lucide-react';
import { SecretsManager } from '../../../utils/SecretsManager';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
// [ZEN FIX] Import Firestore Termination tools
import { getFirestore, terminate } from '../../../services/sovereignDbAdapter';
import { debugConfig } from '../../../debugConfig';
import { aiStateBridge } from '../../../utils/aiStateBridge';
import { getPrimaryModelId, getReserveModelId, getXAIModelId } from '../../../services/ai/config';
import type { Settings, Tag, Media, User } from '../../../types';
import { isRootUser } from '../../../utils/rbac';
import { LibrarianSubTab } from './LibrarianSubTab';
import { MaintenanceSubTab } from './MaintenanceSubTab';
import { InferencesSubTab } from './InferencesSubTab';

// Sub-Components
import { SecretsSubTab } from './SecretsSubTab';
import { RosterSubTab } from './RosterSubTab';
import { DebugSubTab } from './DebugSubTab';
import { SystemSubTab } from './SystemSubTab';
import { DangerSubTab } from './DangerSubTab';

export type SubTab = 'secrets' | 'roster' | 'debug' | 'system' | 'danger' | 'librarian' | 'maintenance' | 'inferences';

export interface StatusObj {
    type: 'success' | 'error' | 'info';
    msg: string;
}

interface UtilsTabProps {
    allTags: Tag[];
    brokenLinks: Media[];
    duplicates: Media[];
    runScan: () => Promise<void>;
    executePurge: (type: 'broken' | 'dupes') => Promise<void>;
    handleSettingChange: (key: keyof Settings, value: any) => void;
    handleClearConfig: () => void;
    handleSaveConfig: () => void;
    onExport?: () => void;
    scanStatus: string;
    localSettings: Settings;
    isUsingLocalStorage: boolean;
    isForcedLocal: boolean;
    firebaseConfigJson: string;
    setFirebaseConfigJson: (val: string) => void;
    configStatus: string | StatusObj;
    onHydrateMemory: () => Promise<void>;
    hydrationStatus: string;
    isHydrating: boolean;
    onBackup: () => void;
    onRepair: () => void;
    isRepairing: boolean;
    user?: User | null;
}

export const UtilsTab: React.FC<UtilsTabProps> = (props) => {
    const isRoot = isRootUser(props.user);

    const [activeSubTab, setActiveSubTab] = useState<SubTab>(isRoot ? 'secrets' : 'maintenance');

    // [ZEN FIX] State Recovery: If isRoot becomes true after initial mount (profile loaded late),
    // we should switch from 'maintenance' to a dev-ready tab.
    // [ZEN FIX] State Recovery: If isRoot becomes true after initial mount (profile loaded late),
    // we should switch from 'maintenance' to a dev-ready tab.
    // REMOVED: This blocked Root users from accessing Maintenance tab features (Backup/Repair).
    /*
    useEffect(() => {
        if (isRoot && activeSubTab === 'maintenance') {
            setActiveSubTab('secrets');
        }
    }, [isRoot, activeSubTab]);
    */

    const authUser = getAuth().currentUser;
    console.log("[UtilsTab] 🛰️ RBAC Debug:", {
        isRoot,
        role: props.user?.role,
        propEmail: props.user?.email,
        authEmail: authUser?.email,
        propId: props.user?.id,
        authId: authUser?.uid,
        activeSubTab
    });
    const [status, setStatus] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [showKeys, setShowKeys] = useState(false);

    // Removal of the direct role check here, filtering will happen in the render

    // State
    const [keys, setKeys] = useState({
        fireworks: '', xai: '', typesense_host: '', typesense_key: '', google_client_id: '', voyage: ''
    });
    const [roster, setRoster] = useState({
        fireworks: '', reserve: '', xai: ''
    });
    const [debugSettings, setDebugSettings] = useState({
        showThinking: true, verboseLogging: false, mockMode: false, logNetwork: true, showSystemPrompts: false
    });
    const [storageStats, setStorageStats] = useState({ used: 0, total: 5, percent: 0, count: 0 });

    // [ZEN HELPER] Load all keys from SSOT (Local First)
    const loadAllKeys = () => {
        setKeys({
            fireworks: SecretsManager.get('fireworks') || '',
            xai: SecretsManager.get('xai') || '',
            typesense_host: SecretsManager.get('typesense_host') || '',
            typesense_key: SecretsManager.get('typesense_key') || '',
            google_client_id: SecretsManager.get('google_client_id') || '',
            voyage: SecretsManager.get('voyage') || ''
        });

        setRoster({
            fireworks: getPrimaryModelId(),
            reserve: getReserveModelId(),
            xai: getXAIModelId()
        });
    };

    const auth = getAuth();
    const currentUser = { id: auth.currentUser?.uid || props.user?.id || 'unknown' };

    // Initialization Effect
    useEffect(() => {
        loadAllKeys();

        const savedDebug = localStorage.getItem('gigi_debug_settings');
        if (savedDebug) {
            setDebugSettings(JSON.parse(savedDebug));
        } else {
            const cfg = debugConfig as any;
            setDebugSettings({
                showThinking: cfg.ui?.showThinking ?? true,
                verboseLogging: cfg.local?.verbose ?? false,
                mockMode: cfg.local?.mock ?? false,
                logNetwork: cfg.local?.logNetwork ?? true,
                showSystemPrompts: cfg.ui?.showSystemPrompts ?? false
            });
        }

        let _used = 0, _count = 0;
        for (let x in localStorage) {
            if (localStorage.hasOwnProperty(x)) {
                _used += ((localStorage[x].length + x.length) * 2);
                _count++;
            }
        }
        const usedMB = _used / 1024 / 1024;
        setStorageStats({
            used: parseFloat(usedMB.toFixed(2)),
            total: 5,
            percent: Math.min(100, (usedMB / 5) * 100),
            count: _count
        });

    }, []);

    const handleKeyChange = (k: keyof typeof keys, v: string) => setKeys(p => ({ ...p, [k]: v }));
    const handleRosterChange = (k: keyof typeof roster, v: string) => setRoster(p => ({ ...p, [k]: v }));

    // [ZEN HELPER] Polyfill for addToast since it wasn't passed down
    const addToast = (msg: string, type: 'success' | 'error' | 'info') => {
        const prefix = type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : 'ℹ️ ';
        setStatus(prefix + msg);
        setTimeout(() => setStatus(''), 4000);
    };

    const handleLocalSave = () => {
        SecretsManager.set('fireworks', keys.fireworks);
        SecretsManager.set('xai', keys.xai);
        SecretsManager.set('typesense_host', keys.typesense_host);
        SecretsManager.set('typesense_key', keys.typesense_key);
        SecretsManager.set('google_client_id', keys.google_client_id);
        SecretsManager.set('voyage', keys.voyage);

        SecretsManager.set('model_fireworks', roster.fireworks);
        SecretsManager.set('model_reserve', roster.reserve);
        SecretsManager.set('model_xai', roster.xai);

        localStorage.setItem('gigi_debug_settings', JSON.stringify(debugSettings));

        setStatus('✅ Saved locally.');
        setTimeout(() => setStatus(''), 3000);
    };

    // [ZEN FIX] Terminate & Nuke Ingestor
    const handleSkeletonIngest = async (data: any) => {
        try {
            console.log("💀 Skeleton Key: Processing...");

            // 1. SAVE KEYS FIRST
            if (data.keys) {
                setKeys(data.keys);
                SecretsManager.set('fireworks', data.keys.fireworks);
                SecretsManager.set('xai', data.keys.xai);
                SecretsManager.set('typesense_host', data.keys.typesense_host);
                SecretsManager.set('typesense_key', data.keys.typesense_key);
                if (data.keys.google_client_id) SecretsManager.set('google_client_id', data.keys.google_client_id);
                if (data.keys.voyage) SecretsManager.set('voyage', data.keys.voyage);
            }

            if (data.roster) {
                setRoster(data.roster);
                SecretsManager.set('model_fireworks', data.roster.fireworks);
                SecretsManager.set('model_reserve', data.roster.reserve);
                SecretsManager.set('model_xai', data.roster.xai);
            }

            // 2. DISABLE MOCK MODE
            const newDebug = { ...debugSettings, mockMode: false };
            setDebugSettings(newDebug);
            localStorage.setItem('gigi_debug_settings', JSON.stringify(newDebug));

            // 3. HANDLE CONFIG & TERMINATE NUKE
            if (data.firebaseConfig) {
                const configStr = JSON.stringify(data.firebaseConfig);
                localStorage.setItem('firebaseConfig', configStr);
                localStorage.setItem('gigi_firebase_config', configStr);
                props.setFirebaseConfigJson(JSON.stringify(data.firebaseConfig, null, 2));

                console.log("💀 Terminating Firestore connections...");

                // A. Cleanup LocalStorage Auth
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('firebase:authUser') || key.includes('gigi_user')) {
                        localStorage.removeItem(key);
                    }
                });
                sessionStorage.clear();

                // B. Terminate Firestore (Releases File Lock)
                try {
                    await terminate(getFirestore());
                    console.log("💀 Firestore Terminated.");
                } catch (e) {
                    console.warn("Could not terminate firestore (might not be init)", e);
                }

                // C. Sign Out Auth
                try { await getAuth().signOut(); } catch (e) { }

                // D. NUKE IndexedDB (Now unblocked)
                console.log("💀 Nuking Database...");
                const nukeRequest = indexedDB.deleteDatabase('firebaseLocalStorageDb');

                const finish = () => {
                    console.log("💀 Done. Reloading...");
                    window.location.reload();
                };

                // Add a small delay to ensure OS releases file handle
                nukeRequest.onsuccess = () => setTimeout(finish, 100);
                nukeRequest.onerror = () => setTimeout(finish, 100);
                nukeRequest.onblocked = () => {
                    console.error("💀 DB Delete Blocked! Force reloading anyway.");
                    setTimeout(finish, 100);
                };

                return;
            }

            setStatus('💀 Skeleton Key Accepted. Data Saved.');
            setTimeout(() => setStatus(''), 4000);

        } catch (e) {
            console.error(e);
            setStatus('❌ Skeleton Key Rejected: Invalid Format');
        }
    };

    const handleCloudSync = async () => {
        const user = getAuth().currentUser;
        if (!user?.uid) return setStatus('❌ Not logged in.');

        setIsSaving(true);
        setStatus('☁️ Syncing...');
        try {
            await SecretsManager.saveToCloud(user.uid, {
                fireworksKey: keys.fireworks,
                grokKey: keys.xai,
                typesenseHost: keys.typesense_host,
                typesenseKey: keys.typesense_key,
                googleClientId: keys.google_client_id,
                voyageKey: keys.voyage
            } as any);
            handleLocalSave();
            setStatus('☁️ Synced to Cloud!');
        } catch (e) {
            console.error(e);
            setStatus('❌ Sync failed.');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleDebug = (s: keyof typeof debugSettings) => {
        const v = !debugSettings[s];
        const newSettings = { ...debugSettings, [s]: v };
        setDebugSettings(newSettings);
        localStorage.setItem('gigi_debug_settings', JSON.stringify(newSettings));
        if (s === 'showThinking') aiStateBridge.setThinking(v);
    };

    const factoryReset = () => {
        if (prompt("Type 'DELETE' to wipe EVERYTHING:") === 'DELETE') {
            localStorage.clear();
            indexedDB.deleteDatabase('firebaseLocalStorageDb');
            window.location.reload();
        }
    };

    const TabBtn = ({ id, label, icon: Icon }: any) => (
        <button onClick={() => setActiveSubTab(id)} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeSubTab === id ? 'border-violet-500 text-white bg-white/10 rounded-t-lg' : 'border-transparent text-slate-500 hover:bg-white/5'}`}>
            <Icon size={14} /> {label}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-slate-900/50">
             <div className="flex border-b border-white/10 shrink-0 overflow-x-auto no-scrollbar gap-1 px-2 bg-black/20">
                {/* [ZEN FIX] Unified Visibility: Root sees ALL, Standard sees ONLY Maintenance */}
                {isRoot && (
                    <>
                        <TabBtn id="secrets" label="Keys" icon={Key} />
                        <TabBtn id="librarian" label="Librarian" icon={BookOpen} />
                        <TabBtn id="roster" label="Roster" icon={List} />
                        <TabBtn id="debug" label="Debug" icon={Terminal} />
                        <TabBtn id="system" label="System" icon={Activity} />
                        <TabBtn id="danger" label="Danger" icon={AlertTriangle} />
                        <TabBtn id="maintenance" label="Maint" icon={Wrench} />
                        <TabBtn id="inferences" label="Inferences" icon={Brain} />
                    </>
                )}
                {!isRoot && (
                    <>
                        <TabBtn id="maintenance" label="Maintenance" icon={Wrench} />
                        <TabBtn id="inferences" label="Inferences" icon={Brain} />
                    </>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {activeSubTab === 'secrets' && (
                    <SecretsSubTab
                        keys={keys} handleKeyChange={handleKeyChange}
                        showKeys={showKeys} setShowKeys={setShowKeys}
                        status={status} handleLocalSave={handleLocalSave}
                        handleCloudSync={handleCloudSync} isSaving={isSaving}
                        firebaseConfigJson={props.firebaseConfigJson}
                        setFirebaseConfigJson={props.setFirebaseConfigJson}
                        handleSaveConfig={props.handleSaveConfig}
                        configStatus={props.configStatus}
                        onIngestSkeletonKey={handleSkeletonIngest}
                    />
                )}
                {activeSubTab === 'librarian' && (
                    <LibrarianSubTab
                        user={currentUser}
                        addToast={addToast}
                    />
                )}
                {activeSubTab === 'roster' && (
                    <RosterSubTab
                        roster={roster} handleRosterChange={handleRosterChange}
                        status={status} handleLocalSave={handleLocalSave}
                        handleCloudSync={handleCloudSync} isSaving={isSaving}
                    />
                )}
                {activeSubTab === 'debug' && (
                    <DebugSubTab debugSettings={debugSettings} toggleDebug={toggleDebug} />
                )}
                {activeSubTab === 'system' && (
                    <SystemSubTab
                        storageStats={storageStats}
                        hydrationStatus={props.hydrationStatus}
                        isHydrating={props.isHydrating}
                        onHydrateMemory={props.onHydrateMemory}
                        scanStatus={props.scanStatus}
                        runScan={props.runScan}
                        brokenLinks={props.brokenLinks}
                        duplicates={props.duplicates}
                        executePurge={props.executePurge}
                        onBackup={props.onBackup}
                        onRepair={props.onRepair}
                        isRepairing={props.isRepairing}
                    />
                )}
                {activeSubTab === 'danger' && (
                    <DangerSubTab factoryReset={factoryReset} onExport={props.onExport} />
                )}
                {activeSubTab === 'maintenance' && (
                    <MaintenanceSubTab
                        user={props.user || currentUser}
                        addToast={addToast}
                        tags={props.allTags}
                    />
                )}
                {activeSubTab === 'inferences' && (
                    <InferencesSubTab
                        allTags={props.allTags}
                        user={props.user || null}
                    />
                )}
            </div>


            {/* [ZEN FIX] Global Toast Overlay for UtilsTab */}
            {
                status && (
                    <div className="absolute bottom-6 right-6 z-[100] px-4 py-3 rounded-lg shadow-2xl backdrop-blur-md text-xs font-bold border animate-in slide-in-from-bottom-4 bg-black/80 border-white/20 text-white">
                        {status}
                    </div>
                )
            }
        </div >
    );
};