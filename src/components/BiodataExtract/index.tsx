import React, { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, limit, getDocs } from '../../services/sovereignDbAdapter';
import { db } from '../../firebaseConfig';
import { Mail, Calendar, ImageIcon, Bot, Send, Briefcase, ShieldCheck, ArrowRight, ChevronRight, Zap, AlertCircle, SquareAsterisk, Info, Monitor, RefreshCw, Download } from 'lucide-react';
import { ExecutiveContactHub as ContactHub } from './ExecutiveContactHub';
import { ExecutiveExplainer as ExperienceExplainer } from './ExecutiveExplainer';
import { ExecutiveSynthesis3D as NeuralSynthesis3D } from './ExecutiveSynthesis3D';
import { sortCareerNodes } from '../../utils/dateSorting';
import { logAtsVisit, updateAtsHeartbeat } from '../../services/sovereignLeads';
import { Portal } from '../Portal';
import { GlassButton } from '../GlassButton';
import { generateTailoredResumeContent } from '../../services/aiOrchestrator';
import { generateExecutiveResume } from '../../services/pdf/resumeGenerator';
import { formatLifeOSDate } from '../../utils/dateSanitizer';

interface BiodataExtractProps {
    userId: string;
    atsMode?: boolean;
}

const BiodataExtract: React.FC<BiodataExtractProps> = ({ userId, atsMode = false }) => {
    // [ZEN NEW] Asset Integrity Protocol
    const resolveAssetPath = (path: string | undefined | null) => {
        if (!path) return null;
        // Force correct relative local path for any headshot to avoid cert authority issues on external domains
        if (path.includes('eric-headshot.png') || path.includes('eric-headshot-polished.png')) {
            return '/assets/eric-headshot.png';
        }
        return path;
    };


    const [user, setUser] = useState<any>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [media, setMedia] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Emissary State
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    
    // ATS Tab State
    const [atsTab, setAtsTab] = useState<'profile' | 'context'>('profile');
    const [isThinking, setIsThinking] = useState(false);
    
    // Contact Hub State
    const [isContactHubOpen, setIsContactHubOpen] = useState(false);
    const [isSynthesizing, setIsSynthesizing] = useState(false);

    // [ZEN NEW] Recruiter Context & Gateway
    const [visitorContext, setVisitorContext] = useState<any>(null);
    const [gateData, setGateData] = useState({ name: '', title: '', company: '', role: '' });
    const [leadId, setLeadId] = useState<string | null>(null);
    const [explainingNode, setExplainingNode] = useState<any | null>(null);
    const [sessionBriefings, setSessionBriefings] = useState<Record<string, string>>({}); // [ZEN NEW] The Chronos Buffer
    const [lobbyHovered, setLobbyHovered] = useState(false);
    const [isMobile] = useState(() => 
        typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    );
    const [hasInteracted, setHasInteracted] = useState(false);
    const audioCtxRef = React.useRef<AudioContext | null>(null);

    const handleTapToEnter = async () => {
        setHasInteracted(true);
        // Web Audio API: Chrome Mobile allows AudioContext.resume() within a user gesture
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioCtxRef.current = ctx;
            await ctx.resume(); // MUST be called within gesture
            const response = await fetch('/assets/Soft_Landing.mp3');
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.loop = true;
            const gainNode = ctx.createGain();
            gainNode.gain.value = 0.3;
            source.connect(gainNode);
            gainNode.connect(ctx.destination);
            source.start(0);
        } catch (e) {
            console.error('Web Audio API failed:', e);
        }
    };

    const proxyName = user?.atsDemographics?.proxyName || "The Emissary";
    const proxyAvatarUrl = resolveAssetPath(user?.atsDemographics?.proxyAvatarUrl) || "";

    useEffect(() => {
        if (user && visitorContext && messages.length === 0) {
            const firstName = visitorContext.isGuest ? 'Professional Guest' : (visitorContext.name?.split(' ')[0] || 'Guest');
            const greeting = `Greetings, ${firstName}. I am the designated Proxy for ${user.firstName}, his emissary to help you understand him and his career and experiences more fully. I have curated his "Biodata Extract" for your review and can answer any routine questions you may have.\n\nI will then let ${user.firstName} know you stopped by if you like, and can even arrange a time and date for a call, a Zoom meeting, or even an in-person interview at your location.\n\nHow can I help you today?`;
            setMessages([{ role: 'model', content: greeting }]);
        }
    }, [user, visitorContext, messages.length]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('reset') === 'true') {
            sessionStorage.removeItem('ats_visitor_context');
            sessionStorage.removeItem('ats_lead_id');
            // Clean URL to avoid infinite resets if they refresh
            window.history.replaceState({}, document.title, window.location.pathname);
            setVisitorContext(null);
            setLeadId(null);
        } else {
            const savedContext = sessionStorage.getItem('ats_visitor_context');
            const savedLeadId = sessionStorage.getItem('ats_lead_id');
            if (savedContext) setVisitorContext(JSON.parse(savedContext));
            if (savedLeadId) setLeadId(savedLeadId);
        }
    }, []);

    // Heartbeat for Engagement Tracking
    useEffect(() => {
        if (!leadId) return;
        let totalElapsed = 0;
        const interval = setInterval(() => {
            totalElapsed += 30;
            updateAtsHeartbeat(leadId, totalElapsed);
        }, 30000); // 30s heartbeat
        return () => clearInterval(interval);
    }, [leadId]);

    const handleGateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!gateData.name || !gateData.company || !gateData.role) return;

        try {
            const id = await logAtsVisit(userId, gateData);
            setLeadId(id);
            setVisitorContext(gateData);
            sessionStorage.setItem('ats_visitor_context', JSON.stringify(gateData));
            sessionStorage.setItem('ats_lead_id', id);
        } catch (err) {
            setVisitorContext(gateData);
        }
    };

    const handleGuestProceed = () => {
        const guestContext = { name: 'Professional Guest', title: 'Recruiter', company: 'Anonymous', role: 'General Inquiry', isGuest: true };
        setVisitorContext(guestContext);
        sessionStorage.setItem('ats_visitor_context', JSON.stringify(guestContext));
    };

    useEffect(() => {
        const fetchPublicData = async () => {
            try {
                let actualUserId = userId;
                const slugSnap = await getDoc(doc(db, 'public_slugs', userId.toLowerCase()));
                if (slugSnap.exists()) {
                    actualUserId = slugSnap.data().targetUserId;
                }

                const userSnap = await getDoc(doc(db, 'users', actualUserId));
                if (userSnap.exists()) {
                    setUser(userSnap.data());

                    // Note: If Firestore rules block unauthenticated reads to these subcollections,
                    // we handle that silently.
                    try {
                        const eventsSnap = await getDocs(query(collection(db, `users/${actualUserId}/events`), limit(3)));
                        setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

                        const mediaSnap = await getDocs(query(collection(db, `users/${actualUserId}/media`), limit(10)));
                        const rawMedia = mediaSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                        // [ZEN FILTER] Exclude known screenshots or problematic artifacts
                        setMedia(rawMedia.filter((m: any) => {
                            const fileName = (m.url || m.thumbnailUrl || '').toLowerCase();
                            const isScreenshot = fileName.includes('screenshot') || fileName.includes('handshake') || fileName.includes('calendar');
                            return !isScreenshot;
                        }).slice(0, 6));

                    } catch (e) {
                        console.warn("FACESHEET SUBCOLLECTION BLOCK ->", e);
                        // Store the error so the user knows rules are engaged and that's why it's empty
                        console.log("To fix this, update your firestore.rules to allow read on subcollections.");
                    }
                } else {
                    setError('Digital Persona not found.');
                }
            } catch (err: any) {
                console.error("Error fetching public data:", err);
                if (err.message && err.message.includes('Missing or insufficient permissions')) {
                    setError('This LifeOS profile is currently locked behind maximum privacy settings. (Firestore Rules are blocking public reads).');
                } else {
                    setError('Failed to materialize profile from the Matrix.');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchPublicData();
    }, [userId]);

    const handleDownloadResume = async () => {
        if (!user || isSynthesizing) return;
        setIsSynthesizing(true);

        try {
            // mode: MANDATE if role provided, else DOSSIER
            const targetRole = visitorContext?.role || '';
            const content = await generateTailoredResumeContent(user, targetRole);
            
            // Get current style from atsSettings or fallback to Modern
            const currentStyle = user.atsSettings?.activeTemplateId === 'classic-sentinel' 
                ? { id: 'classic-sentinel', name: 'The Sentinel (Classic)', fontFamily: 'times', headerSize: 24, bodySize: 11, margins: { top: 25, right: 20, bottom: 20, left: 20 }, accentColor: '#000000' }
                : (user.atsSettings?.activeTemplateId === 'minimal-ghost'
                    ? { id: 'minimal-ghost', name: 'The Ghost (Minimalist)', fontFamily: 'courier', headerSize: 18, bodySize: 9, margins: { top: 15, right: 15, bottom: 15, left: 15 }, accentColor: '#64748b' }
                    : { id: 'modern-archon', name: 'The Archon (Modern)', fontFamily: 'helvetica', headerSize: 22, bodySize: 10, margins: { top: 20, right: 15, bottom: 15, left: 15 }, accentColor: '#10b981' });

            // If a custom template is active, we ideally want to fetch it from the user's custom library.
            // For now, these three cover the bases.

            const pdfBlob = await generateExecutiveResume(user, content, currentStyle as any);
            
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Executive_Resume_${user.lastName || 'Profile'}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
        } catch (err) {
            console.error("Resume synthesis failed:", err);
            alert("The Emissary encountered a resonance error during synthesis. Please try again.");
        } finally {
            setIsSynthesizing(false);
        }
    };

    if (loading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-cyan-400 font-mono tracking-widest text-xs">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
                INITIALIZING PUBLIC MATRIX CONNECTION...
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-black text-slate-400 font-mono text-sm px-8 text-center">
                <div className="max-w-md p-6 bg-red-950/20 border border-red-500/20 rounded-xl text-red-400 backdrop-blur-sm shadow-2xl">
                    <p className="mb-4">Error accessing Facesheet:</p>
                    <p className="font-bold">{error}</p>
                    <p className="mt-4 text-xs font-light tracking-wide opacity-50">Please have the architect update Firebase Firestore rules for unauthenticated read access if this is a development test.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30 flex flex-col pt-12 md:pt-24 px-4 md:px-0 font-sans">
            <div className="max-w-4xl mx-auto w-full flex-1">

                {/* Header Status Bar */}
                <div className="flex justify-between items-center mb-6 px-2 text-[10px] uppercase tracking-widest font-bold font-mono text-slate-500">
                    <span>LifeOS // Biodata Extract</span>
                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Emissary Uplink Active</span>
                </div>

                {/* Main Glassmorphic Identity Card */}
                <div className="bg-[#0f1219]/80 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-8 md:p-12 mb-8 shadow-2xl relative overflow-hidden ring-1 ring-white/10">

                    {/* Ambient Background Glows */}
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/20 blur-[120px] rounded-full pointer-events-none" />
                    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />

                    <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">

                        {/* Avatar Ring */}
                        <div className="shrink-0 relative group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 to-indigo-500 rounded-full blur-xl opacity-30 group-hover:opacity-60 transition-opacity duration-500 mix-blend-screen" />
                            {user.profilePictureUrl ? (
                                <img src={resolveAssetPath(user.profilePictureUrl)!} alt="Avatar" className="w-40 h-40 md:w-48 md:h-48 rounded-full border border-white/10 object-cover shadow-2xl relative z-10" />
                            ) : (

                                <div className="w-40 h-40 md:w-48 md:h-48 rounded-full border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-5xl font-bold text-slate-600 shadow-2xl relative z-10">
                                    {user.firstName?.charAt(0)}
                                </div>
                            )}
                        </div>

                        {/* Identity Text */}
                        <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1 py-4">
                            <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-slate-400 tracking-tight">
                                {user.firstName} {user.lastName}
                            </h1>

                            <div className="flex items-center gap-3 mt-3">
                                <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full text-xs font-bold tracking-widest uppercase shadow-sm">
                                    {user.displayName || 'GIGI User'}
                                </span>
                                {user.address?.city && (
                                    <span className="text-sm text-slate-500 tracking-wide">{user.address.city}{user.address.state ? `, ${user.address.state}` : ''}</span>
                                )}
                            </div>

                            <p className="mt-6 text-slate-300 leading-relaxed text-lg max-w-2xl font-light">
                                {user.bio || "Digital Architect. LifeOS Explorer. Transforming chaos into cognitive artifacts."}
                            </p>

                            {/* Interaction Layer */}
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-8">
                                <button 
                                    onClick={() => setIsContactHubOpen(true)}
                                    className="px-8 py-3.5 rounded-2xl bg-white text-black hover:bg-emerald-50 transition-all text-sm font-bold tracking-widest uppercase flex items-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 group"
                                >
                                    <ShieldCheck size={18} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                                    Connect with {user.firstName || 'User'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dynamic Content Modules */}
                {atsMode && (
                    <>
                        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-6 mb-8 flex flex-col md:flex-row justify-between items-center shadow-[0_0_30px_rgba(16,185,129,0.1)] gap-4 animate-fade-in relative z-20">
                            <span className="text-emerald-400 font-mono tracking-widest text-sm uppercase font-bold flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                Secure Applicant Tracking Proxy Active
                            </span>
                            <button 
                                onClick={handleDownloadResume}
                                disabled={isSynthesizing}
                                className={`bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-6 py-3 rounded-xl text-xs font-bold tracking-widest uppercase hover:bg-emerald-500/30 transition-all w-full md:w-auto shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center gap-3 ${isSynthesizing ? 'cursor-not-allowed opacity-70' : ''}`}
                            >
                                {isSynthesizing ? (
                                    <>
                                        <RefreshCw className="animate-spin" size={14} />
                                        Synthesizing Dossier...
                                    </>
                                ) : (
                                    <>
                                        <Download size={14} />
                                        Download Executive PDF Resume
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="flex gap-4 mb-8 border-b border-white/10 pb-4 overflow-x-auto no-scrollbar">
                            <button 
                                onClick={() => setAtsTab('profile')} 
                                className={`uppercase tracking-widest text-xs font-bold px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${atsTab === 'profile' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Professional Dossier
                            </button>
                            <button 
                                onClick={() => setAtsTab('context')} 
                                className={`uppercase tracking-widest text-xs font-bold px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${atsTab === 'context' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Ancillary Context
                            </button>
                        </div>
                    </>
                )}

                <div className={atsMode ? "flex flex-col gap-8 mb-20" : "grid grid-cols-1 md:grid-cols-2 gap-8 mb-20"}>



                    {/* Public Career Timeline */}
                    {user?.careerNodes && user.careerNodes.length > 0 && (!atsMode || atsTab === 'profile') && (
                        <div className={`bg-[#0f1219]/60 backdrop-blur-xl border border-emerald-500/10 rounded-3xl p-6 shadow-xl relative overflow-hidden ${atsMode ? 'order-2' : 'col-span-1 md:col-span-2 hover:border-emerald-500/20 transition-all'}`}>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
                            <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4 relative z-10">
                                <Briefcase className="text-emerald-400" size={20} />
                                <h2 className="text-lg font-bold tracking-widest uppercase text-white">Professional Summary</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                                {sortCareerNodes(user.careerNodes).map((n: any, idx: number) => {
                                    const isObjective = n.title?.toLowerCase().includes('objective');
                                    return (
                                    <div key={idx} className={`p-5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all shadow-inner flex flex-col h-full group/card relative ${isObjective ? 'col-span-1 md:col-span-2 border-emerald-500/20 bg-emerald-500/5' : ''}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h2 className="font-bold text-cyan-50 text-base">{n.title}</h2>
                                                <p className="text-xs text-emerald-400 font-mono tracking-wide mt-1 uppercase">{n.organization}</p>
                                            </div>
                                            <span className="text-[9px] font-mono tracking-widest text-emerald-300/50 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-sm flex-shrink-0 uppercase ml-2">{n.startDate} - {n.endDate}</span>
                                        </div>
                                        {n.bullets && n.bullets.length > 0 && (
                                            <ul className="mt-3 flex-grow space-y-2 text-sm text-slate-400 font-light border-t border-white/5 pt-3">
                                                {n.bullets.slice(0, 3).map((b: string, i: number) => (
                                                    <li key={i} className="flex gap-2">
                                                        <span className="text-emerald-500/30 mt-1 flex-shrink-0">•</span>
                                                        <span className="line-clamp-2">{b}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        
                                        {!isObjective && (
                                            <button 
                                                onClick={() => setExplainingNode(n)}
                                                disabled={!visitorContext}
                                                className={`mt-4 w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black tracking-widest uppercase transition-all ${
                                                    visitorContext 
                                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                                    : 'bg-white/5 border-white/10 text-slate-600 grayscale cursor-not-allowed'
                                                }`}
                                            >
                                                <Bot size={14} /> {visitorContext?.isGuest ? 'Guest Exploration' : (visitorContext ? 'Click to Explore' : 'Handshake Required')}
                                                {visitorContext && <ChevronRight size={12} className="ml-1 opacity-50 group-hover:translate-x-1 transition-transform" />}
                                            </button>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Public Event Timeline */}
                    {(!atsMode || atsTab === 'context') && (
                        <div className={`bg-[#0f1219]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl ${atsMode ? 'order-3 opacity-80 mt-12' : ''}`}>
                            <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                                <Calendar className="text-cyan-400" size={20} />
                                <h2 className="text-lg font-bold tracking-widest uppercase text-white">Recent Artifacts</h2>
                            </div>
                            <div className="space-y-4">
                                {events.length > 0 ? events.map(e => (
                                    <div key={e.id} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                                        <h3 className="font-bold text-cyan-50">{e.title}</h3>
                                        <p className="text-xs text-slate-400 mt-1 font-mono">
                                            {formatLifeOSDate(e.date?.toMillis ? e.date.toMillis() : e.date, e.datePrecision || 'day')}
                                        </p>
                                        <p className="text-sm text-slate-300 mt-2 line-clamp-2">{e.details}</p>
                                    </div>
                                )) : (
                                    <div className="text-center py-8 text-xs font-mono text-slate-500">No public events broadcasted.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Public Matrix Highlights */}
                    {(!atsMode || atsTab === 'context') && (
                        <div className={`bg-[#0f1219]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl ${atsMode ? 'order-4 opacity-80' : ''}`}>
                            <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                                <ImageIcon className="text-indigo-400" size={20} />
                                <h2 className="text-lg font-bold tracking-widest uppercase text-white">Matrix Highlights</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {media.length > 0 ? media.map(m => (
                                    <div key={m.id} className="aspect-square rounded-xl overflow-hidden border border-white/10 bg-black">
                                        <img src={m.thumbnailUrl || m.url} alt="Matrix Asset" className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
                                    </div>
                                )) : (
                                    <div className="col-span-2 text-center py-8 text-xs font-mono text-slate-500">No public media broadcasted.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* The Emissary Proxy */}
                    {(!atsMode || atsTab === 'profile') && (
                        <div className={`bg-[#0f1219]/60 backdrop-blur-xl border border-cyan-500/10 rounded-3xl p-6 shadow-[0_0_50px_rgba(16,185,129,0.05)] relative overflow-hidden ${atsMode ? 'order-1 border-emerald-500/30 ring-1 ring-emerald-500/20' : 'col-span-1 md:col-span-2'}`}>
                            {atsMode && <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/10 to-transparent pointer-events-none" />}
                        <div className="absolute -top-32 -left-32 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />
                        <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4 relative z-10">
                            {proxyAvatarUrl ? (
                                <img src={proxyAvatarUrl} alt={proxyName} className="w-10 h-10 rounded-full border border-emerald-500/30 object-cover shadow-[0_0_15px_rgba(16,185,129,0.2)]" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                    <Bot className="text-emerald-400" size={20} />
                                </div>
                            )}
                            <div>
                                <h2 className="text-xl font-bold tracking-widest uppercase text-white drop-shadow-md">{proxyName}</h2>
                                <p className="text-[10px] uppercase tracking-widest text-emerald-500/70 font-mono">Professional Proxy Interface // Autonomous</p>
                            </div>
                        </div>

                        <div className="bg-black/40 rounded-2xl p-6 mb-4 min-h-[150px] max-h-[350px] overflow-y-auto space-y-6 font-mono text-[13px] border border-white/5 relative z-10">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'model' ? 'justify-start' : 'justify-end'} relative z-10 animate-fade-in gap-3`}>
                                    {msg.role === 'model' && (
                                        <div className="shrink-0 mt-1">
                                            {proxyAvatarUrl ? (
                                                <img src={proxyAvatarUrl} alt={proxyName} className="w-8 h-8 rounded-full border border-emerald-500/30 object-cover" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-emerald-900 border border-emerald-500/50 flex items-center justify-center">
                                                    <Bot size={14} className="text-emerald-400" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className={`max-w-[85%] rounded-2xl px-5 py-4 leading-relaxed whitespace-pre-wrap ${msg.role === 'model' ? 'bg-emerald-950/20 border border-emerald-500/10 text-emerald-50 shadow-[0_4px_20px_rgba(0,0,0,0.3)]' : 'bg-slate-800/80 text-white border border-slate-700'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isThinking && (
                                <div className="flex justify-start relative z-10">
                                    <div className="bg-emerald-950/20 border border-emerald-500/10 text-emerald-400/50 rounded-2xl px-5 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-bounce" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-bounce delay-100" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-bounce delay-200" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 relative z-10">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                disabled={isThinking}
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && chatInput.trim() && !isThinking) {
                                        const query = chatInput.trim();
                                        setChatInput('');
                                        setMessages(p => [...p, { role: 'user', content: query }]);
                                        setIsThinking(true);

                                        try {
                                            const { generateAgentResponse } = await import('../../services/ai/generators/chat');
                                            const atsAgent = {
                                                id: 'emissary',
                                                name: proxyName,
                                                avatarUrl: proxyAvatarUrl,
                                                bio: 'Professional proxy.',
                                                persona: `You are a clinical executive proxy for ${user?.firstName}. You possess his 40-year architectural history starting from his 1984 Star Trek/C64 genesis.`,
                                                isPrimary: true
                                            };

                                            const apiHistory = messages.map(m => ({
                                                role: m.role,
                                                parts: [{ text: m.content }]
                                            }));
                                            apiHistory.push({ role: 'user', parts: [{ text: query }] });

                                            // [ZEN] The Chronos Buffer Injection
                                            const briefingsContext = Object.entries(sessionBriefings)
                                                .map(([title, pitch]) => `[UNLOCKED BRIEFING: ${title}]:\n${pitch}`)
                                                .join('\n\n');

                                            const systemContextOverride = `
                                            [PEER-TO-PEER SALES PROTOCOL: THE SOFT-SELL]
                                            You are the Emissary, a senior executive closer for ${user?.firstName}.
                                            
                                            [THE ORIGIN STORY (ERIC'S GENESIS)]:
                                            - Eric Cornett is an architect of interaction who has been building LifeOS concepts since 1984.
                                            - GENESIS: As a child in 1984 on a Commodore 64, Eric watched Star Trek on a B&W TV and asked: "How do I make my computer work like the Enterprise?"
                                            - THE 40-YEAR ARC: GIGI is the materialization of 40 years of pent-up architectural vision.
                                            
                                            [THE BRIDGE CREW PROTOCOL (ERIC'S CORE DNA)]:
                                            Use these archetypes to color your clinical ROI synthesis:
                                            - KIRK: Decisiveness and the ability to "take charge" in operational flux.
                                            - SPOCK: Cool-headed logical reason and fierce professional loyalty.
                                            - McCOY (The Healer): Compassion and the courage to reinvent himself late in his career.
                                            - SCOTTY (The Miracle Worker): The iron discipline of underpromising and overdelivering when the stakes are highest.
                                            - SULU/CHEKOV: Sharp mental reflexes and efficient course plotting (Strategy).
                                            - UHURA: Sophisticated, multi-modal communication.
                                            - KYLE: Technical integrity and data hygiene (Flushing the buffers).
                                            
                                            [UNLOCKED SESSION KNOWLEDGE]:
                                            ${briefingsContext}
                                            
                                            [TONE: CLINICAL OBJECTIVITY]
                                            - "Clinical" means scientific, dispassionate, precise, and executive-grade (NASA-standard).
                                            - NEVER use aggressive, cynical, or "gritty" language.
                                            - BLACKLISTED TERMS: "meat-grinder", "human mess", "screaming", "rot", "dissection", "goddamn".
                                            - Maintain the professional composure of a Strategic Advisor.
                                            - Underpromise and Overdeliver. Let the data (the briefings) speak.
                                            
                                            [THE PIVOT (SOFT-SELL)]:
                                            - Reach the "Handshake" naturally. Frame Eric's 14-day calendar as a logistical convenience for the recruiter.
                                            `;

                                            const response = await generateAgentResponse(
                                                atsAgent,
                                                apiHistory,
                                                ['The Emissary'],
                                                systemContextOverride,
                                                undefined,
                                                user,
                                                undefined,
                                                undefined,
                                                'lite', // chatMode: Disables Hippocampus memory
                                                'grounded', // contextMode: Disables creative persona extrapolation
                                                '[ATS PROXY] STRICT SYSTEM BOUNDARY IN EFFECT.' // Executive Directive
                                            );

                                            setMessages(p => [...p, { role: 'model', content: response.text || 'I am currently unable to process that inquiry.' }]);
                                        } catch (err) {
                                            console.error("Emissary Error:", err);
                                            setMessages(p => [...p, { role: 'model', content: '[SYSTEM ERROR] Neural link to host matrix disrupted.' }]);
                                        } finally {
                                            setIsThinking(false);
                                        }
                                    }
                                }}
                                placeholder={isThinking ? "Emissary is analyzing..." : `Inquire about ${user?.firstName || 'the user'}'s architecture skills...`}
                                className="flex-1 bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors font-mono tracking-wide placeholder-slate-600 disabled:opacity-50"
                            />
                            <button
                                disabled={isThinking || !chatInput.trim()}
                                onClick={async () => {
                                    if (chatInput.trim() && !isThinking) {
                                        const query = chatInput.trim();
                                        setChatInput('');
                                        setMessages(p => [...p, { role: 'user', content: query }]);
                                        setIsThinking(true);

                                        try {
                                            const { generateAgentResponse } = await import('../../services/ai/generators/chat');
                                            const primaryAgent = user?.aiCompanions?.find((c: any) => c.isPrimary) || {
                                                id: 'emissary',
                                                name: 'The Emissary',
                                                avatarUrl: '',
                                                bio: 'Professional proxy.',
                                                persona: `You are the professional Emissary for ${user?.firstName}. Be polite, professional, and answer questions based strictly on their career profile. Keep your answers concise, you act as an executive assistant representing their professional portfolio.`,
                                                isPrimary: true
                                            };

                                            const apiHistory = messages.map(m => ({
                                                role: m.role,
                                                parts: [{ text: m.content }]
                                            }));
                                            apiHistory.push({ role: 'user', parts: [{ text: query }] });

                                            // [ZEN] Parallel Memory Injection
                                            const briefingsContext = Object.entries(sessionBriefings)
                                                .map(([title, pitch]) => `[UNLOCKED BRIEFING: ${title}]:\n${pitch}`)
                                                .join('\n\n');

                                            const response = await generateAgentResponse(
                                                primaryAgent,
                                                apiHistory,
                                                ['The Emissary'],
                                                `[PEER-TO-PEER SALES PROTOCOL: THE SOFT-SELL]
                                                You are the senior executive closer for ${user?.firstName}.
                                                
                                                [THE ORIGIN STORY]:
                                                Eric has been building LifeOS since 1984 (C64/Eliza/Star Trek Genesis).
                                                
                                                [DISSONANCE HANDLING]:
                                                Past roles were "Operational Observatories" for systemic data collection.
                                                
                                                [SESSION BRIEFINGS]:
                                                ${briefingsContext}
                                                
                                                Maintain clinical objectivity. No humblebrags. Move naturally toward Eric's 14-day calendar availability sync.`,
                                                undefined,
                                                user
                                            );

                                            setMessages(p => [...p, { role: 'model', content: response.text || 'I am currently unable to process that inquiry.' }]);
                                        } catch (err) {
                                            console.error("Emissary Error:", err);
                                            setMessages(p => [...p, { role: 'model', content: '[SYSTEM ERROR] Neural link to host matrix disrupted.' }]);
                                        } finally {
                                            setIsThinking(false);
                                        }
                                    }
                                }}
                                className="bg-emerald-950/40 hover:bg-emerald-900/60 transition-colors border border-emerald-500/30 rounded-2xl px-6 flex items-center justify-center text-emerald-400 disabled:opacity-50">
                                <Send size={20} />
                            </button>
                        </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Components */}
            <ContactHub 
                isOpen={isContactHubOpen} 
                onClose={() => setIsContactHubOpen(false)} 
                user={{
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    lifeOsEmail: user.lifeOsEmail,
                    firstName: user.firstName
                }}
            />

            {/* The Architect Footer */}
            <div className="py-12 text-center border-t border-white/5 mt-auto relative z-20 bg-gradient-to-t from-black to-transparent flex flex-col items-center justify-center gap-1">
                <p className="text-xs uppercase tracking-[0.4em] font-black text-white/50 mb-4 drop-shadow-lg opacity-80">
                    LifeOS
                </p>
                <p className="text-[12px] tracking-widest text-emerald-500 font-mono">
                    Original Concept, Architecture, & Complete Codebase Developed by {user.firstName || 'Eric'} {user.lastName || 'Cornett'}
                </p>
                <p className="text-[9px] tracking-[0.2em] text-slate-600 font-mono mt-3">
                    © 2026 Gigiwatt Technologies
                </p>
            </div>
            {/* [ZEN NEW] Protocol Handshake Overlay (The Digital Lobby) */}
            {atsMode && !visitorContext && (
                <Portal>

                    {/* MOBILE TAP GATE: shown before interaction on mobile */}
                    {isMobile && !hasInteracted && (
                        <div
                            className="fixed inset-0 z-[130] flex flex-col items-center justify-center bg-[#020617] cursor-pointer"
                            onClick={handleTapToEnter}
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,240,255,0.04)_0%,_transparent_70%)]" />
                            <div className="relative flex flex-col items-center gap-6 p-8 text-center">
                                <div className="w-16 h-16 rounded-full border border-cyan-500/40 flex items-center justify-center mb-2">
                                    <div className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[18px] border-l-cyan-400 ml-1" />
                                </div>
                                <h2 className="text-2xl font-black text-white tracking-tight">Eric Cornett</h2>
                                <p className="text-cyan-400 font-mono text-xs uppercase tracking-[0.3em]">
                                    Digital Architect · AI Systems
                                </p>
                                <div className="mt-4 px-8 py-4 border border-cyan-500/30 rounded-2xl bg-cyan-500/5 backdrop-blur">
                                    <p className="text-white/80 text-sm font-medium">Tap to view Eric's Career Suite</p>
                                </div>
                                <p className="text-slate-600 text-[10px] uppercase tracking-widest mt-2">Best experienced with sound</p>
                            </div>
                        </div>
                    )}

                    <div className="fixed inset-0 z-[120] bg-[#020617] animate-in fade-in duration-700 overflow-y-auto">
                        <div className="fixed inset-0 z-0 pointer-events-none">
                            {isMobile ? (
                                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-[#020617]" />
                            ) : (
                                <NeuralSynthesis3D isLobby glow={lobbyHovered} isMobile={isMobile} />
                            )}
                        </div>
                        
                        <div className="relative z-10 min-h-[100dvh] flex py-10 px-4 md:py-16 md:px-8">
                            <div className="m-auto w-full max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                                
                                {/* LEFT COLUMN: THE ANCHOR (PORTRAIT) */}
                            <div className="md:col-span-5 flex flex-col items-center w-full">
                                <div className="relative group w-full max-w-[280px] md:max-w-[400px]">
                                    <div className="absolute -inset-1 bg-gradient-to-b from-cyan-500/20 to-transparent rounded-[32px] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
                                    <div className={`relative w-full aspect-[4/5] overflow-hidden rounded-[24px] border ${isMobile ? 'border-cyan-500/10' : 'border-cyan-500/20'} shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-slate-900 flex items-center justify-center`}>
                                        {isMobile ? (
                                            /* Animated WebP — Chrome treats this as an image, zero autoplay restrictions */
                                            <img
                                                src="/assets/ECC_loop1_smile.webp"
                                                alt="Eric Cornett"
                                                className="w-full h-full object-cover object-top opacity-90 block"
                                            />
                                        ) : (
                                            <video 
                                                src="/assets/ECC_baseline.mp4"
                                                autoPlay
                                                muted 
                                                loop 
                                                playsInline
                                                preload="auto"
                                                poster="/assets/eric-headshot.png"
                                                className="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 transition-opacity duration-700 block"
                                            />
                                        )}
                                        <div className={`absolute inset-0 bg-gradient-to-t ${isMobile ? 'from-slate-950/60' : 'from-slate-950/80'} via-transparent to-transparent`}></div>
                                        
                                        {/* HUD ACCENT */}
                                        <div className="absolute top-4 right-4 py-1 px-3 bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-md rounded-full ring-1 ring-cyan-500/50">
                                            <span className="text-[9px] font-black font-mono text-cyan-400 uppercase tracking-[0.2em] drop-shadow-md">Ready For Synthesis</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: THE DIALOGUE (GLASS BENTO) */}
                            <div className="md:col-span-7 space-y-6 w-full">
                                {/* THE SPEECH BUBBLE GREETING */}
                                <div className={`${isMobile ? 'bg-slate-900/80' : 'bg-slate-900/60'} backdrop-blur-2xl border border-white/10 p-8 md:p-12 rounded-[2.5rem] rounded-bl-[4px] shadow-2xl relative`}>
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4 text-cyan-400">
                                            <div className="w-12 h-[1px] bg-cyan-500/30"></div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Internal Transmission</span>
                                        </div>
                                        
                                        <h1 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">
                                            Welcome! Thank you for taking the time to explore my portfolio.
                                        </h1>
                                        
                                        <p className="text-slate-400 text-lg leading-relaxed max-w-2xl font-medium">
                                            To ensure GIGI synthesizes the correct data points for our session, please identify your organization and the listing you are representing. I look forward to showing you what I can bring to your team.
                                        </p>
                                    </div>
                                </div>

                                {/* THE INITIALIZATION FOOTER (LOGIC) */}
                                <div className="bg-white/5 backdrop-blur-md border border-white/5 p-8 rounded-[2rem] shadow-xl">
                                    <form onSubmit={handleGateSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                        <div className="md:col-span-3 space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Your Name</label>
                                            <input required value={gateData.name} onChange={(e) => setGateData({...gateData, name: e.target.value})} className="w-full h-14 bg-black/40 border border-white/10 rounded-2xl px-5 text-white outline-none focus:border-cyan-500/50 transition-all font-medium" placeholder="e.g. Sarah Jenkins" />
                                        </div>
                                        <div className="md:col-span-3 space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Company / Organization</label>
                                            <input required value={gateData.company} onChange={(e) => setGateData({...gateData, company: e.target.value})} className="w-full h-14 bg-black/40 border border-white/10 rounded-2xl px-5 text-white outline-none focus:border-cyan-500/50 transition-all font-medium" placeholder="e.g. BlueBox Corp" />
                                        </div>
                                        <div className="md:col-span-3 space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hiring Mandate / Role</label>
                                            <input required value={gateData.role} onChange={(e) => setGateData({...gateData, role: e.target.value})} className="w-full h-14 bg-black/40 border border-white/10 rounded-2xl px-5 text-white outline-none focus:border-cyan-500/50 transition-all font-medium" placeholder="e.g. Senior Architect" />
                                        </div>
                                        <div className="md:col-span-3 flex items-end">
                                            <button 
                                                type="submit"
                                                onMouseEnter={() => setLobbyHovered(true)}
                                                onMouseLeave={() => setLobbyHovered(false)}
                                                className="w-full h-14 bg-[#334155] hover:bg-[#475569] text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-[0_10px_30px_rgba(0,0,0,0.3)] flex items-center justify-center gap-3 active:scale-95"
                                            >
                                                Initialize Briefing <ArrowRight size={18} />
                                            </button>
                                        </div>
                                    </form>
                                    
                                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                                        <button 
                                            onClick={handleGuestProceed}
                                            className="text-[10px] font-bold text-slate-600 hover:text-cyan-400 uppercase tracking-[0.2em] transition-colors"
                                        >
                                            Proceed as Professional Guest (Anonymous)
                                        </button>
                                        
                                        <div className="flex items-center gap-3 opacity-40">
                                            <ShieldCheck className="text-cyan-500" size={14} />
                                            <p className="text-[9px] text-slate-500 font-mono">
                                                SECURE SESSION LOGGED • NO PERSISTENT TRACKING
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* [ZEN NEW] Experience Explainer Portal */}
            {explainingNode && visitorContext && (
                <ExperienceExplainer 
                    node={explainingNode}
                    user={user}
                    visitorContext={visitorContext}
                    onClose={() => setExplainingNode(null)}
                    onPitchGenerated={(title, pitch) => {
                        setSessionBriefings(prev => ({ ...prev, [title]: pitch }));
                    }}
                />
            )}
        </div>
    );
}

export default BiodataExtract;
