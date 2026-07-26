import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { loadGoogleMaps } from '../utils/googleMapsLoader';

export interface AddressData {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry?: string;
    coordinates?: { lat: number; lng: number };
}

interface AddressAutocompleteProps {
    value: AddressData;
    onChange: (val: AddressData) => void;
    apiKey?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({ value, onChange, apiKey }) => {
    const [query, setQuery] = useState('');
    const [predictions, setPredictions] = useState<any[]>([]);
    const [isMapsLoaded, setIsMapsLoaded] = useState(false);
    const [sessionToken, setSessionToken] = useState<any>(null);
    
    // Refs for the new API classes
    const AutocompleteSuggestionRef = useRef<any>(null);
    const PlaceRef = useRef<any>(null);

    // Load Google Maps & Places Library (New)
    useEffect(() => {
        if (apiKey) {
            loadGoogleMaps(apiKey).then(async () => {
                try {
                    // [ZEN MIGRATION] Import the new "places" library for Places API (New)
                    // This replaces the global google.maps.places.AutocompleteService
                    const { AutocompleteSuggestion, Place, AutocompleteSessionToken } = await (window as any).google.maps.importLibrary("places");
                    
                    AutocompleteSuggestionRef.current = AutocompleteSuggestion;
                    PlaceRef.current = Place;
                    
                    // Create a fresh session token for billing optimization
                    setSessionToken(new AutocompleteSessionToken());
                    setIsMapsLoaded(true);
                } catch (e) {
                    console.error("Failed to load Places Library (New)", e);
                }
            }).catch((err: any) => console.error("Failed to load Maps", err));
        }
    }, [apiKey]);

    // Handle Text Change (New "fetchAutocompleteSuggestions" API)
    const handleSearch = async (text: string) => {
        setQuery(text);

        if (!text || !AutocompleteSuggestionRef.current || !isMapsLoaded) {
            setPredictions([]);
            return;
        }

        try {
            // [ZEN MIGRATION] Use fetchAutocompleteSuggestions instead of getPlacePredictions
            const request = {
                input: text,
                includedRegionCodes: ['us'], // Replaces componentRestrictions: { country: 'us' }
                sessionToken: sessionToken
            };

            const { suggestions } = await AutocompleteSuggestionRef.current.fetchAutocompleteSuggestions(request);
            
            // Filter for place predictions only (ignore query predictions if any)
            const validSuggestions = suggestions.filter((s: any) => s.placePrediction);
            setPredictions(validSuggestions);

        } catch (error) {
            console.error("Autocomplete Error:", error);
            setPredictions([]);
        }
    };

    // Handle Selection (New "toPlace()" and "fetchFields()" API)
    const handleSelect = async (suggestion: any) => {
        // The display text is now nested in placePrediction.text.text
        const mainText = suggestion.placePrediction.text.text;
        setQuery(mainText);
        setPredictions([]);

        try {
            // [ZEN MIGRATION] Convert suggestion to Place object and fetch fields
            const place = suggestion.placePrediction.toPlace();
            
            // Fetch required fields: Address Components and Location (Lat/Lng)
            await place.fetchFields({
                fields: ['addressComponents', 'location'],
            });

            // Parse the result (structure is slightly different from legacy)
            let streetNum = '', route = '', city = '', state = '', zip = '';

            if (place.addressComponents) {
                place.addressComponents.forEach((c: any) => {
                    if (c.types.includes('street_number')) streetNum = c.longText;
                    if (c.types.includes('route')) route = c.longText;
                    if (c.types.includes('locality')) city = c.longText;
                    if (c.types.includes('administrative_area_level_1')) state = c.shortText; // Use short for State (e.g. VA)
                    if (c.types.includes('postal_code')) zip = c.longText;
                });
            }

            const newData: AddressData = {
                streetAddress: `${streetNum} ${route}`.trim(),
                addressLocality: city,
                addressRegion: state,
                postalCode: zip,
                addressCountry: 'USA',
                coordinates: place.location ? {
                    lat: place.location.lat(),
                    lng: place.location.lng()
                } : undefined
            };

            onChange(newData);
            
            // Refresh session token after selection (best practice)
            const { AutocompleteSessionToken } = await (window as any).google.maps.importLibrary("places");
            setSessionToken(new AutocompleteSessionToken());

        } catch (error) {
            console.error("Place Details Error:", error);
        }
    };

    return (
        <div className="w-full">
            <div className="flex justify-between items-end mb-2">
                <h3 className="text-sm font-bold text-violet-400 flex items-center gap-2"><MapPin size={16}/> Location</h3>
                {apiKey && !isMapsLoaded && <span className="text-[10px] text-slate-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Loading Maps...</span>}
            </div>

            <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-500" />
                </div>
                <input 
                    type="text" 
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder={apiKey ? "Search address (Google Places New)..." : "Enter address manually (API Key missing)"}
                    className="w-full bg-[#1a1d26] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 placeholder-slate-600 outline-none transition-all"
                />
                
                {/* Google Predictions Dropdown */}
                {predictions.length > 0 && (
                    <ul className="absolute z-50 w-full mt-1 bg-[#1a1d26] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                        {predictions.map((item, index) => {
                            // [ZEN MIGRATION] New data structure access
                            const mainText = item.placePrediction.mainText.text;
                            const secondaryText = item.placePrediction.secondaryText?.text || "";

                            return (
                                <li 
                                    key={index} // Suggestions might not have stable IDs in the list view, index is safe here
                                    onClick={() => handleSelect(item)}
                                    className="px-4 py-3 hover:bg-white/5 cursor-pointer text-xs text-slate-300 border-b border-white/5 last:border-0"
                                >
                                    <span className="font-bold text-white block mb-0.5">{mainText}</span>
                                    <span className="opacity-60">{secondaryText}</span>
                                </li>
                            );
                        })}
                        <li className="px-2 py-1.5 text-[10px] text-right text-slate-500 bg-[#0f1219] flex justify-end items-center gap-1">
                            Powered by Google
                        </li>
                    </ul>
                )}
            </div>

            {/* Manual Fields (Auto-filled) */}
            <div className="grid grid-cols-6 gap-3 mb-2">
                <div className="col-span-6">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Street</label>
                    <input type="text" value={value?.streetAddress || ''} onChange={e => onChange({...value, streetAddress: e.target.value})} className="w-full bg-[#1a1d26] border border-white/10 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-cyan-500 outline-none" />
                </div>
                <div className="col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">City</label>
                    <input type="text" value={value?.addressLocality || ''} onChange={e => onChange({...value, addressLocality: e.target.value})} className="w-full bg-[#1a1d26] border border-white/10 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-cyan-500 outline-none" />
                </div>
                <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">State</label>
                    <input type="text" value={value?.addressRegion || ''} onChange={e => onChange({...value, addressRegion: e.target.value})} className="w-full bg-[#1a1d26] border border-white/10 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-cyan-500 outline-none" />
                </div>
                <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Zip</label>
                    <input type="text" value={value?.postalCode || ''} onChange={e => onChange({...value, postalCode: e.target.value})} className="w-full bg-[#1a1d26] border border-white/10 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-cyan-500 outline-none" />
                </div>
            </div>
        </div>
    );
};