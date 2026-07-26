export const calculateAge = (birthDateString: string): number | null => {
    if (!birthDateString) return null;
    try {
        // Handle YYYY-MM-DD format correctly by ensuring it's parsed as UTC
        const birthDate = new Date(birthDateString + 'T00:00:00Z');
        if (isNaN(birthDate.getTime())) return null;

        const today = new Date();
        let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
        const m = today.getUTCMonth() - birthDate.getUTCMonth();
        
        if (m < 0 || (m === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
            age--;
        }
        return age >= 0 ? age : null;
    } catch (e) {
        console.error("Error calculating age:", e);
        return null;
    }
};

/**
 * Intelligently parses a string to a Date object, supporting various formats.
 * @param input The user's date string.
 * @returns A Date object if parsable, otherwise null.
 */
export const parseNaturalDateString = (input: string): Date | null => {
    if (!input || typeof input !== 'string') return null;

    const cleanedInput = input.trim().toLowerCase();

    // 1. Try native parsing for standard formats like "YYYY-MM-DD" or "April 13, 1985"
    if (!/^\d+$/.test(cleanedInput)) {
        const nativeDate = new Date(cleanedInput);
        if (!isNaN(nativeDate.getTime())) {
             return nativeDate;
        }
    }
    
    // 2. Handle formats with month names: "April 13th, 1985", "apr 13 85" etc.
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const monthRegex = new RegExp(`(${monthNames.join('|')})[a-z]*`);
    const monthMatch = cleanedInput.match(monthRegex);

    if (monthMatch) {
        const month = monthNames.indexOf(monthMatch[1]) + 1;
        const remaining = cleanedInput.replace(monthRegex, '').replace(/(st|nd|rd|th|,)/g, '').trim();
        const parts = remaining.split(/\s+/).map(p => parseInt(p, 10)).filter(p => !isNaN(p));
        
        if (parts.length === 2) { 
            let day = parts[0];
            let year = parts[1];
            if (day > 31) { [year, day] = [day, year]; }
            if (year < 100) year += (year > 50 ? 1900 : 2000); 

            if (year > 999 && day > 0 && day <= 31) {
                return new Date(Date.UTC(year, month - 1, day));
            }
        }
    }

    // 3. Handle numeric-only strings like 41385, 4131985, 13041985
    const numericInput = cleanedInput.replace(/[^0-9]/g, '');
    if (numericInput.length >= 5) {
        let year, month, day;

        // MMDDYY 
        if (numericInput.length === 5 || numericInput.length === 6) {
            const padded = numericInput.padStart(6, '0');
            month = parseInt(padded.substring(0, 2), 10);
            day = parseInt(padded.substring(2, 4), 10);
            year = parseInt(padded.substring(4, 6), 10);
            year += (year > 50 ? 1900 : 2000);
        }
        // MMDDYYYY or DDMMYYYY
        else if (numericInput.length === 7 || numericInput.length === 8) {
            const padded = numericInput.padStart(8, '0');
            const part1 = parseInt(padded.substring(0, 2), 10);
            const part2 = parseInt(padded.substring(2, 4), 10);
            const yearPart = parseInt(padded.substring(4, 8), 10);

            // Ambiguity check: If first part > 12, it must be DDMMYYYY (European style)
            if (part1 > 12 && part1 <= 31 && part2 <= 12) { 
                day = part1; month = part2; year = yearPart;
            } else { // Otherwise, assume MMDDYYYY (US default)
                month = part1; day = part2; year = yearPart;
            }
        }
        
        if (year && month && day) {
            const testDate = new Date(Date.UTC(year, month - 1, day));
            if (year > 999 && month > 0 && month <= 12 && day > 0 && day <= 31 && testDate.getUTCMonth() === month - 1) {
               return testDate;
            }
        }
    }

    return null; 
};