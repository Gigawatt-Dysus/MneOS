import React, { useRef } from 'react';
import { ShieldCheck, Eye, EyeOff, Key, Database, Save, RefreshCw, Cloud, Info, Upload } from 'lucide-react';
import type { StatusObj } from './index';

interface SecretsSubTabProps {
    keys: { fireworks: string; xai: string; typesense_host: string; typesense_key: string; google_client_id: string; };
    handleKeyChange: (k: any, v: string) => void;
    showKeys: boolean;
    setShowKeys: (v: boolean) => void;
    status: string;
    handleLocalSave: () => void;
    handleCloudSync: () => void;
    isSaving: boolean;

    firebaseConfigJson: string;
    setFirebaseConfigJson: (val: string) => void;
    handleSaveConfig: () => void;
    configStatus: string | StatusObj;

    // [ZEN NEW]
    onIngestSkeletonKey: (data: any) => void;
}

export const SecretsSubTab: React.FC<SecretsSubTabProps> = (props) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Helper to clean raw input ---
    const cleanJsonInput = (input: string) => {
        const trimmed = input.trim();
        const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
        return jsonMatch ? jsonMatch[0] : trimmed;
    };

    const handleConfigPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        const cleaned = cleanJsonInput(pastedText);
        props.setFirebaseConfigJson(cleaned);
    };

    const handleSafeApplyConfig = () => {
        if (!props.firebaseConfigJson.trim()) return;
        let content = cleanJsonInput(props.firebaseConfigJson);
        props.handleLocalSave(); // Auto-save keys first

        try {
            JSON.parse(content);
            if (content !== props.firebaseConfigJson) props.setFirebaseConfigJson(content);
            props.handleSaveConfig();
            return;
        } catch (e) { }

        try {
            let fixed = content.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
                .replace(/,(\s*})/g, '$1')
                .replace(/'/g, '"');
            const parsed = JSON.parse(fixed);
            const formatted = JSON.stringify(parsed, null, 2);
            props.setFirebaseConfigJson(formatted);
            alert("✨ Auto-Fixed: Valid JSON generated. Please click 'Apply Config' again.");
        } catch (e) {
            alert("❌ Rejected: Invalid JSON.");
        }
    };

    const renderConfigStatus = () => {
        if (!props.configStatus) return null;
        if (typeof props.configStatus === 'string') return <span className="text-xs text-emerald-400">{props.configStatus}</span>;
        const color = props.configStatus.type === 'error' ? 'text-red-400' : 'text-emerald-400';
        return <span className={`text-xs ${color}`}>{props.configStatus.msg}</span>;
    };

    // [ZEN NEW] Skeleton Key Handler
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                props.onIngestSkeletonKey(json);
            } catch (err) {
                alert("❌ Failed to parse Skeleton Key JSON.");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">

            {/* === API KEYS === */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><ShieldCheck className="text-emerald-400" size={20} /> API Credentials</h3>

                <div className="flex gap-2">
                    {/* [ZEN NEW] Skeleton Key Button */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".json"
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded-lg transition-colors border border-emerald-500/30 flex items-center gap-2 text-xs font-bold"
                        title="Upload Skeleton Key (Master Config)"
                    >
                        <Upload size={14} /> Ingest Skeleton Key
                    </button>

                    <button onClick={() => props.setShowKeys(!props.showKeys)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
                        {props.showKeys ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2"><Key size={12} /> Models</h4>
                <div className="grid gap-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300 block">Fireworks AI</label>
                        <input type={props.showKeys ? "text" : "password"} value={props.keys.fireworks} onChange={(e) => props.handleKeyChange('fireworks', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-violet-500 focus:bg-black/60 outline-none text-white font-mono" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300 block">xAI (Grok)</label>
                        <input type={props.showKeys ? "text" : "password"} value={props.keys.xai} onChange={(e) => props.handleKeyChange('xai', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-white/50 focus:bg-black/60 outline-none text-white font-mono" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300 block">Voyage AI (Vectors)</label>
                        <input type={props.showKeys ? "text" : "password"} value={(props.keys as any).voyage || ''} onChange={(e) => props.handleKeyChange('voyage', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-emerald-500 focus:bg-black/60 outline-none text-white font-mono" placeholder="pa-..." />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300 block">Google Client ID (OAuth)</label>
                        <input type="text" value={props.keys.google_client_id} onChange={(e) => props.handleKeyChange('google_client_id', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:bg-black/60 outline-none text-white font-mono" placeholder="4595...apps.googleusercontent.com" />
                    </div>
                </div>
            </div>

            <div className="w-full h-px bg-white/10" />

            <div className="space-y-4">
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2"><Database size={12} /> Database</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300 block">Typesense Host</label>
                        <input type="text" value={props.keys.typesense_host} onChange={(e) => props.handleKeyChange('typesense_host', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-orange-500 focus:bg-black/60 outline-none text-white font-mono" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300 block">Typesense Key</label>
                        <input type={props.showKeys ? "text" : "password"} value={props.keys.typesense_key} onChange={(e) => props.handleKeyChange('typesense_key', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-orange-500 focus:bg-black/60 outline-none text-white font-mono" />
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className={`text-xs ${props.status.includes('❌') ? 'text-red-400' : 'text-emerald-400'}`}>{props.status}</span>
                <div className="flex gap-2">
                    <button onClick={props.handleLocalSave} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold flex gap-2"><Save size={14} /> Save Device</button>
                    <button onClick={props.handleCloudSync} disabled={props.isSaving} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold flex gap-2 disabled:opacity-50">
                        {props.isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />} Sync Cloud
                    </button>
                </div>
            </div>

            <div className="w-full h-px bg-white/10" />

            {/* === FIREBASE CONFIG === */}
            <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><Cloud size={16} className="text-blue-400" /> Firebase Config</h3>
                    <div className="group relative" title='Paste your config object here. We will auto-format it to JSON.'>
                        <Info size={14} className="text-slate-500 hover:text-cyan-400 cursor-help" />
                    </div>
                </div>
                <div className="space-y-2">
                    <textarea
                        value={props.firebaseConfigJson}
                        onChange={(e) => props.setFirebaseConfigJson(e.target.value)}
                        onPaste={handleConfigPaste}
                        className="w-full h-24 bg-black/40 border border-white/10 rounded p-2 text-[10px] font-mono text-slate-300 resize-none outline-none focus:border-blue-500"
                        placeholder='{ apiKey: "..." }'
                    />
                    <div className="flex justify-end gap-2 items-center">
                        {renderConfigStatus()}
                        <button onClick={handleSafeApplyConfig} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center gap-2">
                            <Save size={12} /> Apply Config
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};