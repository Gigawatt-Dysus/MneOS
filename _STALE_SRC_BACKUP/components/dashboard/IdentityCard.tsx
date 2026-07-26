import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { View, User, Tag } from '@/types';
import { Fingerprint, Globe, AlertTriangle, Settings } from 'lucide-react';
import { GlassAvatar } from '../GlassAvatar';
import { migrateChatHistory } from '../../services/dataRepairChat';
import { loadGoogleMaps } from '../../utils/googleMapsLoader';

const SpatialEntitiesMap: React.FC<{ tags: Tag[], apiKey?: string, onNavigate: (view: View, data?: any) => void }> = ({ tags, apiKey, onNavigate }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapInstance, setMapInstance] = useState<any>(null);
    const markersRef = useRef<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    // 1. Filter Tags with Coordinates
    const geoTags = useMemo(() => {
        return tags.filter(t => {
            if (t.type !== 'person' && t.type !== 'place') return false;
            const meta = t.metadata as any;
            const coords = meta.address?.coordinates || meta.coordinates;
            return coords && coords.lat && coords.lng;
        });
    }, [tags]);

    // 2. Load Maps (Modern Import with Retry)
    useEffect(() => {
        if (!apiKey) return;

        const initMap = async () => {
            try {
                setError(null);
                await loadGoogleMaps(apiKey);

                // Extra Safety Check
                if (typeof window.google === 'undefined' || typeof window.google.maps.importLibrary !== 'function') {
                    throw new Error("Google Maps API failed to export 'importLibrary'. Please refresh.");
                }

                if (!mapRef.current || mapInstance) return;

                const { Map } = await (window as any).google.maps.importLibrary("maps");

                const map = new Map(mapRef.current, {
                    center: { lat: 39.8283, lng: -98.5795 },
                    zoom: 3,
                    disableDefaultUI: true,
                    mapTypeId: 'hybrid',
                    backgroundColor: '#001a00',
                    gestureHandling: 'greedy',
                    mapId: "DEMO_MAP_ID",
                });

                setMapInstance(map);
            } catch (e: any) {
                console.error("Map Load Failed", e);
                setError(e.message || "Map Initialization Failed");
            }
        };

        initMap();
    }, [apiKey]);

    // 3. Render Markers (AdvancedMarkerElement)
    useEffect(() => {
        if (!mapInstance || !geoTags) return;

        const renderMarkers = async () => {
            try {
                // Clear old markers
                markersRef.current.forEach(m => m.map = null);
                markersRef.current = [];

                const { AdvancedMarkerElement, PinElement } = await (window as any).google.maps.importLibrary("marker");
                const { LatLngBounds } = await (window as any).google.maps.importLibrary("core");

                const bounds = new LatLngBounds();
                const points: { lat: number, lng: number }[] = [];

                geoTags.forEach(tag => {
                    const meta = tag.metadata as any;
                    const coords = meta.address?.coordinates || meta.coordinates;
                    if (coords) {
                        points.push(coords);

                        const pinColor = tag.type === 'person' ? '#8b5cf6' : '#10b981';

                        const pin = new PinElement({
                            background: pinColor,
                            borderColor: "#ffffff",
                            glyphColor: "#ffffff",
                            scale: 0.8
                        });

                        const marker = new AdvancedMarkerElement({
                            map: mapInstance,
                            position: coords,
                            title: tag.name,
                            content: pin.element
                        });

                        marker.addListener("click", () => {
                            onNavigate('tags', { tagId: tag.id });
                        });

                        markersRef.current.push(marker);
                    }
                });

                // "Smart Focus" Algorithm
                if (points.length > 0) {
                    const total = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
                    const centroid = { lat: total.lat / points.length, lng: total.lng / points.length };

                    const pointsWithDist = points.map(p => {
                        const dx = p.lat - centroid.lat;
                        const dy = p.lng - centroid.lng;
                        return { ...p, dist: dx * dx + dy * dy };
                    });

                    pointsWithDist.sort((a, b) => a.dist - b.dist);
                    const cutoff = points.length < 5 ? points.length : Math.ceil(points.length * 0.80);
                    const corePoints = pointsWithDist.slice(0, cutoff);

                    corePoints.forEach(p => {
                        bounds.extend({ lat: p.lat, lng: p.lng });
                    });

                    mapInstance.fitBounds(bounds);
                }
            } catch (err) {
                console.error("Marker Render Error", err);
            }
        };

        renderMarkers();
    }, [mapInstance, geoTags]);

    if (!apiKey) return <div className="h-full flex items-center justify-center text-xs text-slate-600 bg-[#0a0c10]">Map Disabled (No API Key)</div>;

    if (error) return (
        <div className="h-full flex flex-col items-center justify-center text-red-400 bg-[#0a0c10] p-4 text-center">
            <AlertTriangle size={24} className="mb-2" />
            <span className="text-xs font-mono">{error}</span>
            <button onClick={() => window.location.reload()} className="mt-2 text-[10px] underline hover:text-white">Reload Interface</button>
        </div>
    );

    return <div ref={mapRef} className="w-full h-full opacity-100 transition-opacity duration-500" />;
};

