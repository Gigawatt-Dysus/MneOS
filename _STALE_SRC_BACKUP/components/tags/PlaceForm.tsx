import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Search, CheckCircle } from 'lucide-react';
import type { Tag, Settings, PlaceMetadata } from '@/types';
import { AddressAutocomplete, AddressData } from '../AddressAutocomplete';
import { loadGoogleMaps } from '../../utils/googleMapsLoader';
import { getPinIcon } from '../../utils/mapStyles';

interface PlaceFormProps {
    // Controlled Mode Props (TagEditorTabs)
    tag?: Tag; 
    onMetadataChange?: (metadata: any) => void;
    
    // Standalone/Modal Mode Props (TagView)
    initialData?: Tag;
    onSubmit?: (tag: Tag) => void;
    onCancel?: () => void;
    
    // Common
    settings?: Settings;
}

export const PlaceForm: React.FC<PlaceFormProps> = ({ 
    tag, 
    initialData, 
    onMetadataChange, 
    onSubmit, 
    onCancel, 
    settings 
}) => {
    // Resolve the source of truth (tag vs initialData)
    const activeTag = tag || initialData;
    
    // Local state for Name (if standalone) or just for the input
    const [name, setName] = useState(activeTag?.name || '');
    
    // Explicitly cast metadata to PlaceMetadata to satisfy TS Union checks
    const rawMetadata = activeTag?.metadata as any;
    const metadata: PlaceMetadata = {
        address: rawMetadata?.address || '',
        significance: rawMetadata?.significance || '',
        coordinates: rawMetadata?.coordinates || { lat: 0, lng: 0 }
    };
    
    // Map State
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapInstance, setMapInstance] = useState<any>(null);
    const markerRef = useRef<any>(null);
    const apiKey = settings?.googleMapsApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    // Helper to push changes up
    const handleMetaChange = (newMeta: PlaceMetadata) => {
        if (onMetadataChange) {
            onMetadataChange(newMeta);
        } else if (onSubmit && activeTag) {
            // If strictly standalone, we rely on the parent or final submit
        }
    };

    // --- MAP INITIALIZATION ---
    useEffect(() => {
        if (!apiKey) return;

        const initMap = async () => {
            await loadGoogleMaps(apiKey);
            if (!mapRef.current) return;

            // Default center: coordinates or US center
            const center = (metadata.coordinates && metadata.coordinates.lat !== 0) 
                ? metadata.coordinates 
                : { lat: 39.8283, lng: -98.5795 };

            const map = new (window as any).google.maps.Map(mapRef.current, {
                center: center,
                zoom: (metadata.coordinates && metadata.coordinates.lat !== 0) ? 18 : 4,
                disableDefaultUI: true,
                mapTypeId: 'hybrid', // Satellite view
                backgroundColor: '#001a00',
                gestureHandling: 'cooperative',
                mapId: undefined // Enforce Raster Engine
            });

            setMapInstance(map);

            // Add Click Listener to Map
            map.addListener('click', (e: any) => {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                updateLocation({ lat, lng });
            });
            
            // Layout refresh hook
            setTimeout(() => {
                (window as any).google.maps.event.trigger(map, "resize");
                map.setCenter(center);
            }, 100);
        };

        initMap();
    }, [apiKey]);

    // --- MARKER SYNC ---
    useEffect(() => {
        if (!mapInstance) return;

        const hasCoords = metadata.coordinates && metadata.coordinates.lat !== 0;
        
        if (hasCoords) {
            const position = metadata.coordinates;
            
            // Create or Move Marker
            if (!markerRef.current) {
                markerRef.current = new (window as any).google.maps.Marker({
                    position,
                    map: mapInstance,
                    // Shared explicit SVG Icon
                    icon: { 
                        ...getPinIcon('#10b981'), // Emerald for Places
                        anchor: new (window as any).google.maps.Point(12, 22)
                    },
                    animation: (window as any).google.maps.Animation.DROP
                });
            } else {
                markerRef.current.setPosition(position);
            }

            // Pan map if it's far away
            if (!mapInstance.getBounds()?.contains(position)) {
                mapInstance.panTo(position);
                if (mapInstance.getZoom() < 12) mapInstance.setZoom(18);
            }
        }
    }, [mapInstance, metadata.coordinates]);

    // --- LOGIC ---
    const updateLocation = (coords: { lat: number, lng: number }, formattedAddress?: string) => {
        const newMeta: PlaceMetadata = {
            ...metadata,
            coordinates: coords,
            address: formattedAddress || metadata.address || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
        };
        handleMetaChange(newMeta);
    };

    const handleAddressSelect = (addr: AddressData) => {
        if (addr.coordinates) {
            const newMeta: PlaceMetadata = {
                ...metadata,
                address: addr.streetAddress + (addr.addressLocality ? `, ${addr.addressLocality}` : ''),
                coordinates: addr.coordinates
            };
            handleMetaChange(newMeta);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (onSubmit && activeTag) {
            // Construct as Tag with cast to any for metadata to bypass strict union checks
            const updatedTag: Tag = {
                ...activeTag,
                name,
                type: 'place',
                metadata: metadata as any 
            };
            onSubmit(updatedTag);
        }
    };

    if (!activeTag) return null;

    return (
        <div className="flex h-full">
            {/* Left: Map Preview */}
            <div className="w-1/2 bg-[#000] relative border-r border-white/10">
                {!apiKey ? (
                    <div className="h-full flex items-center justify-center text-slate-500">Map Disabled</div>
                ) : (
                    <div ref={mapRef} className="w-full h-full opacity-100" />
                )}
                
                {/* [ZEN FIX] The Sunglass Layer (Dark Overlay) */}
                <div className="absolute inset-0 bg-black/60 pointer-events-none z-10"></div>
            </div>

            {/* Right: Details Form */}
            <div className="w-1/2 flex flex-col bg-[#0f1219]">
                <div className="p-6 border-b border-white/10">
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <MapPin className="text-emerald-500" /> Edit Place
                    </h2>
                </div>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                    
                    <div className="bg-[#1a1d26] p-4 rounded-xl border border-white/10">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                            <Search size={12} /> Search Address
                        </label>
                        <AddressAutocomplete 
                            value={{ streetAddress: metadata.address || '' } as any}
                            onChange={handleAddressSelect}
                            apiKey={apiKey}
                        />
                    </div>

                    {onSubmit && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Place Name</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-3 text-white focus:border-emerald-500 outline-none"
                                placeholder="e.g. Grandma's House"
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold text-emerald-400 uppercase mb-1 flex items-center gap-2">
                            <CheckCircle size={12}/> Manual Coordinates Override
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center bg-[#1a1d26] border border-emerald-500/50 rounded-xl px-3 py-2 shadow-inner shadow-emerald-900/10">
                                <span className="text-slate-500 text-xs mr-2">Lat</span>
                                <input 
                                    type="number" 
                                    value={metadata.coordinates?.lat || 0} 
                                    onChange={e => updateLocation({ 
                                        lat: parseFloat(e.target.value) || 0, 
                                        lng: metadata.coordinates?.lng || 0 
                                    })}
                                    className="bg-transparent text-emerald-400 font-mono text-sm w-full outline-none focus:outline-none"
                                />
                            </div>
                            <div className="flex items-center bg-[#1a1d26] border border-emerald-500/50 rounded-xl px-3 py-2 shadow-inner shadow-emerald-900/10">
                                <span className="text-slate-500 text-xs mr-2">Lng</span>
                                <input 
                                    type="number" 
                                    value={metadata.coordinates?.lng || 0} 
                                    onChange={e => updateLocation({ 
                                        lat: metadata.coordinates?.lat || 0,
                                        lng: parseFloat(e.target.value) || 0
                                    })}
                                    className="bg-transparent text-emerald-400 font-mono text-sm w-full outline-none focus:outline-none"
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                            <Navigation size={10} /> Click on the map or edit above to set the pin location.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Significance / Notes</label>
                        <textarea 
                            value={metadata.significance || ''}
                            onChange={e => handleMetaChange({...metadata, significance: e.target.value})}
                            className="w-full bg-[#1a1d26] border border-white/10 rounded-xl p-3 text-slate-300 focus:border-emerald-500 outline-none h-32 resize-none custom-scrollbar"
                            placeholder="Why is this place important?"
                        />
                    </div>
                </div>

                {onSubmit && (
                    <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-[#13161f]">
                        <button onClick={onCancel} className="px-6 py-3 text-xs font-bold text-slate-400 hover:text-white transition-colors">CANCEL</button>
                        <button onClick={handleSubmit} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all">
                            SAVE LOCATION
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaceForm;