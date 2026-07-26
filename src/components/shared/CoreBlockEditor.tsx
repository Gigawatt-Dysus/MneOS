import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent, FloatingMenu, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';
import { Heading1, Heading2, Text, List, Quote, Tag as TagIcon, Unlink, Undo, Redo, Scissors } from 'lucide-react';
import { Tag } from '../../types';
import { appDataService } from '../../services/serviceManager';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';

interface CoreBlockEditorProps {
    value: string;
    onChange: (text: string) => void;
    userId: string;
    allTags?: Tag[];
    placeholder?: string;
    className?: string;
}

export const CoreBlockEditor: React.FC<CoreBlockEditorProps> = ({
    value,
    onChange,
    userId,
    allTags = [],
    placeholder = "Type '/' for commands or highlight to tag...",
    className = ''
}) => {
    const [isTagging, setIsTagging] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [tagRange, setTagRange] = useState<{from: number, to: number} | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            Placeholder.configure({
                placeholder,
            }),
            Typography,
            Link.configure({
                openOnClick: false,
                autolink: false,
                linkOnPaste: false,
                protocols: ['http', 'https', 'mailto', 'tel', 'tag'],
                HTMLAttributes: {
                    class: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold cursor-pointer transition-colors no-underline',
                },
            }),
            Markdown.configure({
                html: false,
                tightLists: true,
                tightListClass: '',
                bulletListMarker: '-',
                linkify: false,
                breaks: true,
            }),
            GlobalDragHandle.configure({
                dragHandleWidth: 20,
                scrollTreshold: 100,
            }),
        ],
        content: value || '',
        editorProps: {
            attributes: {
                class: 'prose prose-invert prose-fuchsia max-w-none focus:outline-none min-h-[300px] prose-p:my-1 prose-li:my-0',
            },
        },
        onUpdate: ({ editor }) => {
            // Use tiptap-markdown to get cleanly serialized markdown!
            onChange(editor.storage.markdown.getMarkdown());
        },
    });

    useEffect(() => {
        if (editor && value) {
            const currentMarkdown = editor.storage.markdown.getMarkdown();
            if (value !== currentMarkdown && editor.isEmpty) {
                // Safely load initial async data without resetting user typing
                editor.commands.setContent(value);
            }
        }
    }, [value, editor]);

    if (!editor) {
        return null;
    }

    const selectedText = editor ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to) : '';
    const selectedTextLength = selectedText.trim().length;
    const canBeCategory = selectedTextLength > 0 && selectedTextLength <= 100 && !selectedText.includes('\n');

    const extractAndFormat = (formatCallback: (chain: any) => any) => {
        if (!editor) return;
        const { state } = editor;
        const { selection } = state;
        const { empty, from, to, $from, $to } = selection;

        if (empty) {
            formatCallback(editor.chain().focus()).run();
            return;
        }

        const isSameBlock = $from.parent === $to.parent;
        const text = state.doc.textBetween(from, to, ' ');
        const blockText = $from.parent.textContent;

        // If selection spans blocks or covers the whole block, use native behavior
        if (!isSameBlock || text.trim() === blockText.trim()) {
            formatCallback(editor.chain().focus()).run();
            return;
        }

        // Selection is partial and within a single block. We must isolate it first.
        const isAtStart = $from.parentOffset === 0;
        const isAtEnd = $to.parentOffset === $to.parent.content.size;

        // Split after selection if there is text after it
        if (!isAtEnd) {
            editor.chain().focus().setTextSelection(to).splitBlock().run();
        }

        // Split before selection if there is text before it
        if (!isAtStart) {
            editor.chain().focus().setTextSelection(from).splitBlock().run();
            // Cursor automatically lands at the start of the newly isolated block
        } else {
            // If we didn't split at start, move cursor back to original start position
            editor.chain().focus().setTextSelection(from).run();
        }

        // Apply formatting to the isolated block
        formatCallback(editor.chain().focus()).run();
    };

    const handleMakeCategory = () => {
        extractAndFormat((chain) => {
            if (editor?.isActive('bulletList')) {
                chain = chain.liftListItem('listItem');
            }
            return chain.toggleHeading({ level: 2 });
        });
    };

    const handleMakeDetail = () => {
        extractAndFormat((chain) => {
            // If we are already inside a list, splitting the block natively creates a sibling list item.
            // We only apply toggleBulletList if we are NOT in a list to prevent toggling it off.
            if (!editor?.isActive('bulletList')) {
                return chain.toggleBulletList();
            }
            return chain;
        });
    };

    const applyTag = (type: string, id: string) => {
        if (tagRange) {
            editor.chain().focus().setTextSelection(tagRange).setLink({ href: `tag://${type}:${id}` }).run();
        } else {
            editor.chain().focus().setLink({ href: `tag://${type}:${id}` }).run();
        }
        setIsTagging(false);
        setTagRange(null);
    };

    const handleCreateTag = async (name: string, type: Tag['type']) => {
        const id = `tag-${Date.now()}`;
        const newTag: Tag = {
            id,
            name,
            type: type,
            description: '',
            privateNotes: '',
            tagIds: [],
            mediaIds: [],
            mediaGallery: [],
            metadata: {},
            isPrivate: false,
            isFiction: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } as Tag;

        try {
            await appDataService.saveTag(userId, newTag);
            applyTag(type, id);
        } catch (err) {
            console.error("Failed to create inline tag:", err);
        }
    };

    return (
        <div className={`relative w-full border border-white/10 rounded-xl bg-black/40 shadow-inner focus-within:border-fuchsia-500/50 focus-within:shadow-[0_0_15px_rgba(217,70,239,0.1)] transition-all p-4 ${className}`}>
            
            {/* Editor Action Bar (Sticky Top Right) */}
            <div className="sticky top-2 float-right flex gap-1 z-10 opacity-30 hover:opacity-100 transition-opacity bg-black/60 p-1 rounded-lg border border-white/5 shadow-md">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`p-1.5 rounded-md hover:bg-slate-800 transition-colors ${editor.isActive('heading', { level: 2 }) ? 'text-fuchsia-400 bg-fuchsia-900/20' : 'text-slate-400 hover:text-white'}`}
                    title="Toggle Category (Entire Block)"
                >
                    <Heading2 size={14} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-1.5 rounded-md hover:bg-slate-800 transition-colors ${editor.isActive('bulletList') ? 'text-cyan-400 bg-cyan-900/20' : 'text-slate-400 hover:text-white'}`}
                    title="Toggle Detail (Entire Block)"
                >
                    <List size={14} />
                </button>
                <div className="w-px bg-white/10 mx-1 my-1" />
                <button
                    type="button"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo size={14} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo size={14} />
                </button>
            </div>
            
            {/* Notion-style Floating Menu for empty lines */}
            <FloatingMenu editor={editor} tippyOptions={{ duration: 100 }} className="flex flex-col gap-1 bg-slate-900 border border-slate-700 p-2 rounded-lg shadow-xl w-48 z-50">
                <span className="text-[10px] uppercase text-slate-500 font-bold px-1 mb-1 tracking-wider">Add Structure</span>
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 transition-colors text-sm text-left ${editor.isActive('heading', { level: 2 }) ? 'text-fuchsia-400 bg-fuchsia-900/20' : 'text-slate-300'}`}
                >
                    <div className="w-5 h-5 bg-slate-800 rounded flex items-center justify-center font-bold text-[10px]">+</div>
                    Create Category
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 transition-colors text-sm text-left ${editor.isActive('bulletList') ? 'text-cyan-400 bg-cyan-900/20' : 'text-slate-300'}`}
                >
                    <div className="w-5 h-5 bg-slate-800 rounded flex items-center justify-center font-bold text-[10px]">+</div>
                    Create Detail
                </button>
            </FloatingMenu>

            {/* Notion-style text formatting bubble menu */}
            <BubbleMenu editor={editor} tippyOptions={{ duration: 100, onHidden: () => setIsTagging(false) }} className="flex bg-slate-900 border border-slate-700 p-1 rounded-lg shadow-xl min-w-[120px]">
                {!isTagging ? (
                    <div className="flex gap-1 items-center">
                        <button
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            className={`px-2 py-1 rounded-md text-sm font-bold hover:bg-slate-800 text-slate-300 ${editor.isActive('bold') ? 'bg-fuchsia-500/20 text-fuchsia-400' : ''}`}
                        >
                            B
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            className={`px-2 py-1 rounded-md text-sm italic hover:bg-slate-800 text-slate-300 ${editor.isActive('italic') ? 'bg-fuchsia-500/20 text-fuchsia-400' : ''}`}
                        >
                            I
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleBlockquote().run()}
                            className={`p-1.5 rounded-md hover:bg-slate-800 text-slate-300 ${editor.isActive('blockquote') ? 'bg-fuchsia-500/20 text-fuchsia-400' : ''}`}
                        >
                            <Quote size={14} />
                        </button>
                        <div className="w-px h-4 bg-slate-700 mx-1" />
                        <div className="w-px h-4 bg-slate-700 mx-1" />
                        
                        {/* Category Formatters */}
                        <div className="flex items-center bg-slate-800/50 rounded-md overflow-hidden border border-slate-700/50">
                            <button
                                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                                className="px-1.5 py-1 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                                title="Convert ENTIRE block to Category (H2)"
                            >
                                <Heading2 size={14} />
                            </button>
                            <div className="w-px h-4 bg-slate-600" />
                            <button
                                onClick={handleMakeCategory}
                                disabled={!canBeCategory}
                                className={`px-1.5 py-1 flex items-center transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-fuchsia-900/20 text-fuchsia-400' : 'text-slate-300 hover:bg-slate-700'} ${!canBeCategory ? 'opacity-30 cursor-not-allowed' : ''}`}
                                title={canBeCategory ? "Surgically extract highlighting into a new Category" : "Selection too long for a Category"}
                            >
                                <Scissors size={12} className="text-fuchsia-400" />
                            </button>
                        </div>

                        <div className="w-px h-4 bg-slate-700 mx-1" />

                        {/* Detail Formatters */}
                        <div className="flex items-center bg-slate-800/50 rounded-md overflow-hidden border border-slate-700/50">
                            <button
                                onClick={() => editor.chain().focus().toggleBulletList().run()}
                                className="px-1.5 py-1 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                                title="Convert ENTIRE block to Detail bullet"
                            >
                                <List size={14} />
                            </button>
                            <div className="w-px h-4 bg-slate-600" />
                            <button
                                onClick={handleMakeDetail}
                                className={`px-1.5 py-1 flex items-center transition-colors ${editor.isActive('bulletList') ? 'bg-cyan-900/20 text-cyan-400' : 'text-slate-300 hover:bg-slate-700'}`}
                                title="Surgically extract highlighting into a new Detail bullet"
                            >
                                <Scissors size={12} className="text-cyan-400" />
                            </button>
                        </div>
                        <div className="w-px h-4 bg-slate-700 mx-1" />
                        {editor.isActive('link') ? (
                            <button
                                onClick={() => editor.chain().focus().unsetLink().run()}
                                className="px-2 py-1 flex items-center gap-1.5 rounded-md text-xs font-bold hover:bg-rose-900/30 text-rose-400 transition-colors"
                                title="Remove tag link (Finite Transfiguratio)"
                            >
                                <Unlink size={12} /> Untag
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    setIsTagging(true);
                                    const selection = editor.state.selection;
                                    setTagRange({ from: selection.from, to: selection.to });
                                    const selectedText = editor.state.doc.textBetween(selection.from, selection.to);
                                    setSearchQuery(selectedText.trim());
                                }}
                                className="px-2 py-1 flex items-center gap-1.5 rounded-md text-xs font-bold hover:bg-fuchsia-900/30 text-fuchsia-400 transition-colors"
                                title="Link an entity. Only tag items that act as network hubs or require their own rich data container to prevent graph bloat."
                            >
                                <TagIcon size={12} /> Tag Entity
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col w-64 max-h-64 p-1">
                        <input
                            autoFocus
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search or create tag..."
                            className="bg-slate-800 text-sm text-white px-2 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-fuchsia-500 mb-2 w-full"
                        />
                        <div className="flex flex-col overflow-y-auto gap-1 custom-scrollbar">
                            {allTags.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5).map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => applyTag(tag.type, tag.id)}
                                    className="text-left text-xs px-2 py-2 hover:bg-slate-800 text-slate-300 rounded flex justify-between items-center transition-colors"
                                >
                                    <span className="font-medium truncate">{tag.name}</span>
                                    <span className="text-[10px] text-slate-500 uppercase ml-2 flex-shrink-0">{tag.type}</span>
                                </button>
                            ))}
                            {searchQuery.trim() && !allTags.find(t => t.name.toLowerCase() === searchQuery.toLowerCase()) && (
                                <div className="mt-2 p-2 bg-slate-900/50 rounded border border-slate-700/50 flex flex-col gap-2">
                                    <span className="text-[10px] text-slate-400 font-medium">Create "{searchQuery}" as:</span>
                                    <div className="flex flex-wrap gap-1">
                                        {(['person', 'place', 'thing', 'concept', 'event', 'pet'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => handleCreateTag(searchQuery.trim(), type)}
                                                className="text-[9px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded uppercase tracking-wider transition-colors border border-slate-700"
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </BubbleMenu>

            <EditorContent editor={editor} className="custom-tiptap-editor" />
        </div>
    );
};
