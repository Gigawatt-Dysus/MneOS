import { CareerNode } from '../types';

/**
 * Normalizes a date string into a comparable numeric value.
 * Handles: 'FUTURE', 'PRESENT', 'Present', 'YYYY-MM-DD', 'YYYY', and irregular formats.
 */
const getSortValue = (dateStr?: string): number => {
    if (!dateStr) return 0;
    
    const normalized = dateStr.toUpperCase().trim();
    
    // Highest Priority: Future goals (Pinned to absolute top)
    if (normalized.includes('FUTURE')) return Number.MAX_SAFE_INTEGER;
    
    // Second Priority: Currently evolving/Present (Pinned below Future)
    if (normalized.includes('PRESENT') || normalized.includes('CURRENT')) return Number.MAX_SAFE_INTEGER - 1;
    
    // Parse standard dates
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        return date.getTime();
    }
    
    // Fallback for YYYY (Ensure it converts to a comparable timestamp)
    const yearMatch = dateStr.match(/\d{4}/);
    if (yearMatch) {
        return new Date(`${yearMatch[0]}-01-01`).getTime();
    }
    
    return 0;
};

/**
 * Sorts CareerNodes chronologically (most recent end date first).
 */
export const sortCareerNodes = (nodes: CareerNode[]): CareerNode[] => {
    if (!nodes || nodes.length <= 1) return nodes || [];
    
    return [...nodes].sort((a, b) => {
        const aVal = getSortValue(a.endDate);
        const bVal = getSortValue(b.endDate);
        
        if (aVal !== bVal) {
            return bVal - aVal; // Descending by end date
        }
        
        // Secondary sort: most recently started
        return getSortValue(b.startDate) - getSortValue(a.startDate);
    });
};
