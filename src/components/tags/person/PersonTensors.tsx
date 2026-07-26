import React, { useState } from 'react';
import type { PersonTag } from '../../../types';
import facialGesturesData from '../../../data/Facial_Gestures_DB.json';
import { Film } from 'lucide-react';

interface PersonTensorsProps {
    tag: PersonTag;
    allTags: any[];
    meta: any;
    handleChange: (path: string, value: any) => void;
    userId?: string;
}

const PersonTensors: React.FC<PersonTensorsProps> = ({ tag }) => {
    const tensorMap = tag.tensorMap || {};
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

    const gestures = facialGesturesData as Array<{
        "Gesture Name": string;
        "Short Description": string;
        "Long Description": string;
    }>;

    return (
        <div className="flex flex-col h-[600px] space-y-4 text-slate-200 p-2">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h3 className="text-xl font-medium text-slate-100 tracking-tight flex items-center gap-2">
                        <Film className="text-indigo-400" size={20} />
                        Expressive Range
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">EmoDB Tensor Mapping & Micro-expression Registry</p>
                </div>
            </div>
            
            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                {/* Left Side: List of Gestures */}
                <div className="w-full lg:w-1/3 flex flex-col rounded-xl bg-slate-900/50 border border-white/5 shadow-inner overflow-hidden">
                    <div className="overflow-y-auto w-full h-full p-2 space-y-1 custom-scrollbar">
                        {gestures.map((gesture) => {
                            const isMapped = tensorMap[gesture["Gesture Name"]] && tensorMap[gesture["Gesture Name"]].length > 0;
                            const isSelected = selectedSlot === gesture["Gesture Name"];
                            
                            return (
                                <div 
                                    key={gesture["Gesture Name"]}
                                    onClick={() => setSelectedSlot(gesture["Gesture Name"])}
                                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border ${isSelected ? 'bg-indigo-500/20 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={`font-medium text-sm ${isSelected ? 'text-indigo-300' : 'text-slate-300'}`}>
                                            {gesture["Gesture Name"]}
                                        </span>
                                        {isMapped ? (
                                            <span className="text-[10px] font-medium bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20">
                                                {tensorMap[gesture["Gesture Name"]].length} Mapped
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-medium text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">
                                                Empty
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-1">{gesture["Short Description"]}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Side: Tensor Detail */}
                <div className="w-full lg:w-2/3 border border-white/5 rounded-xl bg-slate-900/50 p-6 flex flex-col shadow-inner">
                    {selectedSlot ? (
                        <div className="flex flex-col h-full animate-in fade-in duration-300">
                            <div className="mb-6">
                                <h4 className="text-2xl font-medium text-slate-100 mb-2">{selectedSlot}</h4>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    {gestures.find(g => g["Gesture Name"] === selectedSlot)?.["Long Description"]}
                                </p>
                            </div>

                            <div className="flex-1 bg-black/30 border border-white/5 rounded-xl flex flex-col items-center justify-center p-6 overflow-hidden relative shadow-inner">
                                {tensorMap[selectedSlot] && tensorMap[selectedSlot].length > 0 ? (
                                    <div className="w-full h-full grid grid-cols-4 gap-4 overflow-y-auto custom-scrollbar">
                                        {/* Display tensor frames if they exist */}
                                        {tensorMap[selectedSlot].map((url: string, idx: number) => (
                                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-indigo-500/50 transition-colors shadow-lg group cursor-pointer">
                                                <img src={url} alt={`${selectedSlot} frame ${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center flex flex-col items-center">
                                        <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 border border-white/5 shadow-inner">
                                            <Film size={28} className="text-slate-500" />
                                        </div>
                                        <p className="text-slate-300 font-medium mb-2">No Tensors Anchored</p>
                                        <p className="text-sm text-slate-500 max-w-sm">Use the Matrix Staging Airlock to curate and bind generative video bursts to this physical slot.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm animate-in fade-in duration-300">
                            <div className="w-20 h-20 rounded-full bg-slate-800/30 flex items-center justify-center mb-6 border border-white/5 shadow-inner">
                                <span className="text-3xl opacity-50">🎭</span>
                            </div>
                            <p className="text-slate-400 font-medium">Select a structural expression from the registry</p>
                            <p className="text-slate-500 mt-2 text-xs">to view or manage its anchored tensor array.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PersonTensors;
