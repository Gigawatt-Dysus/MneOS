import React, { useState, useEffect, useCallback } from 'react';
import { 
    Globe, MapPin, X, Navigation, Send, Check 
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import type { Media, User as UserType } from '@/types';
import { GlassButton } from '../../GlassButton';
import { AddressAutocomplete, AddressData } from '../../AddressAutocomplete';
import { typesenseService } from '../../../services/typesenseService';

interface MediaWithLocation extends Media {
    location?: any; 
}

interface GeoPanelProps {
    media: MediaWithLocation;
    user: UserType;
    onUpdateLocal: (updated: Media) => void;
}

const SUNGLASSES_FILTER = "brightness(60%) grayscale(20%) contrast(110%)";

// [ZEN FIX] Default empty state object constant
const EMPTY_ADDRESS_DATA: AddressData = {
    streetAddress: '',
    addressLocality: '',
    addressRegion: '',
    postalCode: '',
    addressCountry: '',
    coordinates: undefined
};

export const GeoPanel: React.FC<GeoPanelProps> = ({ media, user, onUpdateLocal }) => {
    
    // [ZEN FIX] Helper function to extract data reliably from the current media prop
    const extractAddressData = useCallback((currentMedia: MediaWithLocation): AddressData => {
        if (currentMedia.location && typeof currentMedia.location === 'object') {
            // Check for rich format
            if ('streetAddress' in currentMedia.location) {
                return currentMedia.location as AddressData;
            }
            // Legacy format fallback
            return {
                ...EMPTY_ADDRESS_DATA,
                streetAddress: currentMedia.location.address || '',
                coordinates: {
                    lat: currentMedia.location.lat || 0,
                    lng: currentMedia.location.lng || 0
                }
            };
        }
        // Return clean empty state if no location data exists
        return EMPTY_ADDRESS_DATA;
    }, []);

    // Initialize state using the helper
    const [addressData, setAddressData] = useState<AddressData>(() => extractAddressData(media));

    const [isLocationDirty, setIsLocationDirty] = useState(false);
    const [justSavedLocation, setJustSavedLocation] = useState(false);

    // [ZEN FIX] CRITICAL: Completely reset state when the selected media ID changes.
    // This ensures data from the previous image does not leak into the new one.
    useEffect(() => {
        setAddressData(extractAddressData(media));
        setIsLocationDirty(false);
        setJustSavedLocation(false);
    }, [media.id, extractAddressData]); 

    const handleAddressSelect = (newData: AddressData) => {
        setAddressData(newData);
        setIsLocationDirty(true);
        setJustSavedLocation(false);
    };

    const commitLocation = async () => {
        // Construct rich object
        const locationPayload = {
            ...addressData,
            // Fallback string for legacy compatibility
            address: `${addressData.streetAddress}, ${addressData.addressLocality}, ${addressData.addressRegion}`, 
            lat: addressData.coordinates?.lat || 0,
            lng: addressData.coordinates?.lng || 0
        };

        const updated = { ...media, location: locationPayload };
        onUpdateLocal(updated);
        // Fire and forget cloud updates for UI responsiveness
        typesenseService.updateMedia(updated).catch(e => console.error("Typesense update failed", e));

        setIsLocationDirty(false);
        setJustSavedLocation(true);
        setTimeout(() => setJustSavedLocation(false), 2000);

        try {
            const mediaRef = doc(db, 'users', user.id, 'media', media.id);
            await updateDoc(mediaRef, { location: locationPayload });
        } catch (err) { 
            console.error("Location commit failed", err);
            // Optionally set error state here to notify user
        }
    };

    const getMapUrl = () => {
        const coords = addressData.coordinates;
        if (!coords || !coords.lat || !coords.lng) return '';
        // Using import.meta.env variable correctly in string interpolation
        return `https://www.google.com/maps/embed/v1/view?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&center=${coords.lat},${coords.lng}&zoom=18&maptype=satellite`;
    };

    return (
        <div className="space-y-3 pt-6 border-t border-white/10 shrink-0 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Globe size={12} className="text-blue-500"/> Geo-Location
                </label>
                {isLocationDirty && (
                    <span className="text-[10px] text-amber-400 font-bold animate-pulse tracking-wide">CHANGES PENDING</span>
                )}
                {justSavedLocation && (
                    <span className="text-[10px] text-emerald-400 font-bold animate-pulse tracking-wide">LOCATION SECURED</span>
                )}
            </div>
            
            {/* Map Preview */}
            {addressData.coordinates && addressData.coordinates.lat !== 0 ? (
                <div className={`relative w-full aspect-video rounded-xl overflow-hidden border shadow-lg group transition-all duration-300 ${isLocationDirty ? 'border-amber-500/50 shadow-amber-900/20' : 'border-white/10'}`}>
                    <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        style={{ border: 0, filter: SUNGLASSES_FILTER }}
                        src={getMapUrl()}
                        allowFullScreen
                    ></iframe>
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-2 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-white truncate px-1">
                            {addressData.streetAddress || 'Coordinates Locked'}
                        </span>
                        <button 
                            onClick={() => {
                                setAddressData({ ...EMPTY_ADDRESS_DATA });
                                setIsLocationDirty(true);
                            }}
                            className="text-red-400 hover:text-red-300"
                        >
                            <X size={12}/>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="w-full aspect-video bg-[#1a1d26] rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center text-slate-600 gap-2 bg-white/[0.02]">
                    <MapPin size={24} className="opacity-20"/>
                    <span className="text-xs italic">No geo-data found.</span>
                </div>
            )}

            {/* Controls */}
            <div className="flex gap-2 items-start">
                <div className="flex-1 min-w-0">
                    <AddressAutocomplete 
                        value={addressData}
                        onChange={handleAddressSelect}
                        apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                    />
                </div>
                {isLocationDirty ? (
                    <GlassButton 
                        onClick={commitLocation} 
                        variant="success" 
                        className="h-12 w-16 px-0 animate-in zoom-in duration-200 font-bold shadow-[0_0_20px_rgba(245,158,11,0.5)] border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 animate-pulse mt-8"
                    >
                        <Send size={24} className="ml-1" />
                    </GlassButton>
                ) : (
                    <GlassButton 
                        variant="secondary" 
                        disabled 
                        className={`h-12 w-16 p-0 flex items-center justify-center transition-all duration-500 mt-8 ${justSavedLocation ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'opacity-30 cursor-not-allowed'}`}
                    >
                        {justSavedLocation ? <Check size={28}/> : <Navigation size={20}/>}
                    </GlassButton>
                )}
            </div>
        </div>
    );
};