import type { Media } from '@/types';

export interface DateGroup {
    title: string;
    dateKey: number;
    assets: Media[];
}

export const groupAssetsByMonth = (assets: Media[]): DateGroup[] => {
    const groups: Record<string, DateGroup> = {};

    assets.forEach(asset => {
        let rawDate: string | Date | number = new Date();

        if (asset.logicalDate) {
            rawDate = asset.logicalDate;
        } else if (asset.uploadDate) {
            rawDate = asset.uploadDate;
        }

        const dateObj = new Date(rawDate);
        if (isNaN(dateObj.getTime())) return;

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