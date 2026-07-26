import React, { useState, useEffect } from 'react';
import type { ImportStatus, User } from '@/types';
import { appDataService } from '../services/serviceManager';

interface BackupImportModalProps {
    status: ImportStatus;
    onConfirm: () => void;
    onClose: () => void;
    currentUser: User | null;
}

interface ProgressState {
    current: number;
    total: number;
    header: string;
    detail: string;
}

// Shared utility to robustly read JSON from .json or .gz files
export const readFileContent = async (file: File): Promise<string> => {
    if (file.name.endsWith('.gz') || file.type.includes('gzip')) {
        if ('DecompressionStream' in window) {
            try {
                const ds = new DecompressionStream('gzip');
                const stream = file.stream().pipeThrough(ds);
                const response = new Response(stream);
                const text = await response.text();
                return text;
            } catch (e) {
                console.warn("DecompressionStream failed, trying fallback blob array buffer...", e);
            }
        }
    }
    const text = await file.text();
    return text;
};

const BackupImportModal: React.FC<BackupImportModalProps> = ({ status, onConfirm: _onConfirm, onClose, currentUser }) => {
    const [showExplanation, setShowExplanation] = useState(false);
    const [localProgress, setLocalProgress] = useState<ProgressState | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        if (status.type === 'idle') {
            setLocalProgress(null);
            setLocalError(null);
        }
    }, [status.type]);

    useEffect(() => {
        if (status.type === 'error') {
            setLocalError(status.message);
        }
    }, [status]);

    const handleStartImport = async () => {
        if (status.type !== 'confirming') return;
        
        setLocalProgress({ current: 0, total: 100, header: 'PREPARING', detail: 'Reading File...' });
        setLocalError(null);

        try {
            const jsonString = await readFileContent(status.file);
            
            if (!jsonString || jsonString.length === 0) {
                throw new Error("File appears empty or could not be read.");
            }

            let data;
            try {
                data = JSON.parse(jsonString);
            } catch (parseError) {
                throw new Error(`Invalid file format. Ensure you selected a .json or .gz backup file. Error: ${(parseError as Error).message}`);
            }

            if (data.firebaseConfig) {
                try {
                    localStorage.setItem('gigi_firebase_config', JSON.stringify(data.firebaseConfig));
                    console.log("Restored config from backup.");
                } catch (e) {
                    console.error("Failed to restore firebase config", e);
                }
            }

            setLocalProgress({ current: 0, total: 100, header: 'INITIALIZING', detail: 'Starting Import...' });

            await appDataService.importBackupData(data, currentUser?.id, (header, detail, current, total) => {
                setLocalProgress({ header, detail, current, total });
            });

            setLocalProgress({ header: 'SUCCESS', detail: 'Reloading...', current: 100, total: 100 });
            
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error: any) {
            console.error("Import failed:", error);
            setLocalError(error.message || "An unknown error occurred.");
            setLocalProgress(null);
        }
    };

    if (status.type === 'idle') return null;

    const percent = localProgress && localProgress.total > 0 
        ? Math.round((localProgress.current / localProgress.total) * 100) 
        : 0;

    const renderContent = () => {
        if (localError) {
             return (
                <div className="p-8 text-center">
                    <div className="p-6 rounded-lg bg-red-900/50 text-red-200 border border-red-500 mb-4">
                        <p className="font-bold mb-2">Import Failed</p>
                        <p className="text-sm">{localError}</p>
                    </div>
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Close</button>
                </div>
            );
        }

        if (localProgress) {
            return (
                <div className="p-8">
                    <div className="p-6 rounded-lg bg-blue-900/50 text-blue-200 border border-blue-500 text-center">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-blue-300 mb-1">{localProgress.header}</h3>
                        <p className="text-lg font-semibold text-white mb-4 truncate">{localProgress.detail}</p>
                        <div className="w-full bg-blue-900/50 rounded-full h-4 mb-2 overflow-hidden border border-blue-700">
                            <div 
                                className="bg-blue-400 h-4 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${percent}%` }}
                            ></div>
                        </div>
                        <p className="text-xs font-mono opacity-80">{localProgress.current} / {localProgress.total}</p>
                    </div>
                </div>
            );
        }

        switch (status.type) {
            case 'confirming':
                return (
                    <>
                        <div className="p-6 space-y-6">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Confirm Import & Migration</h3>
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 rounded-r-lg">
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Ready to import from: <span className="font-bold">{status.file.name}</span></p>
                                <div className="text-sm text-gray-700 dark:text-gray-300 mt-4 font-medium p-3 bg-white/50 dark:bg-black/20 rounded border border-yellow-200 dark:border-yellow-700/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-violet-600 dark:text-violet-400 uppercase text-xs tracking-wider">Ownership Transfer Protocol</span>
                                        <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded-full font-bold border border-green-300 dark:border-green-700">SAFE MERGE ACTIVE</span>
                                    </div>
                                    
                                    <p>The data in this file will be permanently re-assigned to:</p>
                                    <div className="flex items-center gap-3 mt-2 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 mb-3">
                                        {currentUser ? (
                                            <>
                                                <img src={currentUser.profilePictureUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-gray-100">{currentUser.displayName}</p>
                                                    <p className="text-xs text-gray-500 font-mono">{currentUser.id}</p>
                                                </div>
                                            </>
                                        ) : (
                                            <span className="font-bold text-red-500">No Active User (Please Log In)</span>
                                        )}
                                    </div>

                                    <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                        <li>New events/tags created recently on this device will be <strong>preserved</strong>.</li>
                                        <li>Chat histories will be <strong>intelligently merged</strong> (no messages lost).</li>
                                        <li>Older backup data will fill in the gaps.</li>
                                    </ul>
                                </div>
                                
                                <button 
                                    onClick={() => setShowExplanation(!showExplanation)}
                                    className="mt-4 text-xs text-violet-600 dark:text-violet-400 underline hover:text-violet-800 transition-colors font-medium flex items-center gap-1"
                                >
                                    {showExplanation ? "Hide Details" : "Why do I need to upload the file again?"}
                                </button>

                                {showExplanation && (
                                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-gray-600 dark:text-gray-300 space-y-2 border border-blue-100 dark:border-blue-800">
                                        <p><strong>1. Security Walls:</strong> The database sees your old ID and new ID as strangers. It forbids your new account from touching the old data directly.</p>
                                        <p><strong>2. The Bridge:</strong> This file acts as a bridge. By uploading it now, you authenticate that you own this data.</p>
                                        <p><strong>3. Ghost Data:</strong> Yes, the old data technically stays in the old account (orphaned), but your new account gets a fresh, accessible copy.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-4 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                            <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg">Cancel</button>
                            <button onClick={handleStartImport} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Import & Merge</button>
                        </div>
                    </>
                );
            default:
                return null;
        }
    }

    return (
        // [ZEN FIX] Bumped Z-Index to 300 to match ExportModal
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg" role="dialog" aria-modal="true">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Import Data</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
                </div>
                {renderContent()}
            </div>
        </div>
    );
};

export default BackupImportModal;