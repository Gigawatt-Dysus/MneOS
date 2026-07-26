
import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Clock, Trash2, Search, RefreshCw, LayoutGrid } from 'lucide-react';
import { GlassButton } from '../GlassButton';
import { DaydreamStory, User } from '../../types';
import { appDataService } from '../../services/serviceManager';

interface DaydreamDashboardProps {
    user: User;
    onOpenStory: (storyId?: string) => void;
    addToast: (msg: string, type: 'success' | 'error') => void;
}

export const DaydreamDashboard: React.FC<DaydreamDashboardProps> = ({ user, onOpenStory, addToast }) => {
    const [stories, setStories] = useState<DaydreamStory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const loadStories = async () => {
        setIsLoading(true);
        const data = await appDataService.getDaydreams(user.id);
        setStories(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadStories();
    }, [user.id]);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Delete this daydream?")) {
            await appDataService.deleteDaydream(user.id, id);
            addToast("Story deleted.", 'success');
            loadStories();
        }
    };

    const filteredStories = stories.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="flex flex-col h-full bg-transparent text-slate-200">
            {/* STANDARD SUBHEADER (Anchored) */}
            <div className="h-14 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-50">
                {/* LEFT: Identity */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <span>Project GIGI</span>
                        <span className="text-slate-700">/</span>
                        <span className="text-cyan-500 flex items-center gap-2">
                            <LayoutGrid size={14} /> Daydream Library
                        </span>
                    </div>
                </div>

                {/* RIGHT: Actions */}
                <div className="flex items-center gap-3">
                    {/* SEARCH */}
                    <div className="relative group">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search drafts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-black/20 text-xs text-slate-200 pl-9 pr-3 py-1.5 rounded-full border border-white/5 focus:border-cyan-500/50 outline-none w-48 transition-all focus:w-64"
                        />
                    </div>

                    <div className="h-4 w-px bg-white/10" />

                    <GlassButton onClick={loadStories} variant="ghost" className="h-8 w-8 p-0 rounded-full" title="Refresh">
                        <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                    </GlassButton>

                    <GlassButton onClick={() => onOpenStory()} variant="primary" className="h-8 px-4 text-xs font-bold gap-2">
                        <Plus size={14} /> New Thread
                    </GlassButton>
                </div>
            </div>

            {/* CONTENT BODY (Transparent) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12">

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3].map(i => <div key={i} className="h-64 bg-white/5 rounded-2xl border border-white/5" />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {filteredStories.length === 0 && (
                            <div className="col-span-full py-32 text-center text-slate-300 border border-dashed border-white/10 rounded-3xl bg-black/20 backdrop-blur-sm">
                                <BookOpen size={48} className="mx-auto mb-4 text-violet-400 opacity-50" />
                                <h3 className="text-xl font-bold mb-2">The Library is Empty</h3>
                                <p className="text-sm opacity-50">Start your first daydream to begin co-authoring.</p>
                                <button onClick={() => onOpenStory()} className="mt-6 text-cyan-400 hover:text-cyan-300 text-sm font-bold underline decoration-dotted underline-offset-4">
                                    Create new thread
                                </button>
                            </div>
                        )}

                        {filteredStories.map(story => (
                            <div
                                key={story.id}
                                onClick={() => onOpenStory(story.id)}
                                className="group relative bg-[#0a0a0a]/60 backdrop-blur-md border border-white/5 hover:border-violet-500/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-violet-900/10 cursor-pointer overflow-hidden flex flex-col h-64"
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors line-clamp-2 leading-tight">
                                        {story.title}
                                    </h3>
                                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider ${story.status === 'published' ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-500/30 text-slate-500'}`}>
                                        {story.status}
                                    </span>
                                </div>

                                <p className="text-sm text-slate-400 line-clamp-4 leading-relaxed opacity-70 group-hover:opacity-100 flex-1 font-serif">
                                    {story.content?.content?.[0]?.content?.[0]?.text || "Empty draft..."}
                                </p>

                                <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono mt-4 pt-4 border-t border-white/5">
                                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(story.updatedAt).toLocaleDateString()}</span>
                                    <button
                                        onClick={(e) => handleDelete(e, story.id)}
                                        className="p-2 -m-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                        title="Delete Draft"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
