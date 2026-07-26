import React, { useState, useEffect } from 'react';
import { X, Calendar, FileText, Tag, Image as ImageIcon, Check } from 'lucide-react';
import { StagedAsset } from './types'; // Import local type
import { formatDateForInput } from '../../utils/dateSanitizer'; // Adjusted path

interface StagingCardProps {
    asset: StagedAsset;
    onRemove: (id: string) => void;
    onUpdate: (id: string, updates: Partial<StagedAsset>) => void;
}

export const StagingCard: React.FC<StagingCardProps> = ({ asset, onRemove, onUpdate }) => {
    // Detached state for inputs to prevent cursor jumping
    const [localTitle, setLocalTitle] = useState(asset.title || '');
    const [localDate, setLocalDate] = useState(
        asset.logicalDate ? formatDateForInput(new Date(asset.logicalDate)) : ''
    );

    // Sync local state if parent asset changes externally (rare but good practice)
    useEffect(() => {
        setLocalTitle(asset.title || '');
    }, [asset.title]);

    const handleBlur = () => {
        if (localTitle !== asset.title) {
            onUpdate(asset.id, { title: localTitle });
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalDate(val);
        if (val) {
            onUpdate(asset.id, { logicalDate: new Date(val) });
        }
    };

    // Determine icon based on file type if preview fails or is generic
    const isImage = asset.file.type.startsWith('image/');

    return (
        <div className="bg-[#1F2833] rounded-lg border border-[#45A29E]/30 overflow-hidden shadow-lg hover:shadow-[#66FCF1]/10 transition-all group">
            {/* Header / Remove */}
            <div className="relative h-48 bg-black/50 group-hover:bg-black/40 transition-colors">
                {isImage && asset.preview ? (
                    <img
                        src={asset.preview}
                        alt="preview"
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#45A29E]">
                        <FileText className="w-16 h-16 opacity-50" />
                    </div>
                )}

                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(asset.id); }}
                    className="absolute top-2 right-2 p-1 bg-black/70 text-red-400 rounded-full hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove from Staging"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Badge for Google Metadata */}
                {asset.metadata?.googlePhotos && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-blue-900/80 text-blue-200 text-xs rounded border border-blue-500/50 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Google Meta
                    </div>
                )}
            </div>

            {/* Content / Edit Fields */}
            <div className="p-4 space-y-3">

                {/* Filename (Read only reference) */}
                <div className="text-xs text-gray-500 truncate font-mono" title={asset.file.name}>
                    {asset.file.name}
                </div>

                {/* Title Input */}
                <div className="flex items-center gap-2 bg-[#0B0C10] p-2 rounded border border-[#45A29E]/20 focus-within:border-[#66FCF1]/50 transition-colors">
                    <FileText className="w-4 h-4 text-[#45A29E]" />
                    <input
                        type="text"
                        value={localTitle}
                        onChange={(e) => setLocalTitle(e.target.value)}
                        onBlur={handleBlur}
                        placeholder="Add a title..."
                        className="bg-transparent border-none outline-none text-[#E0E0E0] text-sm w-full placeholder-gray-600"
                    />
                </div>

                {/* Date Picker */}
                <div className="flex items-center gap-2 bg-[#0B0C10] p-2 rounded border border-[#45A29E]/20 focus-within:border-[#66FCF1]/50 transition-colors">
                    <Calendar className="w-4 h-4 text-[#45A29E]" />
                    <input
                        type="datetime-local"
                        value={localDate}
                        onChange={handleDateChange}
                        className="bg-transparent border-none outline-none text-[#E0E0E0] text-sm w-full font-mono"
                    />
                </div>

                {/* Metadata Info */}
                <div className="flex justify-between items-center text-xs text-gray-400 pt-2 border-t border-gray-800">
                    <span>{(asset.file.size / 1024 / 1024).toFixed(2)} MB</span>
                    <span>{asset.metadata.width} x {asset.metadata.height}</span>
                </div>
            </div>
        </div>
    );
};