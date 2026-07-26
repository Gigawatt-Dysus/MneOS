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
}

export const StagingGrid: React.FC<StagingGridProps> = ({
    assets,
    isProcessing,
    onRemove,
    onUpdate
}) => {

    if (assets.length === 0 && !isProcessing) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-[#45A29E] opacity-50 border-2 border-dashed border-[#1F2833] rounded-lg">
                <Upload className="w-16 h-16 mb-4" />
                <p className="text-xl font-mono">DROP ARTIFACTS OR SELECT IMPORT</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative">
            {isProcessing && (
                <div className="sticky top-4 left-1/2 -translate-x-1/2 z-50 w-fit mx-auto mb-4 bg-[#1F2833] px-6 py-3 rounded-full border border-[#66FCF1] shadow-xl flex items-center gap-3">
                    <Wand2 className="w-5 h-5 text-[#66FCF1] animate-pulse" />
                    <span className="text-[#66FCF1] font-mono">PROCESSING ARTIFACTS...</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                <AnimatePresence>
                    {assets.map(asset => (
                        <motion.div
                            key={asset.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            layout
                        >
                            <StagingCard
                                asset={asset}
                                onRemove={onRemove}
                                onUpdate={onUpdate}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};