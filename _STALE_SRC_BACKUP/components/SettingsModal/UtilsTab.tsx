import React, { useState, useEffect } from 'react';
import {
    Save, Cloud, Eye, EyeOff, RefreshCw, Key, ShieldCheck,
    Database, Terminal, Activity, Trash2, AlertTriangle,
    ToggleLeft, ToggleRight, Download, HardDrive, Cpu, Server, Wifi, List,
    Play
} from 'lucide-react';
import { SecretsManager } from '../../utils/SecretsManager';
import { getAuth } from 'firebase/auth';
import { debugConfig } from '../../debugConfig';
import { aiStateBridge } from '../../utils/aiStateBridge';
import { appDataService } from '../../services/serviceManager';
import { getPrimaryModelId, getReserveModelId, getXAIModelId, getGeminiModelId } from '../../services/ai/config';
import type { Settings, Tag, Media, User } from '../../../src/types';

type SubTab = 'secrets' | 'roster' | 'debug' | 'system' | 'danger';

// [ZEN FIX] Defined valid shape for status object from SettingsModal
interface StatusObj {
    type: 'success' | 'error' | 'info';
    msg: string;
}

interface UtilsTabProps {
    // Data Props (Janitor)
    allTags: Tag[];
    brokenLinks: Media[];
    duplicates: Media[];

    // Actions
    runScan: () => Promise<void>;
    executePurge: (type: 'broken' | 'dupes') => Promise<void>;
    handleSettingChange: (key: keyof Settings, value: any) => void;
    handleClearConfig: () => void;
    handleSaveConfig: () => void;
    onExport?: () => void;

    // State/Status
    scanStatus: string;
    localSettings: Settings;
    isUsingLocalStorage: boolean;
    isForcedLocal: boolean;
    firebaseConfigJson: string;
    setFirebaseConfigJson: (val: string) => void;

    // [ZEN FIX] Updated type to accept string OR object from parent
    configStatus: string | StatusObj;

    // AI Memory
    onHydrateMemory: () => Promise<void>;
    hydrationStatus: string;
    isHydrating: boolean;

    // [ZEN NEW] User for incineration
    user?: User | null;
}

