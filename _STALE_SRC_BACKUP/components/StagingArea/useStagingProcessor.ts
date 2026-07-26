import { useState, useEffect, useRef } from 'react';
import { processIncomingFile } from '../../utils/imageProcessor';
// [ZEN FIX] Updated casing to match file system (PascalCase) and resolved type imports
import { saveToMatrix } from '../../services/MatrixService';
import { extractDateFromFilename } from '../../utils/dateSanitizer';
import { StagedAsset } from './types'; // Import local type definition

export const useStagingProcessor = (
    stagedFiles: File[],
    userId: string,
    onClear: () => void
) => {
    const [stagedAssets, setStagedAssets] = useState<StagedAsset[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const processedRef = useRef<Set<string>>(new Set());

    // --- Processing Pipeline ---
    useEffect(() => {
        const processFiles = async () => {
            if (!stagedFiles || stagedFiles.length === 0) return;

            // Prevent duplicate processing
            const distinctFiles = stagedFiles.filter(f => {
                const key = `${f.name}-${f.size}-${f.lastModified}`;
                if (processedRef.current.has(key)) return false;
                processedRef.current.add(key);
                return true;
            });

            if (distinctFiles.length === 0) return;

            setIsProcessing(true);
            try {
                console.log(`[Staging] Processing ${distinctFiles.length} new files...`);

                const promises = distinctFiles.map(file => processIncomingFile(file));
                const results = await Promise.all(promises);
                const cleanResults = results.filter((r): r is any => r !== null);

                setStagedAssets(prev => {
                    const trulyNew = cleanResults.map((asset: any) => {

                        // Priority Date Logic
                        let finalDate = new Date();
                        let googleMeta = {};

                        // @ts-ignore
                        if (asset.file && asset.file.gigi_creationTime) {
                            // @ts-ignore
                            finalDate = new Date(asset.file.gigi_creationTime);
                            // @ts-ignore
                            if (asset.file.gigi_googleMetadata) {
                                // @ts-ignore
                                googleMeta = asset.file.gigi_googleMetadata;
                            }
                        }
                        else if (asset.logicalDate) {
                            finalDate = asset.logicalDate;
                        }
                        else if (asset.file) {
                            const filenameDate = extractDateFromFilename(asset.file.name);
                            if (filenameDate) finalDate = new Date(filenameDate);
                        }

                        const newAsset: StagedAsset = {
                            id: asset.id,
                            file: asset.file,
                            preview: asset.preview,
                            metadata: {
                                ...(asset.metadata || { width: 0, height: 0, aspectRatio: 1 }),
                                googlePhotos: googleMeta
                            },
                            thumbnails: asset.thumbnails || {},
                            logicalDate: finalDate,
                            aiStatus: 'pending',
                            status: 'pending',
                            tagIds: [],
                            detectedFaces: [],
                            title: '',
                            description: '',
                            caption: ''
                        };
                        return newAsset;
                    });
                    return [...prev, ...trulyNew];
                });
            } catch (error) {
                console.error("[Staging] Processing failed:", error);
            } finally {
                setIsProcessing(false);
            }
        };
        processFiles();
    }, [stagedFiles]);

    // --- Actions ---

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            for (const asset of stagedAssets) {
                await saveToMatrix(asset, userId);
            }
            setStagedAssets([]);
            processedRef.current.clear();
            onClear();
        } catch (error) {
            console.error("Save failed", error);
            alert("Failed to save some assets. Check console.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = (id: string) => {
        setStagedAssets(prev => prev.filter(a => a.id !== id));
    };

    const handleUpdateAsset = (id: string, updates: Partial<StagedAsset>) => {
        setStagedAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    };

    const clearAll = () => {
        setStagedAssets([]);
        processedRef.current.clear();
        onClear();
    };

    return {
        stagedAssets,
        isProcessing,
        isSaving,
        handleSaveAll,
        handleRemove,
        handleUpdateAsset,
        clearAll
    };
};