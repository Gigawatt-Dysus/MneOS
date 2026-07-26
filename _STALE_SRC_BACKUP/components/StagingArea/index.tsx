import React from 'react';
import { StagingAreaProps } from './types';
import { useStagingProcessor } from './useStagingProcessor';
import { StagingToolbar } from './StagingToolbar';
import { StagingGrid } from './StagingGrid';

export const StagingArea: React.FC<StagingAreaProps> = (props) => {
    const { stagedFiles, userId, onClear } = props;

    // Extract logic to hook
    const {
        stagedAssets,
        isProcessing,
        isSaving,
        handleSaveAll,
        handleRemove,
        handleUpdateAsset,
        clearAll
    } = useStagingProcessor(stagedFiles, userId, onClear);

    return (
        <div className="h-full flex flex-col bg-[#0B0C10] text-[#E0E0E0] p-6 relative">
            <StagingToolbar
                assetCount={stagedAssets.length}
                isSaving={isSaving}
                onClear={clearAll}
                onSave={handleSaveAll}
            />

            <StagingGrid
                assets={stagedAssets}
                isProcessing={isProcessing}
                onRemove={handleRemove}
                onUpdate={handleUpdateAsset}
            />
        </div>
    );
};