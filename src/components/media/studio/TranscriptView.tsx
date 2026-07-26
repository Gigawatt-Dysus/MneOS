import React from 'react';
import { FileText, Clock } from 'lucide-react';
import MarkdownRenderer from '../../ai/MarkDownRenderer';
import { UniversalMedia } from '../MediaStudioModal';

interface TranscriptViewProps {
    asset: UniversalMedia;
}

const TranscriptView = ({ asset }: TranscriptViewProps) => {
    return (
        <div className="w-full h-full max-w-5xl bg-[#080c14] rounded-[40px] border border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-700 relative">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-500/5 blur-[120px] pointer-events-none" />

            <div className="p-10 border-b border-white/5 bg-white/[0.01] flex items-center justify-between relative z-10">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-inner">
                        <FileText size={24} className="text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em] whitespace-nowrap">Forensic Transcript</span>
                            <div className="w-1 h-1 rounded-full bg-white/20 flex-shrink-0" />
                            <span className="text-[9px] font-mono text-slate-500 truncate">SESSION_ID: {asset.id.slice(-8).toUpperCase()}</span>
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight leading-tight line-clamp-2 max-w-2xl">{asset.title || 'Archival Session'}</h2>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-3 flex-shrink-0">
                    <div className="px-5 py-2 bg-cyan-500/10 rounded-full border border-cyan-500/20 text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                        {asset.source || 'ARCHIVE_IMPORT'}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 bg-white/5 px-3 py-1 rounded-md border border-white/5">
                        <Clock size={12} className="text-slate-400" />
                        <span>{asset.logicalDate ? new Date(asset.logicalDate as any).toLocaleDateString() : new Date().toLocaleDateString()}</span>
                        <span className="text-slate-700 ml-1">ARCHIVE_LOCK</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar relative z-10 forensic-transcript-container">
                <div className="prose prose-invert prose-slate max-w-none 
                    prose-p:leading-relaxed prose-p:text-slate-300 prose-p:mb-8
                    prose-strong:text-white prose-strong:font-black
                    prose-em:text-slate-400 prose-em:not-italic prose-em:font-mono prose-em:text-[11px]
                    whitespace-pre-wrap font-sans text-slate-300 leading-relaxed
                ">
                    {(() => {
                        const raw = (asset.textContent || (asset as any).content || asset.description || 'No transcript content found for this artifact.');
                        
                        // 1. Strip redundant leading [HH:MM AM/PM] bracket, normalize rules, and PURGE ALL BOLDING
                        let cleaned = raw
                            .replace(/^\[\d{1,2}:\d{2}\s*(?:AM|PM)\]\s*/gim, '')
                            .replace(/^---\s*$/gm, '')
                            .replace(/\*\*/g, ''); // [ZEN] Messenger logs don't need markdown; killing all bolding for absolute regex accuracy
                        
                        // 2. Extract context - Hardened to handle bracketed times and bolding in titles
                        const cleanTitle = (asset.title || '')
                            .replace(/^\[\d{1,2}:\d{2}\s*(?:AM|PM)\]\s*/gi, '') // Strip leading [Time]
                            .replace(/\*\*/g, '') // Strip bolding
                            .replace('Messages: ', '');
                        
                        const otherPerson = cleanTitle.split(':')[0].split('(')[0].trim() || 'Archive';
                        const userPerson = "Eric Cornett"; 

                        // 3. Clarify "Messages:" header row into the Modern Signal Schema (NO leading rule)
                        cleaned = cleaned.replace(/(?:^|\n)Messages: (.*?): (\d{1,2}:\d{2}\s*(?:AM|PM))\s*[—\-]\s*(.*?)\s*(?:\n|$)/gi, (match: string, recipient: string, time: string, sender: string) => {
                            return `\nSender: ${sender.trim()}\nRecipient: ${recipient.trim()}\nTime: ${time}\n\n`;
                        });

                        // 4. Clarify ALL standard message headers across the thread into the Modern Signal Schema (WITH separator)
                        cleaned = cleaned.replace(/(?:^|\n)(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[—\-]\s*(.*?)\s*(?:\n|$)/gi, (match: string, time: string, sender: string) => {
                            const cleanSender = sender.trim();
                            const recipient = cleanSender === otherPerson ? userPerson : otherPerson;
                            return `\n____________________\n\nSender: ${cleanSender}\nRecipient: ${recipient}\nTime: ${time}\n\n`;
                        });

                        // 5. Final Sanitization: Collapse duplicate signatures and trim whitespace
                        return cleaned
                            .replace(/\n([^\n]+)\n+\1$/g, '\n$1') // Collapse identical trailing lines
                            .trim()
                            .replace(/\n{3,}/g, '\n\n');
                    })()}
                </div>
                
                <div className="mt-16 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
                    <div className="w-12 h-1 bg-white/5 rounded-full" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] text-center">End of Forensic Record</span>
                    <div className="flex items-center gap-6 opacity-30">
                        <div className="w-16 h-[1px] bg-gradient-to-l from-slate-500 to-transparent" />
                        <div className="w-2 h-2 rounded-full border border-slate-500" />
                        <div className="w-16 h-[1px] bg-gradient-to-r from-slate-500 to-transparent" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TranscriptView;
