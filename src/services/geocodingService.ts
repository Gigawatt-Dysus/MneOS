import { Tag, User } from '../types';
import { correctSpatialAnomaly, generateTemporalInquiry } from './aiOrchestrator';
import { loadGoogleMaps } from '../utils/googleMapsLoader';

export interface GeocodeResult {
    display_name: string;
    lat: string;
    lon: string;
    isLocal: boolean;
    isTag?: boolean;
    tagId?: string;
    rawAddress?: string;
    addressDetails?: {
        street?: string;
        city?: string;
        state?: string;
        state_code?: string;
        postcode?: string;
        country?: string;
        country_code?: string;
    };
}

/**
 * [ZEN] Unified Geocoding Service
 * Consolidates spatial intelligence from all providers:
 * 1. Horses First (Local Typesense Archive)
 * 2. Tag Cross-Reference (Existing Place Tags)
 * 3. Google Maps SDK (High fidelity, paid)
 * 4. LocationIQ (High fidelity, free tier)
 * 5. Geocodio (High fidelity US/Canada)
 * 6. Nominatim (Free, fallback)
 */
export const geocodingService = {
    /**
     * Search for locations based on a text query.
     */
    async search(query: string, userId: string, options: { 
        browserCoords?: { lat: number, lng: number } | null,
        tags?: Tag[],
        locationIqToken?: string
    } = {}): Promise<GeocodeResult[]> {
        if (!query) return [];
        const trimmed = query.trim();
        if (trimmed.length < 2) return [];

        try {
            // 1. LOCAL: No dedicated Typesense address collection — skip, use tag cross-reference instead
            const localHorses: GeocodeResult[] = [];

            // 2. REMOTE: Combined Global Search
            const globalSuggestions = await (async () => {
                    const providers = [
                        // Priority A: Google Maps SDK with Auto-injection & Component Mapping
                        async () => {
                            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
                            const gWindow = window as any;
                            
                            // Dynamically inject script if key is present and SDK isn't loaded
                            if (apiKey && !gWindow.google?.maps) {
                                try {
                                    await loadGoogleMaps(apiKey);
                                } catch (e) {
                                    console.error("[Geocoding] unified loadGoogleMaps failed:", e);
                                }
                            }

                            if (gWindow.google && gWindow.google.maps) {
                                const geocoder = new gWindow.google.maps.Geocoder();
                                return new Promise<GeocodeResult[]>((resolve) => {
                                    const geocodeRequest: any = { address: query };
                                    if (options.browserCoords) {
                                        geocodeRequest.location = new gWindow.google.maps.LatLng(
                                            options.browserCoords.lat, 
                                            options.browserCoords.lng
                                        );
                                    }
                                    geocoder.geocode(geocodeRequest, (results: any[], status: string) => {
                                        if (status === 'OK' && results && results.length > 0) {
                                            resolve(results.map((r: any) => {
                                                const details: any = {};
                                                if (Array.isArray(r.address_components)) {
                                                    for (const comp of r.address_components) {
                                                        const types = comp.types || [];
                                                        if (types.includes('street_number')) details.streetNumber = comp.long_name;
                                                        if (types.includes('route')) details.route = comp.long_name;
                                                        if (types.includes('locality')) details.city = comp.long_name;
                                                        if (types.includes('administrative_area_level_1')) {
                                                            details.state = comp.long_name;
                                                            details.state_code = comp.short_name;
                                                        }
                                                        if (types.includes('postal_code')) details.postcode = comp.long_name;
                                                        if (types.includes('country')) {
                                                            details.country = comp.long_name;
                                                            details.country_code = comp.short_name;
                                                        }
                                                    }
                                                }
                                                const street = (details.streetNumber && details.route) 
                                                    ? `${details.streetNumber} ${details.route}`
                                                    : details.route || r.formatted_address?.split(',')[0];

                                                return {
                                                    display_name: r.formatted_address,
                                                    lat: r.geometry.location.lat().toString(),
                                                    lon: r.geometry.location.lng().toString(),
                                                    isLocal: false,
                                                    addressDetails: {
                                                        street,
                                                        city: details.city || '',
                                                        state: details.state_code || details.state || '',
                                                        postcode: details.postcode || '',
                                                        country: details.country || 'USA'
                                                    }
                                                };
                                            }));
                                        } else {
                                            resolve([]);
                                        }
                                    });
                                });
                            }
                            return [];
                        },

                        // Priority B: LocationIQ
                        async () => {
                            if (!options.locationIqToken) return [];
                            try {
                                const liqRes = await fetch(`https://us1.locationiq.com/v1/autocomplete.php?key=${options.locationIqToken}&q=${encodeURIComponent(query)}&limit=5&countrycodes=us&addressdetails=1`);
                                if (!liqRes.ok) return [];
                                const liqData = await liqRes.json();
                                if (Array.isArray(liqData)) {
                                    return liqData.map((d: any) => ({
                                        display_name: d.display_name,
                                        lat: d.lat,
                                        lon: d.lon,
                                        isLocal: false,
                                        addressDetails: {
                                            street: d.address?.house_number ? `${d.address.house_number} ${d.address.road || ''}`.trim() : d.address?.road,
                                            city: d.address?.city || d.address?.town || d.address?.village,
                                            state: d.address?.state,
                                            state_code: d.address?.state_code,
                                            postcode: d.address?.postcode,
                                            country: d.address?.country,
                                            country_code: d.address?.country_code
                                        }
                                    }));
                                }
                            } catch (e) { console.warn("[Geocoding] LocationIQ failed:", e); }
                            return [];
                        },

                        // Priority C: Geocodio
                        async () => {
                            const geocodioKey = 'd722f868c9999166321f9262789cf1c67162dd2';
                            if (!geocodioKey) return [];
                            try {
                                let q = query;
                                // [ZEN FIX] Geocodio 422 suppression for extremely short partials
                                if (query.trim().length < 4 && !query.includes(',')) return [];
                                
                                if (/^-?\d+\.?\d*,\s?-?\d+\.?\d*$/.test(query)) {
                                    q = query.replace(/\s/g, ''); 
                                }
                                
                                const geoRes = await fetch(`https://api.geocod.io/v1.7/geocode?q=${encodeURIComponent(q)}&api_key=${geocodioKey}`);
                                
                                const mapGeocodio = (r: any) => {
                                    const ac = r.address_components;
                                    const street = ac ? `${ac.number || ''} ${ac.formatted_street || ac.street || ''}`.trim() : r.formatted_address?.split(',')[0];
                                    return {
                                        display_name: r.formatted_address,
                                        lat: r.location.lat.toString(),
                                        lon: r.location.lng.toString(),
                                        isLocal: false,
                                        addressDetails: {
                                            street,
                                            city: ac?.city || '',
                                            state: ac?.state || '',
                                            postcode: ac?.zip || '',
                                            country: ac?.country || 'USA'
                                        }
                                    };
                                };

                                if (!geoRes.ok) {
                                    // [ZEN FIX] Explicit suppression of 422 (Unprocessable) for ambiguous partials
                                    if (geoRes.status === 422 || geoRes.status === 400) {
                                        console.warn(`[Geocoding] Geocodio suppressed ${geoRes.status} for: "${q}"`);
                                        return [];
                                    }

                                    if (q.includes(',')) {
                                        const revRes = await fetch(`https://api.geocod.io/v1.7/reverse?q=${encodeURIComponent(q)}&api_key=${geocodioKey}`);
                                        if (revRes.ok) {
                                            const revData = await revRes.json();
                                            if (revData.results && revData.results.length > 0) {
                                                return revData.results.map(mapGeocodio);
                                            }
                                        }
                                    }
                                    return [];
                                }
                                const geoData = await geoRes.json();
                                if (geoData.results && geoData.results.length > 0) {
                                    return geoData.results.map(mapGeocodio);
                                }
                            } catch (e) { console.warn("[Geocoding] Geocodio failed:", e); }
                            return [];
                        },

                        // Priority D: Nominatim
                        async () => {
                            try {
                                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&countrycodes=us&addressdetails=1`, { 
                                    headers: { 'User-Agent': 'LifeOS/1.0' } 
                                });
                                if (!res.ok) return [];
                                const data = await res.json();
                                return data.map((d: any) => ({ 
                                    display_name: d.display_name, 
                                    lat: d.lat, 
                                    lon: d.lon, 
                                    isLocal: false,
                                    addressDetails: {
                                        street: d.address?.house_number ? `${d.address.house_number} ${d.address.road || ''}`.trim() : d.address?.road,
                                        city: d.address?.city || d.address?.town || d.address?.village,
                                        state: d.address?.state,
                                        postcode: d.address?.postcode,
                                        country: d.address?.country
                                    }
                                }));
                            } catch (e) { console.warn("[Geocoding] Nominatim failed:", e); }
                            return [];
                        }
                    ];

                    // Try each provider in sequence until we get results
                    for (const getSuggestions of providers) {
                        const results = await getSuggestions();
                        if (results && results.length > 0) return results;
                    }
                    return [];
                })();

            // 3. TAG CROSS-REFERENCE: Inject existing Place Tags
            const placeTags = (options.tags || []).filter(t => {
                if (t.type !== 'place') return false;
                const q = query.toLowerCase();
                const nameMatch = t.name.toLowerCase().includes(q);
                
                const meta = t.metadata as any;
                const addr = meta?.address;
                const addrStr = (typeof addr === 'string' ? addr : addr?.streetAddress || '').toLowerCase();
                const addressMatch = addrStr.includes(q);
                
                return nameMatch || addressMatch;
            }).map(t => {
                const m = t.metadata as any;
                const addr = m?.address;
                const addrStr = typeof addr === 'string' ? addr : addr?.streetAddress || '';
                const coords = m?.coordinates || { lat: m?.lat, lng: m?.lng || m?.lon };
                
                return { 
                    display_name: t.name + (addrStr ? ` (${addrStr})` : ''), 
                    lat: coords?.lat?.toString(), 
                    lon: coords?.lng?.toString(), 
                    isLocal: true, 
                    isTag: true, 
                    tagId: t.id,
                    rawAddress: addrStr,
                    // [ZEN FIX] Propagate details for auto-fill
                    addressDetails: typeof addr === 'object' ? {
                        street: addr.streetAddress,
                        city: addr.addressLocality,
                        state: addr.addressRegion,
                        postcode: addr.postalCode,
                        country: addr.addressCountry
                    } : {
                        street: addrStr.split(',')[0],
                        city: addrStr.split(',')[1]?.trim() || '',
                        state: addrStr.split(',')[2]?.trim()?.split(' ')[0] || '',
                        postcode: addrStr.split(',')[2]?.trim()?.split(' ')[1] || ''
                    }
                };
            }).filter(t => t.lat && t.lon);

            // Combine and Dedup
            const filteredLocal = (localHorses || []).filter((h: any) => 
                h.display_name.toLowerCase().includes(query.toLowerCase())
            );
            
            const combined = [...placeTags, ...filteredLocal, ...(globalSuggestions || [])];
            const unique = combined.filter((v, i, a) => 
                a.findIndex(t => t.display_name === v.display_name) === i
            );

            return unique.slice(0, 10);
        } catch (e) {
            console.error("[GeocodingService] Search error:", e);
            return [];
        }
    },

    /**
     * Resolve coordinates into a human-readable address.
     */
    async reverse(lat: number, lng: number, locationIqToken?: string): Promise<GeocodeResult | null> {
        try {
            // Priority A: LocationIQ (Standard)
            if (locationIqToken) {
                const res = await fetch(`https://us1.locationiq.com/v1/reverse.php?key=${locationIqToken}&lat=${lat}&lon=${lng}&format=json&addressdetails=1`);
                const data = await res.json();
                if (data.display_name) {
                    return {
                        display_name: data.display_name,
                        lat: lat.toString(),
                        lon: lng.toString(),
                        isLocal: false,
                        addressDetails: {
                            street: data.address?.house_number ? `${data.address.house_number} ${data.address.road || ''}`.trim() : data.address?.road,
                            city: data.address?.city || data.address?.town || data.address?.village,
                            state: data.address?.state,
                            state_code: data.address?.state_code,
                            postcode: data.address?.postcode,
                            country: data.address?.country,
                            country_code: data.address?.country_code
                        }
                    };
                }
            }

            // Priority B: Nominatim (Free Fallback)
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`, {
                headers: { 'User-Agent': 'LifeOS/1.0' }
            });
            const data = await res.json();
            if (data.display_name) {
                return {
                    display_name: data.display_name,
                    lat: lat.toString(),
                    lon: lng.toString(),
                    isLocal: false,
                    addressDetails: {
                        street: data.address?.house_number ? `${data.address.house_number} ${data.address.road || ''}`.trim() : data.address?.road,
                        city: data.address?.city || data.address?.town || data.address?.village,
                        state: data.address?.state,
                        postcode: data.address?.postcode,
                        country: data.address?.country
                    }
                };
            }
        } catch (e) {
            console.error("[GeocodingService] Reverse geocode error:", e);
        }
        return null;
    },

    /**
     * [AI SPATIAL GUIDE]
     * Leverages Grok to suggest corrections for failing queries.
     */
    async aiSpatialAssist(query: string, user: User, context?: string): Promise<string[]> {
        return correctSpatialAnomaly(query, user, context);
    },

    /**
     * [TEMPORAL HISTORIAN]
     * Engages the user when a location has changed over time.
     */
    async engageTemporalHistory(userQuery: string, mapResult: string, user: User): Promise<string> {
        return generateTemporalInquiry(userQuery, mapResult, user);
    }
};
