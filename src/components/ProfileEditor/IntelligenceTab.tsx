import React, { useEffect, useState } from 'react';
import { getAtsLeads, AtsLead } from '../../services/sovereignLeads';
import { User } from '../../types';
import { Bot, Mail, Clock, Building, User as UserIcon, Calendar, ArrowRight, Zap, LucideIcon } from 'lucide-react';
import { GlassButton } from '../GlassButton';

interface IntelligenceTabProps {
    user: User;
}

export const IntelligenceTab: React.FC<IntelligenceTabProps> = ({ user }) => {
    const [leads, setLeads] = useState<AtsLead[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeads = async () => {
            if (!user.id) return;
            const data = await getAtsLeads(user.id);
            setLeads(data);
            setLoading(false);
        };
        fetchLeads();
    }, [user.id]);

    const handleFollowUp = (lead: AtsLead) => {
        const subject = encodeURIComponent(`Following up: Your visit to GIGI - ${user.firstName} ${user.lastName}`);
        const body = encodeURIComponent(`Hi ${lead.visitorName},\n\nI noticed the Emissary greeted you regarding the ${lead.targetRole || 'position'} at ${lead.visitorCompany} today. I'm excited about the potential intersection between my background and your goals.\n\nWould you like to schedule a deep-dive into how my experience solves for your current needs?\n\nBest regards,\n${user.firstName}`);
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Zap className="text-emerald-500 animate-pulse" size={32} />
                <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">Scanning Signal History...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Signal Trace */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
                <div className="flex items-center gap-4 mb-2">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <Bot className="text-emerald-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-white">Recruiter Intelligence Hub</h2>
                        <p className="text-xs text-slate-400 font-medium">Cross-referencing market intent with your professional nodes.</p>
                    </div>
                </div>
            </div>

            {/* Leads List */}
            <div className="grid grid-cols-1 gap-4">
                {leads.length > 0 ? (
                    leads.map((lead) => (
                        <div key={lead.id} className="group bg-[#0f1219]/80 border border-white/5 hover:border-emerald-500/20 rounded-2xl p-6 transition-all shadow-xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 to-emerald-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                            
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-emerald-400 transition-colors">
                                        <UserIcon size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-white font-bold text-base">{lead.visitorName}</h3>
                                            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest px-2 py-0.5 bg-white/5 rounded-sm">{lead.visitorTitle}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                                            <div className="flex items-center gap-1.5"><Building size={14} className="text-emerald-500/50" /> {lead.visitorCompany}</div>
                                            <div className="flex items-center gap-1.5"><Zap size={14} className="text-cyan-500/50" /> HIRING: <span className="text-cyan-400 font-bold">{lead.targetRole}</span></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 w-full md:w-auto border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                            <Clock size={12} /> Engagement
                                        </div>
                                        <div className="text-emerald-400 font-mono text-sm font-bold tracking-widest">
                                            {lead.durationSec > 0 ? `${Math.ceil(lead.durationSec / 60)} min` : '< 1 min'}
                                        </div>
                                    </div>
                                    
                                    <div className="h-10 w-px bg-white/5 hidden md:block" />

                                    <button 
                                        onClick={() => handleFollowUp(lead)}
                                        className="flex-1 md:flex-none px-6 py-3 bg-emerald-500 text-black rounded-xl text-xs font-bold tracking-widest uppercase hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Mail size={14} /> Follow-up Scribe
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-20 flex flex-col items-center justify-center text-center opacity-50">
                        <Zap size={48} className="text-slate-700 mb-6" />
                        <h3 className="text-white font-bold text-lg mb-2">Passive Signal Mode</h3>
                        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">The Emissary is currently monitoring incoming ATS traffic. No intersections recorded in the current epoch.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
