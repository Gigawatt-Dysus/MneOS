
import React from 'react';

interface DataRescueModalProps {
    count: number;
    userEmail?: string;
    onConfirm: () => void;
    onDismiss: () => void;
    isSyncing: boolean;
}

const DataRescueModal: React.FC<DataRescueModalProps> = ({ count, userEmail, onConfirm, onDismiss, isSyncing }) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-violet-500/50 animate-toastIn">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-full text-violet-600 dark:text-violet-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Merge Device Data?</h2>
                        <div className="mt-2 text-sm">
                            <p className="text-gray-600 dark:text-gray-300 mb-2">
                                ✅ You are logged in as <span className="font-bold text-violet-600 dark:text-violet-400">{userEmail || 'Cloud User'}</span>.
                            </p>
                            <p className="text-gray-600 dark:text-gray-300">
                                However, we found <strong>{count} items</strong> saved on this device from a previous offline session.
                            </p>
                            <p className="text-gray-600 dark:text-gray-300 mt-2 font-medium">
                                Do you want to upload this device data to your Cloud Account?
                            </p>
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button 
                        onClick={onDismiss}
                        disabled={isSyncing}
                        className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        No, ignore local data
                    </button>
                    <button 
                        onClick={onConfirm}
                        disabled={isSyncing}
                        className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-violet-500/30 transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-wait flex items-center gap-2"
                    >
                        {isSyncing ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Uploading...
                            </>
                        ) : (
                            "Yes, Merge to Cloud"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataRescueModal;