interface IdentityCardProps {
    user: User;
    mediaCount: number;
    tagCount: number;
    eventCount: number;
    onNavigate: (view: View, data?: any) => void;
    tags: Tag[];
    apiKey?: string;
}

export const IdentityCard: React.FC<IdentityCardProps> = ({ user, mediaCount, tagCount, eventCount, onNavigate, tags, apiKey }) => {
    const [isMigrating, setIsMigrating] = useState(false);

    const handleMigration = async () => {
        if (!confirm("Start Chat History Migration?")) return;
        setIsMigrating(true);
        try {
            await migrateChatHistory(user.id);
            alert(`Migration Complete!`);
            window.location.reload();
        } catch (e) {
            alert("Migration Failed.");
        } finally {
            setIsMigrating(false);
        }
    };

    return (
        <div
            className="h-full bg-black/20 backdrop-blur-md rounded-3xl border border-white/5 relative overflow-hidden flex flex-col shadow-2xl group min-h-[500px]"
            title="Double-click header to Edit Profile"
        >
            <div className="p-6 bg-white/5 relative shrink-0 z-10 border-b border-white/5" onDoubleClick={() => onNavigate('profile')}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // Special case: onNavigate with 'settings' should open settings modal
                        onNavigate('dashboard', { openSettings: true });
                    }}
                    className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-slate-500 hover:text-cyan-400 transition-all group"
                    title="User Settings"
                >
                    <Settings size={16} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>
                <div className="flex items-center gap-4 mb-4">
                    <GlassAvatar
                        imageUrl={user.profilePictureUrl}
                        altText={user.displayName}
                        fallbackChar={user.displayName}
                        size="w-16 h-16"
                        className="text-2xl font-bold border-2 border-white/10"
                    />
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight leading-none">{user.displayName}</h2>
                        <p className="text-sm text-slate-500 font-mono uppercase tracking-[0.2em] mt-1 flex items-center gap-1">
                            <Fingerprint size={12} /> Architect // Lvl 12
                        </p>
                    </div>
                </div>

                <div className="flex justify-between items-center bg-black/40 py-2 px-3 rounded-xl border border-white/5 backdrop-blur-sm">
                    <div className="text-center">
                        <span className="block text-lg font-bold text-white leading-none">{eventCount}</span>
                        <span className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">Events</span>
                    </div>
                    <div className="w-px h-6 bg-white/10"></div>
                    <div className="text-center">
                        <span className="block text-lg font-bold text-white leading-none">{mediaCount}</span>
                        <span className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">Media</span>
                    </div>
                    <div className="w-px h-6 bg-white/10"></div>
                    <div className="text-center">
                        <span className="block text-lg font-bold text-white leading-none">{tagCount}</span>
                        <span className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">Tags</span>
                    </div>
                </div>
            </div>

            {/* --- BOTTOM SECTION: SPATIAL MAP --- */}
            <div className="flex-1 bg-black/10 relative min-h-0">
                <div className="absolute top-3 left-12 z-20 flex items-center gap-2 pointer-events-none">
                    <Globe size={12} className="text-cyan-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">Spatial Entities</span>
                </div>

                {/* The Sunglass Layer (Dark Overlay) */}
                <div className="absolute inset-0 bg-black/60 pointer-events-none z-10"></div>

                <SpatialEntitiesMap tags={tags} apiKey={apiKey} onNavigate={onNavigate} />
            </div>
        </div >
    );
};