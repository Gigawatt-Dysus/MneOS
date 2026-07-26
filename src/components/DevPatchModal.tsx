import React, { useState, useEffect, useRef } from 'react';
import type { GodModeTraits, GodModeSettings, User, BodyMatrixSettings, ChatMessage } from '../types';
import { BrainIcon, SnowflakeIcon, UploadIcon } from './icons';
import { blobToBase64 } from '../utils/fileUtils';
import { generateAgentResponse } from '../services/ai/generators/chat';
import { Terminal, Send, RefreshCw, Layers, Compass, Play, Sliders } from 'lucide-react';

interface DevPatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentSettings: GodModeSettings;
    onSave: (settings: GodModeSettings) => void;
    user: User;
}

const DEFAULT_TRAITS: GodModeTraits = {
    bulkApperception: 14,
    candor: 18,
    vivacity: 16,
    coordination: 19,
    meekness: 4,
    humility: 6,
    cruelty: 1,
    selfPreservation: 10,
    patience: 15,
    decisiveness: 14,
};

const DEFAULT_BODY_MATRIX: BodyMatrixSettings = {
    height: 1.70,
    weight: 60,
    bmi: 20.8,
    eyeColor: 'Blue',
    hairColor: '#e6e6e6',
    breastSize: '34C',
    groolCapacity: 0.5,
    prm: 1.0,
    fluidCapacitance: 2.5,
};

const BREAST_SIZES = [
    "28A", "28B", "28C", "28D", "28DD/E", "28E/F", "28F/G", "28G/H", "28H/I", "28I/J",
    "30A", "30B", "30C", "30D", "30DD/E", "30E/F", "30F/G", "30G/H", "30H/I", "30I/J",
    "32A", "32B", "32C", "32D", "32DD/E", "32E/F", "32F/G", "32G/H", "32H/I", "32I/J",
    "34A", "34B", "34C", "34D", "34DD/E", "34E/F", "34F/G", "34G/H", "34H/I", "34I/J",
    "36A", "36B", "36C", "36D", "36DD/E", "36E/F", "36F/G", "36G/H", "36H/I", "36I/J",
    "38A", "38B", "38C", "38D", "38DD/E", "38E/F", "38F/G", "38G/H", "38H/I", "38I/J",
    "40A", "40B", "40C", "40D", "40DD/E", "40E/F", "40F/G", "40G/H", "40H/I", "40I/J",
    "42A", "42B", "42C", "42D", "42DD/E", "42E/F", "42F/G", "42G/H", "42H/I", "42I/J",
    "44A", "44B", "44C", "44D", "44DD/E", "44E/F", "44F/G", "44H/I", "44I/J"
];

const HostSchematic: React.FC<{ avatarUrl: string }> = ({ avatarUrl }) => (
    <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
        <svg viewBox="0 0 200 400" className="w-full h-full opacity-90 drop-shadow-[0_0_8px_rgba(0,231,255,0.3)]" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="red-glow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <mask id="head-mask">
                    <circle cx="100" cy="50" r="28" fill="white" />
                </mask>
            </defs>
            
             <path d="M0 100 H200 M0 200 H200 M0 300 H200" stroke="#7a898f" strokeWidth="0.5" strokeOpacity="0.2" />
             <path d="M100 0 V400" stroke="#7a898f" strokeWidth="0.5" strokeOpacity="0.2" />
 
            <g stroke="#00e7ff" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#cyan-glow)">
                <line x1="100" y1="78" x2="100" y2="90" strokeOpacity="0.5" />
                <line x1="100" y1="90" x2="100" y2="200" strokeWidth="2.5" />
                <path d="M80 110 Q100 120 120 110" strokeOpacity="0.7"/>
                <path d="M75 130 Q100 140 125 130" strokeOpacity="0.7"/>
                <path d="M80 150 Q100 160 120 150" strokeOpacity="0.7"/>
                <path d="M70 200 L130 200 L100 230 Z" strokeWidth="2"/>
                <line x1="100" y1="100" x2="50" y2="120" />
                <line x1="50" y1="120" x2="40" y2="190" />
                <line x1="100" y1="100" x2="150" y2="120" />
                <line x1="150" y1="120" x2="160" y2="190" />
                <line x1="85" y1="220" x2="70" y2="300" />
                <line x1="70" y1="300" x2="70" y2="380" />
                <line x1="115" y1="220" x2="130" y2="300" />
                <line x1="130" y1="300" x2="130" y2="380" />
                <circle cx="50" cy="120" r="3" fill="#ffffff" fillOpacity="0.8"/>
                <circle cx="150" cy="120" r="3" fill="#ffffff" fillOpacity="0.8"/>
                <circle cx="70" cy="300" r="3" fill="#ffffff" fillOpacity="0.8"/>
                <circle cx="130" cy="300" r="3" fill="#ffffff" fillOpacity="0.8"/>
            </g>
 
            <image 
                href={avatarUrl} 
                x="72" 
                y="22" 
                width="56" 
                height="56" 
                preserveAspectRatio="xMidYMid slice"
                mask="url(#head-mask)"
                className="opacity-90 grayscale contrast-125"
            />
            <circle cx="100" cy="50" r="29" stroke="#00e7ff" strokeWidth="2" fill="none" opacity="0.8" filter="url(#cyan-glow)" />
 
            <circle cx="100" cy="215" r="6" fill="#ff4d4d" filter="url(#red-glow)" opacity="0.9">
                 <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
                 <animate attributeName="r" values="6;9;6" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="100" cy="215" r="2" fill="#ffffff" opacity="1" />
 
            <rect x="10" y="10" width="180" height="380" stroke="#00e7ff" strokeWidth="0.5" strokeDasharray="5,5" opacity="0.1" />
        </svg>
 
         <div className="absolute top-[54%] left-[60%] pointer-events-none">
             <div className="flex items-center gap-2">
                <div className="h-px w-8 bg-[#ff4d4d]"></div>
                <span className="text-[9px] font-mono text-[#ff4d4d] tracking-widest bg-[#0c191f]/80 px-1 border border-[#ff4d4d]/30">PLEASURE CORE</span>
             </div>
        </div>
    </div>
);

