import React, { useEffect, useRef, useState } from 'react';
import { Plus, Minus, Map as MapIcon, Eye, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { loadGoogleMaps } from '../utils/googleMapsLoader';

interface InteractiveMapProps {
    lat: number;
    lng: number;
    apiKey: string;
    onClose?: () => void; 
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ lat, lng, apiKey, onClose }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const streetViewRef = useRef<HTMLDivElement>(null);
    const [mapInstance, setMapInstance] = useState<any>(null);
    const [streetViewInstance, setStreetViewInstance] = useState<any>(null);
    
    const [isStreetView, setIsStreetView] = useState(false);

    // Initialize Map
    useEffect(() => {
        if (!apiKey) return;

        loadGoogleMaps(apiKey).then(() => {
            if (!mapRef.current || !(window as any).google) return;

            const map = new (window as any).google.maps.Map(mapRef.current, {
                center: { lat, lng },
                zoom: 14,
                disableDefaultUI: true, 
                clickableIcons: false,
            });

            const panorama = new (window as any).google.maps.StreetViewPanorama(streetViewRef.current, {
                position: { lat, lng },
                pov: { heading: 0, pitch: 0 },
                visible: false,
                disableDefaultUI: true,
            });

            map.setStreetView(panorama);
            setMapInstance(map);
            setStreetViewInstance(panorama);

            new (window as any).google.maps.Marker({
                position: { lat, lng },
                map: map,
            });
        }).catch(e => console.error("Map Load Error", e));

    }, [apiKey]); 

    // Update Center
    useEffect(() => {
        if (mapInstance && (window as any).google) {
            mapInstance.panTo({ lat, lng });
        }
        if (streetViewInstance) {
            streetViewInstance.setPosition({ lat, lng });
        }
    }, [lat, lng, mapInstance, streetViewInstance]);

    // Toggle Street View
    useEffect(() => {
        if (streetViewInstance) {
            streetViewInstance.setVisible(isStreetView);
        }
    }, [isStreetView, streetViewInstance]);

    const handleZoom = (delta: number) => {
        if (isStreetView && streetViewInstance) {
            const current = streetViewInstance.getZoom() || 1;
            streetViewInstance.setZoom(current + delta);
        } else if (mapInstance) {
            const current = mapInstance.getZoom();
            mapInstance.setZoom(current + delta);
        }
    };

    const MapUI = (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col animate-in fade-in duration-200">
            {/* Header / Controls */}
            <div className="absolute top-4 left-4 z-50 flex gap-4">
                <button 
                    onClick={onClose} 
                    className="px-4 py-2 bg-red-600 text-white font-bold rounded shadow-lg hover:bg-red-700 flex items-center gap-2"
                >
                    <X size={18}/> Close Map
                </button>
            </div>

            <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
                <button onClick={() => setIsStreetView(!isStreetView)} className={`p-3 rounded-full shadow-xl transition-colors ${isStreetView ? 'bg-cyan-500 text-white' : 'bg-white text-slate-800 hover:bg-gray-100'}`}>
                    {isStreetView ? <MapIcon size={20} /> : <Eye size={20} />}
                </button>

                <div className="flex flex-col rounded-lg bg-white shadow-xl overflow-hidden">
                    <button onClick={() => handleZoom(1)} className="p-3 hover:bg-gray-100 border-b border-gray-200">
                        <Plus size={20} className="text-slate-800" />
                    </button>
                    <button onClick={() => handleZoom(-1)} className="p-3 hover:bg-gray-100">
                        <Minus size={20} className="text-slate-800" />
                    </button>
                </div>
            </div>

            {/* Map Layers */}
            <div className="relative w-full h-full">
                <div ref={mapRef} className={`absolute inset-0 w-full h-full ${isStreetView ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} />
                <div ref={streetViewRef} className={`absolute inset-0 w-full h-full ${!isStreetView ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} />
            </div>
            
            {/* Footer Info */}
            <div className="absolute bottom-4 left-4 right-4 z-50 pointer-events-none flex justify-center">
                <div className="bg-black/70 text-white px-4 py-2 rounded-full text-sm backdrop-blur-md">
                    {isStreetView ? "Street View Mode" : "Map View Mode"} • {lat.toFixed(4)}, {lng.toFixed(4)}
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(MapUI, document.body);
};