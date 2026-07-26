import React, { useState } from 'react';
import type { Settings, User } from '../../types';
import { GlassToggle, GlassSlider } from '../GlassInputs';
import { HelpCircle } from 'lucide-react';
import { isRootUser } from '../../utils/rbac';

interface CompanionsTabProps {
    localSettings: Settings;
    handleSettingChange: (key: keyof Settings, value: any) => void;
    user?: User | null;
}

export const CompanionsTab: React.FC<CompanionsTabProps> = ({ localSettings, handleSettingChange, user }) => {

    const [showKey, setShowKey] = useState(false);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2">

            {isRootUser(user) && (
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                        <label className="block text-xs font-bold text-blue-300 uppercase tracking-widest">Fireworks AI Engine</label>
                        {/* UX Tooltip */}
                        <div className="group relative">
                            <HelpCircle size={10} className="text-blue-500/50 hover:text-blue-400 cursor-help" />
                            <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-[#1a1d26] border border-blue-500/20 rounded-lg shadow-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                <p className="text-[9px] leading-tight text-slate-300">
                                    Only the Root Archivist can view or modify the AI engine credentials to ensure project cost control and security.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type={showKey ? "text" : "password"}
                            value={localSettings.fireworksApiKey || ''}
                            onChange={(e) => handleSettingChange('fireworksApiKey', e.target.value)}
                            placeholder="fw_..."
                            className="flex-1 bg-black/30 border border-white/10 rounded px-3 py-2 text-sm text-white font-mono"
                        />
                        <button onClick={() => setShowKey(!showKey)} className="text-xs text-white/50 hover:text-white px-2">
                            {showKey ? "HIDE" : "SHOW"}
                        </button>
                    </div>
                    <p className="text-[10px] text-white/40 mt-1">Required for custom models & uncensored roleplay.</p>
                </div>
            )}

            {/* General Settings */}
            <GlassToggle
                label="Show Memory Prompt"
                description="Display a personalized conversation starter on the dashboard."
                checked={localSettings.showMemoryPromptOnDashboard}
                onChange={(v) => handleSettingChange('showMemoryPromptOnDashboard', v)}
            />

            <GlassToggle
                label="AI Daydreaming"
                description="Allow AIs to reflect on memories while you are away."
                checked={localSettings.aiDaydreaming}
                onChange={(v) => handleSettingChange('aiDaydreaming', v)}
            />

            <GlassSlider
                label="Idle Timeout"
                description="Minutes of inactivity before AI starts dreaming."
                value={localSettings.idleTimeout}
                min={1} max={30}
                onChange={(v) => handleSettingChange('idleTimeout', v)}
                formatValue={(v) => `${v} min`}
            />

            <GlassSlider
                label="Daydream Frequency"
                description="How often to trigger reflection events."
                value={localSettings.daydreamInterval}
                min={1} max={120}
                onChange={(v) => handleSettingChange('daydreamInterval', v)}
                formatValue={(v) => `${v} min`}
            />

            <GlassSlider
                label="Context Depth"
                description="Number of items Gigi analyzes per thought."
                value={localSettings.daydreamDepth || 10}
                min={5} max={20}
                onChange={(v) => handleSettingChange('daydreamDepth', v)}
                formatValue={(v) => `${v} items`}
            />

            <GlassSlider
                label="Deep Dive Length"
                description="Target word count for research reports."
                value={localSettings.deepDiveWordCount || 600}
                min={200} max={2000} step={100}
                onChange={(v) => handleSettingChange('deepDiveWordCount', v)}
                formatValue={(v) => `${v} words`}
            />
        </div>
    );
};