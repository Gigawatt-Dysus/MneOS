import React from 'react';
import type { View } from '../../types';

interface MarkdownRendererProps {
    content: string;
    onNavigate: (view: View, data?: any) => void;
    role?: 'user' | 'model' | 'assistant' | 'system';
    // [ZEN] Set true in non-chat contexts (studio, accession, messenger) to prevent
    // [bracket] text from being consumed by the vocal tag pipeline
    disableVocalTags?: boolean;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onNavigate, role, disableVocalTags = false }) => {
    const renderContent = () => {
        // Pre-process Headers to apply relative scaling classes
        // [ZEN] Aggressively trim archival content to ensure perfect alignment
        let processedContent = content.trim()
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-2 mb-1">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-3 mb-2">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-extrabold mt-4 mb-2">$1</h1>');

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

        // [ZEN] Prose Cleaning Helper for Tags
        const cleanProse = (text: string): string => {
            if (!text) return "";
            let clean = text.trim();
            if (!clean) return "";
            // Capitalize first letter
            clean = clean.charAt(0).toUpperCase() + clean.slice(1);
            // Add period if it's a phrase (multi-word) and lacks terminal punctuation
            // [ZEN] Don't add to timestamps (contains : and numbers)
            if (clean.split(/\s+/).length > 1 && !/[.!?]$/.test(clean) && !/\d+:\d+/.test(clean)) {
                clean += ".";
            }
            return clean;
        };

        // [ZEN] Vocal Tags [Inline rendering] — CHAT ONLY
        // Only active in AI chat context. In studio/accession/messenger, brackets are literal archival data.
        const processedForVocalTags = disableVocalTags
            ? processedForArtifacts
            : processedForArtifacts.replace(/\[([^\]]+)\]/g, (_match, tag) => {
                const cleanedTag = role === 'user' ? tag : cleanProse(tag);
                linkPlaceholders.push(
                    <span key={`vocal-${linkPlaceholders.length}`} className="inline-flex items-center px-1.5 py-0 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] font-black tracking-[0.2em] mx-1 shadow-[0_0_15px_rgba(34,211,238,0.1)] select-none align-middle relative -top-[1px]">
                        {cleanedTag}
                    </span>
                );
                return `@@GIGI_LINK_${linkPlaceholders.length - 1}@@`;
            });

        const parts = processedForVocalTags
            .replace(/__\*\*\*(.*?)\*\*\*__/g, '<u><b><i>$1</i></b></u>')
            .replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>')
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/__(.*?)__/g, '<u>$1</u>')
            // [ZEN] Inject a blank line after any bold-terminated line (message headers like
            // "**11:16 AM — Ruthie Evers**") so body text has breathing room — for every message.
            .replace(/<\/b>\n(?!\n)/g, '</b>\n\n')
            .split(/@@GIGI_LINK_(\d+)@@/g);

        const result: React.ReactNode[] = [];
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) {
                // [ZEN] Trim leading whitespace from any text segment that follows a placeholder
                // (the raw archival data often has a space after [10:34 PM] before "Messages:")
                let textPart = parts[i];
                textPart = textPart.trimStart();
                // [ZEN] For text that follows a placeholder (i > 0), inject a blank line
                // after the first newline so the message body has breathing room from the header
                if (i > 0) {
                    textPart = textPart.replace('\n', '\n\n');
                }
                if (textPart) result.push(<span key={`text-${i}`} dangerouslySetInnerHTML={{ __html: textPart }} />);
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