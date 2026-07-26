import React from 'react';
import { AccessioningGatewayProps } from './types';
import { useStagingProcessor } from './useStagingProcessor';
import { StagingToolbar } from './StagingToolbar';
import { StagingGrid } from './StagingGrid';
import { MediaStudioModal } from '../media/MediaStudioModal';
import { GenieModal } from './GenieModal';
import { AirlockViewer } from './AirlockViewer';

export const AccessioningGateway: React.FC<AccessioningGatewayProps> = (props) => {
    const { stagedFiles, userId, onClear } = props;

    const {
        stagedAssets,
        isProcessing,
        isSaving,
        sortOrder,
        setSortOrder,
        handleSaveAll,
        handleRemove,
        handleUpdateAsset,
        clearAll,
        purgeNoise,
        processingMessage,
        handleGenieArchive
    } = useStagingProcessor(stagedFiles, userId, onClear);

    const [activeEditAssetId, setActiveEditAssetId] = React.useState<string | null>(null);
    const [isGenieModalOpen, setIsGenieModalOpen] = React.useState(false);
    const [isTelemetryOpen, setIsTelemetryOpen] = React.useState(false);
    
    const activeEditAsset = stagedAssets.find(a => a.id === activeEditAssetId);


    return (
        <div className="h-full relative overflow-hidden bg-[#050A15]">
            <div className="relative z-10 h-full flex flex-col">
                <div className="p-6 pb-0">
                    <StagingToolbar
                        assetCount={stagedAssets.length}
                        isSaving={isSaving}
                        sortOrder={sortOrder}
                        onToggleSort={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        onClear={clearAll}
                        onPurgeNoise={purgeNoise}
                        onSave={handleSaveAll}
                        onImport={props.onStageFiles}
                        onGenieImport={() => setIsGenieModalOpen(true)}
                        onToggleTelemetry={() => setIsTelemetryOpen(true)}
                    />
                </div>

                <div className="flex-1 flex flex-col overflow-hidden px-6 pb-6 mt-4">
                    <StagingGrid
                        assets={stagedAssets}
                        isProcessing={isProcessing}
                        processingMessage={processingMessage}
                        onRemove={handleRemove}
                        onUpdate={handleUpdateAsset}
                        onEdit={(id) => setActiveEditAssetId(id)}
                        onImport={props.onStageFiles}
                    />
                </div>
            </div>

            {activeEditAsset && (
                <MediaStudioModal
                    asset={activeEditAsset as any}
                    onClose={() => setActiveEditAssetId(null)}
                    onUpdate={(id, updates) => handleUpdateAsset(id, updates as any)}
                    onRemove={handleRemove}
                    tags={props.tags}
                    user={props.user}
                />
            )}

            <GenieModal 
                isOpen={isGenieModalOpen}
                onClose={() => setIsGenieModalOpen(false)}
                onIgnite={(jsonFiles, htmlFiles) => {
                    handleGenieArchive(jsonFiles, htmlFiles);
                }}
            />

            <AirlockViewer 
                isOpen={isTelemetryOpen} 
                onClose={() => setIsTelemetryOpen(false)} 
            />
        </div>
    );
};