export const UtilsTab: React.FC<UtilsTabProps> = (props) => {
    // Destructure Props
    const {
        allTags, brokenLinks, duplicates,
        runScan, executePurge,
        scanStatus,
        onExport,
        onHydrateMemory, hydrationStatus, isHydrating,
        firebaseConfigJson, setFirebaseConfigJson, handleSaveConfig, configStatus,
        user
    } = props;

    // Local Component State
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('secrets');
    const [status, setStatus] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isIncinerating, setIsIncinerating] = useState(false);
    const [showIncinerateConfirm, setShowIncinerateConfirm] = useState(false);
    const [showKeys, setShowKeys] = useState(false);

    // API Keys (Restored from your version)
    const [keys, setKeys] = useState({
        fireworks: '',
        gemini: '',
        xai: '',
        typesense_host: '',
        typesense_key: ''
    });

    // AI Roster (Restored from your version)
    const [roster, setRoster] = useState({
        fireworks: '',
        reserve: '',
        xai: '',
        gemini: ''
    });

    // Debug (Restored from your version)
    const [debugSettings, setDebugSettings] = useState({
        showThinking: true,
        verboseLogging: false,
        mockMode: false,
        logNetwork: true,
        showSystemPrompts: false
    });

    const [storageStats, setStorageStats] = useState({ used: 0, total: 5, percent: 0, count: 0 });

    useEffect(() => {
        // 1. Load Keys
        setKeys({
            fireworks: SecretsManager.get('fireworks') || '',
            gemini: SecretsManager.get('gemini') || '',
            xai: SecretsManager.get('xai') || '',
            typesense_host: SecretsManager.get('typesense_host') || '',
            typesense_key: SecretsManager.get('typesense_key') || ''
        });

        // 2. Load Roster (Defaults from config if local empty)
        setRoster({
            fireworks: getPrimaryModelId(),
            reserve: getReserveModelId(),
            xai: getXAIModelId(),
            gemini: getGeminiModelId()
        });

        // 3. Load Debug
        const cfg = debugConfig as any;
        setDebugSettings({
            showThinking: cfg.ui?.showThinking ?? true,
            verboseLogging: cfg.local?.verbose ?? false,
            mockMode: cfg.local?.mock ?? false,
            logNetwork: cfg.local?.logNetwork ?? true,
            showSystemPrompts: cfg.ui?.showSystemPrompts ?? false
        });

        // 4. Calc Storage
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

    const handleLocalSave = () => {
        // Save Keys
        SecretsManager.set('fireworks', keys.fireworks);
        SecretsManager.set('gemini', keys.gemini);
        SecretsManager.set('xai', keys.xai);
        SecretsManager.set('typesense_host', keys.typesense_host);
        SecretsManager.set('typesense_key', keys.typesense_key);

        // Save Roster
        SecretsManager.set('model_fireworks', roster.fireworks);
        SecretsManager.set('model_reserve', roster.reserve);
        SecretsManager.set('model_xai', roster.xai);
        SecretsManager.set('model_gemini', roster.gemini);

        setStatus('✅ Saved locally.');
        setTimeout(() => setStatus(''), 3000);
    };

    const handleCloudSync = async () => {
        const user = getAuth().currentUser;
        if (!user?.uid) return setStatus('❌ Not logged in.');

        setIsSaving(true);
        setStatus('☁️ Syncing...');
        try {
            await SecretsManager.saveToCloud(user.uid, {
                // Keys
                fireworksKey: keys.fireworks,
                geminiKey: keys.gemini,
                grokKey: keys.xai,
                typesenseHost: keys.typesense_host,
                typesenseKey: keys.typesense_key,
                // Roster
                modelFireworks: roster.fireworks,
                modelReserve: roster.reserve,
                modelXAI: roster.xai,
                modelGemini: roster.gemini
            });
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
        setDebugSettings(p => ({ ...p, [s]: v }));
        if (s === 'showThinking') aiStateBridge.setThinking(v);
    };

    const clearCache = () => {
        if (!confirm("Clear local cache (images/history)? Keys remain.")) return;
        const keep = [
            'GIGI_SEC_FIREWORKS', 'GIGI_SEC_GEMINI', 'GIGI_SEC_XAI', 'GIGI_SEC_TYPESENSE_HOST', 'GIGI_SEC_TYPESENSE_KEY',
            'GIGI_SEC_MODEL_FIREWORKS', 'GIGI_SEC_MODEL_RESERVE', 'GIGI_SEC_MODEL_XAI', 'GIGI_SEC_MODEL_GEMINI',
            'gigi_identity_cache', 'gigi_user_settings'
        ];
        const saved: Record<string, string> = {};
        keep.forEach(k => { const v = localStorage.getItem(k); if (v) saved[k] = v; });
        localStorage.clear();
        Object.entries(saved).forEach(([k, v]) => localStorage.setItem(k, v));
        window.location.reload();
    };

    const factoryReset = () => {
        if (prompt("Type 'DELETE' to wipe EVERYTHING:") === 'DELETE') {
            localStorage.clear();
            window.location.reload();
        }
    };

    // [ZEN NEW] Global Incineration Sequence
    const handleGlobalIncinerate = async () => {
        if (!user?.id) return alert("System Error: No valid session.");

        setIsIncinerating(true);
        setStatus('🔥 Initializing Snap...');

        try {
            // 1. BACKUP
            console.log("[Incinerator] Securing JSON Backup...");
            const history = await appDataService.getChatHistory(user.id);
            if (history.length > 0) {
                const dataStr = JSON.stringify(history, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `archive-snap-backup-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

            // 2. TRIGGER ANIMATION
            window.dispatchEvent(new CustomEvent('incinerate-chat'));
            setStatus('🔥 Disintegrating Memplex...');

            // 3. DELAY for effect
            await new Promise(r => setTimeout(r, 4500));

            // 4. PURGE
            await appDataService.deleteChatHistory(user.id);

            setStatus('✨ Incineration Successful.');
            setShowIncinerateConfirm(false);
            alert("Memplex Incinerated. You are now free of the past.");
        } catch (e) {
            console.error("[Incinerator] Global Sequence Failed", e);
            setStatus('❌ Snap Failure');
            alert("Incineration sequence failed. Check logs.");
        } finally {
            setIsIncinerating(false);
        }
    };

    // Helper to render parent status prop safely
    const renderConfigStatus = () => {
        if (!configStatus) return null;
        if (typeof configStatus === 'string') {
            return <span className="text-xs text-emerald-400">{configStatus}</span>;
        }
        const color = configStatus.type === 'error' ? 'text-red-400' : 'text-emerald-400';
        return <span className={`text-xs ${color}`}>{configStatus.msg}</span>;
    };

    const TabBtn = ({ id, label, icon: Icon }: any) => (
        <button onClick={() => setActiveSubTab(id)} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${activeSubTab === id ? 'border-violet-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:bg-white/5'}`}>
            <Icon size={16} /> {label}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-slate-900/50">
            <div className="flex border-b border-white/10 shrink-0">
                <TabBtn id="secrets" label="Keys" icon={Key} />
                <TabBtn id="roster" label="Roster" icon={List} />
                <TabBtn id="debug" label="Debug" icon={Terminal} />
                <TabBtn id="system" label="System" icon={Activity} />
                <TabBtn id="danger" label="Danger" icon={AlertTriangle} />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                {/* === SECRETS === */}
                {activeSubTab === 'secrets' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><ShieldCheck className="text-emerald-400" size={20} /> API Credentials</h3>
                            <button onClick={() => setShowKeys(!showKeys)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
                                {showKeys ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2"><Key size={12} /> Models</h4>
                            <div className="grid gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-300 block">Fireworks AI</label>
                                    <input type={showKeys ? "text" : "password"} value={keys.fireworks} onChange={(e) => handleKeyChange('fireworks', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-violet-500 focus:bg-black/60 outline-none text-white font-mono" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-300 block">Google Gemini</label>
                                    <input type={showKeys ? "text" : "password"} value={keys.gemini} onChange={(e) => handleKeyChange('gemini', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-cyan-500 focus:bg-black/60 outline-none text-white font-mono" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-300 block">xAI (Grok)</label>
                                    <input type={showKeys ? "text" : "password"} value={keys.xai} onChange={(e) => handleKeyChange('xai', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-white/50 focus:bg-black/60 outline-none text-white font-mono" />
                                </div>
                            </div>
                        </div>
                        <div className="w-full h-px bg-white/10" />
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2"><Database size={12} /> Database</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-300 block">Typesense Host</label>
                                    <input type="text" value={keys.typesense_host} onChange={(e) => handleKeyChange('typesense_host', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-orange-500 focus:bg-black/60 outline-none text-white font-mono" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-300 block">Typesense Key</label>
                                    <input type={showKeys ? "text" : "password"} value={keys.typesense_key} onChange={(e) => handleKeyChange('typesense_key', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-orange-500 focus:bg-black/60 outline-none text-white font-mono" />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-white/10">
                            <span className={`text-xs ${status.includes('❌') ? 'text-red-400' : 'text-emerald-400'}`}>{status}</span>
                            <div className="flex gap-2">
                                <button onClick={handleLocalSave} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold flex gap-2"><Save size={14} /> Save Device</button>
                                <button onClick={handleCloudSync} disabled={isSaving} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold flex gap-2 disabled:opacity-50">
                                    {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />} Sync Cloud
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* === ROSTER === */}
                {activeSubTab === 'roster' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><List className="text-blue-400" size={20} /> AI Model Roster</h3>
                        </div>
                        <p className="text-xs text-slate-400">Set the specific Model IDs for each slot. If a slot is empty, it will be skipped.</p>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-violet-300 block">1. Primary (Fireworks)</label>
                                <input type="text" value={roster.fireworks} onChange={(e) => handleRosterChange('fireworks', e.target.value)} className="w-full bg-black/40 border border-violet-500/30 rounded-lg px-4 py-2.5 text-sm focus:border-violet-500 outline-none text-white font-mono" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-300 block">2. Reserve Slot</label>
                                <input type="text" value={roster.reserve} onChange={(e) => handleRosterChange('reserve', e.target.value)} placeholder="(Optional) e.g. accounts/fireworks/models/mixtral..." className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-slate-500 outline-none text-white font-mono" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-white block">3. xAI (Grok)</label>
                                <input type="text" value={roster.xai} onChange={(e) => handleRosterChange('xai', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-white outline-none text-white font-mono" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-cyan-300 block">4. Gemini (Fallback)</label>
                                <input type="text" value={roster.gemini} onChange={(e) => handleRosterChange('gemini', e.target.value)} className="w-full bg-black/40 border border-cyan-500/30 rounded-lg px-4 py-2.5 text-sm focus:border-cyan-500 outline-none text-white font-mono" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-white/10">
                            <span className={`text-xs ${status.includes('❌') ? 'text-red-400' : 'text-emerald-400'}`}>{status}</span>
                            <div className="flex gap-2">
                                <button onClick={handleLocalSave} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold flex gap-2"><Save size={14} /> Save Device</button>
                                <button onClick={handleCloudSync} disabled={isSaving} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold flex gap-2 disabled:opacity-50">
                                    {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />} Sync Cloud
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* === DEBUG === */}
                {activeSubTab === 'debug' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2"><Terminal className="text-amber-400" size={20} /> Developer Config</h3>
                        <div className="grid gap-3">
                            <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex gap-3">
                                    <div className="p-2 rounded-lg h-fit bg-white/5 text-emerald-400"><Cpu size={18} /></div>
                                    <div><h4 className="text-sm font-medium text-white">Show Thinking</h4><p className="text-xs text-slate-400">Display internal monologue.</p></div>
                                </div>
                                <button onClick={() => toggleDebug('showThinking')} className={`text-2xl transition-colors ${debugSettings.showThinking ? 'text-emerald-400' : 'text-slate-700'}`}>{debugSettings.showThinking ? <ToggleRight /> : <ToggleLeft />}</button>
                            </div>
                            <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex gap-3">
                                    <div className="p-2 rounded-lg h-fit bg-white/5 text-blue-400"><Activity size={18} /></div>
                                    <div><h4 className="text-sm font-medium text-white">Verbose Logging</h4><p className="text-xs text-slate-400">Raw API payloads to console.</p></div>
                                </div>
                                <button onClick={() => toggleDebug('verboseLogging')} className={`text-2xl transition-colors ${debugSettings.verboseLogging ? 'text-blue-400' : 'text-slate-700'}`}>{debugSettings.verboseLogging ? <ToggleRight /> : <ToggleLeft />}</button>
                            </div>
                            <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex gap-3">
                                    <div className="p-2 rounded-lg h-fit bg-white/5 text-amber-400"><AlertTriangle size={18} /></div>
                                    <div><h4 className="text-sm font-medium text-white">Mock Mode</h4><p className="text-xs text-slate-400">Simulate API responses.</p></div>
                                </div>
                                <button onClick={() => toggleDebug('mockMode')} className={`text-2xl transition-colors ${debugSettings.mockMode ? 'text-amber-400' : 'text-slate-700'}`}>{debugSettings.mockMode ? <ToggleRight /> : <ToggleLeft />}</button>
                            </div>
                            <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex gap-3">
                                    <div className="p-2 rounded-lg h-fit bg-white/5 text-purple-400"><Server size={18} /></div>
                                    <div><h4 className="text-sm font-medium text-white">Reveal System Prompts</h4><p className="text-xs text-slate-400">Show hidden instructions.</p></div>
                                </div>
                                <button onClick={() => toggleDebug('showSystemPrompts')} className={`text-2xl transition-colors ${debugSettings.showSystemPrompts ? 'text-purple-400' : 'text-slate-700'}`}>{debugSettings.showSystemPrompts ? <ToggleRight /> : <ToggleLeft />}</button>
                            </div>
                            <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex gap-3">
                                    <div className="p-2 rounded-lg h-fit bg-white/5 text-pink-400"><Wifi size={18} /></div>
                                    <div><h4 className="text-sm font-medium text-white">Log Network Traffic</h4><p className="text-xs text-slate-400">Log detailed fetch/XHR.</p></div>
                                </div>
                                <button onClick={() => toggleDebug('logNetwork')} className={`text-2xl transition-colors ${debugSettings.logNetwork ? 'text-pink-400' : 'text-slate-700'}`}>{debugSettings.logNetwork ? <ToggleRight /> : <ToggleLeft />}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* === SYSTEM === */}
                {activeSubTab === 'system' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2"><HardDrive className="text-blue-400" size={20} /> System Health</h3>

                        {/* Storage Health */}
                        <div className="bg-black/20 p-4 rounded-xl border border-white/10">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm text-slate-300">Storage Usage ({storageStats.count} items)</span>
                                <span className="text-xs font-mono text-slate-400">{storageStats.used}MB / {storageStats.total}MB</span>
                            </div>
                            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-1000 ${storageStats.percent > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${storageStats.percent}%` }} />
                            </div>
                        </div>

                        {/* [MERGED] Memory Hydration */}
                        <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                <Database size={16} className="text-purple-400" />
                                Vector Memory
                            </h3>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-300">Hydration Status: {hydrationStatus}</p>
                                    <p className="text-[10px] text-slate-500">Syncing local context with cloud knowledge.</p>
                                </div>
                                <button
                                    onClick={onHydrateMemory}
                                    disabled={isHydrating}
                                    className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded text-xs border border-purple-500/30 flex items-center gap-2"
                                >
                                    {isHydrating ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                    {isHydrating ? 'Hydrating...' : 'Force Hydrate'}
                                </button>
                            </div>
                        </div>

                        {/* [MERGED] Database Hygiene (The Janitor) */}
                        <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                <Activity size={16} className="text-emerald-400" />
                                Database Hygiene
                            </h3>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-xs text-slate-300">Scan Status: {scanStatus}</p>
                                </div>
                                <button
                                    onClick={runScan}
                                    className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded text-xs border border-emerald-500/30 flex items-center gap-2"
                                >
                                    <Play size={12} /> Run Diagnostics
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 bg-black/40 rounded border border-white/5">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs text-slate-400">Broken Links</span>
                                        <span className="text-xs font-bold text-red-400">{brokenLinks.length}</span>
                                    </div>
                                    <button
                                        onClick={() => executePurge('broken')}
                                        disabled={brokenLinks.length === 0}
                                        className="w-full py-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 text-[10px] rounded border border-red-900/30 disabled:opacity-50"
                                    >
                                        Purge Broken
                                    </button>
                                </div>
                                <div className="p-3 bg-black/40 rounded border border-white/5">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs text-slate-400">Duplicates</span>
                                        <span className="text-xs font-bold text-amber-400">{duplicates.length}</span>
                                    </div>
                                    <button
                                        onClick={() => executePurge('dupes')}
                                        disabled={duplicates.length === 0}
                                        className="w-full py-1 bg-amber-900/20 hover:bg-amber-900/40 text-amber-400 text-[10px] rounded border border-amber-900/30 disabled:opacity-50"
                                    >
                                        Purge Dupes
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* [ZEN FIX] Firebase Config Editor */}
                        <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                <Cloud size={16} className="text-blue-400" />
                                Firebase Config
                            </h3>
                            <div className="space-y-2">
                                <textarea
                                    value={firebaseConfigJson}
                                    onChange={(e) => setFirebaseConfigJson(e.target.value)}
                                    className="w-full h-24 bg-black/40 border border-white/10 rounded p-2 text-[10px] font-mono text-slate-300 resize-none outline-none focus:border-blue-500"
                                    placeholder='{ "apiKey": "..." }'
                                />
                                <div className="flex justify-end gap-2 items-center">
                                    {renderConfigStatus()}
                                    <button
                                        onClick={handleSaveConfig}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center gap-2"
                                    >
                                        <Save size={12} /> Apply Config
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Browser Actions */}
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={clearCache} className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl flex flex-col items-center justify-center gap-2">
                                <RefreshCw className="text-blue-400" />
                                <span className="text-sm font-bold text-slate-200">Clear Cache</span>
                            </button>
                            <button onClick={() => window.location.reload()} className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl flex flex-col items-center justify-center gap-2">
                                <Activity className="text-emerald-400" />
                                <span className="text-sm font-bold text-slate-200">Force Reload</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* === DANGER === */}
                {activeSubTab === 'danger' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
                        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center gap-4">
                            <AlertTriangle className="text-red-500" size={24} />
                            <div>
                                <h3 className="text-sm font-bold text-red-400">Destructive Actions</h3>
                                <p className="text-xs text-red-300/70">Proceed with caution.</p>
                            </div>
                        </div>
                        <div className="flex justify-between items-center bg-black/20 p-4 rounded-lg border border-red-900/20">
                            <div>
                                <h4 className="text-sm font-medium text-white">Factory Reset</h4>
                                <p className="text-xs text-slate-400">Wipe all data & keys.</p>
                            </div>
                            <button onClick={factoryReset} className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold flex items-center gap-2">
                                <Trash2 size={14} /> Wipe Device
                            </button>
                        </div>
                        <div className="flex justify-between items-center bg-black/20 p-4 rounded-lg border border-white/5">
                            <div>
                                <h4 className="text-sm font-medium text-white">Export Debug Dump</h4>
                                <p className="text-xs text-slate-400">Download logs & config.</p>
                            </div>
                            <button onClick={onExport} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold flex items-center gap-2">
                                <Download size={14} /> Export JSON
                            </button>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};