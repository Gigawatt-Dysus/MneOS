import React, { useEffect, useRef, useState } from 'react';
import { Plus, Minus, Map as MapIcon, Eye, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { loadGoogleMaps } from '../utils/googleMapsLoader';

interface InteractiveMapProps {
    lat: number;
    lng: number;
    apiKey: string;
    onClose?: () => void; 
    onSelect?: (lat: number, lng: number) => void;
    isPicker?: boolean;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ lat, lng, apiKey, onClose, onSelect, isPicker }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const streetViewRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<maplibregl.Map | null>(null);
    const markerInstance = useRef<maplibregl.Marker | null>(null);
    const [streetViewInstance, setStreetViewInstance] = useState<any>(null);
    const [isStreetView, setIsStreetView] = useState(false);
    const [selectedPos, setSelectedPos] = useState({ lat, lng });

    // 1. Initialize MapLibre (2D Map)
    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        mapInstance.current = new maplibregl.Map({
            container: mapRef.current,
            style: {
                version: 8,
                sources: {
                    'esri-satellite': {
                        type: 'raster',
                        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                        tileSize: 256,
                        attribution: 'Esri'
                    }
                },
                layers: [{ id: 'sat', type: 'raster', source: 'esri-satellite' }]
            },
            center: [lng, lat],
            zoom: isPicker ? 4 : 14,
            attributionControl: false
        });

        markerInstance.current = new maplibregl.Marker({ color: isPicker ? '#06b6d4' : '#ef4444' })
            .setLngLat([lng, lat])
            .addTo(mapInstance.current);

        if (isPicker) {
            mapInstance.current.on('click', (e) => {
                const { lng, lat } = e.lngLat;
                setSelectedPos({ lat, lng });
                markerInstance.current?.setLngLat([lng, lat]);
            });
        }

        return () => {
            mapInstance.current?.remove();
            mapInstance.current = null;
        };
    }, []);

    // 2. Initialize Google Street View (Proprietary)
    useEffect(() => {
        if (!apiKey || streetViewInstance) return;

        loadGoogleMaps(apiKey).then(() => {
            if (!streetViewRef.current || !(window as any).google) return;

            const panorama = new (window as any).google.maps.StreetViewPanorama(streetViewRef.current, {
                position: { lat: selectedPos.lat, lng: selectedPos.lng },
                pov: { heading: 0, pitch: 0 },
                visible: false,
                disableDefaultUI: true,
            });

            setStreetViewInstance(panorama);
        }).catch(e => console.error("Street View Load Error", e));
    }, [apiKey]);

    // 3. Sync Locations
    useEffect(() => {
        if (mapInstance.current) {
            // Only auto-center if not in picker mode or if initial
            if (!isPicker) {
                mapInstance.current.setCenter([lng, lat]);
                markerInstance.current?.setLngLat([lng, lat]);
            }
        }
        if (streetViewInstance) {
            streetViewInstance.setPosition({ lat: selectedPos.lat, lng: selectedPos.lng });
        }
    }, [lat, lng, streetViewInstance]);

    // 4. Toggle Street View
    useEffect(() => {
        if (streetViewInstance) {
            streetViewInstance.setVisible(isStreetView);
        }
    }, [isStreetView, streetViewInstance]);

    const handleZoom = (delta: number) => {
        if (isStreetView && streetViewInstance) {
            const current = streetViewInstance.getZoom() || 1;
            streetViewInstance.setZoom(current + delta);
        } else if (mapInstance.current) {
            const current = mapInstance.current.getZoom();
            mapInstance.current.setZoom(current + delta);
        }
    };

    const MapUI = (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col animate-in fade-in duration-200">
            {/* Header / Controls */}
            <div className="absolute top-4 left-4 z-50 flex gap-4">
                <button 
                    onClick={onClose} 
                    className="px-4 py-2 bg-slate-800 text-white font-bold rounded shadow-lg hover:bg-slate-700 flex items-center gap-2 transition-transform active:scale-95"
                >
                    <X size={18}/> Cancel
                </button>
                {isPicker && (
                    <button 
                        onClick={() => onSelect?.(selectedPos.lat, selectedPos.lng)} 
                        className="px-6 py-2 bg-cyan-600 text-white font-black uppercase tracking-widest rounded shadow-lg hover:bg-cyan-700 flex items-center gap-2 transition-transform active:scale-95"
                    >
                        Confirm Sovereign Pin
                    </button>
                )}
            </div>

            <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
                {!isPicker && (
                    <button 
                        onClick={() => setIsStreetView(!isStreetView)} 
                        className={`p-3 rounded-full shadow-xl transition-all active:scale-95 ${isStreetView ? 'bg-cyan-500 text-white' : 'bg-white text-slate-800 hover:bg-gray-100'}`}
                        title={isStreetView ? "Back to Grid" : "Switch to Street View"}
                    >
                        {isStreetView ? <MapIcon size={20} /> : <Eye size={20} />}
                    </button>
                )}

                <div className="flex flex-col rounded-lg bg-white shadow-xl overflow-hidden border border-slate-200">
                    <button onClick={() => handleZoom(1)} className="p-3 hover:bg-gray-100 border-b border-gray-100 transition-colors">
                        <Plus size={20} className="text-slate-800" />
                    </button>
                    <button onClick={() => handleZoom(-1)} className="p-3 hover:bg-gray-100 transition-colors">
                        <Minus size={20} className="text-slate-800" />
                    </button>
                </div>
            </div>

            {/* Map Layers */}
            <div className="relative w-full h-full grayscale-[0.1] brightness-[0.9]">
                <div ref={mapRef} className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${isStreetView ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} />
                <div ref={streetViewRef} className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${!isStreetView ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} />
            </div>
            
            {/* Footer Info */}
            <div className="absolute bottom-4 left-4 right-4 z-50 pointer-events-none flex justify-center">
                <div className={`bg-black/70 text-white px-4 py-2 rounded-full text-[10px] font-mono tracking-widest backdrop-blur-md border border-white/10 uppercase ${isPicker ? 'text-cyan-400 border-cyan-500/50' : ''}`}>
                    {isPicker ? "Sovereign Pinning Mode" : (isStreetView ? "Street View Sync Active" : "Local Spatial Grid")} • {selectedPos.lat.toFixed(6)}, {selectedPos.lng.toFixed(6)}
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(MapUI, document.body);
};