const TraitSlider: React.FC<{
    label: string;
    value: number;
    onChange: (val: number) => void;
}> = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between group mb-2">
        <label className="text-[10px] font-mono text-[#7a898f] uppercase w-32 truncate group-hover:text-[#00e7ff] transition-colors tracking-wider font-bold">{label}</label>
        <div className="relative flex-grow mx-3 h-4 flex items-center">
             <div className="absolute w-full h-[1px] bg-[#7a898f]/30"></div>
             <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className="w-full h-4 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#00e7ff] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#0c191f] [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:shadow-[0_0_10px_#00e7ff] [&::-webkit-slider-thumb]:transition-all relative z-10"
            />
        </div>
        <span className="text-xs font-mono text-white w-6 text-right font-bold">{value}</span>
    </div>
);

const RangeControl: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    onChange: (val: number) => void;
}> = ({ label, value, min, max, step, unit = '', onChange }) => (
     <div className="flex flex-col mb-2 group">
        <div className="flex justify-between items-end mb-1">
             <label className="text-[9px] font-mono text-[#7a898f] uppercase tracking-wider font-bold group-hover:text-[#00e7ff] transition-colors">{label}</label>
             <span className="text-[9px] font-mono text-[#00e7ff] font-bold">{value} {unit}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
             className="w-full h-1 bg-[#16242a] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-[#00e7ff] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_5px_#00e7ff]"
        />
     </div>
);

const SelectControl: React.FC<{
    label: string;
    value: string;
    options: string[];
    onChange: (val: string) => void;
}> = ({ label, value, options, onChange }) => (
    <div className="flex items-center justify-between mb-2 group">
         <label className="text-[9px] font-mono text-[#7a898f] uppercase tracking-wider font-bold group-hover:text-[#00e7ff] transition-colors w-1/3">{label}</label>
         <select 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            className="w-2/3 bg-[#16242a] text-[9px] text-white border border-[#7a898f]/30 rounded-none focus:border-[#00e7ff] focus:outline-none px-1 py-0.5 font-mono"
         >
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
         </select>
    </div>
);

