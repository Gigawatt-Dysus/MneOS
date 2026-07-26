import React, { useState, useEffect } from 'react';
import { Database, FileCode, FileVideo, FileImage, FileAudio, FileArchive, FileText, HardDrive, Cpu, ShieldCheck, AlertCircle, File, ChevronLeft, ChevronRight, Search, Trash2, Eye, FolderTree, LayoutGrid, X } from 'lucide-react';
import type { View } from '../../types';
interface Stats {
    totalFiles: number;
    totalSize: number;
    extensions: { extension: string; count: number }[];
}

interface FileRow {
    hash: string;
    filename: string;
    filepath: string;
    extension: string;
    size: number;
}

export interface TreeNode {
    name: string;
    size: number;
    children: TreeNode[];
}

const TreeVisualizer: React.FC<{ data: TreeNode; totalSize: number; level?: number }> = ({ data, totalSize, level = 0 }) => {
    const [expanded, setExpanded] = useState(level < 2);
    if (data.size === 0) return null;

    const percentage = ((data.size / totalSize) * 100).toFixed(2);
    
    const getIntensity = (pct: number) => {
        if (pct > 50) return 'bg-rose-500/80';
        if (pct > 20) return 'bg-amber-500/80';
        if (pct > 5) return 'bg-emerald-500/80';
        return 'bg-cyan-500/50';
    };

    return (
        <div className="font-mono text-sm w-full">
            <div 
                className={`flex items-center gap-3 py-1.5 px-2 hover:bg-slate-800/50 cursor-pointer transition-colors ${level === 0 ? 'border-b border-slate-700/50 pb-3 mb-2' : ''}`}
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex-1 flex items-center gap-2">
                    <span className="text-slate-600 w-4 text-center cursor-pointer" style={{ marginLeft: `${level * 20}px` }}>
                        {data.children && data.children.length > 0 ? (expanded ? '▼' : '▶') : '•'}
                    </span>
                    <span className={level === 0 ? 'text-emerald-400 font-bold' : level === 1 ? 'text-cyan-300' : 'text-slate-300'}>
                        {data.name || 'ROOT'}
                    </span>
                </div>
                <div className="w-1/2 flex items-center gap-4">
                    <div className="flex-1 bg-slate-900/80 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div className={`h-full ${getIntensity(parseFloat(percentage))} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="text-emerald-500/70 w-24 text-right font-bold tracking-wider text-xs">{formatSize(data.size)}</span>
                    <span className="text-slate-500 w-16 text-right text-xs">{percentage}%</span>
                </div>
            </div>
            {expanded && data.children && data.children.length > 0 && (
                <div className="flex flex-col">
                    {data.children.map(child => (
                        <TreeVisualizer key={child.name} data={child} totalSize={totalSize} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

const getFileIcon = (ext: string) => {
    switch (ext) {
        case '.mp4': case '.mov': case '.avi': return <FileVideo size={16} className="text-purple-400" />;
        case '.jpg': case '.jpeg': case '.png': case '.gif': return <FileImage size={16} className="text-emerald-400" />;
        case '.mp3': case '.wav': case '.m4a': return <FileAudio size={16} className="text-amber-400" />;
        case '.zip': case '.rar': case '.7z': return <FileArchive size={16} className="text-rose-400" />;
        case '.txt': case '.md': case '.pdf': case '.doc': case '.docx': return <FileText size={16} className="text-sky-400" />;
        case '.json': case '.js': case '.ts': case '.html': return <FileCode size={16} className="text-orange-400" />;
        default: return <File size={16} className="text-slate-400" />;
    }
};

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export interface StagingDashboardProps {
    onNavigate?: (view: View) => void;
}

export const StagingDashboard: React.FC<StagingDashboardProps> = ({ onNavigate }) => {
    const [viewMode, setViewMode] = useState<'grid' | 'tree'>('grid');
    const [treeData, setTreeData] = useState<TreeNode | null>(null);

    const [stats, setStats] = useState<Stats | null>(null);
    const [files, setFiles] = useState<FileRow[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [hoveredFile, setHoveredFile] = useState<FileRow | null>(null);
    const [debouncedFile, setDebouncedFile] = useState<FileRow | null>(null);
    const [failedMedia, setFailedMedia] = useState<Set<string>>(new Set());
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (hoveredFile) {
            timer = setTimeout(() => {
                setDebouncedFile(hoveredFile);
            }, 300);
        } else {
            setDebouncedFile(null);
        }
        return () => clearTimeout(timer);
    }, [hoveredFile]);

    const handleMouseMove = (e: React.MouseEvent) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMediaError = (filepath: string) => {
        setFailedMedia(prev => {
            const next = new Set(prev);
            next.add(filepath);
            return next;
        });
    };

    const API_BASE = 'http://localhost:3001/api';

    const fetchStats = () => {
        fetch(`${API_BASE}/stats`)
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(err => {
                console.error(err);
                setError("Failed to connect to Staging API. Is node staging_api.js running?");
            });
    };

    const fetchFiles = () => {
        setLoading(true);
        const query = new URLSearchParams({ page: page.toString(), limit: "100" });
        if (search) query.append("search", search);

        fetch(`${API_BASE}/files?${query}`)
            .then(res => res.json())
            .then(data => {
                setFiles(data.data);
                setTotalPages(data.pagination.totalPages);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        fetchFiles();
    }, [page, search]);

    useEffect(() => {
        if (viewMode === 'tree' && !treeData) {
            setLoading(true);
            fetch(`${API_BASE}/tree`)
                .then(res => res.json())
                .then(data => {
                    setTreeData(data);
                    setLoading(false);
                })
                .catch(console.error);
        }
    }, [viewMode]);

    const handlePruneExtension = async (extension: string) => {
        if (!window.confirm(`Are you sure you want to permanently prune all '${extension}' metadata records? This will delete them from the staging ledger.`)) return;
        
        try {
            const res = await fetch(`${API_BASE}/prune/extension`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extension })
            });
            const data = await res.json();
            if (data.success) {
                fetchStats();
                fetchFiles();
            } else {
                setError(data.error || "Failed to prune extension");
            }
        } catch (err) {
            setError("Failed to connect to API for pruning.");
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#0B0D17] text-slate-200 font-sans p-6 overflow-y-auto">
            
            {/* HEADER */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center gap-3">
                        <Database className="text-emerald-400" /> Sovereign Staging Telemetry
                    </h1>
                    <p className="text-slate-400 mt-2 flex items-center gap-2">
                        <HardDrive size={14} /> Drive <span className="text-emerald-400 font-mono">F:\</span> Online (Genesis Alpha Host)
                    </p>
                </div>
                
                <div className="flex bg-slate-900/80 border border-slate-700/50 rounded-lg p-1 backdrop-blur-sm shadow-xl">
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-slate-800 text-emerald-400 shadow border border-slate-700/50' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
                    >
                        <LayoutGrid size={16} /> Grid
                    </button>
                    <button 
                        onClick={() => setViewMode('tree')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${viewMode === 'tree' ? 'bg-slate-800 text-cyan-400 shadow border border-slate-700/50' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
                    >
                        <FolderTree size={16} /> Matrix Tree
                    </button>
                    {onNavigate && (
                        <>
                            <div className="w-px h-8 bg-slate-700/50 mx-2 self-center"></div>
                            <button 
                                onClick={() => onNavigate('theMatrix')}
                                className="flex items-center justify-center p-2 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all border border-transparent"
                                title="Exit Staging Telemetry"
                            >
                                <X size={18} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-rose-500/10 border border-rose-500/50 p-4 rounded-xl text-rose-400 flex items-center gap-3 mb-8">
                    <AlertCircle />
                    {error}
                </div>
            )}

            {/* TELEMETRY CARDS */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 backdrop-blur-sm">
                        <div className="text-slate-400 flex items-center gap-2 mb-2"><ShieldCheck size={16} /> Total Staged Objects</div>
                        <div className="text-4xl font-mono text-emerald-400">{stats.totalFiles.toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 backdrop-blur-sm">
                        <div className="text-slate-400 flex items-center gap-2 mb-2"><Cpu size={16} /> Gross Vector Load (Raw)</div>
                        <div className="text-4xl font-mono text-cyan-400">{formatSize(stats.totalSize)}</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 backdrop-blur-sm overflow-hidden">
                        <div className="text-slate-400 flex items-center gap-2 mb-3"><FileArchive size={16} /> Top Signatures</div>
                        <div className="flex flex-wrap gap-2">
                            {stats.extensions.map(ext => (
                                <div key={ext.extension} className="group flex items-center px-2 py-1 bg-slate-800 rounded-md text-xs font-mono border border-slate-700 hover:border-rose-500/50 transition-colors">
                                    <span className="text-emerald-400">{ext.extension || 'UNKNOWN'}</span> 
                                    <span className="text-slate-500 mx-2">{ext.count}</span>
                                    <button 
                                        onClick={() => handlePruneExtension(ext.extension)}
                                        title="Flags record for absolute metadata deletion from the staging ledger (Does not delete actual files)"
                                        className="text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all focus:outline-none flex items-center justify-center"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* SPREADSHEET GRID OR TREE MATRIX */}
            <div className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
                
                {viewMode === 'grid' ? (
                    <>
                        {/* TOOLBAR */}
                        <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900">
                            <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search metadata signatures..." 
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-emerald-500 w-80 text-emerald-100 placeholder:text-slate-600 font-mono"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500 font-mono">Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50 transition-colors">
                                <ChevronLeft size={16} />
                            </button>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50 transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* TABLE */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-950/80 sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="px-6 py-3 text-slate-500 font-medium border-b border-slate-800">Signature</th>
                                <th className="px-6 py-3 text-slate-500 font-medium border-b border-slate-800">Origin Vector (Absolute Path)</th>
                                <th className="px-6 py-3 text-slate-500 font-medium border-b border-slate-800">Mass</th>
                                <th className="px-6 py-3 text-slate-500 font-medium border-b border-slate-800">SHA-256 Checksum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50" onMouseMove={handleMouseMove}>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 animate-pulse">Scanning telemetry...</td>
                                </tr>
                            ) : files.map(file => (
                                <tr 
                                    key={file.hash + file.filepath} 
                                    className="hover:bg-slate-800/30 transition-colors font-mono group"
                                >
                                    <td className="px-6 py-3 flex items-center gap-3">
                                        {getFileIcon(file.extension)}
                                        <span className="text-slate-300 group-hover:text-emerald-300 transition-colors truncate max-w-xs">{file.filename}</span>
                                        <button 
                                            className="ml-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-cyan-400 transition-all focus:outline-none"
                                            onMouseEnter={() => setHoveredFile(file)}
                                            onMouseLeave={() => setHoveredFile(null)}
                                            title="Hover to Preview Media"
                                        >
                                            <Eye size={14} />
                                        </button>
                                    </td>
                                    <td className="px-6 py-3 text-slate-500 group-hover:text-slate-400 truncate max-w-md" title={file.filepath}>
                                        {file.filepath}
                                    </td>
                                    <td className="px-6 py-3 text-cyan-500/70">{formatSize(file.size)}</td>
                                    <td className="px-6 py-3 text-slate-600 font-mono text-xs">{file.hash.substring(0, 16)}...</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                </>
                ) : (
                    <div className="flex-1 overflow-auto p-6 bg-slate-950/50">
                        {treeData ? (
                            <TreeVisualizer data={treeData} totalSize={stats?.totalSize || 1} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500 animate-pulse flex-col gap-4">
                                <FolderTree size={48} className="opacity-20" />
                                <span>Scanning matrix topology...</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* HOVER PREVIEW POPOVER */}
            {debouncedFile && (
                <div 
                    className="fixed z-[100] pointer-events-none bg-slate-950/95 border border-slate-700/80 rounded-lg shadow-2xl p-1.5 backdrop-blur-md"
                    style={{ 
                        top: Math.min(mousePos.y + 15, window.innerHeight - 340), 
                        left: Math.min(mousePos.x + 15, window.innerWidth - 340) 
                    }}
                >
                    {['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(debouncedFile.extension.toLowerCase()) ? (
                        <div className={`relative rounded overflow-hidden bg-slate-900 border border-slate-800 min-w-[200px] min-h-[100px] flex items-center justify-center ${failedMedia.has(debouncedFile.filepath) ? 'is-offline' : ''}`}>
                            <img 
                                src={`${API_BASE}/preview?filepath=${encodeURIComponent(debouncedFile.filepath)}`} 
                                alt="Preview" 
                                className="max-w-[300px] max-h-[300px] object-contain relative z-10"
                                style={{ display: failedMedia.has(debouncedFile.filepath) ? 'none' : 'block' }}
                                onError={() => handleMediaError(debouncedFile.filepath)}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-500/70 font-mono text-[10px] uppercase tracking-widest bg-slate-900/50 z-0 opacity-0 [.is-offline_&]:opacity-100">
                                <AlertCircle size={14} className="mb-1" />
                                Media Offline
                            </div>
                        </div>
                    ) : ['.mp4', '.mov', '.avi', '.webm'].includes(debouncedFile.extension.toLowerCase()) ? (
                        <div className={`relative rounded overflow-hidden bg-slate-900 border border-slate-800 w-[300px] h-[170px] flex items-center justify-center ${failedMedia.has(debouncedFile.filepath) ? 'is-offline' : ''}`}>
                            <video 
                                src={`${API_BASE}/preview?filepath=${encodeURIComponent(debouncedFile.filepath)}`} 
                                autoPlay muted loop 
                                className="max-w-[300px] max-h-[170px] object-contain relative z-10"
                                style={{ display: failedMedia.has(debouncedFile.filepath) ? 'none' : 'block' }}
                                onError={() => handleMediaError(debouncedFile.filepath)}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-500/70 font-mono text-[10px] uppercase tracking-widest bg-slate-900/50 z-0 opacity-0 [.is-offline_&]:opacity-100">
                                <AlertCircle size={14} className="mb-1" />
                                Video Offline
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-slate-400 font-mono flex items-center gap-2 px-3 py-2 bg-slate-900 rounded border border-slate-800">
                            {getFileIcon(debouncedFile.extension)}
                            <span className="truncate max-w-xs">{debouncedFile.filename}</span>
                        </div>
                    )}
                </div>
            )}
            
        </div>
    );
};

export default StagingDashboard;
