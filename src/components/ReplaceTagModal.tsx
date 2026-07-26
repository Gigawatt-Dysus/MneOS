import React, { useState } from 'react';
import type { Tag } from '../types';

interface ReplaceTagModalProps {
    tagToReplace: Tag;
    allTags: Tag[];
    onConfirm: (tagToDeleteId: string, replacementTagId: string) => void;
    onClose: () => void;
}

const ReplaceTagModal: React.FC<ReplaceTagModalProps> = ({ tagToReplace, allTags, onConfirm, onClose }) => {
    const [replacementId, setReplacementId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isConfirming, setIsConfirming] = useState(false);

    const availableTags = allTags.filter(t => t.id !== tagToReplace.id);
    
    const suggestedTags = searchTerm
        ? availableTags.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 5)
        : [];
        
    const handleConfirm = () => {
        if (replacementId) {
            onConfirm(tagToReplace.id, replacementId);
        }
    };
    
    const selectTag = (tag: Tag) => {
        setReplacementId(tag.id);
        setSearchTerm(tag.name);
    };
    
    const replacementTag = allTags.find(t => t.id === replacementId);

    const renderInitialContent = () => (
        <>
            <div className="p-6 space-y-6">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 rounded-r-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                        This will replace every instance of the original tag with the new tag you select. The original tag will then be permanently deleted.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4 items-end">
                    <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Tag to Replace</label>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-200 truncate">{tagToReplace.name}</p>
                    </div>

                    <div className="relative">
                        <label htmlFor="replacement-tag" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Replacement Tag</label>
                        <input
                            id="replacement-tag"
                            type="text"
                            value={searchTerm}
                            onChange={e => {
                                setSearchTerm(e.target.value);
                                if(replacementId) setReplacementId(''); // Clear selection if user types again
                            }}
                            placeholder="Search for a replacement tag..."
                            className="mt-1 block w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 sm:text-sm text-gray-900 dark:text-white"
                        />
                        {searchTerm && suggestedTags.length > 0 && !replacementTag && (
                            <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
                                {suggestedTags.map(tag => (
                                    <li key={tag.id} onClick={() => selectTag(tag)} className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">{tag.name} ({tag.type})</li>
                                ))}
                            </ul>
                        )}
                        {searchTerm && suggestedTags.length === 0 && !replacementTag && <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg p-2 text-sm text-gray-500">No tags found.</div>}
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-4 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg">Cancel</button>
                <button 
                    onClick={() => setIsConfirming(true)}
                    disabled={!replacementId}
                    className="px-6 py-2 bg-violet-600 text-white font-semibold rounded-lg shadow-md hover:bg-violet-700 disabled:bg-violet-400 dark:disabled:bg-violet-800 disabled:cursor-not-allowed"
                >
                    Replace Tag...
                </button>
            </div>
        </>
    );

    const renderConfirmationContent = () => (
        <>
            <div className="p-6 space-y-4">
                <div className="p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-r-lg">
                    <h3 className="font-bold text-red-800 dark:text-red-200">Are you absolutely sure?</h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        This action is permanent and cannot be undone.
                    </p>
                </div>
                <p className="text-center text-lg text-gray-700 dark:text-gray-300">
                    Replace all instances of <br/>
                    <strong className="text-violet-600 dark:text-violet-400">"{tagToReplace.name}"</strong>
                    <br/> with <br/>
                    <strong className="text-violet-600 dark:text-violet-400">"{replacementTag?.name}"</strong>
                    <br/> and permanently delete the original tag?
                </p>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-4 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                <button onClick={() => setIsConfirming(false)} className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg">Cancel</button>
                <button 
                    onClick={handleConfirm}
                    className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700"
                >
                    Yes, Replace & Delete
                </button>
            </div>
        </>
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg" role="dialog" aria-modal="true">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Replace Tag</h2>
                     <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
                </div>
                
                {isConfirming ? renderConfirmationContent() : renderInitialContent()}

            </div>
        </div>
    );
};

export default ReplaceTagModal;