import React from 'react';
import type { GigiJournalEntry } from '../types';
import { CheckCircleIcon } from './icons';

interface JournalTileProps {
    entry: GigiJournalEntry;
    isSelected: boolean;
    onClick: () => void;
}

const formatTileDate = (date: Date): string => {
    if (!date || isNaN(date.getTime())) return "Invalid Date";
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
};

const JournalTile: React.FC<JournalTileProps> = ({ entry, isSelected, onClick }) => {
    
    const contentSnippet = entry.content.length > 150 ? entry.content.substring(0, 150) + '...' : entry.content;

    const baseClasses = "relative group flex flex-col h-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg border transition-all duration-200 cursor-pointer";
    const selectedClasses = "ring-2 ring-violet-500 border-violet-500";
    const unselectedClasses = "border-gray-200 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1 hover:border-violet-300 dark:hover:border-violet-600";

    return (
        <div onClick={onClick} className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}>
            {isSelected && (
                <div className="absolute top-2 right-2 z-10">
                    <CheckCircleIcon className="w-7 h-7 text-violet-600 bg-white rounded-full" />
                </div>
            )}
            <div className="relative p-3 bg-gray-900/80 text-white rounded-t-lg">
                <h3 className="text-md font-semibold text-gray-100 font-serif truncate">{entry.title}</h3>
                <p className="text-xs text-gray-400">{formatTileDate(entry.creationDate)}</p>
            </div>
            <div className="p-4 flex-grow">
                <p className="text-sm text-gray-600 dark:text-gray-400">{contentSnippet}</p>
            </div>
        </div>
    );
};

export default JournalTile;