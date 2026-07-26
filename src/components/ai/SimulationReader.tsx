import React, { useState, useEffect } from 'react';
import { FileText, FileJson, Download, ChevronDown, ChevronUp, Eye, Loader2 } from 'lucide-react';
import MarkdownRenderer from './MarkDownRenderer';

export interface SimulationReaderProps {
    url: string;
    mimeType?: string;
}

export const SimulationReader: React.FC<SimulationReaderProps> = ({ url, mimeType }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [content, setContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isJson = url.match(/\.json(\?.*)?$/i) || (mimeType && mimeType.includes('json'));
    const isMd = url.match(/\.md(\?.*)?$/i) || (mimeType && mimeType.includes('markdown'));
    const isTxt = url.match(/\.txt(\?.*)?$/i) || (mimeType && mimeType.includes('text/plain'));
    const isPdf = url.match(/\.pdf(\?.*)?$/i) || (mimeType && mimeType.includes('pdf'));

    // Try to extract a filename from the URL, decoding it.
    let fileName = 'simulation_artifact';
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart) {
            fileName = decodeURIComponent(lastPart);
        }
    } catch (e) {
        // Fallback to simple split if not a valid URL
        const parts = url.split('/');
        fileName = decodeURIComponent(parts[parts.length - 1].split('?')[0]);
    }

    const handleToggleExpand = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isExpanded) {
            setIsExpanded(true);
            if (isPdf) return; // Don't fetch text for PDF
            if (!content) {
                setIsLoading(true);
                setError(null);
                try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    const text = await res.text();
                    
                    if (isJson) {
                        try {
                            const parsed = JSON.parse(text);
                            setContent(JSON.stringify(parsed, null, 2));
                        } catch (e) {
                            setContent(text);
                        }
                    } else {
                        setContent(text);
                    }
                } catch (err: any) {
                    setError('Failed to load artifact: ' + err.message);
                } finally {
                    setIsLoading(false);
                }
            }
        } else {
            setIsExpanded(false);
        }
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="w-full my-2 border border-white/10 rounded-xl overflow-hidden bg-black/40 shadow-lg" onClick={(e) => e.stopPropagation()}>
            {/* Header / collapsed state */}
            <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors group"
                onClick={handleToggleExpand}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-[#18191c] rounded-lg border border-white/5 group-hover:border-white/20 transition-colors">
                        {isJson ? <FileJson size={18} className="text-emerald-400" /> : <FileText size={18} className="text-fuchsia-400" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-white/90 truncate">{fileName}</span>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider">
                            {isJson ? 'Simulation Data (JSON)' : isPdf ? 'Document (PDF)' : isTxt ? 'Document (TXT)' : 'Simulation Transcript (MD)'}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleDownload}
                        className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                        title="Download Artifact"
                    >
                        <Download size={16} />
                    </button>
                    <button 
                        className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                        title={isExpanded ? "Collapse" : "Read Artifact"}
                    >
                        {isExpanded ? <ChevronUp size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t border-white/10 bg-[#0d0e12] p-4 max-h-[500px] overflow-y-auto">
                    {isPdf ? (
                        <object data={url} type="application/pdf" className="w-full h-[500px]" aria-label={fileName}>
                            <div className="flex flex-col items-center justify-center h-full text-white/50">
                                <p className="mb-2">Unable to display PDF preview.</p>
                                <button onClick={handleDownload} className="text-cyan-400 hover:underline">Download PDF</button>
                            </div>
                        </object>
                    ) : isLoading ? (
                        <div className="flex items-center justify-center py-8 text-white/50 gap-3">
                            <Loader2 size={18} className="animate-spin" />
                            <span className="text-xs tracking-wider uppercase">Decoding Artifact...</span>
                        </div>
                    ) : error ? (
                        <div className="text-red-400 text-xs py-4 text-center">{error}</div>
                    ) : content ? (
                        isJson ? (
                            <pre className="text-xs text-emerald-400/90 font-mono whitespace-pre-wrap leading-relaxed">
                                {content}
                            </pre>
                        ) : (
                            <div className="prose prose-invert max-w-none prose-sm">
                                {isTxt ? <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300">{content}</pre> : <MarkdownRenderer content={content} onNavigate={() => {}} />}
                            </div>
                        )
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default SimulationReader;
