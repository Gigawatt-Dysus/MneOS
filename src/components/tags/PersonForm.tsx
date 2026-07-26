import React, { useState } from 'react';
import type { PersonTag, Tag, Settings, AiCompanion, ChassisBiometrics } from '../../types';
import { DEFAULT_CHASSIS_BIOMETRICS } from '../../types';
import { ThreeDChassisScanner } from '../ThreeDChassisScanner';

// Import New Sub-Components
import PersonIdentity from './person/PersonIdentity';
import PersonContact from './person/PersonContact';
import PersonLife from './person/PersonLife';
import { PersonLifeStory } from './person/PersonLifeStory'; // [ZEN] New Component
import PersonBio from './person/PersonBio';
import PersonConnections from './person/PersonConnections';
import PersonTensors from './person/PersonTensors';
import PersonReflux from './person/PersonReflux';
const HAIR_COLOR_PRESETS = [
  { name: "Auburn", hex: "#6A2B19" },
  { name: "Black", hex: "#090806" },
  { name: "Bleach Blonde", hex: "#E6D4A8" },
  { name: "Burgundy", hex: "#4C1C24" },
  { name: "Chestnut Brown", hex: "#4A3319" },
  { name: "Copper Red", hex: "#B85C37" },
  { name: "Dark Blonde", hex: "#B09E80" },
  { name: "Dark Brown", hex: "#2B1A0A" },
  { name: "Electric Blue", hex: "#004B8D" },
  { name: "Ginger", hex: "#C26A38" },
  { name: "Golden Blonde", hex: "#D9C383" },
  { name: "Light Blonde", hex: "#EBE1C5" },
  { name: "Light Brown", hex: "#5C4A3C" },
  { name: "Medium Brown", hex: "#423121" },
  { name: "Neon Green", hex: "#39FF14" },
  { name: "Pastel Pink", hex: "#FFD1DC" },
  { name: "Platinum Blonde", hex: "#F4F2EA" },
  { name: "Plum Purple", hex: "#4D1F3C" },
  { name: "Silver Gray", hex: "#A8A9AD" },
  { name: "White Hair", hex: "#F8F9FA" }
];

interface PersonFormProps {
    tag: PersonTag;
    activeTab: string;
    allTags: Tag[];
    onMetadataChange: (metadata: any) => void;
    // [ZEN FIX] Explicitly accepting onRootChange to avoid compiler errors
    onRootChange: (field: keyof Tag, value: any) => void;
    settings?: Settings;
    onEnrollFace: () => void;
    isEnrolling: boolean;
    primaryCompanion: AiCompanion;
    onOpenGedcom?: () => void; // [ZEN]
    userId?: string;
    userPresets?: any[];
    relatedMedia?: any[];
}

const PersonForm: React.FC<PersonFormProps> = ({
    tag,
    activeTab,
    allTags,
    onMetadataChange,
    onRootChange,
    settings,
    onEnrollFace,
    isEnrolling,
    primaryCompanion,
    onOpenGedcom,
    userId,
    userPresets,
    relatedMedia
}) => {
    const meta = tag.metadata;
    // [ZEN EWO 001] faceDescriptor removed - migrated to Azure Vision cloud
    const isEnrolled = false; // Azure integration pending

    const [useImperial, setUseImperial] = useState(false);
    const [customHairColor, setCustomHairColor] = useState(() => {
        const currentHex = meta.biometrics?.hairColor || DEFAULT_CHASSIS_BIOMETRICS.hairColor;
        return !HAIR_COLOR_PRESETS.some(p => p.hex.toLowerCase() === currentHex.toLowerCase());
    });

    // Helper for updating metadata
    const handleMetaChange = (path: string, value: any) => {
        const newMeta = JSON.parse(JSON.stringify(meta));
        if (!path.includes('.')) {
            newMeta[path] = value;
        } else {
            const keys = path.split('.');
            let current = newMeta;
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                // [ZEN SELF-HEALING] Overwrite key as object if it is missing, null, or a legacy primitive string
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
            current[keys[keys.length - 1]] = value;
        }
        onMetadataChange(newMeta);
    };

    switch (activeTab) {
        case 'identity':
            return (
                <PersonIdentity
                    tag={tag}
                    allTags={allTags}
                    meta={meta}
                    handleChange={handleMetaChange}
                    onEnrollFace={onEnrollFace}
                    isEnrolling={isEnrolling}
                    isEnrolled={isEnrolled}
                    onRootChange={onRootChange}
                    userId={userId}
                />
            );
        case 'contact':
            return <PersonContact meta={meta} handleChange={handleMetaChange} />;
        case 'lifestory':
            return <PersonLifeStory tag={tag} meta={meta} handleChange={handleMetaChange} aiName={primaryCompanion.name} onOpenGedcom={onOpenGedcom} />;
        case 'life':
            return <PersonLife meta={meta} handleChange={handleMetaChange} settings={settings} />;
        case 'bio':
            return <PersonBio meta={meta} handleChange={handleMetaChange} userId={userId} />;
        case 'connections':
            return (
                <PersonConnections
                    tag={tag}
                    allTags={allTags}
                    meta={meta}
                    handleChange={handleMetaChange}
                    primaryCompanion={primaryCompanion}
                />
            );
        case 'tensors':
            return (
                <PersonTensors
                    tag={tag}
                    allTags={allTags}
                    meta={meta}
                    handleChange={handleMetaChange}
                    userId={userId}
                />
            );
        case 'reflux':
            return (
                <PersonReflux
                    tag={tag}
                    allTags={allTags}
                    meta={meta}
                    handleChange={handleMetaChange}
                    userId={userId}
                    relatedMedia={relatedMedia}
                />
            );
        case 'chassis': {
            const biometrics = meta.biometrics || DEFAULT_CHASSIS_BIOMETRICS;
            
            const setBiometrics = (newBiometrics: ChassisBiometrics) => {
                handleMetaChange('biometrics', newBiometrics);
            };

            const displayHeight = (metersStr: string) => {
                const m = parseFloat(metersStr) || 1.72;
                if (useImperial) {
                    const totalInches = Math.round(m * 39.3701);
                    const feet = Math.floor(totalInches / 12);
                    const inches = totalInches % 12;
                    return `${feet}'${inches}"`;
                }
                return `${m.toFixed(2)}m`;
            };

            const displayWeight = (kgStr: string) => {
                const kg = parseFloat(kgStr) || 58;
                if (useImperial) {
                    return `${Math.round(kg * 2.20462)}lbs`;
                }
                return `${kg.toFixed(0)}kg`;
            };

            return (
                <div className="flex flex-col lg:flex-row gap-6 h-[600px] w-full text-amber-50">
                    {/* Left: 3D Viewport */}
                    <div className="flex-1 min-h-[300px] lg:min-h-0 relative border border-amber-500/20 bg-black/40 rounded-lg overflow-hidden backdrop-blur-sm">
                        <ThreeDChassisScanner 
                            bodyMatrix={biometrics}
                            setBodyMatrix={setBiometrics}
                            fashionGown={0}
                            yOffset={-0.3}
                        />
                    </div>
                    
                    {/* Right: Parameter Sliders */}
                    <div className="w-full lg:w-96 flex flex-col gap-4 overflow-y-auto pr-2 border-l border-amber-500/10 pl-0 lg:pl-6 max-h-[600px]">
                        <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                            <div>
                                <h3 className="text-lg font-semibold text-amber-400 tracking-wider font-mono">Chassis Core Stats</h3>
                                <p className="text-xs text-amber-500/70 font-mono">Quantum Multiverse Sync Layer</p>
                            </div>
                        </div>

                        {/* Controls Toolbar */}
                        <div className="flex justify-between items-center bg-black/30 border border-amber-500/10 rounded-lg p-2 gap-2">
                            <button 
                                type="button"
                                onClick={() => setUseImperial(!useImperial)}
                                className="flex-1 py-1.5 text-[10px] border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded transition font-mono uppercase tracking-wider"
                            >
                                Units: {useImperial ? 'Imperial' : 'Metric'}
                            </button>
                            <button 
                                type="button"
                                onClick={() => setBiometrics(DEFAULT_CHASSIS_BIOMETRICS)}
                                className="flex-1 py-1.5 text-[10px] border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded transition font-mono uppercase tracking-wider"
                            >
                                Reset Defaults
                            </button>
                        </div>

                        {/* Grid of Sliders */}
                        <div className="flex flex-col gap-4">
                            {/* Height */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-mono">
                                    <span className="text-amber-400/80">{useImperial ? 'Height' : 'Height (m)'}</span>
                                    <span className="text-amber-400 font-bold">{displayHeight(biometrics.height)}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min={useImperial ? "51" : "1.30"} 
                                    max={useImperial ? "83" : "2.10"} 
                                    step={useImperial ? "1" : "0.01"}
                                    value={useImperial ? Math.round(parseFloat(biometrics.height) * 39.3701) : biometrics.height}
                                    onChange={(e) => {
                                        if (useImperial) {
                                            const inches = parseInt(e.target.value, 10);
                                            setBiometrics({ ...biometrics, height: (inches / 39.3701).toFixed(2) });
                                        } else {
                                            setBiometrics({ ...biometrics, height: e.target.value });
                                        }
                                    }}
                                    className="w-full accent-amber-500 bg-amber-950/40 rounded-lg appearance-none h-1 cursor-pointer"
                                />
                            </div>

                            {/* Weight */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-mono">
                                    <span className="text-amber-400/80">{useImperial ? 'Weight' : 'Weight (kg)'}</span>
                                    <span className="text-amber-400 font-bold">{displayWeight(biometrics.weight)}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min={useImperial ? "77" : "35"} 
                                    max={useImperial ? "265" : "120"} 
                                    step="1"
                                    value={useImperial ? Math.round(parseFloat(biometrics.weight) * 2.20462) : biometrics.weight}
                                    onChange={(e) => {
                                        if (useImperial) {
                                            const lbs = parseInt(e.target.value, 10);
                                            setBiometrics({ ...biometrics, weight: (lbs / 2.20462).toFixed(0) });
                                        } else {
                                            setBiometrics({ ...biometrics, weight: e.target.value });
                                        }
                                    }}
                                    className="w-full accent-amber-500 bg-amber-950/40 rounded-lg appearance-none h-1 cursor-pointer"
                                />
                            </div>

                            {/* Breast Size */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-mono">
                                    <span className="text-amber-400/80">Breast Size</span>
                                    <span className="text-amber-400">{biometrics.breastSize}</span>
                                </div>
                                <select 
                                    value={biometrics.breastSize}
                                    onChange={(e) => setBiometrics({ ...biometrics, breastSize: e.target.value })}
                                    className="w-full bg-black/60 border border-amber-500/20 text-amber-300 rounded px-2 py-1 text-sm font-mono focus:border-amber-400 focus:outline-none"
                                >
                                    {["32A", "32B", "32C", "32D", "34A", "34B", "34C", "34D", "34DD", "36B", "36C", "36D", "36DD", "38C", "38D", "38DD"].map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Fluid Capacitance */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-mono">
                                    <span className="text-amber-400/80">Fluid Capacitance</span>
                                    <span className="text-amber-400">{biometrics.fluidCapacitance}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="50" 
                                    max="100" 
                                    step="1"
                                    value={parseInt(biometrics.fluidCapacitance || "94")}
                                    onChange={(e) => setBiometrics({ ...biometrics, fluidCapacitance: `${e.target.value}%` })}
                                    className="w-full accent-amber-500 bg-amber-950/40 rounded-lg appearance-none h-1 cursor-pointer"
                                />
                            </div>

                            {/* Grool Capacity */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-mono">
                                    <span className="text-amber-400/80">Grool Capacity</span>
                                    <span className="text-amber-400">{biometrics.groolCapacity}</span>
                                </div>
                                <select 
                                    value={biometrics.groolCapacity || "High"}
                                    onChange={(e) => setBiometrics({ ...biometrics, groolCapacity: e.target.value })}
                                    className="w-full bg-black/60 border border-amber-500/20 text-amber-300 rounded px-2 py-1 text-sm font-mono focus:border-amber-400 focus:outline-none"
                                >
                                    {["Low", "Medium", "High", "Critical Overflow"].map(cap => (
                                        <option key={cap} value={cap}>{cap}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Hair Color */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center text-xs font-mono">
                                    <span className="text-amber-400/80">Hair Color</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setCustomHairColor(!customHairColor)}
                                            className="text-[10px] text-amber-500/60 hover:text-amber-400 underline cursor-pointer"
                                        >
                                            {customHairColor ? "Use Presets" : "Use Custom Hex"}
                                        </button>
                                        <span className="text-amber-400 font-bold" style={{ color: biometrics.hairColor }}>
                                            {customHairColor 
                                                ? biometrics.hairColor 
                                                : (HAIR_COLOR_PRESETS.find(p => p.hex.toLowerCase() === biometrics.hairColor?.toLowerCase())?.name || biometrics.hairColor)
                                            }
                                        </span>
                                    </div>
                                </div>

                                {customHairColor ? (
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="color" 
                                            value={biometrics.hairColor || "#E2C98A"}
                                            onChange={(e) => setBiometrics({ ...biometrics, hairColor: e.target.value })}
                                            className="w-10 h-7 border border-amber-500/30 rounded bg-transparent cursor-pointer"
                                        />
                                        <input 
                                            type="text" 
                                            value={biometrics.hairColor || ""}
                                            onChange={(e) => setBiometrics({ ...biometrics, hairColor: e.target.value })}
                                            className="flex-1 bg-black/60 border border-amber-500/20 text-amber-300 rounded px-2 py-1 text-sm font-mono focus:border-amber-400 focus:outline-none"
                                            placeholder="#E2C98A"
                                        />
                                    </div>
                                ) : (
                                    <select 
                                        value={HAIR_COLOR_PRESETS.find(p => p.hex.toLowerCase() === biometrics.hairColor?.toLowerCase())?.hex || "#E2C98A"}
                                        onChange={(e) => setBiometrics({ ...biometrics, hairColor: e.target.value })}
                                        className="w-full bg-black/60 border border-amber-500/20 text-amber-300 rounded px-2 py-1 text-sm font-mono focus:border-amber-400 focus:outline-none"
                                    >
                                        {HAIR_COLOR_PRESETS.map(preset => (
                                            <option key={preset.hex} value={preset.hex}>
                                                {preset.name} ({preset.hex})
                                            </option>
                                        ))}
                                        {biometrics.hairColor && !HAIR_COLOR_PRESETS.some(p => p.hex.toLowerCase() === biometrics.hairColor.toLowerCase()) && (
                                            <option value={biometrics.hairColor}>
                                                Custom ({biometrics.hairColor})
                                            </option>
                                        )}
                                    </select>
                                )}
                            </div>

                            {/* Eye Color */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-mono">
                                    <span className="text-amber-400/80">Eye Color</span>
                                    <span className="text-amber-400">{biometrics.eyeColor || "Hazel"}</span>
                                </div>
                                <select 
                                    value={biometrics.eyeColor || "Hazel"}
                                    onChange={(e) => setBiometrics({ ...biometrics, eyeColor: e.target.value })}
                                    className="w-full bg-black/60 border border-amber-500/20 text-amber-300 rounded px-2 py-1 text-sm font-mono focus:border-amber-400 focus:outline-none"
                                >
                                    {["Amber", "Blue", "Brown", "Gray", "Green", "Hazel", "Red", "Violet"].map(color => (
                                        <option key={color} value={color}>{color}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Head Size */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-mono">
                                    <span className="text-amber-400/80">Head Size</span>
                                    <span className="text-amber-400">{biometrics.headSize || "50"}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="10" 
                                    max="90" 
                                    step="1"
                                    value={biometrics.headSize || "50"}
                                    onChange={(e) => setBiometrics({ ...biometrics, headSize: e.target.value })}
                                    className="w-full accent-amber-500 bg-amber-950/40 rounded-lg appearance-none h-1 cursor-pointer"
                                />
                            </div>

                            {/* Limb Length */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-mono">
                                    <span className="text-amber-400/80">Limb Length</span>
                                    <span className="text-amber-400">{biometrics.limbLength || "50"}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="10" 
                                    max="90" 
                                    step="1"
                                    value={biometrics.limbLength || "50"}
                                    onChange={(e) => setBiometrics({ ...biometrics, limbLength: e.target.value })}
                                    className="w-full accent-amber-500 bg-amber-950/40 rounded-lg appearance-none h-1 cursor-pointer"
                                />
                            </div>

                            {/* Torso Length */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-mono">
                                    <span className="text-amber-400/80">Torso Length</span>
                                    <span className="text-amber-400">{biometrics.torsoLength || "50"}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="10" 
                                    max="90" 
                                    step="1"
                                    value={biometrics.torsoLength || "50"}
                                    onChange={(e) => setBiometrics({ ...biometrics, torsoLength: e.target.value })}
                                    className="w-full accent-amber-500 bg-amber-950/40 rounded-lg appearance-none h-1 cursor-pointer"
                                />
                            </div>

                            {/* Hair Style */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-mono">
                                    <span className="text-amber-400/80">Hair Style</span>
                                    <span className="text-amber-400">{biometrics.hairStyle || "Bob"}</span>
                                </div>
                                <select 
                                    value={biometrics.hairStyle || "Bob"}
                                    onChange={(e) => setBiometrics({ ...biometrics, hairStyle: e.target.value })}
                                    className="w-full bg-black/60 border border-amber-500/20 text-amber-300 rounded px-2 py-1 text-sm font-mono focus:border-amber-400 focus:outline-none"
                                >
                                    {["Bob", "Long", "Short", "Curly", "Ponytail", "Braid", "Pixie"].map(style => (
                                        <option key={style} value={style}>{style}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Model URL */}
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs font-mono">
                                    <span className="text-amber-400/80">Model GLB Path</span>
                                </div>
                                <input 
                                    type="text" 
                                    value={biometrics.chassisModelUrl || ""}
                                    onChange={(e) => setBiometrics({ ...biometrics, chassisModelUrl: e.target.value })}
                                    className="w-full bg-black/60 border border-amber-500/20 text-amber-300 rounded px-2 py-1 text-sm font-mono focus:border-amber-400 focus:outline-none"
                                    placeholder="/Rio.glb"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        default:
            return null;
    }
};

export default PersonForm;