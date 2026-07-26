import React, { useState, useEffect } from 'react';
import { ensurePetMetadata, PetMetadata } from './types';
import { BasicInfoTab } from './BasicInfoTab';
import { MedicalTab } from './MedicalTab';
import { DietTab } from './DietTab';
import { PawPrint, Activity, Utensils } from 'lucide-react';

interface PetFormProps {
    metadata: any;
    onChange: (metadata: any) => void;
}

const PetForm: React.FC<PetFormProps> = ({ metadata, onChange }) => {
    const [data, setData] = useState<PetMetadata>(ensurePetMetadata(metadata));
    const [activeTab, setActiveTab] = useState<'basic' | 'medical' | 'diet'>('basic');

    useEffect(() => {
        setData(ensurePetMetadata(metadata));
    }, [metadata]);

    const handleUpdate = (updates: Partial<PetMetadata>) => {
        const newData = { ...data, ...updates };
        setData(newData);
        onChange(newData);
    };

    return (
        <div className="flex flex-col h-full bg-[#0b0d12] rounded-2xl border border-white/5 overflow-hidden">
            <div className="flex border-b border-white/5 bg-black/20">
                <button
                    onClick={() => setActiveTab('basic')}
                    className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs font-bold tracking-wider transition-all ${activeTab === 'basic' ? 'bg-cyan-900/20 text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                >
                    <PawPrint size={16} /> IDENTITY
                </button>
                <button
                    onClick={() => setActiveTab('medical')}
                    className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs font-bold tracking-wider transition-all ${activeTab === 'medical' ? 'bg-emerald-900/20 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                >
                    <Activity size={16} /> MEDICAL
                </button>
                <button
                    onClick={() => setActiveTab('diet')}
                    className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs font-bold tracking-wider transition-all ${activeTab === 'diet' ? 'bg-orange-900/20 text-orange-400 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                >
                    <Utensils size={16} /> DIET
                </button>
            </div>

            <div className="p-6">
                {activeTab === 'basic' && <BasicInfoTab data={data} onChange={handleUpdate} />}
                {activeTab === 'medical' && <MedicalTab data={data} onChange={handleUpdate} />}
                {activeTab === 'diet' && <DietTab data={data} onChange={handleUpdate} />}
            </div>
        </div>
    );
};

export default PetForm;