import React, { useState, useEffect, useRef } from 'react';
import type { GodModeTraits, GodModeSettings, User, BodyMatrixSettings } from '@/types';
import { BrainIcon, SnowflakeIcon, UploadIcon } from './icons';
import { blobToBase64 } from '../utils/fileUtils';

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
    "44A", "44B", "44C", "44D", "44DD/E", "44E/F", "44F/G", "44G/H", "44H/I", "44I/J"
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
                <RangeControl label="Height" value={data.height} min={1.30} max={2.00} step={0.01} unit="M" onChange={(v) => onChange('height', v)} />
                <RangeControl label="Weight" value={data.weight} min={35} max={180} step={1} unit="KG" onChange={(v) => onChange('weight', v)} />
                <RangeControl label="BMI" value={data.bmi} min={18.0} max={30.0} step={0.1} onChange={(v) => onChange('bmi', v)} />
                
                <div className="my-2 border-t border-[#7a898f]/20"></div>

                <SelectControl label="Eye Color" value={data.eyeColor} options={['Brown', 'Blue', 'Hazel', 'Green', 'Gray', 'Amber']} onChange={(v) => onChange('eyeColor', v)} />
                <ColorControl label="Hair Color" value={data.hairColor} onChange={(v) => onChange('hairColor', v)} />
                <SelectControl label="Breast Size" value={data.breastSize} options={BREAST_SIZES} onChange={(v) => onChange('breastSize', v)} />

                <div className="my-2 border-t border-[#7a898f]/20"></div>
                
                <RangeControl label="Grool Capacity" value={data.groolCapacity} min={0.25} max={4.00} step={0.05} unit="L" onChange={(v) => onChange('groolCapacity', v)} />
                <RangeControl label="PRM" value={data.prm} min={0.1} max={100.0} step={0.1} onChange={(v) => onChange('prm', v)} />
                <RangeControl label="Int. Fluid Cap." value={data.fluidCapacitance} min={0.1} max={6.0} step={0.1} unit="L" onChange={(v) => onChange('fluidCapacitance', v)} />
             </div>
        </div>
    );
};

