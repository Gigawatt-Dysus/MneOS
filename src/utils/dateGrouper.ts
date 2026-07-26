import type { Media } from '../types';

export interface DateGroup {
    title: string;
    dateKey: number;
    assets: Media[];
}

/**
 * [ZEN] Coerce a date value from any of the following to a JS Date:
 *  - Firestore Timestamp objects (have a .toDate() method)
 *  - Plain JS Date objects
 *  - ISO date strings
 *  - Unix epoch numbers
 * Returns null if the value cannot be coerced to a valid date.
 */
const toDate = (raw: any): Date | null => {
    if (!raw) return null;
    // Firestore Timestamp: has seconds + nanoseconds + .toDate()
    if (typeof raw === 'object' && typeof raw.toDate === 'function') {
        return raw.toDate();
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
};

export const groupAssetsByMonth = (assets: Media[]): DateGroup[] => {
    const groups: Record<string, DateGroup> = {};

    assets.forEach(asset => {
        // [ZEN] Prefer logicalDate (set by user), fall back to uploadDate (set at ingest).
        // Both can be Firestore Timestamps at runtime even though typed as string/Date.
        const rawDate = asset.logicalDate || asset.uploadDate || null;
        const dateObj = toDate(rawDate) ?? new Date(); // fall back to today if truly unparseable

        const monthName = dateObj.toLocaleString('default', { month: 'long' });
        const year = dateObj.getFullYear();
        const title = `${monthName} ${year}`;
        const sortKey = parseInt(`${year}${dateObj.getMonth().toString().padStart(2, '0')}`);

        if (!groups[title]) {
            groups[title] = { title, dateKey: sortKey, assets: [] };
        }
        groups[title].assets.push(asset);
    });

    const sortedGroups = Object.values(groups).sort((a, b) => b.dateKey - a.dateKey);

    sortedGroups.forEach(group => {
        group.assets.sort((a, b) => {
            const dateA = new Date(a.logicalDate || a.uploadDate || 0).getTime();
            const dateB = new Date(b.logicalDate || b.uploadDate || 0).getTime();
            return dateB - dateA;
        });
    });

    return sortedGroups;
};