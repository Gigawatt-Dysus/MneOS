import React from 'react';
import { Editor } from '@tiptap/react';
import { 
    Bold, Italic, Heading1, Heading2, List, ListOrdered, Undo, Redo, 
    AlignLeft, AlignCenter, AlignRight, AlignJustify, Type, ChevronDown, X, Sparkles
} from 'lucide-react';
import { GlassButton } from '../../../GlassButton';
import { GOOGLE_FONTS } from '../types';

interface ToolbarProps {
    editor: Editor | null;
    loadFont: (font: string) => void;
    onClose: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ editor, loadFont, onClose }) => {
    return (
        <div className="h-12 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md flex items-center justify-center px-4 z-[60] shadow-md relative">
            <div className="flex flex-wrap gap-2 justify-center">
                <div className="flex items-center gap-0.5 border-r border-white/10 pr-2 mr-2">
                    <ToolbarBtn onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} icon={Undo} />
                    <ToolbarBtn onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} icon={Redo} />
                </div>
                <div className="flex items-center gap-0.5 border-r border-white/10 pr-2 mr-2">
                    <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} isActive={editor?.isActive('bold')} icon={Bold} />
                    <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} isActive={editor?.isActive('italic')} icon={Italic} />
                </div>
                <div className="flex items-center gap-0.5 border-r border-white/10 pr-2 mr-2">
                    <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor?.isActive('heading', { level: 1 })} icon={Heading1} />
                    <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor?.isActive('heading', { level: 2 })} icon={Heading2} />
                </div>
                <div className="flex items-center gap-0.5 border-r border-white/10 pr-2 mr-2 hidden sm:flex">
                    <ToolbarBtn onClick={() => editor?.chain().focus().setTextAlign('left').run()} isActive={editor?.isActive({ textAlign: 'left' })} icon={AlignLeft} />
                    <ToolbarBtn onClick={() => editor?.chain().focus().setTextAlign('center').run()} isActive={editor?.isActive({ textAlign: 'center' })} icon={AlignCenter} />
                    <ToolbarBtn onClick={() => editor?.chain().focus().setTextAlign('right').run()} isActive={editor?.isActive({ textAlign: 'right' })} icon={AlignRight} />
                    <ToolbarBtn onClick={() => editor?.chain().focus().setTextAlign('justify').run()} isActive={editor?.isActive({ textAlign: 'justify' })} icon={AlignJustify} />
                </div>
                <div className="flex items-center gap-0.5 border-r border-white/10 pr-2 mr-2">
                    <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} isActive={editor?.isActive('bulletList')} icon={List} />
                    <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} isActive={editor?.isActive('orderedList')} icon={ListOrdered} />
                </div>

                {/* Font Dropdown */}
                <div className="group relative h-full flex items-center border-l border-white/10 pl-2 ml-2 pb-1">
                    <GlassButton className="gap-2 text-xs font-bold uppercase tracking-wider pr-2">
                        <Type size={14} className="text-cyan-400" /> <span className="hidden sm:inline">Font</span> <ChevronDown size={12} />
                    </GlassButton>
                    <div className="absolute top-full right-0 mt-0 w-48 bg-[#0f1219] border border-white/10 rounded-xl shadow-2xl p-1 hidden group-hover:block z-[100] max-h-80 overflow-y-auto custom-scrollbar">
                        {GOOGLE_FONTS.map(font => (
                            <button
                                key={font}
                                onClick={() => loadFont(font)}
                                className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between mb-1 group
                                            ${editor?.isActive('textStyle', { fontFamily: font }) ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-white/5'}`}
                            >
                                <span style={{ fontFamily: font }}>{font}</span>
                                {editor?.isActive('textStyle', { fontFamily: font }) && <Sparkles size={10} />}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center border-l border-white/10 pl-2 ml-2">
                    <button onClick={onClose} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full text-slate-500 transition-colors">
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const ToolbarBtn = ({ onClick, isActive, icon: Icon, disabled }: any) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`p-2 rounded hover:bg-white/10 transition-colors ${isActive ? 'text-cyan-400 bg-white/10' : 'text-slate-500'} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
        <Icon size={18} />
    </button>
);
