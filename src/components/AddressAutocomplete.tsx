import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, Globe, Sparkles, Navigation, FileText, Target } from 'lucide-react';
import { typesenseService } from '../services/typesenseService';
import { geocodingService, GeocodeResult } from '../services/geocodingService';
import { InteractiveMap } from './InteractiveMap';

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
    tags?: any[];
    userId?: string;
    label?: string;
}

/**
 * [ZEN INDEPENDENCE] Free Address Autocomplete via LocationIQ.
 * Integrated with [ZEN] Horse Search (Local Typesense Archive).
 * [GHOST GEOGRAPHY] Supports Narrative & Sovereign Pinning.
 */
export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({ value, onChange, tags, userId, label }) => {
    const [query, setQuery] = useState('');
    const [predictions, setPredictions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [localResults, setLocalResults] = useState<any[]>([]);
    const [isManual, setIsManual] = useState(false);
    const [isExact, setIsExact] = useState(true);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const token = import.meta.env.VITE_LOCATIONIQ_TOKEN;
    const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const COORD_REGEX = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;

    const [lastPropValue, setLastPropValue] = useState(value.streetAddress || '');

    // Sync prop value to internal query state only if it changed from the OUTSIDE
    useEffect(() => {
        if (value.streetAddress !== lastPropValue) {
            setQuery(value.streetAddress || '');
            setLastPropValue(value.streetAddress || '');
            setShowDropdown(false); 
        }
    }, [value.streetAddress]);

    const handleSearch = async (text: string) => {
        setQuery(text);
        setShowDropdown(true);
        setAiSuggestions([]);

        // [ZEN] In Manual or Narrative Mode, update the parent immediately as they type
        if (isManual || !isExact) {
            onChange({ ...value, streetAddress: text, coordinates: isExact ? value.coordinates : undefined });
            setLastPropValue(text);
            if (!isExact) return; // Skip geocoding in Narrative Mode
        }

        if (!text || text.length < 2) {
            setPredictions([]);
            setLocalResults([]);
            return;
        }

        setIsLoading(true);

        const results = await geocodingService.search(text, userId || 'current-user', {
            locationIqToken: token,
            tags
        });

        const local = results.filter(r => r.isLocal);
        const remote = results.filter(r => !r.isLocal);

        if (COORD_REGEX.test(text)) {
            const [lat, lng] = text.split(',').map(s => s.trim());
            local.unshift({
                display_name: `Coordinates: ${lat}, ${lng}`,
                lat,
                lon: lng,
                isLocal: true,
                isGPS: true
            } as any);
        }

        setLocalResults(local);
        setPredictions(remote);
        setIsLoading(false);
    };

    const handleAiAssist = async () => {
        if (!query || query.length < 3) return;
        setIsAiThinking(true);
        try {
            const suggestions = await geocodingService.aiSpatialAssist(query, { id: userId } as any);
            setAiSuggestions(suggestions);
        } catch (e) {
            console.error("AI Spatial Assist failed", e);
        } finally {
            setIsAiThinking(false);
        }
    };

    const handleSelect = async (item: GeocodeResult | (GeocodeResult & { isGPS: boolean })) => {
        setIsLoading(true);
        setShowDropdown(false);
        
        let finalData: AddressData;

        if ((item as any).isGPS) {
            const resolved = await geocodingService.reverse(parseFloat(item.lat), parseFloat(item.lon), token);
            if (resolved) {
                const addr = resolved.addressDetails;
                finalData = {
                    streetAddress: resolved.display_name.split(',')[0],
                    addressLocality: addr?.city || '',
                    addressRegion: addr?.state_code || addr?.state || '',
                    postalCode: addr?.postcode || '',
                    addressCountry: 'USA',
                    coordinates: {
                        lat: parseFloat(item.lat),
                        lng: parseFloat(item.lon)
                    }
                };
            } else {
                finalData = {
                    streetAddress: item.display_name,
                    addressLocality: '',
                    addressRegion: '',
                    postalCode: '',
                    addressCountry: 'USA',
                    coordinates: {
                        lat: parseFloat(item.lat),
                        lng: parseFloat(item.lon)
                    }
                };
            }
        } else if (item.isLocal) {
            const addr = item.addressDetails;
            let street = addr?.street || item.rawAddress || item.display_name.split(' (')[0];
            
            const queryMatch = query.trim().match(/^(\d+[A-Za-z]?(-[A-Za-z0-9]+)?)/);
            if (queryMatch && !street.startsWith(queryMatch[1])) {
                street = `${queryMatch[1]} ${street}`;
            }

            finalData = {
                streetAddress: street,
                addressLocality: addr?.city || '',
                addressRegion: addr?.state || addr?.state_code || '',
                postalCode: addr?.postcode || '',
                coordinates: {
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon)
                }
            };
        } else {
            const addr = item.addressDetails;
            let street = addr?.street || item.display_name.split(',')[0];

            const queryMatch = query.trim().match(/^(\d+[A-Za-z]?(-[A-Za-z0-9]+)?)/);
            if (queryMatch && !street.startsWith(queryMatch[1])) {
                street = `${queryMatch[1]} ${street}`;
            }

            finalData = {
                streetAddress: street,
                addressLocality: addr?.city || '',
                addressRegion: addr?.state_code || addr?.state || '',
                postalCode: addr?.postcode || '',
                addressCountry: 'USA',
                coordinates: {
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon)
                }
            };
        }

        setQuery(finalData.streetAddress || item.display_name);
        setLocalResults([]);
        setPredictions([]);
        setIsLoading(false);
        onChange(finalData);
    };

    return (
        <div className="w-full">
            <div className="flex justify-between items-end mb-2">
                <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-bold text-violet-400 flex items-center gap-2">
                        <MapPin size={16} /> {label || "Location Search"}
                    </h3>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative flex items-center">
                                <input 
                                    type="checkbox"
                                    checked={isExact}
                                    onChange={(e) => {
                                        setIsExact(e.target.checked);
                                        if (!e.target.checked) {
                                            setIsManual(true);
                                            onChange({ ...value, coordinates: undefined });
                                        }
                                    }}
                                    className="sr-only"
                                />
                                <div className={`w-8 h-4 rounded-full transition-colors ${isExact ? 'bg-cyan-500/40' : 'bg-slate-700'}`} />
                                <div className={`absolute w-3 h-3 bg-white rounded-full transition-transform ${isExact ? 'translate-x-4' : 'translate-x-1'}`} />
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isExact ? 'text-cyan-400' : 'text-slate-500'}`}>
                                Exact Address
                            </span>
                        </label>
                    </div>
                </div>
                
                <div className="flex flex-col items-end gap-1">
                    <button 
                        onClick={() => {
                            const nextManual = !isManual;
                            setIsManual(nextManual);
                            if (nextManual) {
                                onChange({ ...value, streetAddress: query });
                            }
                        }}
                        className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors ${isManual ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-400'}`}
                    >
                        <Sparkles size={10} className={isManual ? 'text-cyan-400' : ''} /> {isExact ? 'Manual Mode' : 'Narrative Mode Active'}
                    </button>
                    {isLoading && (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin" /> Searching...
                        </span>
                    )}
                </div>
            </div>

            <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-500" />
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                    onFocus={() => { if (query.length >= 2) setShowDropdown(true); }}
                    placeholder={!isExact ? "Describe the location (e.g. The park near Main St)..." : "Search for a place or address..."}
                    className={`w-full bg-[#1a1d26] border border-white/10 rounded-lg pl-10 pr-10 py-2 text-sm text-white focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 placeholder-slate-600 outline-none transition-all ${!isExact ? 'border-amber-500/30 bg-amber-500/5' : ''}`}
                />

                {query && (
                    <button 
                        onClick={() => {
                            handleSearch('');
                            setShowDropdown(false);
                        }}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white transition-colors"
                    >
                        <Globe size={14} className="opacity-40" />
                    </button>
                )}

                {showDropdown && (isLoading || predictions.length > 0 || localResults.length > 0 || aiSuggestions.length > 0 || (query.length >= 2 && !isLoading)) && (
                    <ul className="absolute z-50 w-full mt-1 bg-[#1a1d26] border border-white/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                        {isLoading && (localResults.length === 0 && predictions.length === 0) && (
                            <li className="px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
                                <Loader2 size={12} className="animate-spin" /> Deep Search in Progress...
                            </li>
                        )}
                        
                        {localResults.map((item, index) => (
                            <li
                                key={`local-${index}`}
                                onClick={() => handleSelect(item)}
                                className="px-4 py-3 bg-cyan-900/10 hover:bg-cyan-900/20 cursor-pointer text-xs text-slate-300 border-b border-white/5 last:border-0"
                            >
                                <span className="font-bold text-cyan-400 flex items-center gap-2 mb-0.5">
                                    {item.isGPS ? <MapPin size={12} /> : <Globe size={12} />} {item.display_name}
                                </span>
                                <span className="opacity-60 text-[10px] italic">
                                    {item.isGPS ? 'Direct Geographic Coordinates' : 'Found in your Archive'}
                                </span>
                            </li>
                        ))}
                        
                        {predictions.map((item, index) => (
                            <li
                                key={`remote-${index}`}
                                onClick={() => handleSelect(item)}
                                className="px-4 py-3 hover:bg-white/5 cursor-pointer text-xs text-slate-300 border-b border-white/5 last:border-0"
                            >
                                <span className="font-bold text-white block mb-0.5">
                                    {item.address?.name || item.display_name.split(',')[0]}
                                </span>
                                <span className="opacity-60 text-[10px]">
                                    {item.display_name}
                                </span>
                            </li>
                        ))}

                        {aiSuggestions.map((s, index) => (
                            <li
                                key={`ai-${index}`}
                                onClick={() => setQuery(s)}
                                className="px-4 py-3 bg-violet-900/10 hover:bg-violet-900/20 cursor-pointer text-xs text-slate-300 border-b border-white/5 last:border-0"
                            >
                                <span className="font-bold text-violet-400 flex items-center gap-2 mb-0.5">
                                    <Sparkles size={12} /> {s}
                                </span>
                                <span className="opacity-60 text-[10px] italic">
                                    GIGI Suggestion (Fuzzy Match)
                                </span>
                            </li>
                        ))}

                        {isAiThinking && (
                            <li className="px-4 py-3 text-xs text-violet-400 flex items-center gap-2 animate-pulse">
                                <Sparkles size={12} /> GIGI is correcting spatial anomalies...
                            </li>
                        )}

                        {!isLoading && isExact && query.length >= 2 && localResults.length === 0 && predictions.length === 0 && !isAiThinking && aiSuggestions.length === 0 && (
                            <div className="p-4 bg-slate-900/50 border-t border-white/5">
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3">No Exact Match Found</p>
                                <div className="flex flex-col gap-2">
                                    <button 
                                        onClick={() => {
                                            setIsExact(false);
                                            setIsManual(true);
                                            onChange({ ...value, streetAddress: query, coordinates: undefined });
                                            setShowDropdown(false);
                                        }}
                                        className="w-full p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold rounded border border-amber-500/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        <FileText size={14} /> Store as Narrative Location
                                    </button>
                                    <button 
                                        onClick={handleAiAssist}
                                        className="w-full p-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-xs font-bold rounded border border-violet-500/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Sparkles size={14} /> Ask AI to find similar
                                    </button>
                                    <button 
                                        onClick={() => setShowPicker(true)}
                                        className="w-full p-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold rounded border border-cyan-500/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Target size={14} /> Manual Map Pinning
                                    </button>
                                </div>
                            </div>
                        )}
                    </ul>
                )}
            </div>

            {showPicker && (
                <InteractiveMap 
                    lat={value.coordinates?.lat || 39.8283}
                    lng={value.coordinates?.lng || -98.5795}
                    apiKey={googleKey || ''}
                    isPicker={true}
                    onClose={() => setShowPicker(false)}
                    onSelect={(lat, lng) => {
                        onChange({ ...value, coordinates: { lat, lng } });
                        setShowPicker(false);
                        setIsExact(true);
                    }}
                />
            )}

            {/* Manual Fields (Auto-filled or manual correction) */}
            <div className="grid grid-cols-6 gap-3 mb-2">
                <div className="col-span-6">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Street</label>
                    <input 
                        type="text" 
                        name="address-line1"
                        autoComplete="address-line1"
                        value={value?.streetAddress || ''} 
                        onChange={e => onChange({ ...value, streetAddress: e.target.value })} 
                        className="w-full bg-[#1a1d26] border border-white/10 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-cyan-500 outline-none transition-colors focus:bg-[#232732]" 
                    />
                </div>
                <div className="col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">City</label>
                    <input 
                        type="text" 
                        name="address-level2"
                        autoComplete="address-level2"
                        value={value?.addressLocality || ''} 
                        onChange={e => onChange({ ...value, addressLocality: e.target.value })} 
                        className="w-full bg-[#1a1d26] border border-white/10 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-cyan-500 outline-none transition-colors focus:bg-[#232732]" 
                    />
                </div>
                <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">State</label>
                    <input 
                        type="text" 
                        name="address-level1"
                        autoComplete="address-level1"
                        value={value?.addressRegion || ''} 
                        onChange={e => onChange({ ...value, addressRegion: e.target.value })} 
                        className="w-full bg-[#1a1d26] border border-white/10 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-cyan-500 outline-none transition-colors focus:bg-[#232732]" 
                    />
                </div>
                <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Zip</label>
                    <input 
                        type="text" 
                        name="postal-code"
                        autoComplete="postal-code"
                        value={value?.postalCode || ''} 
                        onChange={e => onChange({ ...value, postalCode: e.target.value })} 
                        className="w-full bg-[#1a1d26] border border-white/10 rounded p-2 text-white text-sm placeholder-slate-600 focus:border-cyan-500 outline-none transition-colors focus:bg-[#232732]" 
                    />
                </div>
            </div>
        </div>
    );
};