export const sanitizeDate = (dateString: string): string => {
    if (!dateString) return new Date().toISOString();
    const date = new Date(dateString);
    const year = date.getFullYear();

    // [ZEN GIGI ARCHIVE] Open boundary: reject only if the year is genuinely
    // non-numeric (garbage/corrupted input). No floor, no ceiling.
    // This preserves deep-historical Tags (ancient civilizations, BCE events)
    // AND the 5000-01-01 sentinel date used by the shoebox triage system.
    if (isNaN(year)) {
        return new Date().toISOString();
    }
    return dateString;
};

export const extractDateFromFilename = (filename: string): string | null => {
    if (!filename) return null;

    // [ZEN FIX] 1. THE FACEBOOK FIREWALL
    // Facebook images (FB_IMG...) usually contain IDs, not reliable timestamps.
    // We explicitly ignore them to prevent "Year 1590" errors.
    if (filename.includes('FB_IMG') || filename.includes('Facebook')) {
        return null;
    }

    // [ZEN FIX] 2. STRICT PATTERN MATCHING
    // Instead of grabbing any 4 digits, we look for specific date structures.
    // Supports:
    // - 20231225 (Compact)
    // - 2023-12-25 (Hyphen)
    // - 2023_12_25 (Underscore)
    // Regex looks for 19xx or 20xx followed immediately by month/day patterns
    const dateRegex = /(19|20)\d{2}[-_]?((0[1-9])|(1[0-2]))[-_]?((0[1-9])|([1-2][0-9])|(3[0-1]))/;
    const match = filename.match(dateRegex);

    if (match) {
        // Construct ISO String (YYYY-MM-DD) from parts
        // match[0] is full string
        // We strip non-digits to get pure numbers: 20231225
        const cleanMatch = match[0].replace(/[-_]/g, '');
        const year = parseInt(cleanMatch.substring(0, 4));
        const month = parseInt(cleanMatch.substring(4, 6));
        const day = parseInt(cleanMatch.substring(6, 8));

        // [ZEN FIX] 3. LOGICAL BOUNDARIES
        const currentYear = new Date().getFullYear();
        if (year < 1970 || year > currentYear + 1) return null;

        // Construct Date Object
        const date = new Date(year, month - 1, day);

        // Also try to grab time if available: HHMMSS after the date
        // e.g. IMG_20231225_143005
        const timeRegex = new RegExp(`${match[0]}[-_]?([0-2][0-9])([0-5][0-9])([0-5][0-9])`);
        const timeMatch = filename.match(timeRegex);

        if (timeMatch) {
            date.setHours(parseInt(timeMatch[1]));
            date.setMinutes(parseInt(timeMatch[2]));
            date.setSeconds(parseInt(timeMatch[3]));
        } else {
            // Default to noon to avoid timezone shifting previous day
            date.setHours(12, 0, 0, 0);
        }

        return date.toISOString();
    }

    // [ZEN FIX] 4. UNIX TIMESTAMP FALLBACK (Last Resort)
    // If filename looks like a 13-digit timestamp (e.g., 1689234000000)
    // Common in WhatsApp/Download files
    const timestampRegex = /\b(1[0-9]{12})\b/; // Starts with 1, 13 digits (valid for 2001-2286)
    const tsMatch = filename.match(timestampRegex);

    if (tsMatch) {
        const ts = parseInt(tsMatch[1]);
        const date = new Date(ts);
        const year = date.getFullYear();

        if (year > 1970 && year < new Date().getFullYear() + 1) {
            return date.toISOString();
        }
    }

    return null;
};

