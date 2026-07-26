import React, { useState } from 'react';
import { LucideKey, LucideBrainCircuit, LucideBookOpen, LucideListTree, LucideBox, LucidePlus, LucideX, LucideMessageSquare } from 'lucide-react';
import type { DevConfig } from './ZenShared';

interface ZenSettingsProps {
    config: DevConfig;
    setConfig: React.Dispatch<React.SetStateAction<DevConfig>>;
    onSave: (config: DevConfig, close: boolean) => void;
    onClose: () => void;
}

const ZenSettings: React.FC<ZenSettingsProps> = ({ config, setConfig, onSave, onClose }) => {
    const [newIssueType, setNewIssueType] = useState('');
    const [newModule, setNewModule] = useState('');
    const [newIdleMessage, setNewIdleMessage] = useState('');

    const handleTaxonomyAdd = (listName: keyof DevConfig, input: string, setInput: (v: string) => void) => {
        if (!input.trim()) return;
        const currentList = config[listName] as string[] || [];
        if (!currentList.includes(input)) {
            setConfig({ ...config, [listName]: [...currentList, input] });
            setInput('');
        }
    };

    const handleTaxonomyRemove = (listName: keyof DevConfig, item: string) => {
        const currentList = config[listName] as string[] || [];
        setConfig({ ...config, [listName]: currentList.filter(i => i !== item) });
    };

    const renderChips = (listName: keyof DevConfig) => (
        (config[listName] as string[]).map(item => (
            <span key={item} className="bg-slate-800 text-xs text-[#00ffcc] px-2 py-1 rounded flex items-center gap-2 border border-[#00ffcc]/30">
                {item}
                <button onClick={() => handleTaxonomyRemove(listName, item)}><LucideX size={12}/></button>
            </span>
        ))
    );

    return (
        <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#001020] border border-[#00ffcc] w-full max-w-2xl p-6 rounded-lg shadow-[0_0_50px_rgba(0,255,204,0.2)] max-h-[90vh] overflow-y-auto custom-scrollbar">
                <h2 className="text-xl font-bold text-[#00ffcc] mb-4 border-b border-[#00ffcc]/30 pb-2">SYSTEM CONFIGURATION</h2>
                
                <div className="space-y-6 text-xs font-mono">
                    
                    {/* Keys */}
                    <div className="space-y-2">
                        <h3 className="text-[#00ffcc] font-bold flex items-center gap-2"><LucideKey size={14}/> API CREDENTIALS</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <input type="password" value={config.grokKey} onChange={e => setConfig({...config, grokKey: e.target.value})} className="w-full bg-black border border-[#00ffcc]/30 p-2 text-[#00ffcc]" placeholder="Grok Key" />
                        </div>
                    </div>

                    {/* Identity */}
                    <div className="space-y-2">
                        <h3 className="text-[#00ffcc] font-bold flex items-center gap-2"><LucideBrainCircuit size={14}/> IDENTITY</h3>
                        <input type="text" value={config.coderName} onChange={e => setConfig({...config, coderName: e.target.value})} className="w-full bg-black border border-[#00ffcc]/30 p-2 text-[#00ffcc]" placeholder="Coder Name" />
                    </div>

                    {/* Context */}
                    <div className="space-y-2">
                        <h3 className="text-[#00ffcc] font-bold flex items-center gap-2"><LucideBookOpen size={14}/> CONTEXT</h3>
                        <textarea value={config.basePrompt} onChange={e => setConfig({...config, basePrompt: e.target.value})} className="w-full bg-black border border-[#00ffcc]/30 p-2 text-[#00ffcc] h-24" placeholder="Base System Prompt..." />
                    </div>

                    {/* Lists */}
                    <div className="space-y-2">
                        <h3 className="text-[#00ffcc] font-bold flex items-center gap-2"><LucideListTree size={14}/> ISSUE TYPES</h3>
                        <div className="flex gap-2">
                            <input type="text" value={newIssueType} onChange={e => setNewIssueType(e.target.value)} className="flex-1 bg-black border border-[#00ffcc]/30 p-2 text-[#00ffcc]" placeholder="Add Type" />
                            <button onClick={() => handleTaxonomyAdd('issueTypes', newIssueType, setNewIssueType)} className="px-3 bg-[#00ffcc]/20 text-[#00ffcc] rounded"><LucidePlus size={14}/></button>
                        </div>
                        <div className="flex flex-wrap gap-2">{renderChips('issueTypes')}</div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-[#00ffcc] font-bold flex items-center gap-2"><LucideBox size={14}/> MODULES</h3>
                        <div className="flex gap-2">
                            <input type="text" value={newModule} onChange={e => setNewModule(e.target.value)} className="flex-1 bg-black border border-[#00ffcc]/30 p-2 text-[#00ffcc]" placeholder="Add Module" />
                            <button onClick={() => handleTaxonomyAdd('modules', newModule, setNewModule)} className="px-3 bg-[#00ffcc]/20 text-[#00ffcc] rounded"><LucidePlus size={14}/></button>
                        </div>
                        <div className="flex flex-wrap gap-2">{renderChips('modules')}</div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-[#00ffcc] font-bold flex items-center gap-2"><LucideMessageSquare size={14}/> IDLE MESSAGES (THE SOUL)</h3>
                        <div className="flex gap-2">
                            <input type="text" value={newIdleMessage} onChange={e => setNewIdleMessage(e.target.value)} className="flex-1 bg-black border border-[#00ffcc]/30 p-2 text-[#00ffcc]" placeholder="Add Message (Blake's 7 Style)" />
                            <button onClick={() => handleTaxonomyAdd('idleMessages', newIdleMessage, setNewIdleMessage)} className="px-3 bg-[#00ffcc]/20 text-[#00ffcc] rounded"><LucidePlus size={14}/></button>
                        </div>
                        <div className="flex flex-wrap gap-2">{renderChips('idleMessages')}</div>
                    </div>

                </div>

                <div className="mt-6 flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 text-[#00ffcc]/60 hover:text-[#00ffcc]">CANCEL</button>
                    <button onClick={() => onSave(config, true)} className="px-6 py-2 bg-[#00ffcc] text-black font-bold rounded hover:bg-white transition-colors">SAVE & REBOOT</button>
                </div>
            </div>
        </div>
    );
};

export default ZenSettings;