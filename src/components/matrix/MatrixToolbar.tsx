import React from 'react';
import { Search, Upload, Image as ImageIcon, FileText,
    ArrowUpDown, Grid, LayoutGrid, Maximize,
    CheckSquare, Trash2, X, Import, Sparkles, MessageSquareText, UserCheck, Activity, Loader2, Check, Archive, HelpCircle, Inbox, Wrench, ChevronDown, AlertTriangle, CalendarDays,
    Shield, Globe, Lock, Ghost, Filter, Layers, Film
} from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { GlassButton } from '../GlassButton';
import { SubHeader, SubHeaderAction } from '../SubHeader';
import type { Bucket } from '../../types';

interface MatrixToolbarProps {
    searchQuery?: string;
    onSearch?: (query: string, exact: boolean) => void;
    onImport: () => void;
    onStageFiles: (files: File[]) => void;
    viewMode: 'sm' | 'md' | 'lg' | 'dnd';
    setViewMode: (mode: 'sm' | 'md' | 'lg' | 'dnd') => void;
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
    // [ZEN EWO 005] Neural Re-Up action
    onNeuralReUp?: () => Promise<void>;
    isNeuralReUpRunning?: boolean;
    // [ZEN EWO 006] Neural Glass narrative overlay
    showNarratives?: boolean;
    onToggleNarratives?: () => void;
    // [ZEN EWO 008] Identity & Curation HUD
    showIdentity?: boolean;
    onToggleIdentity?: () => void;
    showShoebox?: boolean;
    onToggleShoebox?: () => void;
    // [ZEN] Fictional Lore
    showFictionalLore?: boolean;
    onToggleFictionalLore?: () => void;
    // [ZEN] Flagged Rotations
    showRotationReviews?: boolean;
    onToggleRotationReviews?: () => void;
    // [ZEN] Director's Cut (Raw Dailies)
    showRawDailies?: boolean;
    onToggleRawDailies?: () => void;
    // [ZEN] AI Provenance Filters
    aiProvenanceFilter?: 'all' | 'gemini-2.5-flash' | 'grok-test' | 'gemini-test' | 'blank-metadata' | 'ai-processed' | 'inferred-dates';
    onAiProvenanceFilterChange?: (filter: 'all' | 'gemini-2.5-flash' | 'grok-test' | 'gemini-test' | 'blank-metadata' | 'ai-processed' | 'inferred-dates') => void;
    // [ZEN] Explicit Accession Gateway Access
    onOpenAirlock?: () => void;
    // [ZEN] Target Collection Toggle
    targetCollection?: 'media' | 'pending_accessions';
    onTargetCollectionChange?: (col: 'media' | 'pending_accessions') => void;
    // [ZEN] Buckets / Vaults
    buckets?: Bucket[];
    activeBucketId?: string | null;
    onBucketChange?: (bucketId: string | null) => void;
    onManageBuckets?: () => void;
    // [ZEN] Promote to Vortex
    onPromoteToVortex?: () => void;
    showTimeslidePortal?: boolean;
    onToggleTimeslidePortal?: () => void;
    timeslidePortalNode?: React.ReactNode;
    // [ZEN] Bulk Move
    onMoveToBucket?: (bucketId: string | null) => void;
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
    onDelete,
    onNeuralReUp,
    isNeuralReUpRunning = false,
    showNarratives = false,
    onToggleNarratives,
    showIdentity = false,
    onToggleIdentity,
    showShoebox = false,
    onToggleShoebox,
    showFictionalLore = false,
    onToggleFictionalLore,
    showRotationReviews = false,
    onToggleRotationReviews,
    showRawDailies = false,
    onToggleRawDailies,
    aiProvenanceFilter = 'all',
    onAiProvenanceFilterChange,
    onOpenAirlock,
    targetCollection = 'media',
    onTargetCollectionChange,
    buckets = [],
    activeBucketId = null,
    onBucketChange,
    onManageBuckets,
    onPromoteToVortex,
    searchQuery,
    showTimeslidePortal = false,
    onToggleTimeslidePortal,
    timeslidePortalNode,
    onMoveToBucket
}) => {
    const [healProgress, setHealProgress] = React.useState<{current: number, total: number} | null>(null);
    const [healComplete, setHealComplete] = React.useState(false);
    const [showDevTools, setShowDevTools] = React.useState(false);
    const [showBucketDropdown, setShowBucketDropdown] = React.useState(false);
    const [showProvenanceDropdown, setShowProvenanceDropdown] = React.useState(false);
    const [localSearch, setLocalSearch] = React.useState(searchQuery || '');
    const [isExpanded, setIsExpanded] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const devToolsRef = React.useRef<HTMLDivElement>(null);
    const bucketDropdownRef = React.useRef<HTMLDivElement>(null);
    const provenanceDropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (onSearch && localSearch !== searchQuery) {
                onSearch(localSearch, false);
            }
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [localSearch, onSearch, searchQuery]);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (devToolsRef.current && !devToolsRef.current.contains(event.target as Node)) {
                setShowDevTools(false);
            }
            if (bucketDropdownRef.current && !bucketDropdownRef.current.contains(event.target as Node)) {
                setShowBucketDropdown(false);
            }
            if (provenanceDropdownRef.current && !provenanceDropdownRef.current.contains(event.target as Node)) {
                setShowProvenanceDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onStageFiles(Array.from(e.target.files));
        }
    };

    const handleHealIndex = async () => {
        const uid = getAuth().currentUser?.uid;
        if (uid && (window as any).reindexMedia) {
            setHealComplete(false);
            try {
                await (window as any).reindexMedia(uid, (current: number, total: number) => {
                    setHealProgress({ current, total });
                });
                setHealComplete(true);
                setTimeout(() => setHealComplete(false), 5000); // Clear success state after 5s
            } catch (e) {
                console.error("Heal failed", e);
                alert("Search Index healing failed. Check console.");
            } finally {
                setHealProgress(null);
            }
        } else {
            alert("Error: Cannot start sync. Please ensure you are logged in.");
        }
    };

    const handleSyncTags = async () => {
        const uid = getAuth().currentUser?.uid;
        if (uid && (window as any).reindexAllTags) {
            setHealComplete(false);
            try {
                await (window as any).reindexAllTags(uid, (current: number, total: number) => {
                    setHealProgress({ current, total });
                });
                setHealComplete(true);
                setTimeout(() => setHealComplete(false), 5000);
            } catch (e) {
                console.error("Tag Sync failed", e);
                alert("Neural Tag Sync failed. Check console.");
            } finally {
                setHealProgress(null);
            }
        }
    };

    return (
        <SubHeader className="!z-[100] relative">
            <div className="flex flex-col w-full relative z-[100]">

                {/* --- ROW 1 (Always Top): Search Bar --- */}
                <div className="w-full relative z-20 flex gap-2">
                    <div className="relative flex-1">
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isExpanded ? 'text-cyan-400' : 'text-slate-500'}`} size={18} />
                        <input
                            type="text"
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            onFocus={() => setIsExpanded(true)}
                            placeholder="Search the Matrix (use '-' to exclude, e.g. jaguar -car -football)..."
                            className="w-full bg-slate-900/50 backdrop-blur-md border border-white/10 hover:border-white/20 focus:border-cyan-500/50 rounded-xl pl-12 pr-4 py-3 text-sm text-slate-200 outline-none transition-all placeholder-slate-600 shadow-inner"
                        />
                    </div>
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`bg-slate-900/50 backdrop-blur-md border border-white/10 hover:bg-white/10 rounded-xl px-4 flex items-center justify-center transition-colors ${isExpanded ? 'text-cyan-400 border-cyan-500/30' : 'text-slate-400'}`}
                        title={isExpanded ? "Collapse Toolbar" : "Expand Toolbar"}
                    >
                        <Wrench size={18} className="mr-2 hidden sm:block" />
                        <ChevronDown size={18} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                <div className={`absolute top-[calc(100%-1rem)] left-0 right-0 pt-4 transition-all duration-300 ease-out z-[110] ${isExpanded ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
                    <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex flex-col gap-4 w-full">

                            {/* --- ROW 1.5: Timeslide Portal (If Provided) --- */}
                            {timeslidePortalNode && (
                                <div className="w-full mb-2">
                                    {timeslidePortalNode}
                                </div>
                            )}

                            {/* --- ROW 2: Upload, Import, Filters & Toggles --- */}
                            <div className="flex flex-col 2xl:flex-row justify-between items-center gap-4 w-full">
                    
                    {/* Left side: Ingestion & Core Actions */}
                    <div className="flex flex-wrap justify-center 2xl:justify-start gap-2 sm:gap-3 w-full 2xl:w-auto">
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                        />

                        <GlassButton onClick={() => fileInputRef.current?.click()} variant="secondary" title="Upload new media or document to the Matrix" className="flex-1 sm:flex-none justify-center px-4">
                            <Upload size={18} className="mr-2" /> Upload
                        </GlassButton>

                        <GlassButton onClick={onImport} variant="secondary" title="Import assets from external sources" className="flex-1 sm:flex-none justify-center px-4">
                            <Import size={18} className="mr-2" /> Import
                        </GlassButton>

                        {onOpenAirlock && (
                            <GlassButton onClick={onOpenAirlock} variant="secondary" title="Open the Staging Airlock / Accession Gateway" className="flex-1 sm:flex-none justify-center px-4 transition-all duration-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.5)] border-cyan-500/30 text-cyan-400">
                                <Inbox size={18} className="mr-2" /> Staging Airlock
                            </GlassButton>
                        )}

                        {onTargetCollectionChange && (
                            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 items-center">
                                <button
                                    onClick={() => onTargetCollectionChange('media')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${targetCollection === 'media' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                                    title="Browse Main Vault (media collection)"
                                >
                                    Vault
                                </button>
                                <button
                                    onClick={() => onTargetCollectionChange('pending_accessions')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${targetCollection === 'pending_accessions' ? 'bg-rose-500/20 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                                    title="Browse Pending Accessions (legacy Gemini data)"
                                >
                                    Pending
                                </button>
                            </div>
                        )}
                        
                        {/* [ZEN] Buckets / Vaults Dropdown */}
                        {onBucketChange && (
                            <div className="relative" ref={bucketDropdownRef}>
                                <GlassButton 
                                    onClick={() => setShowBucketDropdown(!showBucketDropdown)} 
                                    variant="secondary" 
                                    title="Switch Custom Silo / Bucket" 
                                    className={`flex-1 sm:flex-none justify-center px-4 transition-all border-cyan-500/20 text-cyan-400 ${showBucketDropdown || activeBucketId ? 'bg-cyan-900/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : ''}`}
                                >
                                    <Shield size={18} className="mr-2" /> 
                                    <span className="hidden sm:inline font-bold">
                                        {activeBucketId ? buckets.find(b => b.id === activeBucketId)?.name || 'Unknown Silo' : 'Global Matrix'}
                                    </span>
                                    <ChevronDown size={14} className={`ml-2 transition-transform duration-200 ${showBucketDropdown ? 'rotate-180' : ''}`} />
                                </GlassButton>

                                {showBucketDropdown && (
                                    <div className="absolute top-full left-0 mt-2 z-50 flex flex-col gap-1 p-2 bg-slate-900/95 border border-white/10 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-xl min-w-[200px] animate-in fade-in slide-in-from-top-2">
                                        {selectedCount > 0 && onMoveToBucket ? (
                                            <div className="px-3 py-1 text-[10px] font-bold text-cyan-400/70 tracking-widest uppercase">
                                                Move {selectedCount} items to:
                                            </div>
                                        ) : null}

                                        <button
                                            onClick={() => { 
                                                if (selectedCount > 0 && onMoveToBucket) {
                                                    onMoveToBucket(null);
                                                } else if (onBucketChange) {
                                                    onBucketChange(null); 
                                                }
                                                setShowBucketDropdown(false); 
                                            }}
                                            className={`px-3 py-2 text-left rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${!activeBucketId && selectedCount === 0 ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                        >
                                            <Globe size={14} className="inline mr-2" /> Global Matrix
                                        </button>
                                        
                                        {buckets.length > 0 && <div className="h-px w-full bg-white/10 my-1" />}
                                        
                                        {buckets.map(b => (
                                            <button
                                                key={b.id}
                                                onClick={() => { 
                                                    if (selectedCount > 0 && onMoveToBucket) {
                                                        onMoveToBucket(b.id);
                                                    } else if (onBucketChange) {
                                                        onBucketChange(b.id); 
                                                    }
                                                    setShowBucketDropdown(false); 
                                                }}
                                                className={`px-3 py-2 text-left rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeBucketId === b.id && selectedCount === 0 ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                            >
                                                {b.privacyLevel === 'restricted' ? <Lock size={14} className="inline mr-2 text-rose-400" /> : 
                                                 b.privacyLevel === 'ghost' ? <Ghost size={14} className="inline mr-2 text-purple-400" /> : 
                                                 <Shield size={14} className="inline mr-2 text-cyan-400" />}
                                                {b.name}
                                            </button>
                                        ))}

                                        {onManageBuckets && (
                                            <>
                                                <div className="h-px w-full bg-white/10 my-1" />
                                                <button
                                                    onClick={() => { onManageBuckets(); setShowBucketDropdown(false); }}
                                                    className="px-3 py-2 text-left rounded-lg text-xs font-bold uppercase tracking-wider text-amber-400 hover:bg-amber-500/20 transition-all flex items-center"
                                                >
                                                    <Wrench size={14} className="mr-2" /> Manage Silos
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* System / Dev Tools Dropdown */}
                        <div className="relative" ref={devToolsRef}>
                            <GlassButton 
                                onClick={() => setShowDevTools(!showDevTools)} 
                                variant="secondary" 
                                title="System Operations & Developer Tools (Heal Index, Sync Tags)" 
                                className={`flex-1 sm:flex-none justify-center px-4 transition-all ${showDevTools ? 'bg-white/10' : ''}`}
                            >
                                <Wrench size={18} className="mr-2" /> 
                                <span className="hidden sm:inline">System</span>
                                <ChevronDown size={14} className={`ml-2 transition-transform duration-200 ${showDevTools ? 'rotate-180' : ''}`} />
                            </GlassButton>

                            {showDevTools && (
                                <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 z-50 flex flex-col gap-2 p-3 bg-slate-900/95 border border-white/10 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-xl min-w-[240px] animate-in fade-in slide-in-from-top-2">
                                    <GlassButton 
                                        onClick={handleHealIndex} 
                                        disabled={!!healProgress}
                                        variant="secondary" 
                                        title="Heal Search Index (Re-sync Firebase to Typesense)" 
                                        className={`w-full justify-start px-4 transition-all duration-500 ${
                                            healComplete ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                                            healProgress ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                                            'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border-orange-500/30'
                                        }`}
                                    >
                                        {healComplete ? (
                                            <><Check size={18} className="mr-2 animate-in zoom-in" /> HEALED</>
                                        ) : healProgress ? (
                                            <>
                                                <Loader2 size={18} className="mr-2 animate-spin" />
                                                <span className="font-mono text-[10px] w-12">
                                                    {Math.round((healProgress.current / healProgress.total) * 100)}%
                                                </span>
                                            </>
                                        ) : (
                                            <><Activity size={18} className="mr-2" /> Heal Index</>
                                        )}
                                    </GlassButton>

                                    <GlassButton 
                                        onClick={handleSyncTags} 
                                        disabled={!!healProgress}
                                        variant="secondary" 
                                        title="Neural Sync: Vectorize all Persons, Places, Pets & Things" 
                                        className={`w-full justify-start px-4 transition-all duration-500 ${
                                            healComplete ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 
                                            healProgress ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 
                                            'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border-cyan-500/30'
                                        }`}
                                    >
                                        {healComplete ? (
                                            <><Check size={18} className="mr-2 animate-in zoom-in" /> SYNCED</>
                                        ) : healProgress ? (
                                            <>
                                                <Loader2 size={18} className="mr-2 animate-spin" />
                                                <span className="font-mono text-[10px] w-12">
                                                    {Math.round((healProgress.current / healProgress.total) * 100)}%
                                                </span>
                                            </>
                                        ) : (
                                            <><Sparkles size={18} className="mr-2" /> Sync Tags</>
                                        )}
                                    </GlassButton>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right side: Selection, Toggles & Layout */}
                    <div className="flex flex-wrap justify-center 2xl:justify-end items-center gap-2 sm:gap-4 w-full 2xl:w-auto">
                        {/* Type Tabs, Sort, and Grid Layout */}
                        <div className="flex flex-wrap gap-2 items-center justify-center sm:justify-end">
                            <div className="bg-black/40 p-1 rounded-xl border border-white/5 flex gap-1">
                                <button
                                    onClick={() => setActiveTab('visuals')}
                                    title="Switch to Visual Assets"
                                    className={`flex items-center px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${activeTab === 'visuals' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                >
                                    <ImageIcon size={12} className="mr-1.5" /> Visuals
                                </button>
                                <button
                                    onClick={() => setActiveTab('documents')}
                                    title="Switch to Documents & Text"
                                    className={`flex items-center px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${activeTab === 'documents' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                >
                                    <FileText size={12} className="mr-1.5" /> Docs
                                </button>
                            </div>

                            <div className="hidden sm:block w-px h-6 bg-white/10 mx-1" />

                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="p-1.5 rounded-lg bg-black/40 border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                                title={sortOrder === 'asc' ? "Sort Descending" : "Sort Ascending"}
                            >
                                <ArrowUpDown size={14} className={sortOrder === 'desc' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                            </button>

                            <div className="hidden sm:block w-px h-6 bg-white/10 mx-1" />

                            <div className="bg-black/40 p-0.5 rounded-xl border border-white/5 flex gap-0.5">
                                <button
                                    onClick={() => setViewMode('sm')}
                                    title="Small Grid View"
                                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'sm' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <Grid size={13} />
                                </button>
                                <button
                                    onClick={() => setViewMode('md')}
                                    title="Medium Grid View"
                                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'md' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <LayoutGrid size={13} />
                                </button>
                                <button
                                    onClick={() => setViewMode('lg')}
                                    title="Full Aspect Detail View"
                                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'lg' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <Maximize size={13} />
                                </button>
                                <button
                                    onClick={() => setViewMode('dnd')}
                                    title="Light Table (Drag & Drop Sorter)"
                                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'dnd' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'text-slate-500 hover:text-amber-400'}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h16M4 14h16M10 4v16M14 4v16"/></svg>
                                </button>
                            </div>
                        </div>

                        {/* Selection actions */}
                        <div className="flex gap-2 items-center">
                            {isSelectionMode && (
                                <div className="flex items-center gap-2 animate-in slide-in-from-right-4 fade-in mr-1">
                                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-500/20 hidden sm:block">
                                        {selectedCount} Selected
                                    </span>
                                    {selectedCount > 0 && (
                                        <>
                                            {/* [ZEN] Promote to Vortex Button */}
                                            {onPromoteToVortex && (
                                                <button
                                                    onClick={onPromoteToVortex}
                                                    title={`Promote ${selectedCount} items to Vortex Scene`}
                                                    className="p-1.5 text-fuchsia-400 hover:text-fuchsia-300 hover:bg-fuchsia-500/10 rounded-lg transition-colors border border-transparent hover:border-fuchsia-500/30"
                                                >
                                                    <Layers size={14} />
                                                </button>
                                            )}
                                            {/* [ZEN EWO 005] Neural Re-Up Button */}
                                            {onNeuralReUp && (
                                                <button
                                                    onClick={onNeuralReUp}
                                                    disabled={isNeuralReUpRunning}
                                                    title={`Re-Up Neural Metadata for ${selectedCount} items`}
                                                    className={`p-1.5 rounded-lg transition-all ${isNeuralReUpRunning
                                                        ? 'text-cyan-300 bg-cyan-500/20 animate-pulse cursor-wait'
                                                        : 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10'
                                                        }`}
                                                >
                                                    <Sparkles size={14} className={isNeuralReUpRunning ? 'animate-spin' : ''} />
                                                </button>
                                            )}
                                            <button
                                                onClick={onDelete}
                                                title={`Delete ${selectedCount} selected items`}
                                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={onClearSelection}
                                        title="Cancel Selection"
                                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            <div className="hidden sm:block w-px h-6 bg-white/10 mx-1 md:mx-2" />

                            <button
                                onClick={() => setIsSelectionMode(!isSelectionMode)}
                                className={`p-1.5 rounded-lg border transition-all ${isSelectionMode ? 'bg-cyan-500 text-white border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-black/40 border-white/5 text-slate-500 hover:text-white hover:bg-white/5'}`}
                                title={isSelectionMode ? "Exit Selection Mode" : "Enter Selection Mode"}
                            >
                                <CheckSquare size={14} />
                            </button>

                            {/* [ZEN EWO 006] Neural Glass Toggle */}
                            {onToggleNarratives && (
                                <button
                                    onClick={onToggleNarratives}
                                    className={`p-1.5 rounded-lg border transition-all ${showNarratives ? 'bg-fuchsia-500 text-white border-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.4)]' : 'bg-black/40 border-white/5 text-slate-500 hover:text-white hover:bg-white/5'}`}
                                    title={showNarratives ? "Hide Neural Narratives" : "Show Neural Narratives"}
                                >
                                    <MessageSquareText size={14} />
                                </button>
                            )}

                            {/* [ZEN EWO 008] Identity Mode Toggle */}
                            {onToggleIdentity && (
                                <button
                                    onClick={onToggleIdentity}
                                    className={`p-1.5 rounded-lg border transition-all ${showIdentity ? 'bg-cyan-500 text-white border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-black/40 border-white/5 text-slate-500 hover:text-white hover:bg-white/5'}`}
                                    title={showIdentity ? "Hide Identity Map" : "Show Identity Map"}
                                >
                                    <UserCheck size={14} />
                                </button>
                            )}

                            {/* [ZEN] Shoebox Toggle (Undated Media) */}
                            {onToggleShoebox && (
                                <button
                                    onClick={onToggleShoebox}
                                    className={`
                                        group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-500 ml-1
                                        ${showShoebox 
                                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                                            : 'bg-slate-800/40 hover:bg-slate-800/60 text-slate-400 hover:text-amber-400 border-white/5 hover:border-amber-500/30'
                                        }
                                    `}
                                    title={showShoebox ? "Return to Chronological Matrix" : "Open Temporal Shoebox (Undated Artifacts)"}
                                >
                                    <div className="relative">
                                        <Archive size={16} className={showShoebox ? 'text-amber-400' : 'text-slate-500 group-hover:text-amber-400'} />
                                        <div className={`absolute -top-1.5 -right-1.5 bg-slate-950 rounded-full p-0.5 border ${showShoebox ? 'border-amber-500 text-amber-400' : 'border-slate-700 text-slate-500 group-hover:text-amber-400 group-hover:border-amber-500'}`}>
                                            <HelpCircle size={10} />
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold tracking-wider uppercase hidden sm:inline-block">
                                        {showShoebox ? "VIEWING SHOEBOX" : "SHOEBOX"}
                                    </span>
                                </button>
                            )}

                            {/* [ZEN] Fictional Lore Toggle */}
                            {onToggleFictionalLore && (
                                <button
                                    onClick={onToggleFictionalLore}
                                    className={`
                                        group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-500 ml-1
                                        ${showFictionalLore 
                                            ? 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30 shadow-[0_0_15px_rgba(217,70,239,0.3)]' 
                                            : 'bg-slate-800/40 hover:bg-slate-800/60 text-slate-400 hover:text-fuchsia-400 border-white/5 hover:border-fuchsia-500/30'
                                        }
                                    `}
                                    title={showFictionalLore ? "Return to Reality Matrix" : "Open Fictional Lore (AI/Variants)"}
                                >
                                    <Sparkles size={16} className={showFictionalLore ? 'text-fuchsia-400' : 'text-slate-500 group-hover:text-fuchsia-400'} />
                                    <span className="text-[10px] font-bold tracking-wider uppercase hidden sm:inline-block">
                                        {showFictionalLore ? "FICTIONAL LORE" : "LORE"}
                                    </span>
                                </button>
                            )}

                            {/* [ZEN] Flagged Rotations Toggle */}
                            {onToggleRotationReviews && (
                                <button
                                    onClick={onToggleRotationReviews}
                                    className={`
                                        group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-500 ml-1
                                        ${showRotationReviews 
                                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                                            : 'bg-slate-800/40 hover:bg-slate-800/60 text-slate-400 hover:text-rose-400 border-white/5 hover:border-rose-500/30'
                                        }
                                    `}
                                    title={showRotationReviews ? "Return to Full Matrix" : "Review Flagged Rotations"}
                                >
                                    <ArrowUpDown size={16} className={showRotationReviews ? 'text-rose-400' : 'text-slate-500 group-hover:text-rose-400'} />
                                    <span className="text-[10px] font-bold tracking-wider uppercase hidden sm:inline-block">
                                        {showRotationReviews ? "REVIEWING ROTATIONS" : "ROTATIONS"}
                                    </span>
                                </button>
                            )}

                            {/* [ZEN] Raw Dailies Toggle */}
                            {onToggleRawDailies && (
                                <button
                                    onClick={onToggleRawDailies}
                                    className={`
                                        group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-500 ml-1
                                        ${showRawDailies 
                                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                                            : 'bg-slate-800/40 hover:bg-slate-800/60 text-slate-400 hover:text-blue-400 border-white/5 hover:border-blue-500/30'
                                        }
                                    `}
                                    title={showRawDailies ? "Return to Logical Timeline (Curated Dates)" : "View Director's Cut (Physical / Machine Dates)"}
                                >
                                    <Film size={16} className={showRawDailies ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-400'} />
                                    <span className="text-[10px] font-bold tracking-wider uppercase hidden sm:inline-block">
                                        {showRawDailies ? "RAW DAILIES" : "DAILIES"}
                                    </span>
                                </button>
                            )}

                            {/* [ZEN] Timeslide Portal Toggle */}
                            {onToggleTimeslidePortal && (
                                <button
                                    onClick={onToggleTimeslidePortal}
                                    className={`
                                        group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-500 ml-1
                                        ${showTimeslidePortal 
                                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                                            : 'bg-slate-800/40 hover:bg-slate-800/60 text-slate-400 hover:text-amber-400 border-white/5 hover:border-amber-500/30'
                                        }
                                    `}
                                    title={showTimeslidePortal ? "Hide The Sanctuary" : "Open The Sanctuary"}
                                >
                                    <Activity size={16} className={showTimeslidePortal ? 'text-amber-400' : 'text-slate-500 group-hover:text-amber-400'} />
                                    <span className="text-[10px] font-bold tracking-wider uppercase hidden sm:inline-block">
                                        {showTimeslidePortal ? "SANCTUARY" : "SANCTUARY"}
                                    </span>
                                </button>
                            )}

                            {/* [ZEN] Provenance Filters Dropdown */}
                            {onAiProvenanceFilterChange && (
                                <div className="relative ml-1" ref={provenanceDropdownRef}>
                                    <button
                                        onClick={() => setShowProvenanceDropdown(!showProvenanceDropdown)}
                                        className={`
                                            group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-500
                                            ${aiProvenanceFilter !== 'all' 
                                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.3)]' 
                                                : 'bg-slate-800/40 hover:bg-slate-800/60 text-slate-400 hover:text-cyan-400 border-white/5 hover:border-cyan-500/30'
                                            }
                                        `}
                                        title="AI Provenance & Metadata Filters"
                                    >
                                        <Filter size={16} className={aiProvenanceFilter !== 'all' ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'} />
                                        <span className="text-[10px] font-bold tracking-wider uppercase hidden sm:inline-block">
                                            {aiProvenanceFilter === 'all' ? 'FILTERS' : aiProvenanceFilter.replace('-', ' ').toUpperCase()}
                                        </span>
                                        <ChevronDown size={14} className={`transition-transform duration-200 ${showProvenanceDropdown ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showProvenanceDropdown && (
                                        <div className="absolute top-full right-0 mt-2 z-50 flex flex-col gap-1 p-2 bg-slate-900/95 border border-white/10 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-xl min-w-[180px] animate-in fade-in slide-in-from-top-2">
                                            <button
                                                onClick={() => { onAiProvenanceFilterChange('gemini-2.5-flash'); setShowProvenanceDropdown(false); }}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-between ${aiProvenanceFilter === 'gemini-2.5-flash' ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-red-400 hover:bg-white/5'}`}
                                            >
                                                <div className="flex items-center"><AlertTriangle size={14} className="mr-2" /> Toxic</div>
                                                {aiProvenanceFilter === 'gemini-2.5-flash' && <Check size={14} />}
                                            </button>
                                            <button
                                                onClick={() => { onAiProvenanceFilterChange('grok-test'); setShowProvenanceDropdown(false); }}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-between ${aiProvenanceFilter === 'grok-test' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-emerald-400 hover:bg-white/5'}`}
                                            >
                                                <div className="flex items-center"><Sparkles size={14} className="mr-2" /> Grok</div>
                                                {aiProvenanceFilter === 'grok-test' && <Check size={14} />}
                                            </button>
                                            <button
                                                onClick={() => { onAiProvenanceFilterChange('gemini-test'); setShowProvenanceDropdown(false); }}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-between ${aiProvenanceFilter === 'gemini-test' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-blue-400 hover:bg-white/5'}`}
                                            >
                                                <div className="flex items-center"><Sparkles size={14} className="mr-2" /> Gemini</div>
                                                {aiProvenanceFilter === 'gemini-test' && <Check size={14} />}
                                            </button>
                                            <button
                                                onClick={() => { onAiProvenanceFilterChange('blank-metadata'); setShowProvenanceDropdown(false); }}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-between ${aiProvenanceFilter === 'blank-metadata' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-amber-400 hover:bg-white/5'}`}
                                            >
                                                <div className="flex items-center"><AlertTriangle size={14} className="mr-2" /> Blanks</div>
                                                {aiProvenanceFilter === 'blank-metadata' && <Check size={14} />}
                                            </button>
                                            <button
                                                onClick={() => { onAiProvenanceFilterChange('ai-processed'); setShowProvenanceDropdown(false); }}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-between ${aiProvenanceFilter === 'ai-processed' ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400 hover:text-purple-400 hover:bg-white/5'}`}
                                            >
                                                <div className="flex items-center"><Sparkles size={14} className="mr-2" /> Processed</div>
                                                {aiProvenanceFilter === 'ai-processed' && <Check size={14} />}
                                            </button>
                                            <button
                                                onClick={() => { onAiProvenanceFilterChange('inferred-dates'); setShowProvenanceDropdown(false); }}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-between ${aiProvenanceFilter === 'inferred-dates' ? 'bg-violet-500/20 text-violet-400' : 'text-slate-400 hover:text-violet-400 hover:bg-white/5'}`}
                                            >
                                                <div className="flex items-center"><CalendarDays size={14} className="mr-2" /> Inferred</div>
                                                {aiProvenanceFilter === 'inferred-dates' && <Check size={14} />}
                                            </button>
                                            {aiProvenanceFilter !== 'all' && (
                                                <>
                                                    <div className="h-px bg-white/10 my-1" />
                                                    <button
                                                        onClick={() => { onAiProvenanceFilterChange('all'); setShowProvenanceDropdown(false); }}
                                                        className="px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                                                    >
                                                        <X size={14} className="mr-2" /> Clear Filter
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                </div>
                </div>

                {/* --- END ACCORDION CONTENT --- */}
                {/* Visual Affordance for hover */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 opacity-30 group-hover:opacity-0 transition-opacity pointer-events-none">
                    <div className="w-16 h-1 bg-cyan-500/50 rounded-full" />
                </div>
            </div>
        </SubHeader>
    );
};