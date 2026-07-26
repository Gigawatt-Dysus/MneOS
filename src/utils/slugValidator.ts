export interface SlugValidationResult {
    isValid: boolean;
    error?: string;
    cleanSlug: string;
}

const RESERVED_WORDS = [
    'admin', 'administrator', 'system', 'sysop', 'root', 'support', 'help',
    'gigi', 'projectgigi', 'lifeos', 'mod', 'moderator', 'null', 'undefined',
    'api', 'auth', 'login', 'register', 'dashboard', 'profile'
];

const PROFANITY_WORDS = [
    'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'whore',
    'slut', 'fag', 'nigger', 'nigga', 'spic', 'chink', 'wanker'
];

export const validateSlugSyntax = (dirtySlug: string): SlugValidationResult => {
    if (!dirtySlug) {
        return { isValid: false, error: 'Slug cannot be empty', cleanSlug: '' };
    }

    // [User Constraint Enforcement] Strip all non A-Z and 0-9 to prevent DB injections.
    // Replace multiple spaces or invalid chars with a single dash, and force lowercase.
    let cleanSlug = dirtySlug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // replace non A-Z or numbers with dash
        .replace(/^-+|-+$/g, '');     // trim leading/trailing dashes

    if (cleanSlug.length < 3) {
        return { isValid: false, error: 'Vanity URL must be at least 3 characters long.', cleanSlug };
    }

    if (cleanSlug.length > 30) {
        return { isValid: false, error: 'Vanity URL cannot exceed 30 characters.', cleanSlug };
    }

    // Check reserved blocklist
    for (const word of RESERVED_WORDS) {
        if (cleanSlug === word || cleanSlug.startsWith(`${word}-`) || cleanSlug.endsWith(`-${word}`)) {
            return { isValid: false, error: 'This Vanity URL contains a system-reserved keyword.', cleanSlug };
        }
    }

    // Check profanity blocklist (substring matching)
    for (const word of PROFANITY_WORDS) {
        if (cleanSlug.includes(word)) {
            return { isValid: false, error: 'This Vanity URL violates acceptable content policies.', cleanSlug };
        }
    }

    return { isValid: true, cleanSlug };
};
