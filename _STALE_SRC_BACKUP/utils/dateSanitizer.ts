export const sanitizeDate = (dateString: string): string => {
    if (!dateString) return new Date().toISOString();
    const date = new Date(dateString);
    const year = date.getFullYear();
    const now = new Date().getFullYear();

    // [ZEN FIX] Sanity Check:
    // If the year is older than 1950 (pre-digital era) or in the future
    // we assume the metadata is garbage/corrupted.
    // This catches "1590" (FB_IMG) and "0000" errors.
    if (isNaN(year) || year < 1950 || year > now + 1) {
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
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};