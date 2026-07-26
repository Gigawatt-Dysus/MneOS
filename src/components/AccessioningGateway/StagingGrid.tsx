import React from 'react';
import { Upload, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// [ZEN FIX] Updated import to local sibling
import { StagingCard } from './StagingCard';
import { StagedAsset } from './types';

interface StagingGridProps {
    assets: StagedAsset[];
    isProcessing: boolean;
    onRemove: (id: string) => void;
    onUpdate: (id: string, updates: Partial<StagedAsset>) => void;
    onEdit: (id: string) => void;
    onImport?: (files: File[]) => void;
    processingMessage?: string | null;
}

export const StagingGrid: React.FC<StagingGridProps> = ({
    assets,
    isProcessing,
    onRemove,
    onUpdate,
    onEdit,
    onImport,
    processingMessage
}) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onImport?.(Array.from(e.target.files));
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onImport?.(Array.from(e.dataTransfer.files));
        }
    };

    if (assets.length === 0 && !isProcessing) {
        return (
            <div 
                className="h-full flex flex-col items-center justify-center text-[#45A29E] opacity-50 border-2 border-dashed border-[#1F2833] rounded-lg cursor-pointer hover:bg-white/5 hover:opacity-80 transition-all group"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
            >
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    multiple 
                    onChange={handleFileChange} 
                />
                <Upload className="w-16 h-16 mb-4 group-hover:scale-110 transition-transform" />
                <p className="text-xl font-mono tracking-widest">DROP ARTIFACTS OR SELECT IMPORT</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-y-auto pr-2 custom-scrollbar relative">
            {isProcessing && (
                <div className="sticky top-4 left-1/2 -translate-x-1/2 z-50 w-fit mx-auto mb-4 bg-[#1F2833] px-6 py-3 rounded-full border border-[#66FCF1] shadow-xl flex items-center gap-3">
                    <Wand2 className="w-5 h-5 text-[#66FCF1] animate-pulse" />
                    <span className="text-[#66FCF1] font-mono tracking-wider">{processingMessage || "PROCESSING ARTIFACTS..."}</span>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-20">
                <AnimatePresence>
                    {assets.slice(0, 500).map(asset => (
                        <motion.div
                            key={asset.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                        >
                            <StagingCard
                                asset={asset}
                                onRemove={onRemove}
                                onUpdate={onUpdate}
                                onEdit={onEdit}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
            
            {assets.length > 500 && (
                <div className="fixed bottom-6 right-6 z-40 bg-black/90 backdrop-blur-md px-4 py-2 rounded-xl border border-violet-500/30 text-violet-400 font-mono text-[10px] tracking-widest shadow-2xl pointer-events-none">
                    DISPLAYING 500 OF {assets.length} ARTIFACTS // COMMIT OR CLEAR
                </div>
            )}
        </div>
    );
};