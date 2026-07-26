/**
 * [SOVEREIGN HEALTH MONITOR] — Tier 3 of the Sovereign Intelligence Engine [ZEN-V2]
 *
 * Listens for pending DataAnomalyAlert records in Firestore and surfaces them
 * to the user for review. GIGI proposes — the user decides.
 *
 * Features:
 * - Style Learning: Approving prose patterns (ellipses, casing).
 * - Housekeeping: Fixing double spaces, placeholders, and formatting.
 * - Geo Health: Resolving corrupted archival addresses.
 * - Emergency Brake: Pauses background audits while the UI is open.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    getFirestore,
    collection,
    query,
    where,
    onSnapshot,
    doc,
    setDoc,
    getDoc
} from '../../services/sovereignDbAdapter';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { 
    AlertTriangle, 
    CheckCircle, 
    XCircle, 
    MapPin, 
    ChevronDown, 
    ChevronUp, 
    Loader2, 
    Sparkles, 
    Type, 
    FileSearch, 
    Heart 
} from 'lucide-react';
import type { DataAnomalyAlert } from '../../services/SovereignHealthService';
import { 
    resolveAnomaly, 
    dismissGeoAnomaly, 
    runGeoAudit,
    runHousekeepingAudit
} from '../../services/SovereignHealthService';
import { approveStylePreference } from '../../services/SovereignStyleService';

interface DataHealthBannerProps {
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    onAnomalyCountChange?: (count: number) => void;
    onManualEdit?: (sourceId: string, sourceCollection: string, anomalyId: string) => void;
}

const SEVERITY_COLORS = {
    high: { bg: 'bg-red-900/20', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' },
    medium: { bg: 'bg-amber-900/20', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500' },
    low: { bg: 'bg-slate-800/40', border: 'border-white/10', text: 'text-slate-400', dot: 'bg-slate-500' }
};

const SOURCE_LABELS: Record<string, string> = {
    'locations_v1': 'Location History',
    'places_v1': 'Place Archive',
    'media_v1': 'Media Narrative',
    'firestore_tag': 'Personality Tag'
};

interface AnomalyCardProps {
    anomaly: DataAnomalyAlert;
    userId: string;
    onResolved: () => void;
    onManualEdit?: (sourceId: string, sourceCollection: string, anomalyId: string) => void;
}

const AnomalyCard: React.FC<AnomalyCardProps> = ({ 
    anomaly, 
    userId, 
    onResolved, 
    onManualEdit 
}) => {
    const [customFix, setCustomFix] = useState(anomaly.suggestedFix || '');
    const [isApplying, setIsApplying] = useState(false);
    const [isDismissing, setIsDismissing] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(anomaly.previewUrl || '');
    const [imageError, setImageError] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const colors = SEVERITY_COLORS[anomaly.severity];

    // [ZEN] Visual Recon: Fetch/Resolve preview
    useEffect(() => {
        const resolveUrl = async (rawUrl: string) => {
            if (!rawUrl) return '';
            if (rawUrl.startsWith('users/')) {
                try {
                    const storage = getStorage();
                    const url = await getDownloadURL(ref(storage, rawUrl));
                    return url;
                } catch (e) {
                    console.warn('[DataHealthBanner] Failed to resolve storage path:', rawUrl);
                    return '';
                }
            }
            return rawUrl;
        };

        if (anomaly.sourceCollection === 'media_v1') {
            const db = getFirestore();
            const mediaRef = doc(db, 'users', userId, 'media', anomaly.sourceId);
            getDoc(mediaRef).then(async snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    const raw = data.thumbnailUrl || data.storagePath || '';
                    const resolved = await resolveUrl(raw);
                    setPreviewUrl(resolved);
                }
            });
        } else if (previewUrl.startsWith('users/')) {
            resolveUrl(previewUrl).then(setPreviewUrl);
        }
    }, [anomaly.sourceId, anomaly.sourceCollection, anomaly.previewUrl, userId]);

    const handleApprove = async () => {
        if (!customFix.trim() && anomaly.type !== 'style_learning') return;
        setIsApplying(true);
        try {
            if (anomaly.type === 'style_learning') {
                await approveStylePreference(userId, anomaly.id);
            } else {
                await resolveAnomaly(userId, anomaly.id, { address: customFix.trim() });
            }
            onResolved();
        } catch (e) {
            console.error('[DataHealthBanner] Fix failed:', e);
        } finally {
            setIsApplying(false);
        }
    };

    const handleDismiss = async () => {
        setIsDismissing(true);
        try {
            await dismissGeoAnomaly(userId, anomaly.id);
            onResolved();
        } catch (e) {
            console.error('[DataHealthBanner] Dismiss failed:', e);
        } finally {
            setIsDismissing(false);
        }
    };

    return (
        <div className={`rounded-xl border p-4 ${colors.bg} ${colors.border} transition-all duration-200`}>
            {/* Header Row */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${colors.bg} ${colors.text} flex-shrink-0`}>
                        {anomaly.type === 'corrupted_address' ? <MapPin size={14} /> : 
                         anomaly.type === 'style_learning' ? <Heart size={14} /> :
                         anomaly.type === 'placeholder_detected' ? <FileSearch size={14} /> :
                         anomaly.type === 'incomplete_person' ? <Sparkles size={14} className="text-violet-400" /> :
                         <Type size={14} />}
                    </div>
                    <div className="min-w-0">
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${colors.text}`}>
                            {anomaly.type === 'style_learning' ? 'STYLE MIRROR' : 
                             anomaly.type === 'placeholder_detected' ? 'PLACEHOLDER' : 
                             SOURCE_LABELS[anomaly.sourceCollection] || anomaly.sourceCollection}
                        </p>
                        <p className="text-xs text-white font-mono mt-1 break-words">
                            {anomaly.type === 'style_learning' ? `New preference: "${anomaly.corruptedValue}"` : `"${anomaly.corruptedValue}"`}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setIsExpanded(e => !e)}
                    className="text-slate-500 hover:text-white transition-colors flex-shrink-0 mt-0.5"
                >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
            </div>

            {/* GIGI's Suggestion */}
            {anomaly.suggestedFix && (
                <div className="mt-3 flex items-start gap-2 bg-cyan-900/10 border border-cyan-500/20 rounded-lg p-3">
                    <Sparkles size={12} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                        <p className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">GIGI Suggests</p>
                        <p className="text-xs text-slate-200 mt-0.5 break-words leading-relaxed">{anomaly.suggestedFix}</p>
                    </div>
                </div>
            )}

            {/* Visual Recon Section */}
            {previewUrl && !imageError && (
                <div className="mt-3 relative aspect-video rounded-lg overflow-hidden border border-white/10 group bg-black/40">
                    <img 
                        src={previewUrl} 
                        alt="Visual Recon" 
                        onError={() => setImageError(true)}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-bold text-white/70 tracking-widest border border-white/10">
                        EYES ON RECON
                    </div>
                </div>
            )}

                {anomaly.type !== 'style_learning' && anomaly.type !== 'incomplete_person' && (
                    <input
                        type="text"
                        value={customFix}
                        onChange={e => setCustomFix(e.target.value)}
                        placeholder="Enter correct value..."
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all"
                    />
                )}
                <div className="flex gap-2">
                    {anomaly.type === 'incomplete_person' ? (
                        <button
                            onClick={() => onManualEdit?.(anomaly.sourceId, anomaly.sourceCollection, anomaly.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 border border-violet-500/30 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                        >
                            <Sparkles size={10} />
                            Onboard Entity
                        </button>
                    ) : (
                        <button
                            onClick={handleApprove}
                            disabled={(anomaly.type !== 'style_learning' && !customFix.trim()) || isApplying}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-cyan-600/20 hover:bg-cyan-600/40 disabled:opacity-40 disabled:cursor-not-allowed text-cyan-400 border border-cyan-500/30 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                        >
                            {isApplying ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                            {anomaly.type === 'style_learning' ? 'Promote to Sovereign Rule' : 'Apply Fix'}
                        </button>
                    )}

                    {(anomaly.sourceCollection === 'media_v1' || anomaly.sourceCollection === 'firestore_tag') && onManualEdit && anomaly.type !== 'incomplete_person' && (
                        <button
                            onClick={() => onManualEdit(anomaly.sourceId, anomaly.sourceCollection, anomaly.id)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-500/20 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                            title="Open Editor"
                        >
                            <Sparkles size={10} />
                            Manual Edit
                        </button>
                    )}
                    <button
                        onClick={handleDismiss}
                        disabled={isDismissing}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 hover:bg-red-900/20 disabled:opacity-40 text-slate-500 hover:text-red-400 border border-white/5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                        {isDismissing ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
                        Dismiss
                    </button>
                </div>
        </div>
    );
};

export const DataHealthBanner: React.FC<DataHealthBannerProps> = ({
    userId,
    isOpen,
    onClose,
    onAnomalyCountChange,
    onManualEdit
}) => {
    const [anomalies, setAnomalies] = useState<DataAnomalyAlert[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [isScanning, setIsScanning] = useState(false);



    useEffect(() => {
        if (!userId) return;
        const db = getFirestore();
        const anomalyRef = collection(db, 'users', userId, 'dataAnomalies');
        const pendingQuery = query(anomalyRef, where('status', '==', 'pending'));

        const unsubscribe = onSnapshot(pendingQuery, (snapshot: any) => {
            const items = snapshot.docs.map((d: any) => d.data() as DataAnomalyAlert);
            items.sort((a: any, b: any) => {
                const severityOrder: any = { high: 0, medium: 1, low: 2 };
                const sev = severityOrder[a.severity] - severityOrder[b.severity];
                if (sev !== 0) return sev;
                return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
            });
            setAnomalies(items);
            onAnomalyCountChange?.(items.length);
        });

        return () => unsubscribe();
    }, [userId, refreshKey, onAnomalyCountChange]);

    const handleResolved = useCallback(() => {
        setRefreshKey(k => k + 1);
    }, []);

    const handleManualAudit = async () => {
        setIsScanning(true);
        try {
            await runGeoAudit(userId, undefined, true);
            await runHousekeepingAudit(userId);
            setRefreshKey(k => k + 1);
        } catch (e) {
            console.error('[DataHealthBanner] Manual audit failed:', e);
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="flex flex-col bg-[#0f1219] rounded-3xl border border-white/5 shadow-2xl overflow-hidden min-h-[300px] max-h-[500px]">
            <div className="flex-none p-6 border-b border-white/5">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <Heart size={16} className="text-rose-500 animate-pulse" />
                        <h2 className="text-sm font-bold text-white tracking-wide">Health Monitor</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {anomalies.length > 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                {anomalies.length} {anomalies.length === 1 ? 'ANOMALY' : 'ANOMALIES'}
                            </span>
                        )}
                    </div>
                </div>
                <p className="text-[10px] text-slate-500">
                    GIGI is scrubbing the decks. Review detected anomalies to inform your digital mirror.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {anomalies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-8">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            {isScanning ? <Loader2 size={28} className="text-emerald-400 animate-spin" /> : <CheckCircle size={28} className="text-emerald-400" />}
                        </div>
                        <p className="text-sm font-bold text-white">{isScanning ? 'Scrubbing...' : 'All Clear'}</p>
                        <button
                            onClick={handleManualAudit}
                            disabled={isScanning}
                            className="mt-2 px-6 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                        >
                            {isScanning ? 'Scanning...' : 'Scrub Decks'}
                        </button>
                    </div>
                ) : (
                    anomalies.map(anomaly => (
                        <AnomalyCard
                            key={anomaly.id}
                            anomaly={anomaly}
                            userId={userId}
                            onResolved={handleResolved}
                            onManualEdit={onManualEdit}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default DataHealthBanner;
