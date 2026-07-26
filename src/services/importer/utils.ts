/**
 * [ZEN] Importer Utilities
 * Robust date parsing and string sanitization for legacy data streams.
 */

export const parseFlexibleDate = (dateInput: any, contextYear?: number): Date | null => {
    if (!dateInput) return null;

    if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
        return dateInput;
    }
    
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
        const isoDate = new Date(dateInput);
        if (!isNaN(isoDate.getTime())) return isoDate;
    }

    if (typeof dateInput !== 'string') {
        let ts = Number(dateInput);
        if (!isNaN(ts)) {
            if (ts > 0 && ts < 10000000000) ts *= 1000;
            const numDate = new Date(ts);
            if (!isNaN(numDate.getTime())) return numDate;
        }
        return null;
    }
    
    const parts = dateInput.replace(/[./]/g, '-').split('-');
    let year: number | undefined;
    let month: number = 1;
    let day: number = 1;

    if (parts.length === 3) {
        const p1 = parseInt(parts[0]);
        const p2 = parseInt(parts[1]);
        const p3 = parseInt(parts[2]);

        if (parts[0].length === 4) {
            year = p1;
            month = p2 || 1;
            day = p3 || 1;
        } else {
            month = p1 || 1;
            day = p2 || 1;
            if (!isNaN(p3)) {
                year = p3 < 100 ? p3 + (p3 > 50 ? 1900 : 2000) : p3;
            } else {
                year = contextYear;
            }
        }
    } else if (parts.length === 2 && contextYear) {
        month = parseInt(parts[0]) || 1;
        day = parseInt(parts[1]) || 1;
        year = contextYear;
    } else {
        return null;
    }

    if (year === undefined || year === null) return null;
    if (month < 1 || month > 12) month = 1;
    if (day < 1 || day > 31) day = 1;
    
    const finalDate = new Date(Date.UTC(year, month - 1, day));
    return isNaN(finalDate.getTime()) ? null : finalDate;
};

export const fixFBString = (str: string | undefined): string => {
    if (!str) return '';
    try {
        return decodeURIComponent(escape(str));
    } catch {
        return str;
    }
};

export const getTitle = (raw: any): string => {
    const potentialTitle = raw.title || raw.event;
    if (typeof potentialTitle === 'string' && potentialTitle.trim()) {
        return fixFBString(potentialTitle.trim());
    }
    
    const detailsText = String(raw.details ?? '');
    if (detailsText.trim()) {
        const firstLine = detailsText.split('\n')[0].trim();
        return fixFBString(firstLine.length > 70 ? firstLine.substring(0, 67) + '...' : firstLine);
    }
    
    if (raw.name && typeof raw.name === 'string' && !raw.message && !raw.story && !raw.content) {
        return `Became friends with ${fixFBString(raw.name)}`;
    }
    
    if (raw.sender_name && raw.content) {
        return `Message from ${fixFBString(raw.sender_name)}`;
    }
    
    return 'Untitled Entry';
};

export const getMessage = (raw: any): string => {
    const msg = (
        raw.message || 
        raw.story || 
        raw.details || 
        raw.comment || 
        raw.content || 
        raw.data?.[0]?.post || 
        raw.data?.[0]?.comment?.comment || 
        ''
    ).trim();
    return fixFBString(msg);
};
