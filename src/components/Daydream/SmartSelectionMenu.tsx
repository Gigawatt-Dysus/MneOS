import React, { useState } from 'react';
import { BubbleMenu, Editor } from '@tiptap/react';
import { Sparkles, Scissors, Palette, BookOpen, Loader2 } from 'lucide-react';
import { GlassButton } from '../GlassButton';

interface SmartSelectionMenuProps {
    editor: Editor;
    onAiEdit: (instruction: string) => void;
}

export const SmartSelectionMenu: React.FC<SmartSelectionMenuProps> = ({ editor, onAiEdit }) => {
    const [synonyms, setSynonyms] = useState<string[]>([]);
    const [isLoadingSynonyms, setIsLoadingSynonyms] = useState(false);
    const [showSynonyms, setShowSynonyms] = useState(false);

    const handleLookupSynonym = async () => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, ' ');
        if (!text || text.length > 30) return; // Only lookup single phrases

        setShowSynonyms(true);
        setIsLoadingSynonyms(true);
        try {
            const res = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(text)}&max=5`);
            const data = await res.json();
            setSynonyms(data.map((d: any) => d.word));
        } catch (e) {
            console.error(e);
            setSynonyms(['Error loading synonyms']);
        } finally {
            setIsLoadingSynonyms(false);
        }
    };

    const applySynonym = (word: string) => {
        editor.chain().focus().insertContent(word).run();
        setShowSynonyms(false);
    };

    return (
        <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 100, maxWidth: 400 }}
            className="flex flex-col gap-2 bg-[#0f1219]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95"
        >
            {!showSynonyms ? (
                <div className="flex items-center gap-1">
                    <GlassButton onClick={() => onAiEdit("Expand on this text, adding more detail and sensory description.")} variant="ghost" className="h-8 px-2 text-xs" title="Expand">
                        <Sparkles size={14} className="mr-1 text-cyan-400" /> Expand
                    </GlassButton>

                    <GlassButton onClick={() => onAiEdit("Make this text more concise and punchy.")} variant="ghost" className="h-8 px-2 text-xs" title="Shorten">
                        <Scissors size={14} className="mr-1 text-orange-400" /> Shorten
                    </GlassButton>

                    <div className="w-px h-4 bg-white/10 mx-1" />

                    <div className="group relative">
                        <GlassButton className="h-8 px-2 text-xs" title="Tone Shift">
                            <Palette size={14} className="mr-1 text-violet-400" /> Tone
                        </GlassButton>
                        <div className="absolute bottom-full mb-2 left-0 w-32 bg-black/90 border border-white/10 rounded-lg p-1 hidden group-hover:block">
                            <button onClick={() => onAiEdit("Rewrite in a darker, more ominous tone.")} className="w-full text-left px-2 py-1 text-[10px] hover:bg-white/10 rounded text-slate-300">Darker</button>
                            <button onClick={() => onAiEdit("Rewrite in a more formal, academic tone.")} className="w-full text-left px-2 py-1 text-[10px] hover:bg-white/10 rounded text-slate-300">Formal</button>
                            <button onClick={() => onAiEdit("Rewrite in a whimsical, lighter tone.")} className="w-full text-left px-2 py-1 text-[10px] hover:bg-white/10 rounded text-slate-300">Whimsical</button>
                        </div>
                    </div>

                    <GlassButton onClick={handleLookupSynonym} variant="ghost" className="h-8 px-2 text-xs" title="Synonyms">
                        <BookOpen size={14} className="mr-1 text-emerald-400" /> Ref
                    </GlassButton>
                </div>
            ) : (
                <div className="flex flex-col gap-1 min-w-[150px]">
                    <div className="flex justify-between items-center px-2 py-1 border-b border-white/10">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Synonyms</span>
                        <button onClick={() => setShowSynonyms(false)} className="text-slate-500 hover:text-white"><XIcon size={12} /></button>
                    </div>
                    {isLoadingSynonyms ? (
                        <div className="p-2 flex justify-center"><Loader2 size={14} className="animate-spin text-slate-500" /></div>
                    ) : (
                        <div className="flex flex-wrap gap-1 p-1">
                            {synonyms.length > 0 ? synonyms.map(s => (
                                <button key={s} onClick={() => applySynonym(s)} className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-200">
                                    {s}
                                </button>
                            )) : <div className="p-2 text-[10px] text-slate-500">No matches found.</div>}
                        </div>
                    )}
                </div>
            )}
        </BubbleMenu>
    );
};

const XIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);
