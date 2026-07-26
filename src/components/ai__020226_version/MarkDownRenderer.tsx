import React from 'react';
import type { View } from '../../types';

interface MarkdownRendererProps {
    content: string;
    onNavigate: (view: View, data?: any) => void;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onNavigate }) => {
    const renderContent = () => {
        // Pre-process Headers to apply relative scaling classes
        let processedContent = content
            .replace(/^### (.*$)/gim, '<h3 class="text-[1.1em] font-bold mt-2 mb-1">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-[1.25em] font-bold mt-3 mb-2">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-[1.5em] font-extrabold mt-4 mb-2">$1</h1>');

        const linkPlaceholders: React.ReactNode[] = [];
        // [ZEN FIX] Renamed 'match' to '_match' to silence compiler unused var error
        const processedForLinks = processedContent.replace(/\[(.*?)\]\(gigi:\/\/edit-(tag|event)\/(.*?)\)/g, (_match, linkText, type, id) => {
            const view: View = type === 'tag' ? 'tagEditor' : 'eventEditor';
            const data = type === 'tag' ? { editTagId: id } : { editEventId: id };
            linkPlaceholders.push(
                <button key={`${type}-${id}`} onClick={() => onNavigate(view, data)} className="text-violet-600 dark:text-violet-400 font-bold underline hover:opacity-80">{linkText}</button>
            );
            return `@@GIGI_LINK_${linkPlaceholders.length - 1}@@`;
        });

        // Artifact Links [Artifact: ID]
        const processedForArtifacts = processedForLinks.replace(/\[Artifact: (.*?)\]/g, (_match, id) => {
            linkPlaceholders.push(
                <button key={`artifact-${id}`} onClick={() => onNavigate('theMatrix', { mediaId: id })} className="text-cyan-600 dark:text-cyan-400 font-bold underline hover:opacity-80">Artifact: {id}</button>
            );
            return `@@GIGI_LINK_${linkPlaceholders.length - 1}@@`;
        });

        const parts = processedForArtifacts
            .replace(/__\*\*\*(.*?)\*\*\*__/g, '<u><b><i>$1</i></b></u>')
            .replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>')
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/__(.*?)__/g, '<u>$1</u>')
            .split(/@@GIGI_LINK_(\d+)@@/g);

        const result: React.ReactNode[] = [];
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) {
                if (parts[i]) result.push(<span key={`text-${i}`} dangerouslySetInnerHTML={{ __html: parts[i] }} />);
            } else {
                const linkIndex = parseInt(parts[i], 10);
                if (linkPlaceholders[linkIndex]) result.push(linkPlaceholders[linkIndex]);
            }
        }
        return result;
    };

    return <div className="text-sm whitespace-pre-wrap break-words">{renderContent()}</div>;
};

export default MarkdownRenderer;