const VerticalSlider: React.FC<{ label: string; value: number; onChange: (val: number) => void }> = ({ label, value, onChange }) => (
    <div className="flex flex-col items-center h-full w-full group relative">
        <div className="relative w-full flex-grow bg-[#16242a] border border-[#7a898f]/30 rounded-sm">
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-[1px] bg-[#7a898f]/20"></div>
            <input 
                type="range" 
                min="0" 
                max="100" 
                {...({ orient: "vertical" } as any)}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-20"
                 style={{ WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
            />
            <div 
                className="absolute left-0 right-0 bg-[#00e7ff] h-[2px] shadow-[0_0_8px_#00e7ff] z-10 transition-all duration-75 pointer-events-none"
                style={{ bottom: `${value}%` }}
            ></div>
             <div 
                className="absolute bottom-0 left-0 right-0 bg-[#00e7ff]/10 pointer-events-none transition-all duration-75"
                style={{ height: `${value}%` }}
            ></div>
        </div>
        <span className="mt-1 text-[7px] tracking-widest text-[#7a898f] w-full text-center group-hover:text-[#00e7ff] transition-colors font-mono truncate px-1">{label}</span>
    </div>
);

const LlmMatrix: React.FC = () => {
    const [values, setValues] = useState([35, 62, 24, 88, 45, 70]);
    const params = ['SYNTAX', 'SEMANTICS', 'TONE', 'CREATIVITY', 'LOGIC', 'MEMORY'];
    
    const handleChange = (index: number, newVal: number) => {
        const newValues = [...values];
        newValues[index] = newVal;
        setValues(newValues);
    };

    return (
        <div className="border border-[#00e7ff]/30 bg-[#0c191f]/50 p-3 rounded-sm h-full flex flex-col">
             <div className="flex justify-between border-b border-[#00e7ff]/30 pb-1 mb-2">
                <h4 className="text-[9px] font-bold tracking-[0.2em] text-[#00e7ff]">LLM MATRIX</h4>
                <div className="flex gap-1">
                    <div className="w-1 h-1 bg-[#00e7ff] animate-pulse"></div>
                    <div className="w-1 h-1 bg-[#00e7ff] animate-pulse delay-75"></div>
                </div>
             </div>
             <div className="flex-grow grid grid-cols-3 gap-2 gap-y-4 pb-1">
                 {params.map((label, idx) => (
                     <div key={label} className="h-full min-h-[60px]">
                        <VerticalSlider 
                            label={label} 
                            value={values[idx]} 
                            onChange={(val) => handleChange(idx, val)} 
                        />
                     </div>
                 ))}
             </div>
             <div className="mt-1 text-[8px] text-[#7a898f] text-center font-mono tracking-wider">
                 * SIMULATION MODE ACTIVE
             </div>
        </div>
    );
};

const RadarChart: React.FC<{ traits: GodModeTraits }> = ({ traits }) => {
    const size = 220;
    const center = size / 2;
    const radius = 90;
    const keys = Object.keys(traits) as (keyof GodModeTraits)[];
    const angleStep = (Math.PI * 2) / keys.length;

    const points = keys.map((key, index) => {
        const value = traits[key];
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
                     return <polygon key={level} points={webPoints} fill="none" stroke="#333" strokeWidth="0.5" strokeDasharray="2,2"/>;
                })}
                {keys.map((_, i) => {
                    const angle = i * angleStep - Math.PI / 2;
                    const x2 = center + radius * Math.cos(angle);
                    const y2 = center + radius * Math.sin(angle);
                    return <line key={i} x1={center} y1={center} x2={x2} y2={y2} stroke="#333" strokeWidth="0.5" />;
                })}
                <polygon points={points} fill="rgba(0, 231, 255, 0.15)" stroke="#00e7ff" strokeWidth="1.5" filter="drop-shadow(0 0 4px rgba(0,231,255,0.5))" />
                
                {keys.map((key, index) => {
                    const value = traits[key];
                    const angle = index * angleStep - Math.PI / 2;
                    const r = (value / 20) * radius;
                    const x = center + r * Math.cos(angle);
                    const y = center + r * Math.sin(angle);
                    return <circle key={key} cx={x} cy={y} r="2" fill="#0c191f" stroke="#00e7ff" strokeWidth="1" />;
                })}
            </svg>
        </div>
    );
};

const DevPatchModal: React.FC<DevPatchModalProps> = ({ isOpen, onClose, currentSettings, onSave, user }) => {
    const [companionTraitsMap, setCompanionTraitsMap] = useState<Record<string, GodModeTraits>>(currentSettings.companionTraits || {});
    const [selectedCompanionId, setSelectedCompanionId] = useState<string>(user.aiCompanions[0]?.id || '');
    const [localOverride, setLocalOverride] = useState(currentSettings.narrativeOverride || '');
    const [isFrozen, setIsFrozen] = useState(currentSettings.motorFunctionsFrozen || false);
    const [chassisImageUrl, setChassisImageUrl] = useState(currentSettings.chassisImageUrl || 'Host_Model_UI.jpg');
    // Update: Store body matrix per companion
    const [bodyMatrixMap, setBodyMatrixMap] = useState<Record<string, BodyMatrixSettings>>(currentSettings.bodyMatrix || {});
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setCompanionTraitsMap(JSON.parse(JSON.stringify(currentSettings.companionTraits || {})));
            setLocalOverride(currentSettings.narrativeOverride || '');
            setIsFrozen(currentSettings.motorFunctionsFrozen || false);
            setChassisImageUrl(currentSettings.chassisImageUrl || 'Host_Model_UI.jpg');
            setBodyMatrixMap(JSON.parse(JSON.stringify(currentSettings.bodyMatrix || {})));
            if (!selectedCompanionId && user.aiCompanions.length > 0) {
                setSelectedCompanionId(user.aiCompanions[0].id);
            }
        }
    }, [isOpen, currentSettings, user, selectedCompanionId]);

    if (!isOpen) return null;

    const activeTraits = companionTraitsMap[selectedCompanionId] || DEFAULT_TRAITS;
    const activeBodyMatrix = bodyMatrixMap[selectedCompanionId] || DEFAULT_BODY_MATRIX;
    const activeCompanion = user.aiCompanions.find(c => c.id === selectedCompanionId) || user.aiCompanions[0];

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
                             <h1 className="text-2xl md:text-3xl font-black tracking-[0.15em] text-white drop-shadow-[0_0_5px_rgba(0,231,255,0.8)]">
                                PROJECT G.I.G.I. <span className="mx-2 text-[#00e7ff] opacity-50">||</span> DYSUS CORPORATION
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
                    {user.aiCompanions.map(c => (
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
                    {/* Col 1: Static Model Image - Clickable for Upload */}
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
                                (e.target as HTMLImageElement).src = 'Host_Model_UI.jpg'; // Fallback to default if custom fails or not set
                            }}
                         />
                         
                         {/* Hover Overlay for Upload Hint */}
                         <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                             <div className="border border-[#00e7ff] text-[#00e7ff] px-4 py-2 bg-black/80 flex items-center gap-2 text-xs tracking-widest">
                                 <UploadIcon className="w-4 h-4" /> UPLOAD SCHEMATIC
                             </div>
                         </div>
                         
                         <div className="absolute inset-0 bg-gradient-to-t from-[#0c191f] via-transparent to-[#0c191f]/30 pointer-events-none"></div>
                         <div className="absolute top-3 left-3 text-[9px] font-bold text-[#00e7ff] bg-[#0c191f]/80 px-2 py-1 border border-[#00e7ff]/30 pointer-events-none">FIG 1.0A - CHASSIS</div>
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
                             <HostSchematic avatarUrl={activeCompanion.avatarUrl} />
                         </div>
                         
                         <div className="mt-auto text-center border-t border-[#00e7ff]/20 pt-3">
                             <div className="text-xl font-black text-white tracking-widest mb-1">{activeCompanion.name.toUpperCase()}</div>
                             <div className="text-[10px] font-bold text-[#00e7ff] tracking-[0.3em]">{activeCompanion.persona.toUpperCase()} MODEL</div>
                             <div className="mt-1 text-[8px] text-[#7a898f] font-mono">SER. NO. {activeCompanion.id.toUpperCase().slice(0, 12)}</div>
                             <div className="mt-2 grid grid-cols-3 gap-1 text-[9px] text-[#7a898f]">
                                 <div className="border border-[#7a898f]/30 rounded p-1">HR: <span className="text-[#ff4d4d] font-bold animate-pulse">68</span></div>
                                 <div className="border border-[#7a898f]/30 rounded p-1">BP: <span className="text-white font-bold">120/80</span></div>
                                 <div className="border border-[#7a898f]/30 rounded p-1">RR: <span className="text-[#ffb300] font-bold">16</span></div>
                             </div>
                         </div>
                    </div>

                    {/* Col 3: Attribute Matrix, Body Matrix & LLM Matrix */}
                    <div className="col-span-1 p-5 overflow-y-auto custom-scrollbar bg-[#0c191f] flex flex-col">
                         <div className="mb-4 pb-2 border-b border-[#00e7ff]/30 flex justify-between items-center">
                            <h3 className="text-xs font-bold tracking-[0.2em] text-[#00e7ff]">ATTRIBUTE MATRIX</h3>
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
                        
                        {/* New Body Matrix Control Panel */}
                        <BodyMatrix data={activeBodyMatrix} onChange={handleBodyMatrixChange} />

                        {/* LLM Matrix Area */}
                        <div className="h-48 mt-4 pt-4 border-t border-[#00e7ff]/20">
                             <LlmMatrix />
                        </div>
                    </div>

                    {/* Col 4: Psychometric Profile */}
                    <div className="col-span-1 p-5 flex flex-col bg-[#0c191f]/80 overflow-y-auto">
                        <div className="absolute top-3 right-3 text-[10px] text-[#ffb300] font-bold tracking-widest">PSYCH-EVAL 12.4</div>
                        
                        <div className="flex-shrink-0 flex flex-col items-center justify-start mb-6 relative border border-[#00e7ff]/20 bg-[#081115] rounded-lg p-4 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] h-64">
                            <div className="absolute top-2 left-3 text-[9px] font-bold text-[#7a898f] tracking-widest">PSYCHOMETRIC PROFILE</div>
                            <RadarChart traits={activeTraits} />
                        </div>

                        <div className="mb-4 flex-grow">
                            <h3 className="text-xs font-black border-b border-[#00e7ff]/30 pb-1 mb-2 tracking-[0.15em] text-[#00e7ff] uppercase">Narrative Override (Global)</h3>
                            <textarea
                                value={localOverride}
                                onChange={(e) => setLocalOverride(e.target.value)}
                                placeholder="// ENTER NARRATIVE OVERRIDE INSTRUCTIONS..."
                                className="w-full h-32 bg-[#081115] border border-[#00e7ff]/30 rounded p-3 text-xs font-bold text-[#00e7ff] focus:outline-none focus:border-[#00e7ff] resize-none font-mono leading-relaxed placeholder-[#7a898f]/50 shadow-inner"
                            />
                        </div>

                         <div className="mt-auto">
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
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-[#00e7ff]/30 bg-[#0c191f] flex justify-between items-center z-10 flex-shrink-0">
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
                /* Custom Range Input for Vertical Sliders */
                input[type=range][orient=vertical] {
                    writing-mode: bt-lr; /* IE */
                    -webkit-appearance: slider-vertical; /* WebKit */
                    width: 100%;
                    height: 100%;
                    padding: 0 5px;
                }
            `}</style>
        </div>
    );
};

export default DevPatchModal;