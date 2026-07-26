import React, { useState, useEffect, useRef } from 'react';
import type { View, User, Media, Tag, AddressData } from '@/types';
import {
    Radio, Activity as PulseIcon, Image as ImageIcon, MapPin, Plus, Settings as SettingsIcon
} from 'lucide-react';
import { uploadFile } from '../../services/storageService';
import { appDataService } from '../../services/serviceManager';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { GlassAvatar } from '../GlassAvatar';
import { MarkdownEditor } from '../shared/MarkdownEditor';

const AI_STATUS_MESSAGES = [
    "Analyzing narrative threads...",
    "Optimizing retrieval paths...",
    "Monitoring temporal variance...",
    "System nominal. Ready for input.",
    "Cataloging recent artifacts...",
    "Scanning for emotional resonance..."
];

interface ComposerCardProps {
    aiName: string;
    aiAvatar: string;
    recentTags: Tag[];
    media: Media[];
    user: User;
    onNavigate: (view: View, data?: any) => void;
    streamStatus: 'idle' | 'receiving';
}

export const ComposerCard: React.FC<ComposerCardProps> = ({ aiName, aiAvatar, recentTags, media, user, onNavigate, streamStatus }) => {
    const [statusMsg, setStatusMsg] = useState(AI_STATUS_MESSAGES[0]);
    const [aiQuery, setAiQuery] = useState('');
    const [wdyetText, setWdyetText] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [attachedMedia, setAttachedMedia] = useState<Media[]>([]);
    const [showMap, setShowMap] = useState(false);
    const [draftLocation, setDraftLocation] = useState<AddressData | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const savedText = sessionStorage.getItem('gigi_draft_text');
        if (savedText) setWdyetText(savedText);
        const savedMedia = sessionStorage.getItem('gigi_draft_media');
        if (savedMedia) { try { setAttachedMedia(JSON.parse(savedMedia)); } catch (e) { } }
        const savedLoc = sessionStorage.getItem('gigi_draft_location');
        if (savedLoc) { try { setDraftLocation(JSON.parse(savedLoc)); } catch (e) { } }
    }, []);

    useEffect(() => { sessionStorage.setItem('gigi_draft_text', wdyetText); }, [wdyetText]);
    useEffect(() => { sessionStorage.setItem('gigi_draft_media', JSON.stringify(attachedMedia)); }, [attachedMedia]);
    useEffect(() => { if (draftLocation) sessionStorage.setItem('gigi_draft_location', JSON.stringify(draftLocation)); else sessionStorage.removeItem('gigi_draft_location'); }, [draftLocation]);

    useEffect(() => {
        const interval = setInterval(() => {
            setStatusMsg(AI_STATUS_MESSAGES[Math.floor(Math.random() * AI_STATUS_MESSAGES.length)]);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    const handleAiQuerySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (aiQuery.trim()) {
            onNavigate('interviews', { initialMessage: aiQuery });
            setAiQuery('');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        const newAttachments: Media[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const { url } = await uploadFile(file, user.id, `event-attachment-${Date.now()}`);
                // [ZEN FIX] Added missing mediaIds property
                const newMedia: Media = {
                    id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    url: url, thumbnailUrl: url, caption: 'Draft Attachment',
                    uploadDate: new Date(), fileType: file.type, fileName: file.name,
                    size: file.size, tagIds: [], status: 'provisional', logicalDate: new Date().toISOString(),
                    mediaIds: []
                };
                await appDataService.saveMedia(user.id, newMedia);
                newAttachments.push(newMedia);
            } catch (err) { console.error("Quick Upload Failed", err); }
        }
        setAttachedMedia(prev => [...prev, ...newAttachments]);
        setIsUploading(false);
    };

    const handleCreateEvent = () => {
        const draftEvent = {
            title: wdyetText.split('\n')[0].substring(0, 50) || "New Memory",
            details: wdyetText, mediaIds: attachedMedia.map(m => m.id), location: draftLocation
        };
        sessionStorage.removeItem('gigi_draft_text');
        sessionStorage.removeItem('gigi_draft_media');
        sessionStorage.removeItem('gigi_draft_location');
        setWdyetText(''); setAttachedMedia([]); setDraftLocation(null);
        onNavigate('eventEditor', { draftEvent });
    };

    const getTagImage = (tag: Tag) => {
        if (tag.mainImageId) {
            const m = media.find(x => x.id === tag.mainImageId);
            if (m) return m.thumbnailUrl || m.url;
        }
        return null;
    };

    return (
        <div className="h-full bg-black/20 backdrop-blur-md rounded-3xl border border-white/5 p-6 relative overflow-hidden flex flex-col shadow-2xl gap-4 min-h-[500px]">

            {/* Header with AI Team */}
            <div className={`bg-slate-900/80 border rounded-xl p-3 flex items-center gap-3 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] transition-colors duration-500 shrink-0 ${streamStatus === 'receiving' ? 'border-amber-500/50 bg-amber-950/20' : 'border-emerald-500/20'}`}>

                <div className="flex -space-x-3 hover:space-x-1 transition-all duration-300 relative shrink-0 pl-1">
                    {user.aiCompanions && user.aiCompanions.length > 0 ? (
                        user.aiCompanions.map((companion) => (
                            <div key={companion.id} onClick={() => onNavigate('aiCompanionEditor')} className="relative z-10 cursor-pointer hover:z-20 hover:scale-110 transition-transform">
                                <GlassAvatar
                                    imageUrl={companion.avatarUrl}
                                    altText={companion.name}
                                    fallbackChar={companion.name}
                                    size="w-10 h-10"
                                    className={companion.isPrimary ? "border-emerald-500 shadow-[0_0_10px_#10b981]" : "opacity-80"}
                                />
                                {companion.isPrimary && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-black rounded-full z-20"></span>}
                            </div>
                        ))
                    ) : (
                        <div onClick={() => onNavigate('aiCompanionEditor')} className="relative z-10 cursor-pointer hover:scale-110 transition-transform">
                            <GlassAvatar imageUrl={aiAvatar} altText="AI" fallbackChar="AI" size="w-10 h-10" />
                        </div>
                    )}
                    <button onClick={() => onNavigate('aiCompanionEditor')} className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-500 transition-all z-0 ml-2" title="Manage Companions"><SettingsIcon size={14} /></button>
                </div>

                <div className="flex-1 min-w-0 pl-2">
                    <div className="flex justify-between items-center mb-1">
                        {streamStatus === 'receiving' ? (
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2 animate-pulse">
                                <Radio size={12} className="animate-spin" /> Temporal Variance Detected
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                <PulseIcon size={12} /> Neural Uplink: Stable
                            </span>
                        )}
                    </div>
                    <form onSubmit={handleAiQuerySubmit} className="flex gap-2">
                        <span className="text-emerald-500 font-mono text-sm">{">"}</span>
                        <input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder={`${aiName}: ${statusMsg}`} className="bg-transparent border-none outline-none text-sm text-white placeholder-slate-600 font-mono w-full" />
                    </form>
                </div>
            </div>

            <div className="flex-1 bg-white/5 rounded-2xl p-1 border border-white/10 mb-2 shadow-inner group focus-within:border-cyan-500/50 transition-colors flex flex-col min-h-0">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/20 shrink-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">LOG NEW EVENT</span>
                </div>

                {/* GhostWriter Integration */}
                <MarkdownEditor
                    value={wdyetText}
                    onChange={setWdyetText}
                    hideFooter={true}
                    className="flex-1 h-full"
                    placeholder="What did you experience today?"
                />

                {(attachedMedia.length > 0 || draftLocation) && (
                    <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0 bg-[#0f1219]/50 pt-2 border-t border-white/5">
                        {attachedMedia.map((m) => (
                            <div key={m.id} onClick={() => onNavigate('theMatrix', { mediaId: m.id, mediaObject: m })} className="h-10 w-10 rounded border border-white/20 overflow-hidden relative cursor-pointer hover:border-cyan-500 transition-colors" title="View in Matrix">
                                <img src={m.thumbnailUrl || m.url} className="w-full h-full object-cover" alt="thumb" />
                            </div>
                        ))}
                        {draftLocation && <div className="h-10 px-2 bg-emerald-900/30 border border-emerald-500/30 rounded flex items-center justify-center text-xs text-emerald-400 truncate max-w-[100px]">{draftLocation.addressLocality}</div>}
                    </div>
                )}

                {showMap && (
                    <div className="px-4 pb-2 shrink-0 bg-[#0f1219]/50">
                        <AddressAutocomplete value={draftLocation || { streetAddress: '', addressLocality: '', addressRegion: '', postalCode: '' }} onChange={(addr) => { setDraftLocation(addr); setShowMap(false); }} apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} />
                    </div>
                )}
                <div className="px-4 py-3 flex items-center justify-between bg-black/20 shrink-0 border-t border-white/5">
                    <div className="flex gap-4">
                        <button onClick={() => fileInputRef.current?.click()} className="text-slate-500 hover:text-white transition-colors relative" title="Attach Media"><ImageIcon size={20} />{isUploading && <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-500 rounded-full animate-ping"></span>}</button>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
                        <button onClick={() => setShowMap(!showMap)} className={`transition-colors ${draftLocation ? 'text-emerald-500' : 'text-slate-500 hover:text-white'}`} title="Add Location"><MapPin size={20} /></button>
                    </div>
                    <button onClick={handleCreateEvent} disabled={!wdyetText.trim()} className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center text-white hover:bg-cyan-500 transition-colors shadow-[0_0_15px_#0891b2] disabled:opacity-50 disabled:shadow-none"><Plus size={24} strokeWidth={3} /></button>
                </div>
            </div>

            <div className="mt-auto shrink-0">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Active Entities</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                    {recentTags.map(tag => {
                        const imgUrl = getTagImage(tag);
                        return (
                            <button key={tag.id} onClick={(e) => { e.stopPropagation(); onNavigate('tags', { tagId: tag.id }); }} className="flex-shrink-0 w-14 h-14 relative group" title={tag.name}>
                                <GlassAvatar
                                    imageUrl={imgUrl || undefined}
                                    altText={tag.name}
                                    fallbackChar={tag.name}
                                    size="w-14 h-14"
                                    className="text-xl font-bold"
                                />
                                <div className={`absolute bottom-0 left-0 w-full h-1 ${tag.type === 'person' ? 'bg-violet-500' : 'bg-emerald-500'} rounded-full mt-1`}></div>
                            </button>
                        );
                    })}
                    <button onClick={(e) => { e.stopPropagation(); onNavigate('tags', { create: true }); }} className="flex-shrink-0 w-14 h-14 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-600 hover:text-white hover:border-slate-500 transition-colors" title="Create New Tag"><Plus size={20} /></button>
                </div>
            </div>
        </div>
    );
};