import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Search, CheckCircle, Sparkles, Ghost, Milestone, Clock, Globe, Shield, History } from 'lucide-react';
import { NeuralBridge } from '../shared/NeuralBridge';
import { GoogleMap } from '../GoogleMap';
import type { Tag, Settings, PlaceMetadata } from '../../types';
import { AddressAutocomplete, AddressData } from '../AddressAutocomplete';
import { WikiTagEditor } from '../shared/WikiTagEditor';

interface PlaceFormProps {
    tag?: Tag; 
    onMetadataChange?: (metadata: any) => void;
    initialData?: Tag;
    onSubmit?: (tag: Tag) => void;
    onCancel?: () => void;
    settings?: Settings;
    userId: string;
    userPresets?: any[];
    allTags?: Tag[];
}

export const PlaceForm: React.FC<PlaceFormProps> = ({ 
    tag, 
    initialData, 
    onMetadataChange, 
    onSubmit, 
    onCancel,
    userId,
    userPresets,
    allTags
}) => {
    const activeTag = tag || initialData;
    const [name, setName] = useState(activeTag?.name || '');
    
    const rawMetadata = activeTag?.metadata as any;
    // [ZEN] Destructure with defaults while preserving all metadata fields
    const metadata: PlaceMetadata = {
        ...(rawMetadata || {}),
        address: rawMetadata?.address || '',
        significance: rawMetadata?.significance || '',
        coordinates: rawMetadata?.coordinates || { lat: 0, lng: 0 },
        isLost: rawMetadata?.isLost || false,
        isSovereignPoint: rawMetadata?.isSovereignPoint || false,
        dates: rawMetadata?.dates || {
            foundedDate: '',
            dissolvedDate: ''
        }
    };
    
    const isLost = metadata.isLost;
    
    const handleMetaChange = (newMeta: Partial<PlaceMetadata>) => {
        if (onMetadataChange) {
            onMetadataChange({ ...metadata, ...newMeta });
        }
    };

    const updateLocation = async (coords: { lat: number, lng: number }, formattedAddress?: string, isSovereign = false) => {
        let finalAddress = formattedAddress || metadata.address;

        const addressStr = typeof finalAddress === 'string' ? finalAddress : (finalAddress as any)?.streetAddress || '';
        if (!formattedAddress && (!addressStr || addressStr.includes(','))) {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`);
                const data = await res.json();
                if (data.display_name) {
                    finalAddress = data.display_name;
                }
            } catch (e) {
                console.warn("Reverse Geocode Failed", e);
            }
        }

        handleMetaChange({
            coordinates: coords,
            address: finalAddress || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
            isSovereignPoint: isSovereign
        });
    };

    const handleAddressSelect = (addr: AddressData) => {
        handleMetaChange({
            address: addr.streetAddress + (addr.addressLocality ? `, ${addr.addressLocality}` : ''),
            coordinates: addr.coordinates || metadata.coordinates,
            isSovereignPoint: !!addr.coordinates // If from geocoder, it's NOT sovereign yet unless manually pinned
        });
    };

    const handleManualGeocode = async () => {
        try {
            const addressStr = typeof metadata.address === 'string' ? metadata.address : (metadata.address as any)?.streetAddress || '';
            if (!addressStr) return;
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressStr)}&limit=1`);
            const data = await response.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                updateLocation({ lat: parseFloat(lat), lng: parseFloat(lon) }, addressStr);
            }
        } catch (e) {
            console.error("Manual Geocode Failed", e);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (onSubmit && activeTag) {
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

    // [ZEN] Limbic Archive Theme (Sepia / Steel)
    const themeStyles = isLost 
        ? "bg-[#1c1a16] border-amber-900/30 text-amber-100" 
        : "bg-[#0f1219] border-white/10 text-white";

    return (
        <div className={`flex h-full transition-colors duration-700 ${isLost ? 'grayscale-[0.2]' : ''}`}>
            {/* Left: Map Preview */}
            <div className={`w-1/2 relative border-r border-white/10 group ${isLost ? 'bg-[#12110e]' : 'bg-[#000]'}`}>
                <GoogleMap 
                    lat={metadata.coordinates?.lat || 39.8283}
                    lng={metadata.coordinates?.lng || -98.5795}
                    zoom={metadata.coordinates?.lat ? 17 : 3}
                    apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                    draggable={true}
                    onMarkerDragEnd={(lat, lng) => updateLocation({ lat, lng }, undefined, true)}
                />
                
                {/* Visual Overlay - Sepia filter for lost towns */}
                <div className={`absolute inset-0 pointer-events-none z-10 transition-colors duration-700 ${isLost ? 'bg-amber-950/20 mix-blend-multiply' : 'bg-black/40'}`}></div>
                
                {/* Lat/Lng HUD */}
                <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
                    <div className={`px-3 py-1.5 backdrop-blur-md rounded border text-[10px] font-mono transition-colors ${isLost ? 'bg-amber-950/80 border-amber-500/30 text-amber-400' : 'bg-black/80 border-white/10 text-emerald-400'}`}>
                        {metadata.isSovereignPoint ? <Shield size={10} className="inline mr-1" /> : 'SENSORS:'} {metadata.coordinates?.lat.toFixed(6)}, {metadata.coordinates?.lng.toFixed(6)}
                    </div>
                    {metadata.coordinates?.lat !== 0 && (
                        <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${metadata.coordinates?.lat},${metadata.coordinates?.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`p-1.5 backdrop-blur-md rounded border transition-colors ${isLost ? 'bg-amber-950/80 border-amber-500/30 text-amber-500 hover:text-amber-300' : 'bg-black/80 border-white/10 text-slate-400 hover:text-emerald-400'}`}
                            title="Open in Google Maps"
                        >
                            <Navigation size={12} />
                        </a>
                    )}
                </div>
            </div>

            {/* Right: Details Form */}
            <div className={`w-1/2 flex flex-col transition-colors duration-700 ${themeStyles}`}>
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className={`text-xl font-black flex items-center gap-2 ${isLost ? 'text-amber-500' : 'text-white'}`}>
                        {isLost ? <Ghost className="animate-pulse" /> : <MapPin className="text-emerald-500" />} {isLost ? 'Lost Settlement Record' : 'Spatial Record'}
                    </h2>
                    
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input 
                                type="checkbox"
                                checked={metadata.isLost}
                                onChange={(e) => handleMetaChange({ isLost: e.target.checked })}
                                className="sr-only"
                            />
                            <div className={`w-10 h-5 rounded-full transition-colors ${metadata.isLost ? 'bg-amber-600' : 'bg-slate-700'}`} />
                            <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform ${metadata.isLost ? 'translate-x-5' : 'translate-x-1'}`} />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${metadata.isLost ? 'text-amber-500' : 'text-slate-500'}`}>
                            Historic / Lost Site
                        </span>
                    </label>
                </div>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                    
                    <div className={`p-4 rounded-xl border transition-colors ${isLost ? 'bg-amber-950/20 border-amber-900/30' : 'bg-[#1a1d26] border-white/10'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <label className={`text-xs font-bold uppercase flex items-center gap-2 ${isLost ? 'text-amber-600' : 'text-slate-500'}`}>
                                <Search size={12} /> Location Search
                            </label>
                            {metadata.isSovereignPoint && (
                                <span className="text-[10px] font-black text-cyan-400 flex items-center gap-1">
                                    <Shield size={10} /> SOVEREIGN PIN ACTIVE
                                </span>
                            )}
                        </div>
                        <AddressAutocomplete 
                            value={{ streetAddress: typeof metadata.address === 'string' ? metadata.address : (metadata.address as any)?.streetAddress || '' } as any}
                            onChange={handleAddressSelect}
                            tags={allTags}
                            userId={userId}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className={`block text-xs font-bold uppercase mb-1 ${isLost ? 'text-amber-600' : 'text-slate-500'}`}>Place Name</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                className={`w-full border rounded-xl p-3 text-white outline-none transition-colors ${isLost ? 'bg-amber-950/20 border-amber-900/30 focus:border-amber-500' : 'bg-[#1a1d26] border-white/10 focus:border-emerald-500'}`}
                                placeholder="e.g. Grandma's House"
                            />
                        </div>

                        {/* [ZEN] Genealogical Timeline */}
                        <div>
                            <label className={`block text-xs font-bold uppercase mb-1 flex items-center gap-2 ${isLost ? 'text-amber-500' : 'text-slate-500'}`}>
                                <Milestone size={12}/> Established
                            </label>
                            <input 
                                type="text" 
                                value={metadata.dates?.foundedDate || ''} 
                                onChange={e => handleMetaChange({ dates: { ...metadata.dates, foundedDate: e.target.value }})} 
                                className={`w-full border rounded-xl p-3 text-white outline-none transition-colors ${isLost ? 'bg-amber-950/20 border-amber-900/30 focus:border-amber-500' : 'bg-[#1a1d26] border-white/10 focus:border-emerald-500'}`}
                                placeholder="e.g. 1880"
                            />
                        </div>
                        <div>
                            <label className={`block text-xs font-bold uppercase mb-1 flex items-center gap-2 ${isLost ? 'text-amber-500' : 'text-slate-500'}`}>
                                <Clock size={12}/> Lost / Renamed
                            </label>
                            <input 
                                type="text" 
                                value={metadata.dates?.dissolvedDate || ''} 
                                onChange={e => handleMetaChange({ dates: { ...metadata.dates, dissolvedDate: e.target.value }})} 
                                className={`w-full border rounded-xl p-3 text-white outline-none transition-colors ${isLost ? 'bg-amber-950/20 border-amber-900/30 focus:border-amber-500' : 'bg-[#1a1d26] border-white/10 focus:border-emerald-500'}`}
                                placeholder="e.g. 1910"
                            />
                        </div>
                    </div>

                    {/* [ZEN] Public Memorial Options */}
                    <div className={`p-4 rounded-xl border transition-colors ${isLost ? 'bg-amber-900/10 border-amber-900/30' : 'bg-slate-900/30 border-white/5'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Globe size={12} /> Public Memorial Options
                            </label>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={metadata.isPublicMemorial}
                                        onChange={(e) => handleMetaChange({ isPublicMemorial: e.target.checked })}
                                        className="rounded border-white/10 bg-black text-cyan-500"
                                    />
                                    <span className="text-[10px] font-bold text-slate-500">Public</span>
                                </label>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Memorial URL Slug</label>
                                <div className="flex items-center bg-black/40 border border-white/10 rounded p-2">
                                    <span className="text-slate-600 text-xs mr-1">lifeos.me/heritage/</span>
                                    <input 
                                        type="text" 
                                        value={metadata.urlSlug || ''} 
                                        onChange={e => handleMetaChange({ urlSlug: e.target.value })} 
                                        className="bg-transparent text-cyan-400 text-xs w-full outline-none"
                                        placeholder="old-barstow"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className={`block text-xs font-bold uppercase ${isLost ? 'text-amber-600' : 'text-slate-500'}`}>Significance / Notes</label>
                            <NeuralBridge
                                value={metadata.significance || ''}
                                onChange={(val) => handleMetaChange({significance: val})}
                                userId={userId}
                                userPresets={userPresets}
                                label="Narrate Place"
                            />
                        </div>
                        <WikiTagEditor 
                            value={metadata.significance || ''}
                            onChange={val => handleMetaChange({significance: val})}
                            userId={userId}
                            placeholder="Why is this place important?"
                            rows={5}
                        />
                    </div>

                    {/* [ZEN] GIGI's Transformation Notes */}
                    <div>
                        <label className={`block text-xs font-bold uppercase mb-1 flex items-center gap-2 ${isLost ? 'text-amber-500' : 'text-slate-500'}`}>
                            <History size={12}/> Transformation History
                        </label>
                        <WikiTagEditor 
                            value={metadata.transformationHistory || ''}
                            onChange={val => handleMetaChange({transformationHistory: val})}
                            userId={userId}
                            placeholder="How has this place changed? (e.g. Torn down for a highway in 1970)"
                            rows={4}
                        />
                    </div>
                </div>

                {onSubmit && (
                    <div className={`p-6 border-t border-white/10 flex justify-end gap-3 transition-colors ${isLost ? 'bg-[#12110e]' : 'bg-[#13161f]'}`}>
                        <button onClick={onCancel} className="px-6 py-3 text-xs font-bold text-slate-400 hover:text-white transition-colors">CANCEL</button>
                        <button onClick={handleSubmit} className={`px-8 py-3 text-white text-xs font-bold rounded-xl shadow-lg transition-all uppercase ${isLost ? 'bg-amber-700 hover:bg-amber-600 shadow-amber-900/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'}`}>
                            {isLost ? 'Preserve History' : 'Commit Spatial Data'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaceForm;