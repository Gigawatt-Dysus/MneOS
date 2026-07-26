import React from 'react';
import { 
    Search, Upload, Image as ImageIcon, FileText, 
    ArrowUpDown, Grid, LayoutGrid, Maximize, 
    CheckSquare, Trash2, X, Import 
} from 'lucide-react';
import { GlassButton } from '../GlassButton';

interface MatrixToolbarProps {
    searchQuery?: string;
    onSearch?: (query: string, exact: boolean) => void;
    onImport: () => void;
    onStageFiles: (files: File[]) => void;
    viewMode: 'sm' | 'md' | 'lg';
    setViewMode: (mode: 'sm' | 'md' | 'lg') => void;
    sortOrder: 'asc' | 'desc';
    setSortOrder: (order: 'asc' | 'desc') => void;
    totalAssets: number;
    activeTab: 'visuals' | 'documents';
    setActiveTab: (tab: 'visuals' | 'documents') => void;
    isSelectionMode: boolean;
    setIsSelectionMode: (v: boolean) => void;
    selectedCount: number;
    onClearSelection: () => void;
    onDelete: () => void;
    setIsSearching: (v: boolean) => void;
    setOverlayText: (t: string) => void;
}

export const MatrixToolbar: React.FC<MatrixToolbarProps> = ({
    onSearch,
    onImport,
    onStageFiles,
    viewMode,
    setViewMode,
    sortOrder,
    setSortOrder,
    activeTab,
    setActiveTab,
    isSelectionMode,
    setIsSelectionMode,
    selectedCount,
    onClearSelection,
    onDelete
}) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onStageFiles(Array.from(e.target.files));
        }
    };

    return (
        <div className="p-4 border-b border-white/5 bg-[#0f1219]/80 backdrop-blur-md sticky top-0 z-30 shadow-2xl overflow-x-hidden">
            <div className="flex flex-col md:flex-row gap-4">
                
                {/* --- ROW 1 (Mobile): Upload & Import Actions --- */}
                <div className="flex justify-between md:order-2 md:w-auto gap-3">
                    <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                    />
                    
                    <GlassButton onClick={() => fileInputRef.current?.click()} variant="secondary" className="flex-1 md:flex-none justify-center px-4">
                        <Upload size={18} className="mr-2"/> Upload
                    </GlassButton>
                    
                    <GlassButton onClick={onImport} variant="secondary" className="flex-1 md:flex-none justify-center px-4">
                        <Import size={18} className="mr-2"/> Import
                    </GlassButton>
                </div>

                {/* --- ROW 2 (Mobile): Search Bar --- */}
                <div className="flex-1 relative group md:order-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 group-focus-within:animate-pulse transition-colors" size={18} />
                    <input 
                        type="text" 
                        onChange={(e) => onSearch && onSearch(e.target.value, false)}
                        placeholder="Search the Matrix..." 
                        className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-cyan-500/50 rounded-xl pl-12 pr-4 py-3 text-sm text-slate-200 outline-none transition-all placeholder-slate-600 shadow-inner"
                    />
                </div>

                {/* --- ROW 3 (Mobile): View Controls --- */}
                {/* [ZEN FIX] Added pr-8 and mr-4 to aggressively pull items away from the right edge */}
                <div className="flex justify-between items-center md:order-3 md:w-auto pr-8 mr-4 md:pr-0 md:mr-0">
                    
                    {/* Left: Toggles */}
                    <div className="flex gap-2 items-center">
                        <div className="bg-black/40 p-1 rounded-xl border border-white/5 flex gap-1">
                            <button 
                                onClick={() => setActiveTab('visuals')}
                                className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'visuals' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                            >
                                <ImageIcon size={14} className="mr-2"/> Visuals
                            </button>
                            <button 
                                onClick={() => setActiveTab('documents')}
                                className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'documents' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                            >
                                <FileText size={14} className="mr-2"/> Docs
                            </button>
                        </div>

                        <div className="w-px h-6 bg-white/10 mx-2" />

                        <button 
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} 
                            className="p-2 rounded-lg bg-black/40 border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                            title="Sort Order"
                        >
                             <ArrowUpDown size={16} className={sortOrder === 'desc' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                    </div>

                    {/* Right: Selection & Layout */}
                    <div className="flex gap-2 items-center ml-2">
                        
                        {isSelectionMode && (
                            <div className="flex items-center gap-2 animate-in slide-in-from-right-4 fade-in mr-2">
                                <span className="text-xs font-bold text-cyan-400 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-500/20 hidden sm:block">
                                    {selectedCount}
                                </span>
                                {selectedCount > 0 && (
                                    <button onClick={onDelete} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                <button onClick={onClearSelection} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                        )}

                        <div className="w-px h-6 bg-white/10 mx-1 md:mx-2" />

                        <button 
                            onClick={() => setIsSelectionMode(!isSelectionMode)} 
                            className={`p-2 rounded-lg border transition-all ${isSelectionMode ? 'bg-cyan-500 text-white border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-black/40 border-white/5 text-slate-500 hover:text-white hover:bg-white/5'}`}
                            title="Toggle Selection Mode"
                        >
                            <CheckSquare size={16} />
                        </button>

                        <div className="bg-black/40 p-1 rounded-xl border border-white/5 flex gap-1">
                            <button 
                                onClick={() => setViewMode('sm')} 
                                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'sm' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Grid size={14} />
                            </button>
                            <button 
                                onClick={() => setViewMode('md')} 
                                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'md' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <LayoutGrid size={14} />
                            </button>
                            <button 
                                onClick={() => setViewMode('lg')} 
                                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'lg' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Maximize size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};