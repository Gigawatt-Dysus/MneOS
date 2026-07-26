// utils/formatters.ts

export const COMMON_HONORIFICS = [
    'Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.', 'Prof.', 'Rev.', 'Capt.', 'Sir', 'Madam', 'Mx.', 'Cmdr.', 'Gen.', 'Lt.', 'Sgt.'
];

export const COMMON_SUFFIXES = [
    'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'
];

export const COMMON_CREDENTIALS = [
    'Ph.D.', 'M.D.', 'D.D.S.', 'Esq.', 'CPA', 'MBA', 'R.N.', 'D.V.M.', 'J.D.', 'O.D.', 'Pharm.D.'
];

export const formatHonorific = (val: string): string => {
    if (!val) return '';
    const clean = val.trim();
    const lower = clean.replace(/\.$/, '').toLowerCase();

    const map: Record<string, string> = {
        'mr': 'Mr.', 'mister': 'Mr.',
        'mrs': 'Mrs.', 'missus': 'Mrs.',
        'ms': 'Ms.', 'miss': 'Ms.',
        'dr': 'Dr.', 'doctor': 'Dr.',
        'prof': 'Prof.', 'professor': 'Prof.',
        'rev': 'Rev.', 'reverend': 'Rev.',
        'mx': 'Mx.',
        'cpt': 'Capt.', 'captain': 'Capt.'
    };

    if (map[lower]) return map[lower];

    if (clean.length > 0) {
        const needsDot = clean.length <= 4 && !clean.includes('.');
        const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
        return needsDot ? `${capitalized}.` : capitalized;
    }
    return val;
};

export const formatMiddleInitial = (val: string): string => {
    if (!val) return '';
    const clean = val.trim();

    // 1. If it's a single character, capitalize and dot it.
    if (clean.length === 1 && /^[a-zA-Z]$/.test(clean)) {
        return `${clean.toUpperCase()}.`;
    }

    // 2. Handle multi-initials (e.g. "c d" -> "C. D." or "c.d" -> "C. D.")
    // Split by space or period
    const parts = clean.split(/[\s.]+/).filter(p => p.length > 0);

    // Check if ALL parts are single letters (implies initials)
    const allSingleLetters = parts.every(p => p.length === 1 && /^[a-zA-Z]$/.test(p));

    if (allSingleLetters) {
        return parts.map(p => `${p.toUpperCase()}.`).join(' ');
    }

    // 3. If it looks like a full name (e.g. "Charles"), just capitalize first letter
    // We don't force dots on full names, but we do ensure standard capitalization
    return clean.replace(/\b\w/g, c => c.toUpperCase());
};

export const formatPhoneNumber = (val: string): string => {
    if (!val) return '';
    const digits = val.replace(/\D/g, '');

    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    if (digits.length === 11 && digits.startsWith('1')) {
        return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }

    if (val.startsWith('+')) return val;

    return val;
};

export const normalizeEmail = (val: string): string => {
    return val.trim().toLowerCase();
};

export const formatUrl = (val: string): string => {
    if (!val) return '';
    let clean = val.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        return `https://${clean}`;
    }
    return clean;
};

export const formatFullName = (meta: any, includeHonorifics = false): string => {
    if (!meta) return '';
    const { honorificPrefix, givenName, additionalName, familyName, suffix, honorificSuffix } = meta;
    const parts = [
        includeHonorifics ? honorificPrefix : null,
        givenName,
        additionalName,
        familyName,
        suffix,
        includeHonorifics ? honorificSuffix : null
    ].filter(p => typeof p === 'string' && p.trim().length > 0);
    
    return parts.join(' ').trim();
};

/**
 * sanitizes a label for scannability.
 * 1. Strip non-alphanumeric (except spaces)
 * 2. Title Case
 * 3. Max 20 chars
 */
export const cleanLabel = (val: string): string => {
    if (!val) return '';
    let clean = val.replace(/[^a-zA-Z0-9 ]/g, '');
    clean = clean.substring(0, 20).trim();
    if (!clean) return '';
    return clean.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};