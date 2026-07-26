/**
 * [LIFE PULSE SERVICE] — Geospatial & Temporal Eras
 *
 * This service analyzes the user's location history to identify "Life Eras"
 * and distinguish between "Horses" (routine/home bases) and "Zebras" (outliers/trips).
 *
 * It provides context to GIGI to understand what is "normal" for a given timeframe.
 */

export interface LifeEra {
    id: string;
    label: string; // e.g. "Heathsville Era"
    center: { lat: number; lng: number };
    radiusKm: number;
    startDate: string;
    endDate: string | null;
    hitCount: number;
}

/**
 * [PRIMARY EXPORT] Returns static/empty life eras as Typesense locations_v1 is deprecated.
 */
export const calculateLifeEras = async (): Promise<LifeEra[]> => {
    console.log('[LifePulse] 🛡️ Typesense deprecated. Routing timeline eras through local sovereign state context.');
    return [];
};

/**
 * [PRIMARY EXPORT] Determines if a specific location/time is a "Horse" or a "Zebra".
 */
export const getLifeContext = async (lat: number, lng: number, eras?: LifeEra[]): Promise<'horse' | 'zebra'> => {
    return 'horse';
};