// [ZEN] Helper for HTML DateTime Inputs
export const formatDateForInput = (date: Date): string => {
    if (!date || isNaN(date.getTime())) return '';
    const pad = (n: number) => n < 10 ? '0' + n : n;
    
    const year = date.getFullYear();
    return `${String(year).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * [ZEN] The LifeOS Core Dating Engine
 * Ensures high-fidelity, human-readable dates across the OS.
 * Supports ordinals (1st, 2nd, 3rd) and precision-aware layouts.
 */
export const getOrdinal = (d: number) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
};

/**
 * [ZEN] Robust Date Parser
 * Parses a date value from various representations including Date object,
 * numbers, strings, and MongoDB/Firebase serialized object formats.
 * If all fail, tries to extract chronological hints from associated text content.
 */
export const parseRobustDate = (dateVal: any, textFallbackSource?: string | string[], userContext?: any): Date => {
    const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());
    
    // 1. If it's already a valid Date object, return it
    if (isValidDate(dateVal)) return dateVal;
    
    // 2. If it's a nested timestamp object (MongoDB / Firebase style)
    if (dateVal && typeof dateVal === 'object') {
        const sec = dateVal._seconds || dateVal.seconds || dateVal._sec;
        if (typeof sec === 'number') {
            const parsed = new Date(sec * 1000);
            if (isValidDate(parsed)) return parsed;
        }
        
        // Also check native subfields
        const subDate = dateVal.date || dateVal.createdAt || dateVal.timestamp || dateVal.creationDate;
        if (subDate) {
            const parsed = parseRobustDate(subDate, undefined, userContext);
            if (isValidDate(parsed)) return parsed;
        }
    }

    // 3. If it's a number (timestamp epoch in seconds or milliseconds)
    if (typeof dateVal === 'number') {
        const isSeconds = dateVal < 50000000000;
        const parsed = new Date(isSeconds ? dateVal * 1000 : dateVal);
        if (isValidDate(parsed)) return parsed;
    }
    
    // 4. If it's a string
    if (typeof dateVal === 'string') {
        // [ZEN FIX] UTC Dateline Guard:
        // Plain ISO date strings (e.g. "1965-05-15") are parsed as UTC midnight by spec.
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
            const [y, mo, dy] = dateVal.trim().split('-').map(Number);
            const parsed = new Date(y, mo - 1, dy, 12, 0, 0); // noon local time, no UTC shift
            if (isValidDate(parsed)) return parsed;
        } else {
            const parsed = new Date(dateVal);
            if (isValidDate(parsed)) return parsed;
        }
    }

    // 5. Text extraction fallback if a source is provided
    if (textFallbackSource) {
        const texts = Array.isArray(textFallbackSource) 
            ? textFallbackSource 
            : [textFallbackSource];
            
        const monthMap: Record<string, number> = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
        };
        
        for (const text of texts) {
            if (!text || typeof text !== 'string') continue;
            
            // Check for Month + Year pattern, e.g. "March 1967" or "Mar 1967" or "Mar, 1967"
            const monthYearRegex = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})/i;
            const myMatch = monthYearRegex.exec(text);
            if (myMatch) {
                const monthName = myMatch[1].toLowerCase();
                const yearNum = parseInt(myMatch[2], 10);
                const monthNum = monthMap[monthName] || 0;
                return new Date(Date.UTC(yearNum, monthNum, 1));
            }

            // [ZEN GIGI ARCHIVE] Match any 3-4 digit year — supports ancient/historical
            // entries like "Christianity founded ~30 AD" or "Islam 622 CE".
            const yearRegex = /\b(\d{3,4})\b/;
            const yMatch = yearRegex.exec(text);
            if (yMatch) {
                const yearNum = parseInt(yMatch[1], 10);
                return new Date(Date.UTC(yearNum, 0, 1)); // Default to Jan 1st of that year
            }
        }
    }

    // 6. Absolute Safeguard Fallback (dynamic resolve from userContext)
    const birthday = userContext?.birthday || userContext?.birthDate || userContext?.sovereignMemex?.birthday;
    if (birthday) {
        const parsed = new Date(birthday);
        if (isValidDate(parsed)) return parsed;
    }
    // Fallback to Unix Epoch if no user birthday is set or available
    return new Date(0);
};

export const formatLifeOSDate = (d?: any, precision?: string, userContext?: any): string => {
    if (!d) return '';
    
    let date = parseRobustDate(d, undefined, userContext);
    if (isNaN(date.getTime())) return '';

    let year = date.getFullYear();
    // [ZEN] Smart Year Repair (Same logic as above to preserve display integrity)
    if (year >= 10 && year <= 99 && year !== 19 && year !== 20) {
        year += (year > 50 ? 1900 : 2000);
    }

    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    
    if (precision === 'year') return String(year).padStart(4, '0');
    if (precision === 'circa') return `c. ${String(year).padStart(4, '0')}`;
    if (precision === 'decade') return `${Math.floor(year / 10) * 10}s`;
    if (precision === 'month') return `${monthName} ${String(year).padStart(4, '0')}`;
    
    const ordinal = getOrdinal(day);
    const dateStr = `${monthName} ${day}${ordinal}, ${String(year).padStart(4, '0')}`;
    
    if (precision === 'exact') {
        const timeStr = date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        }).toLowerCase();
        return `${dateStr} - ${timeStr}`;
    }
    
    return dateStr;
};