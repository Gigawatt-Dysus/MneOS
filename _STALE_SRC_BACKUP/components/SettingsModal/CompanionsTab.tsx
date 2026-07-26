import React, { useState } from 'react';
import type { Settings } from '@/types';
import { GlassToggle, GlassSlider } from '../GlassInputs';

interface CompanionsTabProps {
    localSettings: Settings;
    handleSettingChange: (key: keyof Settings, value: any) => void;
}

export const CompanionsTab: React.FC<CompanionsTabProps> = ({ localSettings, handleSettingChange }) => {
    
    const [showKey, setShowKey] = useState(false);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
            
            {/* API KEY SECTION */}
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <label className="block text-xs font-bold text-blue-300 mb-2 uppercase tracking-widest">Fireworks AI Engine</label>
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