import React, { useState, useEffect } from 'react';
import { generateDeepDiveFromQuery } from '../services/geminiService';
import type { User, LifeEvent, Tag, Media } from '@/types';
import { Loader2, BookOpen, X, Printer, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GlassButton } from './GlassButton';

interface DeepDiveReporterProps {
    query: string;
    user: User;
    events: LifeEvent[];
    tags: Tag[];
    media: Media[]; 
    onClose: () => void;
}

const DeepDiveReporter: React.FC<DeepDiveReporterProps> = ({ query, user, events, tags, media, onClose }) => {
    const [report, setReport] = useState<{ title: string; content: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!loading) return;
        const interval = setInterval(() => setElapsed(p => p + 1), 1000);
        return () => clearInterval(interval);
    }, [loading]);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                // [ZEN FIX] Passed 'media' to match signature
                const result = await generateDeepDiveFromQuery(query, user, events, tags, media);
                setReport(result);
            } catch (e) {
                console.error(e);
                setReport({ title: "Analysis Failed", content: "Gigi encountered a neural block while processing this request. Please try again." });
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [query, user, events, tags, media]);

    const handlePrint = () => {
        window.print();
    };

    if (!report && !loading) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 print:p-0 print:bg-white print:static">
            <div className="bg-[#0f1219] w-full max-w-4xl h-[90vh] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden relative print:border-none print:shadow-none print:h-auto print:w-full">
                
                <button 
                    onClick={onClose} 
                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white z-10 hover:bg-white/10 rounded-full transition-colors print:hidden"
                >
                    <X size={24} />
                </button>
                
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-cyan-400 gap-6 p-8 text-center">
                        <div className="relative">
                            <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 animate-pulse"></div>
                            <Loader2 className="w-16 h-16 animate-spin relative z-10" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white mb-2">Analyzing Archive...</h3>
                            <p className="text-sm font-mono text-cyan-500/70 uppercase tracking-widest">
                                Cross-referencing {events.length} events and {tags.length} entities
                            </p>
                            <p className="text-xs text-slate-600 mt-4 font-mono">{elapsed}s elapsed</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                        <div className="bg-[#13161f] p-12 border-b border-white/5 print:bg-white print:text-black print:border-black">
                            <div className="max-w-3xl mx-auto">
                                <div className="flex items-center gap-3 mb-6 text-cyan-500 print:text-black">
                                    <Sparkles size={24} />
                                    <span className="text-xs font-bold uppercase tracking-[0.3em]">Gigi Intelligence Report</span>
                                </div>
                                <h1 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight print:text-black">{report?.title}</h1>
                                <div className="flex gap-4 text-xs font-mono text-slate-500 print:text-gray-600">
                                    <span>QUERY: "{query}"</span>
                                    <span>•</span>
                                    <span>GENERATED: {new Date().toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 p-12 bg-[#0f1219] print:bg-white">
                            <div className="max-w-3xl mx-auto prose prose-invert prose-lg text-slate-300 font-serif leading-relaxed print:text-black print:prose-black">
                                <ReactMarkdown
                                    components={{
                                        // [ZEN FIX] Explicit 'any' typing to silence compiler
                                        h1: ({node, ...props}: any) => <h1 className="text-3xl font-bold text-white mt-8 mb-4 print:text-black" {...props} />,
                                        h2: ({node, ...props}: any) => <h2 className="text-2xl font-bold text-cyan-100 mt-8 mb-4 border-b border-white/10 pb-2 print:text-black print:border-gray-300" {...props} />,
                                        strong: ({node, ...props}: any) => <strong className="text-cyan-400 font-bold print:text-black" {...props} />,
                                        blockquote: ({node, ...props}: any) => <blockquote className="border-l-4 border-cyan-500/50 pl-4 italic text-slate-400 my-6 print:text-gray-600 print:border-gray-400" {...props} />,
                                    }}
                                >
                                    {report?.content || ''}
                                </ReactMarkdown>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/5 bg-[#13161f] flex justify-between items-center print:hidden">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <BookOpen size={14} />
                                <span>Generated by G.I.G.I. Neural Core</span>
                            </div>
                            <div className="flex gap-3">
                                <GlassButton onClick={handlePrint} variant="ghost">
                                    <Printer size={16} /> Print / PDF
                                </GlassButton>
                                <GlassButton onClick={onClose} variant="primary">
                                    Done
                                </GlassButton>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeepDiveReporter;