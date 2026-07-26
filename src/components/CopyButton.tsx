import React, { useState } from 'react';
import { ClipboardIcon, ClipboardCheckIcon } from './icons';

interface CopyButtonProps {
    textToCopy: string;
    className?: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ textToCopy, className }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    return (
        <button
            onClick={handleCopy}
            title="Copy to clipboard"
            className={`p-2 rounded-full transition-colors ${className} ${
                isCopied 
                ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-violet-100 hover:text-violet-600 dark:hover:bg-violet-500/20 dark:hover:text-violet-300'
            }`}
        >
            {isCopied ? <ClipboardCheckIcon className="w-5 h-5" /> : <ClipboardIcon className="w-5 h-5" />}
        </button>
    );
};

export default CopyButton;
