import { useEffect } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import CharacterCount from '@tiptap/extension-character-count';
import Typography from '@tiptap/extension-typography';
import { AutoPagination } from '../extensions/AutoPagination';
import { PaperSize, PAPER_DIMENSIONS } from './types';

export const useDaydreamEditor = (paperSize: PaperSize) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: 'It was a dark and stormy night at the edge of the digital frontier...',
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            TextStyle,
            FontFamily,
            CharacterCount,
            Typography,
            AutoPagination.configure({
                pageHeight: 1056,
            }),
        ],
        content: '<p></p>',
        editorProps: {
            attributes: {
                class: 'max-w-none focus:outline-none min-h-[500px] text-lg leading-relaxed selection:bg-violet-500/30',
            },
        },
    });

    useEffect(() => {
        if (editor && !editor.isDestroyed) {
            const dim = PAPER_DIMENSIONS[paperSize];
            let heightPx = 1056;
            if (dim) {
                if (dim.h.endsWith('in')) heightPx = parseFloat(dim.h) * 96;
                else if (dim.h.endsWith('mm')) heightPx = parseFloat(dim.h) * 3.7795;
                else if (dim.h.endsWith('px')) heightPx = parseFloat(dim.h);
            }
            (editor.commands as any).setPageHeight(heightPx);
        }
    }, [paperSize, editor]);

    const loadFont = (fontFamily: string) => {
        if (!fontFamily || !editor) return;
        const linkId = `font-${fontFamily.replace(/\s+/g, '-')}`;
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@400;700&display=swap`;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        editor.chain().focus().setFontFamily(fontFamily).run();
    };

    return { editor, loadFont };
};
