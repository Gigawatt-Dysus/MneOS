import React from 'react';
import { Sidebar as SidebarIcon, ChevronDown, Save, Upload, Download, Printer, X, Monitor, ZoomOut, ZoomIn, AlignJustify, MessageSquare, Zap } from 'lucide-react';
import { GlassButton } from '../../../GlassButton';
import { DaydreamStory, User } from '../../../../types';
import { PAPER_DIMENSIONS, PaperSize, Orientation, Margins } from '../types';

interface HeaderProps {
    story: DaydreamStory | null;
    setStory: React.Dispatch<React.SetStateAction<DaydreamStory | null>>;
    handleSave: () => void;
    handleContinue: () => void;
    handleImportClick: () => void;
    handleExportDocx: () => void;
    onClose: () => void;
    isSaving: boolean;
    isThinking: boolean;
    status: string;
    zoom: number;
    setZoom: (z: number) => void;
    wordWrap: boolean;
    setWordWrap: (w: boolean) => void;
    paperSize: PaperSize;
    setPaperSize: (s: PaperSize) => void;
    orientation: Orientation;
    setOrientation: (o: Orientation) => void;
    margins: Margins;
    setMargins: (m: Margins) => void;
    bgColor: string;
    setBgColor: (c: string) => void;
    showOOCChat: boolean;
    setShowOOCChat: (s: boolean) => void;
    showGenie: boolean;
    handleSummonGenie: () => void;
    genieThinking: boolean;
    isSidebarOpen: boolean;
    setIsSidebarOpen: (s: boolean) => void;
    handleFixParagraphs: () => void;
    showFormatting: boolean;
    setShowFormatting: (s: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
    story, setStory, handleSave, handleContinue, handleImportClick, handleExportDocx, onClose,
    isSaving, isThinking, status, zoom, setZoom, wordWrap, setWordWrap,
    paperSize, setPaperSize, orientation, setOrientation, margins, setMargins,
    bgColor, setBgColor, showOOCChat, setShowOOCChat, showGenie, handleSummonGenie,
    genieThinking, isSidebarOpen, setIsSidebarOpen, handleFixParagraphs, showFormatting, setShowFormatting
}) => {
    return (
        <div className="h-20 flex items-center justify-between px-8 bg-[#0E0E0E] z-[80] relative border-b border-white/5">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span>Project GIGI</span>
                    <span className="text-slate-700">/</span>
                    <span className="text-cyan-500">Daydream Studio</span>
                </div>
                <input
                    className="bg-transparent text-2xl font-black text-slate-100 placeholder-slate-700 outline-none hover:text-white transition-colors w-[600px] truncate"
                    value={story?.title || ''}
                    onChange={(e) => setStory((prev: DaydreamStory | null) => prev ? { ...prev, title: e.target.value } : null)}
                    onBlur={() => handleSave()}
                    placeholder="Untitled Daydream"
                />
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={handleContinue}
                    disabled={isThinking}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-xs uppercase tracking-wider transition-all
                      ${isThinking ? 'bg-violet-500/20 text-violet-300 animate-pulse cursor-wait' : 'bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]'}
                    `}
                >
                    <Zap size={16} fill="currentColor" />
                    <span>{isThinking ? 'Dreaming...' : 'Continue'}</span>
                </button>

                <div className="flex items-center gap-2">
                    {/* File Menu */}
                    <div className="group relative pb-2">
                        <GlassButton className="gap-2 text-xs font-bold uppercase tracking-wider pr-2">
                            <SidebarIcon size={14} className="text-cyan-400" /> File <ChevronDown size={12} />
                        </GlassButton>
                        <div className="absolute top-full right-0 mt-0 w-48 bg-[#0f1219] border border-white/10 rounded-xl shadow-2xl p-1 hidden group-hover:block z-[100]">
                            <button onClick={handleSave} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/10 rounded-lg flex items-center gap-2">
                                <Save size={14} /> {isSaving ? 'Saving...' : 'Save Now'}
                            </button>
                            <button onClick={handleImportClick} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/10 rounded-lg flex items-center gap-2">
                                <Upload size={14} /> Import .docx
                            </button>
                            <button onClick={handleExportDocx} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/10 rounded-lg flex items-center gap-2">
                                <Download size={14} /> Export .docx
                            </button>
                        </div>
                    </div>

                    {/* View Menu */}
                    <div className="group relative pb-2">
                        <GlassButton className="gap-2 text-xs font-bold uppercase tracking-wider pr-2">
                            <Monitor size={14} className="text-cyan-400" /> View <ChevronDown size={12} />
                        </GlassButton>
                        <div className="absolute top-full right-0 mt-0 w-56 bg-[#0f1219] border border-white/10 rounded-xl shadow-2xl p-2 hidden group-hover:block z-[70]">
                            <div className="flex gap-1 mb-2">
                                <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="flex-1 bg-white/5 py-1 rounded"><ZoomOut size={14} className="mx-auto" /></button>
                                <span className="flex-1 text-center text-xs self-center">{Math.round(zoom * 100)}%</span>
                                <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="flex-1 bg-white/5 py-1 rounded"><ZoomIn size={14} className="mx-auto" /></button>
                            </div>
                            <button onClick={() => setWordWrap(!wordWrap)} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/10 rounded-lg flex items-center gap-2">
                                <AlignJustify size={14} /> {wordWrap ? 'Switch to Web' : 'Switch to Print'}
                            </button>
                        </div>
                    </div>

                    <GlassButton onClick={() => setShowOOCChat(!showOOCChat)} variant={showOOCChat ? 'primary' : 'ghost'} className="h-8 gap-2 px-3 text-xs font-bold">
                        <MessageSquare size={14} />
                    </GlassButton>

                    <GlassButton onClick={handleSummonGenie} variant={showGenie ? 'primary' : 'ghost'} className={`h-8 gap-2 px-3 text-xs font-bold ${genieThinking ? 'animate-pulse' : ''}`}>
                        <Zap size={14} />
                    </GlassButton>

                    <GlassButton onClick={() => setIsSidebarOpen(!isSidebarOpen)} variant={isSidebarOpen ? 'primary' : 'ghost'} className="h-8 w-8 p-0">
                        <SidebarIcon size={16} />
                    </GlassButton>
                </div>
            </div>
        </div>
    );
};
