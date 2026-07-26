import React from 'react';
import { EditorContent, Editor } from '@tiptap/react';
import { PaperSize, Orientation, Margins, PAPER_DIMENSIONS, MARGIN_STYLES } from '../types';

interface CanvasProps {
    editor: Editor | null;
    zoom: number;
    wordWrap: boolean;
    paperSize: PaperSize;
    orientation: Orientation;
    margins: Margins;
    bgColor: string;
    showFormatting: boolean;
}

export const Canvas: React.FC<CanvasProps> = ({
    editor, zoom, wordWrap, paperSize, orientation, margins, bgColor, showFormatting
}) => {
    const isLight = (color: string) => ['#f8fafc', '#fefce8', '#f3f4f6'].includes(color);
    const contrastColor = isLight(bgColor) ? '#1e293b' : '#e2e8f0';

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar flex justify-center perspective-1000 py-8 pb-32">
            <div
                id="daydream-print-container"
                className={`transition-all duration-300 relative flex-shrink-0 h-fit backdrop-blur-xl border-x shadow-2xl
                    ${isLight(bgColor) ? 'prose shadow-slate-300/50' : 'prose-invert shadow-black/50'}
                    ${MARGIN_STYLES[margins]}
                `}
                style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top center',
                    width: wordWrap ? (orientation === 'portrait' ? PAPER_DIMENSIONS[paperSize].w : PAPER_DIMENSIONS[paperSize].h) : '90vw',
                    minHeight: wordWrap ? (orientation === 'portrait' ? PAPER_DIMENSIONS[paperSize].h : PAPER_DIMENSIONS[paperSize].w) : '100vh',
                    backgroundColor: bgColor === 'transparent' ? 'rgba(10, 10, 10, 0.8)' : bgColor,
                    borderColor: isLight(bgColor) ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                    color: contrastColor,
                    '--tw-prose-body': contrastColor,
                    '--tw-prose-headings': contrastColor,
                    '--tw-prose-bold': isLight(bgColor) ? '#0f172a' : '#f8fafc',
                } as React.CSSProperties}
            >
                <div className={`min-h-full ${showFormatting ? 'show-formatting' : ''}`}>
                    <EditorContent editor={editor} />
                </div>

                <div className="border-t border-white/10 bg-black/40 p-2 text-[10px] text-slate-500 flex justify-between px-6 font-mono uppercase tracking-wider">
                    <div>Words: {editor?.storage.characterCount.words()}</div>
                    <div>Chars: {editor?.storage.characterCount.characters()}</div>
                </div>
            </div>
        </div>
    );
};
