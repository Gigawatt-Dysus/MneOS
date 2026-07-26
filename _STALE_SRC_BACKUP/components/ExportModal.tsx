import React, { useState } from 'react';
import { BackupIcon, DocumentTextIcon } from './icons';
import { isFirebaseConfigured } from '../firebaseConfig';

interface ExportModalProps {
    onConfirm: (type: 'full' | 'data-only', includeConfig: boolean) => void;
    onCancel: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ onConfirm, onCancel }) => {
    const [includeConfig, setIncludeConfig] = useState(false);

    return (
        // [ZEN FIX] Z-Index 300 to float above Settings
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 animate-toastIn border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Export Archive</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Create a downloadable backup of your life story.
                </p>

                {isFirebaseConfigured() && (
                    <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                        <h4 className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400 mb-2 tracking-wider">Backup Manifest</h4>
                        <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                            <li className="flex justify-between"><span>Events & Timeline:</span> <span className="font-mono">Included</span></li>
                            <li className="flex justify-between"><span>Tags (People, Places...):</span> <span className="font-mono">Included</span></li>
                            <li className="flex justify-between"><span>Chat History:</span> <span className="font-mono">Included</span></li>
                            <li className="flex justify-between"><span>Journals:</span> <span className="font-mono">Included</span></li>
                            <li className="flex justify-between"><span>Media Links:</span> <span className="font-mono">Included</span></li>
                        </ul>
                        <p className="mt-2 text-[10px] text-gray-400 italic text-center">Data is fetched fresh from Cloud Database.</p>
                    </div>
                )}

                <div className="space-y-4">
                    <button 
                        onClick={() => onConfirm('data-only', includeConfig)}
                        className="w-full flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-violet-50 dark:hover:bg-gray-700/50 hover:border-violet-300 transition-all text-left group"
                    >
                        <div className="p-2 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 rounded-lg group-hover:scale-110 transition-transform">
                            <DocumentTextIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Light Backup (Data Only)</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Extremely fast JSON file. Best for transferring text data. 
                                <span className="text-yellow-600 dark:text-yellow-500 block mt-1 font-medium">Images are linked, not embedded.</span>
                            </p>
                        </div>
                    </button>

                    <button 
                        onClick={() => onConfirm('full', includeConfig)}
                        className="w-full flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700/50 hover:border-blue-300 transition-all text-left group"
                    >
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg group-hover:scale-110 transition-transform">
                            <BackupIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Full Archive</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                A complete snapshot. Includes Base64 encoded images if available locally.
                                <span className="block mt-1">File size may be large.</span>
                            </p>
                        </div>
                    </button>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <label className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={includeConfig} 
                            onChange={e => setIncludeConfig(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 bg-white dark:bg-gray-700 dark:border-gray-600"
                        />
                        <div>
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Include Cloud Config (API Keys)</span>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                Warning: This saves your API Keys into the file. Do not share this backup file if you enable this. Useful if your browser data is wiped often.
                            </p>
                        </div>
                    </label>
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;