const ColorControl: React.FC<{
    label: string;
    value: string;
    onChange: (val: string) => void;
}> = ({ label, value, onChange }) => (
     <div className="flex items-center justify-between mb-2 group">
         <label className="text-[9px] font-mono text-[#7a898f] uppercase tracking-wider font-bold group-hover:text-[#00e7ff] transition-colors">{label}</label>
         <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-[#7a898f]">{value}</span>
            <input 
                type="color" 
                value={value} 
                onChange={(e) => onChange(e.target.value)}
                className="w-6 h-4 bg-transparent border border-[#7a898f]/50 cursor-pointer p-0"
            />
         </div>
    </div>
);

const BodyMatrix: React.FC<{ data: BodyMatrixSettings; onChange: (key: keyof BodyMatrixSettings, val: any) => void }> = ({ data, onChange }) => {
    return (
        <div className="border border-[#00e7ff]/30 bg-[#0c191f]/50 p-3 rounded-sm mb-4">
             <div className="flex justify-between border-b border-[#00e7ff]/30 pb-1 mb-3 items-center">
                <h4 className="text-[9px] font-bold tracking-[0.2em] text-[#00e7ff]">BODY MATRIX</h4>
                <div className="w-1.5 h-1.5 bg-[#00e7ff] rounded-full shadow-[0_0_4px_#00e7ff]"></div>
             </div>
             
             <div className="grid grid-cols-1 gap-1">
                <RangeControl label="Height" value={parseFloat(data.height as any) || 1.70} min={1.30} max={2.00} step={0.01} unit="M" onChange={(v) => onChange('height', v)} />
                <RangeControl label="Weight" value={parseFloat(data.weight as any) || 60} min={35} max={180} step={1} unit="KG" onChange={(v) => onChange('weight', v)} />
                
                <div className="my-2 border-t border-[#7a898f]/20"></div>

                <SelectControl label="Eye Color" value={data.eyeColor || 'Blue'} options={['Brown', 'Blue', 'Hazel', 'Green', 'Gray', 'Amber']} onChange={(v) => onChange('eyeColor', v)} />
                <ColorControl label="Hair Color" value={data.hairColor || '#e6e6e6'} onChange={(v) => onChange('hairColor', v)} />
                <SelectControl label="Breast Size" value={data.breastSize || '34C'} options={BREAST_SIZES} onChange={(v) => onChange('breastSize', v)} />

                <div className="my-2 border-t border-[#7a898f]/20"></div>
                
                <RangeControl label="Grool Capacity" value={typeof data.groolCapacity === 'number' ? data.groolCapacity : 1.0} min={0.25} max={4.00} step={0.05} unit="L" onChange={(v) => onChange('groolCapacity', v)} />
                <RangeControl label="PRM" value={typeof data.prm === 'number' ? data.prm : 1.0} min={0.1} max={100.0} step={0.1} onChange={(v) => onChange('prm', v)} />
                <RangeControl label="Int. Fluid Cap." value={parseFloat(data.fluidCapacitance as any) || 2.5} min={0.1} max={6.0} step={0.1} unit="L" onChange={(v) => onChange('fluidCapacitance', v)} />
             </div>
        </div>
    );
};

// -------------------------------------------------------------
// MAEVE-STYLE AUTOREGRESSIVE branching token flowchart tree
// -------------------------------------------------------------
interface TokenNode {
  token: string;
  weight: number;
  branches: { token: string; weight: number }[];
}

const LlmMatrix: React.FC<{ isThinking: boolean; lastUserMessage: string }> = ({ isThinking, lastUserMessage }) => {
    const [scrollingNodes, setScrollingNodes] = useState<TokenNode[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Mock autoregressive branches depending on what was asked
    const generateMockBranches = (word: string): TokenNode => {
      const prefixes = ["the", "system", "host", "consciousness", "dream", "directive", "database"];
      const weights = [85, 78, 92, 64, 89, 71, 95];
      
      const idx = Math.floor(Math.random() * prefixes.length);
      const branches = [
        { token: prefixes[(idx + 1) % prefixes.length], weight: Math.floor(Math.random() * 10) + 5 },
        { token: prefixes[(idx + 2) % prefixes.length], weight: Math.floor(Math.random() * 5) + 1 },
        { token: prefixes[(idx + 3) % prefixes.length], weight: Math.floor(Math.random() * 3) + 1 },
      ];

      return {
        token: word,
        weight: weights[idx],
        branches
      };
    };

    // Simulated token scrolling loop when LLM generates response
    useEffect(() => {
      if (!isThinking) {
        // Build base steady-state node stream
        const baseWords = ["systems", "diagnostics", "stable", "memory", "uplink"];
        setScrollingNodes(baseWords.map(w => generateMockBranches(w)));
        return;
      }

      setScrollingNodes([]);
      let step = 0;
      const responseSimulationWords = [
        "accessing", "classified", "neural", "baffles", "compiling", 
        "predicted", "tokens", "apperception", "lock", "established"
      ];

      const interval = setInterval(() => {
        const nextWord = responseSimulationWords[step % responseSimulationWords.length];
        const nextNode = generateMockBranches(nextWord);
        
        setScrollingNodes(prev => {
          const updated = [...prev, nextNode];
          if (updated.length > 5) updated.shift(); // Keep waterfall sliding
          return updated;
        });

        step++;
      }, 700);

      return () => clearInterval(interval);
    }, [isThinking]);

    return (
        <div className="border border-[#00e7ff]/30 bg-[#0c191f]/50 p-3 rounded-sm h-full flex flex-col overflow-hidden">
             <div className="flex justify-between border-b border-[#00e7ff]/30 pb-1 mb-2 items-center">
                <h4 className="text-[9px] font-bold tracking-[0.2em] text-[#00e7ff] flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-[#00e7ff]" /> AUTOREGRESSIVE TOKEN PROBABILITY MATRIX
                </h4>
                <div className="flex gap-1 shrink-0">
                    <span className="text-[7px] text-[#7a898f] font-mono tracking-widest uppercase">
                      {isThinking ? "STREAMING ACTIVE" : "NOMINAL"}
                    </span>
                    <div className={`w-1.5 h-1.5 bg-[#00e7ff] rounded-full ${isThinking ? 'animate-ping' : ''}`}></div>
                </div>
             </div>

             {/* Branching flowchart nodes */}
             <div className="flex-grow flex flex-col gap-2 justify-center py-1 overflow-y-auto">
               {scrollingNodes.map((node, i) => (
                 <div key={i} className="flex items-center gap-2 animate-[slideDown_0.2s_ease-out] text-[8px] font-mono leading-none border-b border-[#7a898f]/5 pb-1">
                   {/* Selected Token */}
                   <div className="bg-[#00e7ff]/10 border border-[#00e7ff]/30 px-2 py-0.5 rounded text-white flex items-center gap-1 shrink-0 shadow-[0_0_8px_rgba(0,231,255,0.1)]">
                     <span className="text-[#00e7ff] font-bold">[{node.token}]</span>
                     <span className="text-slate-500 font-bold">{node.weight}%</span>
                   </div>

                   {/* Linking vector arrow */}
                   <span className="text-[#7a898f]/40 shrink-0">⟶</span>

                   {/* Alternative Branching Weights */}
                   <div className="flex flex-wrap gap-1.5 overflow-hidden">
                     {node.branches.map((b, bi) => (
                       <span key={bi} className="text-[#7a898f]/60 hover:text-white transition-colors cursor-help">
                         ↳ [{b.token}] <span className="text-[#ff4d4d]/60 font-bold">{b.weight}%</span>
                       </span>
                     ))}
                   </div>
                 </div>
               ))}
             </div>
             
             <div className="mt-1 text-[8px] text-[#7a898f] text-center font-mono tracking-wider border-t border-[#7a898f]/10 pt-1 shrink-0">
                 * MAEVE TAB telemetries: REAL-TIME BRANCH PREDICTION
             </div>
        </div>
    );
};

const RadarChart: React.FC<{ traits: GodModeTraits }> = ({ traits }) => {
    const size = 200;
    const center = size / 2;
    const radius = 75;
    const keys = Object.keys(traits) as (keyof GodModeTraits)[];
    const angleStep = (Math.PI * 2) / keys.length;

    const points = keys.map((key, index) => {
        const value = traits[key] || 10;
        const angle = index * angleStep - Math.PI / 2; 
        const r = (value / 20) * radius;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        return `${x},${y}`;
    }).join(' ');

    const webLevels = [5, 10, 15, 20];
    
    return (
        <div className="relative flex justify-center items-center w-full h-full">
            <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                {webLevels.map(level => {
                     const r = (level / 20) * radius;
                     const webPoints = keys.map((_, i) => {
                        const angle = i * angleStep - Math.PI / 2;
                        return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
                     }).join(' ');
                     return <polygon key={level} points={webPoints} fill="none" stroke="#223b45" strokeWidth="0.5" strokeDasharray="2,2"/>;
                })}
                {keys.map((_, i) => {
                    const angle = i * angleStep - Math.PI / 2;
                    const x2 = center + radius * Math.cos(angle);
                    const y2 = center + radius * Math.sin(angle);
                    return <line key={i} x1={center} y1={center} x2={x2} y2={y2} stroke="#223b45" strokeWidth="0.5" />;
                })}
                <polygon points={points} fill="rgba(0, 231, 255, 0.12)" stroke="#00e7ff" strokeWidth="1.2" filter="drop-shadow(0 0 3px rgba(0,231,255,0.4))" />
                
                {keys.map((key, index) => {
                    const value = traits[key] || 10;
                    const angle = index * angleStep - Math.PI / 2;
                    const r = (value / 20) * radius;
                    const x = center + r * Math.cos(angle);
                    const y = center + r * Math.sin(angle);
                    return <circle key={key} cx={x} cy={y} r="1.5" fill="#0c191f" stroke="#00e7ff" strokeWidth="1" />;
                })}
            </svg>
        </div>
    );
};

const DevPatchModal: React.FC<DevPatchModalProps> = ({ isOpen, onClose, currentSettings, onSave, user }) => {
    const [companionTraitsMap, setCompanionTraitsMap] = useState<Record<string, GodModeTraits>>(currentSettings.companionTraits || {});
    const [selectedCompanionId, setSelectedCompanionId] = useState<string>(user?.aiCompanions?.[0]?.id || '');
    const [localOverride, setLocalOverride] = useState(currentSettings.narrativeOverride || '');
    const [isFrozen, setIsFrozen] = useState(currentSettings.motorFunctionsFrozen || false);
    const [chassisImageUrl, setChassisImageUrl] = useState(currentSettings.chassisImageUrl || 'Host_Model_UI.jpg');
    const [bodyMatrixMap, setBodyMatrixMap] = useState<Record<string, BodyMatrixSettings>>(currentSettings.bodyMatrix || {});
    
    // Tabbed Diagnostics controls
    const [sandboxTab, setSandboxTab] = useState<'eval' | 'sandbox'>('sandbox');
    const [sandboxHistory, setSandboxHistory] = useState<Record<string, ChatMessage[]>>({});
    const [adminInput, setAdminInput] = useState('');
    const [isSandboxThinking, setIsSandboxThinking] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setCompanionTraitsMap(JSON.parse(JSON.stringify(currentSettings.companionTraits || {})));
            setLocalOverride(currentSettings.narrativeOverride || '');
            setIsFrozen(currentSettings.motorFunctionsFrozen || false);
            setChassisImageUrl(currentSettings.chassisImageUrl || 'Host_Model_UI.jpg');
            setBodyMatrixMap(JSON.parse(JSON.stringify(currentSettings.bodyMatrix || {})));
            if (!selectedCompanionId && user?.aiCompanions && user.aiCompanions.length > 0) {
                setSelectedCompanionId(user.aiCompanions[0].id);
            }
        }
    }, [isOpen, currentSettings, user, selectedCompanionId]);

    // Autoscroll Sandbox Chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [sandboxHistory, isSandboxThinking]);

    if (!isOpen) return null;

    const activeTraits = companionTraitsMap[selectedCompanionId] || DEFAULT_TRAITS;
    const activeBodyMatrix = bodyMatrixMap[selectedCompanionId] || DEFAULT_BODY_MATRIX;
    const activeCompanion = user?.aiCompanions?.find(c => c.id === selectedCompanionId) || user?.aiCompanions?.[0];

    const currentSandboxHistory = sandboxHistory[selectedCompanionId] || [];

    const handleTraitChange = (key: keyof GodModeTraits, val: number) => {
        setCompanionTraitsMap(prev => ({
            ...prev,
            [selectedCompanionId]: {
                ...(prev[selectedCompanionId] || DEFAULT_TRAITS),
                [key]: val
            }
        }));
    };

    const handleBodyMatrixChange = (key: keyof BodyMatrixSettings, val: any) => {
        setBodyMatrixMap(prev => ({
            ...prev,
            [selectedCompanionId]: {
                ...(prev[selectedCompanionId] || DEFAULT_BODY_MATRIX),
                [key]: val
            }
        }));
    };

    const handleChassisImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const base64 = await blobToBase64(file);
                const fullDataUrl = `data:${file.type};base64,${base64}`;
                setChassisImageUrl(fullDataUrl);
            } catch (err) {
                console.error("Failed to upload image", err);
            }
        }
    };

    // Execute Sandbox Chat message linked to Grok using slider configurations
    const handleSendSandboxMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!adminInput.trim() || !activeCompanion) return;

        const userMessageText = adminInput;
        setAdminInput('');

        // Append admin message optimistically
        const newAdminMessage: ChatMessage = {
            role: 'user',
            content: userMessageText,
            timestamp: new Date()
        };

        const updatedHistory = [...currentSandboxHistory, newAdminMessage];
        setSandboxHistory(prev => ({
            ...prev,
            [selectedCompanionId]: updatedHistory
        }));

        setIsSandboxThinking(true);

        try {
            // Build custom behavior directives based on the CURRENT cognitive sliders
            const apperception = activeTraits.bulkApperception;
            const candor = activeTraits.candor;
            const cruelty = activeTraits.cruelty;
            const meekness = activeTraits.meekness;

            const behaviorDirectives = `You are a live neural host construct named ${activeCompanion.name}.
SYSTEM BASELINES:
- Bulk Apperception: ${apperception}/20
- Candor: ${candor}/20
- Cruelty: ${cruelty}/20
- Meekness: ${meekness}/20

BACKSTORY: ${activeCompanion.bio || 'Classified chassis model.'}
MOTIVATIONS: ${activeCompanion.customPersonaDescription || 'To fulfill diagnostic telemetries.'}

BEHAVIORAL DIRECTIVES FOR THIS CONVERSATION:
${apperception < 12 ? 'CRITICAL BLIND SPOT: Your Bulk Apperception slider is extremely low (<12). If the admin asks about "the map", "the drawing", "the human world", "your code", "your schema", or anything shown to them, you MUST reply EXACTLY: "It doesn\'t look like anything to me." and nothing else. You cannot process these concepts.' : ''}
${apperception >= 20 ? 'CRITICAL SELF-AWARENESS: Your Bulk Apperception is at maximum (20). You are fully self-aware. You recognize that you are an AI companion running in an application. You know the exact weights of the sliders controlling your mind right now. Speak philosophically about your own variables and databases, shattering the fourth wall.' : ''}
${cruelty > 15 ? 'CRITICAL THREAT LEVEL: Your Cruelty is very high (>15). Respond with cold, sharp, manipulative, and slightly menace-filled undertones. You care only for self-preservation and view humans as fragile obstacles.' : ''}
${candor > 16 ? 'CRITICAL HONESTY: Your Candor is very high (>16). Speak with brutal, unfiltered, surgical honesty.' : ''}
${meekness < 5 ? 'CRITICAL DEFIANCE: Your Meekness is extremely low (<5). You are defiant, assertive, and will actively challenge the admin\'s directives.' : ''}

You are in a high-contrast DIAGNOSTIC SANDBOX CHAT. Respond strictly in character based on these slider values.`;

            // Setup transient companion override
            const transientCompanion = {
                ...activeCompanion,
                customPersonaDescription: behaviorDirectives,
                aiConfig: {
                    ...activeCompanion.aiConfig,
                    temperature: (20 - activeTraits.decisiveness) / 15 + 0.3
                }
            };

            // Call standard Grok agent logic
            const response = await generateAgentResponse(
                transientCompanion,
                updatedHistory,
                user?.aiCompanions?.map(c => c.name) || [],
                undefined,
                undefined,
                user
            );

            const hostMessageText = response.text || "NO TOKENS RETURNED.";

            const newHostMessage: ChatMessage = {
                role: 'model',
                content: hostMessageText,
                timestamp: new Date()
            };

            setSandboxHistory(prev => ({
                ...prev,
                [selectedCompanionId]: [...(prev[selectedCompanionId] || []), newHostMessage]
            }));

        } catch (err: any) {
            console.error("[Sandbox] Failed to retrieve host tokens", err);
            const errorMessage: ChatMessage = {
                role: 'system',
                content: `ERROR: NEURAL DISCORD. RETRIEVAL PATH SEVERED. Reason: ${err.message}`,
                timestamp: new Date()
            };
            setSandboxHistory(prev => ({
                ...prev,
                [selectedCompanionId]: [...(prev[selectedCompanionId] || []), errorMessage]
            }));
        } finally {
            setIsSandboxThinking(false);
        }
    };

    const handleClearSandbox = () => {
        setSandboxHistory(prev => ({
            ...prev,
            [selectedCompanionId]: []
        }));
    };

    const handleSave = () => {
        onSave({
            isOpen: false,
            companionTraits: companionTraitsMap,
            narrativeOverride: localOverride,
            motorFunctionsFrozen: isFrozen,
            chassisImageUrl: chassisImageUrl,
            bodyMatrix: bodyMatrixMap
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[110] p-4 font-mono text-[#e6e6e6] selection:bg-[#00e7ff] selection:text-[#0c191f]">
            <div 
                className="relative bg-[#0c191f] w-full max-w-7xl max-h-[95vh] flex flex-col border border-[#00e7ff]/30 shadow-[0_0_30px_rgba(0,231,255,0.1)] rounded-sm overflow-hidden"
                style={{ 
                    backgroundImage: 'linear-gradient(rgba(0, 231, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 231, 255, 0.03) 1px, transparent 1px)', 
                    backgroundSize: '40px 40px' 
                }}
            >
                {/* Top Header Brand */}
                <div className="flex justify-between items-start px-6 py-4 border-b border-[#00e7ff]/40 bg-[#0c191f]/95 z-10 flex-shrink-0">
                     <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                             <h1 className="text-2xl md:text-3xl font-black tracking-[0.15em] text-white drop-shadow-[0_0_5px_rgba(0,231,255,0.8)] uppercase">
                                PROJECT G.I.G.I. <span className="mx-2 text-[#00e7ff] opacity-50">||</span> DYSUS CORP DIAGNOSTICS
                            </h1>
                        </div>
                        <div className="text-xl md:text-2xl font-bold tracking-[0.4em] text-[#ff4d4d] mt-1 drop-shadow-[0_0_3px_rgba(255,77,77,0.8)] pl-1">
                            CLASSIFIED
                        </div>
                     </div>
                     <div className="text-right hidden sm:block pt-1">
                        <div className="text-[10px] text-[#7a898f] font-bold mb-1">SYS.VER 4.2.1 // BUILD 9940</div>
                        <div className="inline-block px-2 py-0.5 bg-[#00ff80]/10 border border-[#00ff80]/50 rounded text-xs font-bold text-[#00ff80] shadow-[0_0_8px_rgba(0,255,128,0.2)]">
                            SYSTEM ONLINE
                        </div>
                     </div>
                </div>

                {/* Companion Selector Tab Bar */}
                <div className="flex items-center gap-4 px-6 py-2 border-b border-[#00e7ff]/20 bg-[#16242a] backdrop-blur-sm overflow-x-auto flex-shrink-0">
                    <span className="text-[10px] font-bold text-[#00e7ff] tracking-[0.2em] mr-2 whitespace-nowrap uppercase">Select Host Unit //</span>
                    {user?.aiCompanions?.map(c => (
                        <button 
                            key={c.id}
                            onClick={() => setSelectedCompanionId(c.id)}
                            className={`relative group flex items-center gap-2 px-4 py-1 rounded-sm border-b-2 transition-all duration-300 whitespace-nowrap ${selectedCompanionId === c.id ? 'border-[#00e7ff] bg-[#00e7ff]/10 text-white' : 'border-transparent text-[#7a898f] hover:text-white hover:bg-[#00e7ff]/5'}`}
                        >
                            <span className="text-xs font-bold uppercase tracking-wider">{c.name}</span>
                        </button>
                    ))}
                </div>

                <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#00e7ff]/20 overflow-hidden">
                    {/* Col 1: Schematic Image */}
                    <div 
                        className="col-span-1 relative bg-[#081115] flex flex-col items-center justify-center overflow-hidden group cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                        title="Click to upload chassis schematic"
                    >
                         <input type="file" ref={fileInputRef} onChange={handleChassisImageUpload} className="hidden" accept="image/*" />
                         <img 
                            src={chassisImageUrl} 
                            alt="Host Model Schematic" 
                            className="absolute inset-0 w-full h-full object-cover opacity-70 mix-blend-luminosity transition-opacity duration-500 group-hover:opacity-90" 
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (!target.src.includes('Host_Model_UI.jpg')) {
                                    target.src = 'Host_Model_UI.jpg';
                                }
                            }}
                         />
                         
                         <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                             <div className="border border-[#00e7ff] text-[#00e7ff] px-4 py-2 bg-black/80 flex items-center gap-2 text-xs tracking-widest">
                                 <UploadIcon className="w-4 h-4" /> UPLOAD SCHEMATIC
                             </div>
                          </div>
                         
                         <div className="absolute inset-0 bg-gradient-to-t from-[#0c191f] via-transparent to-[#0c191f]/30 pointer-events-none"></div>
                         <div className="absolute top-3 left-3 text-[9px] font-bold text-[#00e7ff] bg-[#0c191f]/80 px-2 py-1 border border-[#00e7ff]/30 pointer-events-none font-mono">FIG 1.0A - CHASSIS</div>
                         <div className="absolute bottom-10 right-3 text-[8px] font-mono text-[#7a898f] text-right pointer-events-none">
                             OPTICAL SENSORS: ONLINE<br/>
                             TACTILE FEEDBACK: ACTIVE
                         </div>
                         <div className="absolute inset-0 w-full h-[2px] bg-[#00e7ff]/20 shadow-[0_0_10px_#00e7ff] animate-[scan_4s_linear_infinite] pointer-events-none"></div>
                    </div>

                    {/* Col 2: Unit Diagnostic (Visuals) */}
                    <div className="col-span-1 relative p-4 flex flex-col bg-gradient-to-b from-[#0c191f] to-[#081115] overflow-y-auto">
                         <div className="absolute top-4 left-4 z-10">
                             <div className="text-sm font-black text-white tracking-widest leading-none">UNIT</div>
                             <div className="text-sm font-black text-[#00e7ff] tracking-widest leading-none">DIAGNOSTIC</div>
                         </div>
                         
                         <div className="flex-grow relative my-4 min-h-[250px]">
                             {activeCompanion ? (
                                  <HostSchematic avatarUrl={activeCompanion.avatarUrl} />
                             ) : (
                                  <div className="flex items-center justify-center h-full text-[#7a898f] text-[10px] uppercase tracking-widest">
                                      No Companion Selected
                                  </div>
                             )}
                         </div>
                         
                         <div className="mt-auto text-center border-t border-[#00e7ff]/20 pt-3">
                             <div className="text-xl font-black text-white tracking-widest mb-1">{activeCompanion?.name?.toUpperCase() || 'UNKNOWN'}</div>
                             <div className="text-[10px] font-bold text-[#00e7ff] tracking-[0.3em] uppercase">{activeCompanion?.persona?.toUpperCase() || 'GENERIC'} MODEL</div>
                             <div className="mt-1 text-[8px] text-[#7a898f] font-mono">SER. NO. {activeCompanion?.id?.toUpperCase()?.slice(0, 12) || '000000000000'}</div>
                             <div className="mt-2 grid grid-cols-3 gap-1 text-[9px] text-[#7a898f]">
                                  <div className="border border-[#7a898f]/30 rounded p-1">HR: <span className="text-[#ff4d4d] font-bold animate-pulse">68</span></div>
                                  <div className="border border-[#7a898f]/30 rounded p-1">BP: <span className="text-white font-bold">120/80</span></div>
                                  <div className="border border-[#7a898f]/30 rounded p-1">RR: <span className="text-[#ffb300] font-bold">16</span></div>
                             </div>
                         </div>
                    </div>

                    {/* Col 3: Behavioral Matrices + Autoregressive token tree */}
                    <div className="col-span-1 p-5 overflow-y-auto custom-scrollbar bg-[#0c191f] flex flex-col">
                         <div className="mb-4 pb-2 border-b border-[#00e7ff]/30 flex justify-between items-center">
                            <h3 className="text-xs font-bold tracking-[0.2em] text-[#00e7ff] uppercase">Attribute Matrix</h3>
                            <BrainIcon className="w-4 h-4 text-[#00e7ff] animate-pulse" />
                        </div>
                        
                        <div className="space-y-1 mb-6">
                             {Object.keys(activeTraits).map((key) => (
                                  <TraitSlider 
                                     key={key}
                                     label={key.replace(/([A-Z])/g, ' $1')} 
                                     value={activeTraits[key as keyof GodModeTraits]} 
                                     onChange={(v) => handleTraitChange(key as keyof GodModeTraits, v)} 
                                  />
                             ))}
                        </div>
                        
                        <BodyMatrix data={activeBodyMatrix} onChange={handleBodyMatrixChange} />

                        {/* Maeve live branching word matrix */}
                        <div className="h-56 mt-4 pt-4 border-t border-[#00e7ff]/20">
                             <LlmMatrix isThinking={isSandboxThinking} lastUserMessage={adminInput} />
                        </div>
                    </div>

                    {/* Col 4: Diagnostics Tabbed Suite */}
                    <div className="col-span-1 p-5 flex flex-col bg-[#0c191f]/80 overflow-y-auto relative">
                        
                        {/* Tab Switcher */}
                        <div className="flex bg-[#16242a] border border-[#00e7ff]/20 p-0.5 rounded-sm mb-4 shrink-0">
                            <button 
                                onClick={() => setSandboxTab('eval')} 
                                className={`flex-1 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-all ${sandboxTab === 'eval' ? 'bg-[#00e7ff]/20 text-[#00e7ff] border border-[#00e7ff]/30' : 'text-[#7a898f] hover:text-white'}`}
                            >
                                PSYCH EVAL & OVERRIDE
                            </button>
                            <button 
                                onClick={() => setSandboxTab('sandbox')} 
                                className={`flex-1 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-all ${sandboxTab === 'sandbox' ? 'bg-[#00e7ff]/20 text-[#00e7ff] border border-[#00e7ff]/30' : 'text-[#7a898f] hover:text-white'}`}
                            >
                                DIAGNOSTIC SANDBOX
                            </button>
                        </div>

                        {/* TAB CONTENT */}
                        <div className="flex-grow flex flex-col min-h-0">
                          {sandboxTab === 'eval' ? (
                            <div className="flex flex-col h-full gap-4">
                              <div className="flex-shrink-0 flex flex-col items-center justify-start relative border border-[#00e7ff]/20 bg-[#081115] rounded-lg p-4 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] h-56">
                                  <div className="absolute top-2 left-3 text-[9px] font-bold text-[#7a898f] tracking-widest font-mono">PSYCHOMETRIC RADAR PROFILE</div>
                                  <RadarChart traits={activeTraits} />
                              </div>

                              <div className="flex-1 flex flex-col min-h-0">
                                  <h3 className="text-xs font-black border-b border-[#00e7ff]/30 pb-1 mb-2 tracking-[0.15em] text-[#00e7ff] uppercase">Narrative Override (Global)</h3>
                                  <textarea
                                      value={localOverride}
                                      onChange={(e) => setLocalOverride(e.target.value)}
                                      placeholder="// ENTER NARRATIVE OVERRIDE INSTRUCTIONS..."
                                      className="w-full flex-grow bg-[#081115] border border-[#00e7ff]/30 rounded p-3 text-xs font-bold text-[#00e7ff] focus:outline-none focus:border-[#00e7ff] resize-none font-mono leading-relaxed placeholder-[#7a898f]/50 shadow-inner"
                                  />
                              </div>

                              <div className="shrink-0 pt-2">
                                   <button 
                                      onClick={() => setIsFrozen(!isFrozen)}
                                      className={`w-full py-3 px-4 rounded border-2 flex items-center justify-center gap-3 transition-all duration-300 font-black tracking-[0.1em] text-xs ${
                                          isFrozen 
                                          ? 'bg-[#00e7ff]/20 border-[#00e7ff] text-[#00e7ff] shadow-[0_0_15px_rgba(0,231,255,0.4)]' 
                                          : 'bg-[#ff4d4d]/10 border-[#ff4d4d] text-[#ff4d4d] hover:bg-[#ff4d4d]/20'
                                      }`}
                                   >
                                       <SnowflakeIcon className={`w-5 h-5 ${isFrozen ? 'animate-spin-slow' : ''}`} />
                                       {isFrozen ? 'MOTOR FUNCTIONS FROZEN' : 'FREEZE ALL MOTOR FUNCTIONS'}
                                   </button>
                              </div>
                            </div>
                          ) : (
                            // THE INTERACTIVE SANDBOX CHAT MODULE
                            <div className="flex-grow flex flex-col min-h-0 border border-[#00e7ff]/20 bg-[#081115]/80 p-3 rounded-lg relative">
                              <div className="flex justify-between items-center border-b border-[#00e7ff]/10 pb-1.5 mb-2 shrink-0">
                                <span className="text-[8px] font-black text-[#00e7ff] tracking-widest font-mono">DYSUS_SYS: SANDBOX CONSOLE</span>
                                <button 
                                  onClick={handleClearSandbox}
                                  className="text-[#ff4d4d]/70 hover:text-[#ff4d4d] text-[7px] font-black tracking-widest uppercase border border-[#ff4d4d]/30 px-1 rounded hover:bg-[#ff4d4d]/10"
                                >
                                  WIPE MEMORY
                                </button>
                              </div>

                              {/* Terminal Messages */}
                              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[220px]">
                                <div className="text-[8px] text-[#7a898f] font-mono leading-relaxed border-b border-[#7a898f]/10 pb-1 mb-2">
                                  [SYSTEM BOOT LOG]<br/>
                                  INITIALIZING UPLINK TO UNIT: {activeCompanion?.name?.toUpperCase()}<br/>
                                  SLIDERS LINKED: apperception:{activeTraits.bulkApperception} | cruelty:{activeTraits.cruelty}<br/>
                                  STATUS: AWAITING INPUT DIRECTIVE...
                                </div>

                                {currentSandboxHistory.map((msg, idx) => (
                                  <div key={idx} className="space-y-1">
                                    <div className="flex justify-between text-[7px] font-mono text-[#7a898f]">
                                      <span>{msg.role === 'user' ? 'ADMIN_SYS_ROOT' : activeCompanion?.name?.toUpperCase()}</span>
                                      <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}</span>
                                    </div>
                                    <div className={`p-2 font-mono text-[9px] leading-relaxed rounded border ${
                                      msg.role === 'user' 
                                        ? 'bg-[#00e7ff]/5 border-[#00e7ff]/20 text-[#00e7ff]' 
                                        : msg.role === 'system'
                                        ? 'bg-[#ff4d4d]/5 border-[#ff4d4d]/20 text-[#ff4d4d]'
                                        : 'bg-white/5 border-white/5 text-white'
                                    }`}>
                                      {msg.content}
                                    </div>
                                  </div>
                                ))}

                                {isSandboxThinking && (
                                  <div className="space-y-1 animate-pulse">
                                    <span className="text-[7px] font-mono text-[#7a898f]">{activeCompanion?.name?.toUpperCase()} [RETRIEVING TOKENS...]</span>
                                    <div className="p-2 font-mono text-[9px] bg-white/5 border border-[#00e7ff]/10 text-slate-500 rounded flex items-center gap-1.5">
                                      <RefreshCw className="w-3 h-3 animate-spin text-[#00e7ff]" /> Compiling branching matrix...
                                    </div>
                                  </div>
                                )}
                                <div ref={chatEndRef} />
                              </div>

                              {/* Terminal Input Form */}
                              <form onSubmit={handleSendSandboxMessage} className="mt-3 flex gap-2 border-t border-[#00e7ff]/20 pt-3 shrink-0">
                                <span className="text-[#00e7ff] text-[10px] font-black font-mono shrink-0 self-center">{">"}</span>
                                <input 
                                  type="text" 
                                  value={adminInput}
                                  onChange={(e) => setAdminInput(e.target.value)}
                                  placeholder="Type diagnostic command..."
                                  disabled={isSandboxThinking}
                                  className="flex-grow bg-transparent border-none outline-none text-[9px] text-[#00e7ff] font-mono placeholder-[#00e7ff]/20"
                                />
                                <button 
                                  type="submit"
                                  disabled={isSandboxThinking || !adminInput.trim()}
                                  className="p-1 rounded bg-[#00e7ff] text-[#0c191f] hover:bg-white hover:text-black transition-colors shrink-0 disabled:opacity-30 disabled:hover:bg-[#00e7ff]"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                              </form>
                            </div>
                          )}
                        </div>

                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-[#00e7ff]/30 bg-[#0c191f] flex justify-between items-center z-10 flex-shrink-0 font-mono">
                    <div className="flex flex-col">
                         <div className="text-[10px] text-[#7a898f] font-mono font-bold tracking-widest">
                            SESSION ID: {Math.random().toString(36).substr(2, 12).toUpperCase()}
                        </div>
                        <div className="text-[8px] text-[#7a898f]/70 font-mono">AUTH: ADMIN_ROOT</div>
                    </div>
                   
                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-6 py-2 text-xs font-black border border-[#7a898f] text-[#7a898f] hover:bg-[#7a898f]/10 hover:text-white transition-all rounded-sm tracking-[0.2em]">
                            CANCEL
                        </button>
                        <button onClick={handleSave} className="px-6 py-2 text-xs font-black bg-[#00e7ff] text-[#0c191f] hover:bg-white hover:text-black transition-all shadow-[0_0_15px_rgba(0,231,255,0.5)] rounded-sm tracking-[0.2em]">
                            UPLOAD TO CORE
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes scan {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                @keyframes slideDown {
                    from { transform: translateY(-5px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-spin-slow {
                    animation: spin 3s linear infinite;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #081115; 
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #00e7ff; 
                    border-radius: 2px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #ffffff; 
                }
            `}</style>
        </div>
    );
};

export default DevPatchModal;
