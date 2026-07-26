import React from 'react';
import { Upload, Save, Trash2, RotateCw } from 'lucide-react';

export interface StagingToolbarProps {
    assetCount: number;
    isSaving: boolean;
    onClear: () => void;
    onSave: () => void;
}

export const StagingToolbar: React.FC<StagingToolbarProps> = ({ 
    assetCount, 
    isSaving, 
    onClear, 
    onSave 
}) => {
    return (
        <div className="flex justify-between items-center mb-6 border-b border-[#1F2833] pb-4">
            <div className="flex items-center gap-3">
                <Upload className="w-6 h-6 text-[#66FCF1]" />
                <h2 className="text-2xl font-bold font-mono text-[#66FCF1] tracking-wider">
                    STAGING AREA // <span className="text-[#C5C6C7]">{assetCount} ARTIFACTS</span>
                </h2>
            </div>
            <div className="flex gap-4">
                <button 
                    onClick={onClear}
                    className="flex items-center gap-2 px-4 py-2 rounded bg-[#1F2833] hover:bg-red-900/30 text-red-400 transition-colors"
                >
                    <Trash2 className="w-4 h-4" /> CLEAR ALL
                </button>
                <button 
                    onClick={onSave}
                    disabled={isSaving || assetCount === 0}
                    className={`flex items-center gap-2 px-6 py-2 rounded font-bold transition-all ${
                        isSaving || assetCount === 0
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-[#45A29E] hover:bg-[#66FCF1] text-[#0B0C10] shadow-[0_0_15px_rgba(102,252,241,0.3)]'
                    }`}
                >
                    {isSaving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'COMMITTING...' : 'COMMIT TO MATRIX'}
                </button>
            </div>
        </div>
    );
};