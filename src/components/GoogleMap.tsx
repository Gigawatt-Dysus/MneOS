import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../utils/googleMapsLoader';
import { Navigation, Map as MapIcon, Layers } from 'lucide-react';

interface GoogleMapProps {
    lat: number;
    lng: number;
    zoom?: number;
    apiKey: string;
    onBoundsChanged?: (center: { lat: number, lng: number }, zoom: number) => void;
    onMarkerDragEnd?: (lat: number, lng: number) => void;
    draggable?: boolean;
    mapType?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
    className?: string;
}

export const GoogleMap: React.FC<GoogleMapProps> = ({
    lat,
    lng,
    zoom = 15,
    apiKey,
    onBoundsChanged,
    onMarkerDragEnd,
    draggable = false,
    mapType = 'satellite',
    className = "w-full h-full"
}) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markerInstance = useRef<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        let mounted = true;

        loadGoogleMaps(apiKey).then(async () => {
            if (!mounted || !mapRef.current) return;

            const google = (window as any).google;
            
            // 1. Load Libraries
            const { Map } = await google.maps.importLibrary("maps");
            const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

            // 2. Initialize Map
            mapInstance.current = new Map(mapRef.current, {
                center: { lat, lng },
                zoom,
                mapTypeId: mapType,
                mapId: 'GIGI_SPATIAL_INDEX', // Required for AdvancedMarkerElement
                disableDefaultUI: true,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false
            });

            // 3. Initialize Advanced Marker
            markerInstance.current = new AdvancedMarkerElement({
                position: { lat, lng },
                map: mapInstance.current,
                gmpDraggable: draggable,
                title: "Spatial Anchor"
            });

            if (draggable && onMarkerDragEnd) {
                // [ZEN] Advanced Markers use 'dragend' on the element
                markerInstance.current.addListener('dragend', (e: any) => {
                    const pos = markerInstance.current.position;
                    if (pos) {
                        onMarkerDragEnd(pos.lat, pos.lng);
                    }
                });
            }

            if (onBoundsChanged) {
                mapInstance.current.addListener('idle', () => {
                    const center = mapInstance.current.getCenter();
                    onBoundsChanged(
                        { lat: center.lat(), lng: center.lng() },
                        mapInstance.current.getZoom()
                    );
                });
            }

            setIsLoaded(true);
        }).catch(err => {
            console.error("[GoogleMap] SDK Load Error:", err);
        });

        return () => {
            mounted = false;
            if (markerInstance.current) {
                markerInstance.current.map = null;
            }
        };
    }, []); // Only once on mount

    // Sync Props to Map
    useEffect(() => {
        if (!isLoaded || !mapInstance.current) return;

        const google = (window as any).google;
        const newPos = { lat, lng };

        // Smooth pan if close, otherwise jump
        const currentCenter = mapInstance.current.getCenter();
        const dist = Math.sqrt(Math.pow(currentCenter.lat() - lat, 2) + Math.pow(currentCenter.lng() - lng, 2));

        if (dist > 0.01) {
            mapInstance.current.setCenter(newPos);
        } else {
            mapInstance.current.panTo(newPos);
        }

        if (markerInstance.current) {
            markerInstance.current.position = newPos;
        }
    }, [lat, lng, isLoaded]);

    useEffect(() => {
        if (!isLoaded || !mapInstance.current) return;
        mapInstance.current.setZoom(zoom);
    }, [zoom, isLoaded]);

    useEffect(() => {
        if (!isLoaded || !mapInstance.current) return;
        mapInstance.current.setMapTypeId(mapType);
    }, [mapType, isLoaded]);

    return (
        <div className={`relative ${className}`}>
            <div ref={mapRef} className="w-full h-full" />
            
            {/* HUD Overlay */}
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-10">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                        <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Hydrating Spatial Engine...</span>
                    </div>
                </div>
            )}
            
            {/* Lat/Lng HUD */}
            {isLoaded && (
                <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
                    <div className="px-3 py-1.5 bg-black/80 backdrop-blur-md rounded border border-white/10 text-[10px] font-mono text-emerald-400 shadow-2xl">
                        GRID: {lat.toFixed(6)}, {lng.toFixed(6)}
                    </div>
                </div>
            )}
        </div>
    );
};
