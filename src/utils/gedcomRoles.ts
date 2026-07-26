// [ZEN] GEDCOM 7.0 / 5.5.1 Compliant Relationship Definitions
// Source: https://gedcom.io/specifications/FamilySearchGEDCOM7.pdf

export interface RelaRole {
    label: string;       // User-facing label (e.g. "Maternal Grandmother")
    value: string;       // Stored value (e.g. "Maternal Grandmother" or "MAT_GR_MOTHER" if we went strict)
    // NOTE: Project GIGI currently stores valid English strings as the 'type'.
    category: 'Immediate' | 'Extended' | 'Step' | 'Half' | 'In-Law' | 'Professional' | 'Deep Ancestry' | 'Deep Descendants' | 'Adopted' | 'Other';
    gedcomTag?: string;  // PEDI or RELA tag for export
}

export const GEDCOM_ROLES: RelaRole[] = [
    // --- IMMEDIATE FAMILY (Nuclear) ---
    { label: "Mother", value: "Mother", category: "Immediate", gedcomTag: "birth" },
    { label: "Father", value: "Father", category: "Immediate", gedcomTag: "birth" },
    { label: "Parent", value: "Parent", category: "Immediate", gedcomTag: "birth" }, // Generic
    { label: "Daughter", value: "Daughter", category: "Immediate", gedcomTag: "birth" },
    { label: "Son", value: "Son", category: "Immediate", gedcomTag: "birth" },
    { label: "Child", value: "Child", category: "Immediate", gedcomTag: "birth" }, // Generic
    { label: "Sister", value: "Sister", category: "Immediate" },
    { label: "Brother", value: "Brother", category: "Immediate" },
    { label: "Sibling", value: "Sibling", category: "Immediate" },

    // --- SPOUSES / PARTNERS (Union) ---
    { label: "Wife", value: "Wife", category: "Immediate", gedcomTag: "MARR" },
    { label: "Husband", value: "Husband", category: "Immediate", gedcomTag: "MARR" },
    { label: "Spouse", value: "Spouse", category: "Immediate", gedcomTag: "MARR" },
    { label: "Partner", value: "Partner", category: "Immediate", gedcomTag: "PARTNERSHIP" },
    { label: "Fiancé", value: "Fiancé", category: "Immediate", gedcomTag: "MARR_ENG" },
    { label: "Fiancée", value: "Fiancée", category: "Immediate", gedcomTag: "MARR_ENG" },

    // --- GRANDPARENTS (Lineal 2-3) ---
    { label: "Grandmother", value: "Grandmother", category: "Extended" },
    { label: "Grandfather", value: "Grandfather", category: "Extended" },
    { label: "Maternal Grandmother", value: "Maternal Grandmother", category: "Extended" },
    { label: "Maternal Grandfather", value: "Maternal Grandfather", category: "Extended" },
    { label: "Paternal Grandmother", value: "Paternal Grandmother", category: "Extended" },
    { label: "Paternal Grandfather", value: "Paternal Grandfather", category: "Extended" },
    { label: "Great-Grandmother", value: "Great-Grandmother", category: "Extended" },
    { label: "Great-Grandfather", value: "Great-Grandfather", category: "Extended" },

    // --- DEEP ANCESTRY (Lineal Ancestors 4+) ---
    { label: "Great-Great-Grandmother", value: "Great-Great-Grandmother", category: "Deep Ancestry" },
    { label: "Great-Great-Grandfather", value: "Great-Great-Grandfather", category: "Deep Ancestry" },
    { label: "3rd Great-Grandmother", value: "3rd Great-Grandmother", category: "Deep Ancestry" },
    { label: "3rd Great-Grandfather", value: "3rd Great-Grandfather", category: "Deep Ancestry" },
    { label: "4th Great-Grandmother", value: "4th Great-Grandmother", category: "Deep Ancestry" },
    { label: "4th Great-Grandfather", value: "4th Great-Grandfather", category: "Deep Ancestry" },
    { label: "5th Great-Grandmother", value: "5th Great-Grandmother", category: "Deep Ancestry" },
    { label: "5th Great-Grandfather", value: "5th Great-Grandfather", category: "Deep Ancestry" },
    { label: "Ancestor", value: "Ancestor", category: "Deep Ancestry", gedcomTag: "ANCI" },

    // --- GRANDCHILDREN (Lineal Descendants 2-3) ---
    { label: "Granddaughter", value: "Granddaughter", category: "Extended" },
    { label: "Grandson", value: "Grandson", category: "Extended" },
    { label: "Great-Granddaughter", value: "Great-Granddaughter", category: "Extended" },
    { label: "Great-Grandson", value: "Great-Grandson", category: "Extended" },

    // [ZEN] Missing Step-Great-Niece/Nephew
    { label: "Step-Great-Niece", value: "Step-Great-Niece", category: "Step" },
    { label: "Step-Great-Nephew", value: "Step-Great-Nephew", category: "Step" },

    // --- DEEP DESCENDANTS (Lineal Descendants 4+) ---
    { label: "Great-Great-Granddaughter", value: "Great-Great-Granddaughter", category: "Deep Descendants" },
    { label: "Great-Great-Grandson", value: "Great-Great-Grandson", category: "Deep Descendants" },
    { label: "3rd Great-Granddaughter", value: "3rd Great-Granddaughter", category: "Deep Descendants" },
    { label: "3rd Great-Grandson", value: "3rd Great-Grandson", category: "Deep Descendants" },
    { label: "4th Great-Granddaughter", value: "4th Great-Granddaughter", category: "Deep Descendants" },
    { label: "4th Great-Grandson", value: "4th Great-Grandson", category: "Deep Descendants" },
    { label: "5th Great-Granddaughter", value: "5th Great-Granddaughter", category: "Deep Descendants" },
    { label: "5th Great-Grandson", value: "5th Great-Grandson", category: "Deep Descendants" },
    { label: "Descendant", value: "Descendant", category: "Deep Descendants", gedcomTag: "DESI" },

    // --- AUNTS / UNCLES / COUSINS (Collateral) ---
    { label: "Aunt", value: "Aunt", category: "Extended" },
    { label: "Uncle", value: "Uncle", category: "Extended" },
    { label: "Great-Aunt", value: "Great-Aunt", category: "Extended" },
    { label: "Great-Uncle", value: "Great-Uncle", category: "Extended" },
    { label: "Great-Great-Aunt", value: "Great-Great-Aunt", category: "Extended" },
    { label: "Great-Great-Uncle", value: "Great-Great-Uncle", category: "Extended" },
    { label: "Niece", value: "Niece", category: "Extended" },
    { label: "Nephew", value: "Nephew", category: "Extended" },
    { label: "Great-Niece", value: "Great-Niece", category: "Extended" },
    { label: "Great-Nephew", value: "Great-Nephew", category: "Extended" },
    { label: "Great-Great-Niece", value: "Great-Great-Niece", category: "Extended" },
    { label: "Great-Great-Nephew", value: "Great-Great-Nephew", category: "Extended" },
    { label: "Cousin", value: "Cousin", category: "Extended" },

    // --- STEP FAMILY ---
    { label: "Step-Mother", value: "Step-Mother", category: "Step", gedcomTag: "step" },
    { label: "Step-Father", value: "Step-Father", category: "Step", gedcomTag: "step" },
    { label: "Step-Daughter", value: "Step-Daughter", category: "Step", gedcomTag: "step" },
    { label: "Step-Son", value: "Step-Son", category: "Step", gedcomTag: "step" },
    { label: "Step-Sister", value: "Step-Sister", category: "Step" },
    { label: "Step-Brother", value: "Step-Brother", category: "Step" },
    { label: "Step-Aunt", value: "Step-Aunt", category: "Step" },
    { label: "Step-Uncle", value: "Step-Uncle", category: "Step" },
    { label: "Step-Niece", value: "Step-Niece", category: "Step" },
    { label: "Step-Nephew", value: "Step-Nephew", category: "Step" },
    { label: "Step-Grandmother", value: "Step-Grandmother", category: "Step" },
    { label: "Step-Grandfather", value: "Step-Grandfather", category: "Step" },
    { label: "Step-Granddaughter", value: "Step-Granddaughter", category: "Step" },
    { label: "Step-Grandson", value: "Step-Grandson", category: "Step" },
    { label: "Step-Great-Grandmother", value: "Step-Great-Grandmother", category: "Step" },
    { label: "Step-Great-Grandfather", value: "Step-Great-Grandfather", category: "Step" },
    { label: "Step-Great-Granddaughter", value: "Step-Great-Granddaughter", category: "Step" },
    { label: "Step-Great-Grandson", value: "Step-Great-Grandson", category: "Step" },

    // --- HALF SIBLINGS ---
    { label: "Half-Sister", value: "Half-Sister", category: "Half" },
    { label: "Half-Brother", value: "Half-Brother", category: "Half" },
    { label: "Half-Sibling", value: "Half-Sibling", category: "Half" },

    // --- IN-LAWS ---
    { label: "Mother-in-law", value: "Mother-in-law", category: "In-Law" },
    { label: "Father-in-law", value: "Father-in-law", category: "In-Law" },
    { label: "Daughter-in-law", value: "Daughter-in-law", category: "In-Law" },
    { label: "Son-in-law", value: "Son-in-law", category: "In-Law" },
    { label: "Sister-in-law", value: "Sister-in-law", category: "In-Law" },
    { label: "Brother-in-law", value: "Brother-in-law", category: "In-Law" },

    // --- EXTENDED IN-LAWS ---
    { label: "Grandmother-in-law", value: "Grandmother-in-law", category: "In-Law" },
    { label: "Grandfather-in-law", value: "Grandfather-in-law", category: "In-Law" },
    { label: "Granddaughter-in-law", value: "Granddaughter-in-law", category: "In-Law" },
    { label: "Grandson-in-law", value: "Grandson-in-law", category: "In-Law" },
    { label: "Step-Grandmother-in-law", value: "Step-Grandmother-in-law", category: "In-Law" },
    { label: "Step-Grandfather-in-law", value: "Step-Grandfather-in-law", category: "In-Law" },
    { label: "Step-Granddaughter-in-law", value: "Step-Granddaughter-in-law", category: "In-Law" },
    { label: "Step-Grandson-in-law", value: "Step-Grandson-in-law", category: "In-Law" },
    // Specific Complex Affines
    { label: "Granddaughter's Mother-in-law", value: "Granddaughter's Mother-in-law", category: "In-Law", gedcomTag: "RELA" },
    { label: "Grandson's Mother-in-law", value: "Grandson's Mother-in-law", category: "In-Law", gedcomTag: "RELA" },
    { label: "Granddaughter's Father-in-law", value: "Granddaughter's Father-in-law", category: "In-Law", gedcomTag: "RELA" },
    { label: "Grandson's Father-in-law", value: "Grandson's Father-in-law", category: "In-Law", gedcomTag: "RELA" },

    // [ZEN] User Riddle Solvers (Parents of Grandchild-in-laws)
    { label: "Grandson-in-law's Mother", value: "Grandson-in-law's Mother", category: "In-Law", gedcomTag: "RELA" },
    { label: "Grandson-in-law's Father", value: "Grandson-in-law's Father", category: "In-Law", gedcomTag: "RELA" },
    { label: "Granddaughter-in-law's Mother", value: "Granddaughter-in-law's Mother", category: "In-Law", gedcomTag: "RELA" },
    { label: "Granddaughter-in-law's Father", value: "Granddaughter-in-law's Father", category: "In-Law", gedcomTag: "RELA" },

    // [ZEN] Inverse Complex In-Laws
    { label: "Son's Grandmother-in-law", value: "Son's Grandmother-in-law", category: "In-Law", gedcomTag: "RELA" },
    { label: "Son's Grandfather-in-law", value: "Son's Grandfather-in-law", category: "In-Law", gedcomTag: "RELA" },
    { label: "Daughter's Grandmother-in-law", value: "Daughter's Grandmother-in-law", category: "In-Law", gedcomTag: "RELA" },
    { label: "Daughter's Grandfather-in-law", value: "Daughter's Grandfather-in-law", category: "In-Law", gedcomTag: "RELA" },

    { label: "Co-Parent-in-law", value: "Co-Parent-in-law", category: "In-Law", gedcomTag: "RELA" }, // Child's Spouse's Parent

    // --- ADOPTED FAMILY ---
    // Adopted Immediate
    { label: "Adopted Mother", value: "Adopted Mother", category: "Adopted", gedcomTag: "adopted" },
    { label: "Adopted Father", value: "Adopted Father", category: "Adopted", gedcomTag: "adopted" },
    { label: "Adopted Daughter", value: "Adopted Daughter", category: "Adopted", gedcomTag: "adopted" },
    { label: "Adopted Son", value: "Adopted Son", category: "Adopted", gedcomTag: "adopted" },
    { label: "Adopted Sister", value: "Adopted Sister", category: "Adopted", gedcomTag: "adopted" },
    { label: "Adopted Brother", value: "Adopted Brother", category: "Adopted", gedcomTag: "adopted" },

    // Adopted Grand/Greats
    { label: "Adopted Grandmother", value: "Adopted Grandmother", category: "Adopted" },
    { label: "Adopted Grandfather", value: "Adopted Grandfather", category: "Adopted" },
    { label: "Adopted Granddaughter", value: "Adopted Granddaughter", category: "Adopted" },
    { label: "Adopted Grandson", value: "Adopted Grandson", category: "Adopted" },
    { label: "Adopted Great-Grandmother", value: "Adopted Great-Grandmother", category: "Adopted" },
    { label: "Adopted Great-Grandfather", value: "Adopted Great-Grandfather", category: "Adopted" },

    // Adopted Collateral
    { label: "Adopted Aunt", value: "Adopted Aunt", category: "Adopted" },
    { label: "Adopted Uncle", value: "Adopted Uncle", category: "Adopted" },
    { label: "Adopted Niece", value: "Adopted Niece", category: "Adopted" },
    { label: "Adopted Nephew", value: "Adopted Nephew", category: "Adopted" },
    { label: "Adopted Cousin", value: "Adopted Cousin", category: "Adopted" },

    // Adopted In-Laws
    { label: "Adopted Mother-in-law", value: "Adopted Mother-in-law", category: "Adopted", gedcomTag: "In-Law" },
    { label: "Adopted Father-in-law", value: "Adopted Father-in-law", category: "Adopted", gedcomTag: "In-Law" },
    { label: "Adopted Daughter-in-law", value: "Adopted Daughter-in-law", category: "Adopted", gedcomTag: "In-Law" },
    { label: "Adopted Son-in-law", value: "Adopted Son-in-law", category: "Adopted", gedcomTag: "In-Law" },
    { label: "Adopted Sister-in-law", value: "Adopted Sister-in-law", category: "Adopted", gedcomTag: "In-Law" },
    { label: "Adopted Brother-in-law", value: "Adopted Brother-in-law", category: "Adopted", gedcomTag: "In-Law" },

    // --- OTHER / NON-BIOLOGICAL ---
    { label: "Foster Daughter", value: "Foster Daughter", category: "Other", gedcomTag: "foster" },
    { label: "Foster Son", value: "Foster Son", category: "Other", gedcomTag: "foster" },
    { label: "Godmother", value: "Godmother", category: "Other", gedcomTag: "godparent" },
    { label: "Godfather", value: "Godfather", category: "Other", gedcomTag: "godparent" },
    { label: "Godchild", value: "Godchild", category: "Other", gedcomTag: "godparent" },
    { label: "Guardian", value: "Guardian", category: "Other", gedcomTag: "guardian" },
    { label: "Ward", value: "Ward", category: "Other", gedcomTag: "guardian" },

    // --- NON-LINEAL ---
    { label: "Friend", value: "Friend", category: "Other", gedcomTag: "RELA" },
    { label: "Neighbor", value: "Neighbor", category: "Other", gedcomTag: "RELA" },
    { label: "Coworker", value: "Coworker", category: "Other", gedcomTag: "RELA" },

    // --- EX-FAMILY (Divorced/Terminated) ---
    { label: "Ex-Wife", value: "Ex-Wife", category: "Other", gedcomTag: "DIV" },
    { label: "Ex-Husband", value: "Ex-Husband", category: "Other", gedcomTag: "DIV" },
    { label: "Ex-Spouse", value: "Ex-Spouse", category: "Other", gedcomTag: "DIV" },
    { label: "Ex-Partner", value: "Ex-Partner", category: "Other", gedcomTag: "PARTNERSHIP" },
    { label: "Ex-Fiancé", value: "Ex-Fiancé", category: "Other", gedcomTag: "MARR_ENG" },
    { label: "Ex-Fiancée", value: "Ex-Fiancée", category: "Other", gedcomTag: "MARR_ENG" },
    { label: "Ex-Boyfriend", value: "Ex-Boyfriend", category: "Other", gedcomTag: "RELA" },
    { label: "Ex-Girlfriend", value: "Ex-Girlfriend", category: "Other", gedcomTag: "RELA" },

    // Ex-Steps
    { label: "Ex-Step-Mother", value: "Ex-Step-Mother", category: "Other", gedcomTag: "step" },
    { label: "Ex-Step-Father", value: "Ex-Step-Father", category: "Other", gedcomTag: "step" },
    { label: "Ex-Step-Sister", value: "Ex-Step-Sister", category: "Other", gedcomTag: "step" },
    { label: "Ex-Step-Brother", value: "Ex-Step-Brother", category: "Other", gedcomTag: "step" },
    { label: "Ex-Step-Daughter", value: "Ex-Step-Daughter", category: "Other", gedcomTag: "step" },
    { label: "Ex-Step-Son", value: "Ex-Step-Son", category: "Other", gedcomTag: "step" },

    // Ex-In-Laws
    { label: "Ex-Daughter-in-law", value: "Ex-Daughter-in-law", category: "Other", gedcomTag: "In-Law" },
    { label: "Ex-Son-in-law", value: "Ex-Son-in-law", category: "Other", gedcomTag: "In-Law" },
    { label: "Ex-Mother-in-law", value: "Ex-Mother-in-law", category: "Other", gedcomTag: "In-Law" },
    { label: "Ex-Father-in-law", value: "Ex-Father-in-law", category: "Other", gedcomTag: "In-Law" },
    { label: "Ex-Granddaughter-in-law", value: "Ex-Granddaughter-in-law", category: "Other", gedcomTag: "In-Law" },
    { label: "Ex-Grandson-in-law", value: "Ex-Grandson-in-law", category: "Other", gedcomTag: "In-Law" },
    { label: "Ex-Sister-in-law", value: "Ex-Sister-in-law", category: "Other", gedcomTag: "In-Law" },
    { label: "Ex-Brother-in-law", value: "Ex-Brother-in-law", category: "Other", gedcomTag: "In-Law" },

    // Co-In-Laws (Relationship between parents of a married couple)
    { label: "Co-Father-in-law", value: "Co-Father-in-law", category: "In-Law", gedcomTag: "In-Law" },
    { label: "Co-Mother-in-law", value: "Co-Mother-in-law", category: "In-Law", gedcomTag: "In-Law" },
    { label: "Co-Parent-in-law", value: "Co-Parent-in-law", category: "In-Law", gedcomTag: "In-Law" },
];

// Helper to get grouped options
export const getGroupedRoles = () => {
    const groups: Record<string, RelaRole[]> = {
        "Immediate Family": [],
        "Extended Family": [],
        "Adopted Family": [],
        "Step Family": [],
        "Half-Siblings": [],
        "Deep Ancestry": [],
        "Deep Descendants": [],
        "In-Laws": [],
        "Ex-Family": [],
        "Other": []
    };

    GEDCOM_ROLES.forEach(role => {
        if (role.category === 'Immediate') groups["Immediate Family"].push(role);
        else if (role.category === 'Extended') groups["Extended Family"].push(role);
        else if (role.category === 'Deep Ancestry') groups["Deep Ancestry"].push(role);
        else if (role.category === 'Deep Descendants') groups["Deep Descendants"].push(role);
        else if (role.category === 'Step') groups["Step Family"].push(role);
        else if (role.category === 'Half') groups["Half-Siblings"].push(role);
        else if (role.category === 'Adopted') groups["Adopted Family"].push(role);
        else if (role.category === 'In-Law') groups["In-Laws"].push(role);
        else if (role.label.startsWith('Ex-')) groups["Ex-Family"].push(role);
        else groups["Other"].push(role);
    });

    return groups;
};

// [ZEN] Normalization Map for Legacy Data
// Maps common variations/lowercase to Canonical GEDCOM Label
const ROLE_SYNONYMS: Record<string, string> = {
    "mom": "Mother", "mum": "Mother", "mama": "Mother", "mother": "Mother",
    "dad": "Father", "papa": "Father", "daddy": "Father", "father": "Father",
    "bro": "Brother", "brother": "Brother",
    "sis": "Sister", "sister": "Sister",
    "grandma": "Grandmother", "nana": "Grandmother", "grammy": "Grandmother",
    "grandpa": "Grandfather", "gramps": "Grandfather",
    "son": "Son",
    "daughter": "Daughter",
    "wife": "Wife", "wifey": "Wife",
    "husband": "Husband", "hubby": "Husband",
    "spouse": "Spouse",
    "partner": "Partner",
    "friend": "Friend",
    "best friend": "Friend"
};

export const normalizeRole = (rawItem: string): string | null => {
    if (!rawItem) return null;
    const lower = rawItem.toLowerCase().trim();

    // 1. Direct Synonym Lookup
    if (ROLE_SYNONYMS[lower]) return ROLE_SYNONYMS[lower];

    // 2. Case Insensitive Match against Official Roles
    const exactMatch = GEDCOM_ROLES.find(r => r.label.toLowerCase() === lower);
    if (exactMatch) return exactMatch.label;

    // 3. No match found (Unknown/Custom)
    return null;
};

// [ZEN] Helper to check if a specific role (e.g. "Half-Brother") matches a generic heuristic (e.g. "Brother")
export const isRoleCompatible = (heuristicRole: string, actualRole: string): boolean => {
    const h = heuristicRole.toLowerCase();
    const a = actualRole.toLowerCase();

    if (h === a) return true;

    // [ZEN] Global "Ex-" Compatibility
    // If logic suggests "Wife" but user selects "Ex-Wife", that is compatible.
    if (a.startsWith('ex-') && a.replace('ex-', '') === h) return true;

    // Collateral Variations (Aunt/Uncle/Niece/Nephew)
    if (h === 'aunt' && (a === 'step-aunt' || a === 'great-aunt' || a === 'great-great-aunt' || a === 'adopted aunt' || a === 'step-great-aunt')) return true;
    if (h === 'uncle' && (a === 'step-uncle' || a === 'great-uncle' || a === 'great-great-uncle' || a === 'adopted uncle' || a === 'step-great-uncle')) return true;
    if (h === 'niece' && (a === 'step-niece' || a === 'great-niece' || a === 'great-great-niece' || a === 'adopted niece' || a === 'step-great-niece')) return true;
    if (h === 'nephew' && (a === 'step-nephew' || a === 'great-nephew' || a === 'great-great-nephew' || a === 'adopted nephew' || a === 'step-great-nephew')) return true;

    // Sibling Variations
    if (h === 'brother' && (a === 'half-brother' || a === 'step-brother' || a === 'adopted brother')) return true;
    if (h === 'sister' && (a === 'half-sister' || a === 'step-sister' || a === 'adopted sister')) return true;
    if (h === 'sibling' && (a.includes('brother') || a.includes('sister'))) return true;
    // In-Law Variations (General)
    if (h === 'mother-in-law' && (a === 'adopted mother-in-law' || a === 'step-mother-in-law' || a === 'ex-mother-in-law')) return true;
    if (h === 'father-in-law' && (a === 'adopted father-in-law' || a === 'step-father-in-law' || a === 'ex-father-in-law')) return true;
    if (h === 'sister-in-law' && (a === 'adopted sister-in-law' || a === 'step-sister-in-law' || a === 'ex-sister-in-law')) return true;
    if (h === 'brother-in-law' && (a === 'adopted brother-in-law' || a === 'step-brother-in-law' || a === 'ex-brother-in-law')) return true;
    if (h === 'son-in-law' && (a === 'adopted son-in-law' || a === 'step-son-in-law' || a === 'ex-son-in-law')) return true;
    if (h === 'daughter-in-law' && (a === 'adopted daughter-in-law' || a === 'step-daughter-in-law' || a === 'ex-daughter-in-law')) return true;

    // Parent Variations
    if (h === 'father' && (a === 'step-father' || a === 'adopted father')) return true;
    if (h === 'mother' && (a === 'step-mother' || a === 'adopted mother')) return true;

    // Child Variations
    if (h === 'son' && (a === 'step-son' || a === 'adopted son')) return true;
    if (h === 'daughter' && (a === 'step-daughter' || a === 'adopted daughter')) return true;

    // Grandparent Variations
    if (h === 'grandfather' && (a === 'step-grandfather' || a === 'step-grandfather-in-law' || a === 'adopted grandfather')) return true;
    if (h === 'grandmother' && (a === 'step-grandmother' || a === 'step-grandmother-in-law' || a === 'adopted grandmother')) return true;

    // Great-Grandparent Variations
    if (h === 'great-grandfather' && a === 'step-great-grandfather') return true;
    if (h === 'great-grandmother' && a === 'step-great-grandmother') return true;
    if (h.includes('great-grand') && a.includes('step-great-grand')) return true; // Generic catch-all for deeper levels

    // [ZEN] Deep Ancestry Depth Mismatch
    // If logic stops at "Great-Grand...", accept any depth (e.g. Great-Great...)
    if (h.includes('great-grand') && a.includes('great-grand')) return true;

    // Great-Grandchild Variations
    if (h.includes('great-grandson') && a.includes('step-great-grandson')) return true;
    if (h.includes('great-granddaughter') && a.includes('step-great-granddaughter')) return true;

    // Grandchild Variations (In-Law)
    if (h === 'grandson' && (a === 'step-grandson-in-law' || a === 'ex-grandson-in-law')) return true;
    if (h === 'granddaughter' && (a === 'step-granddaughter-in-law' || a === 'ex-granddaughter-in-law')) return true;

    // [ZEN] Riddle Solver Compatibility (Relationship Algebra)
    // Allows "Grandson-in-law's Mother" to match generic descendant/relative suggestions
    // The heuristic gets confused by the generation skip/in-law jump.
    if ((h.includes('daughter') || h.includes('son') || h.includes('grand')) &&
        (a.includes("grandson-in-law's") || a.includes("granddaughter-in-law's"))) {
        return true;
    }

    // [ZEN FIX] Explicit Adopted Grandchildren
    if (h === 'grandson' && a === 'adopted grandson') return true;
    if (h === 'granddaughter' && a === 'adopted granddaughter') return true;

    // [ZEN FIX] Complex Grandchild In-Laws (e.g. Heuristic says 'Grandmother', Reality is 'Son's Grandmother-in-law')
    // This bridges the gap where age/gender suggests 'Grandmother' but the specific tech relationship is an affine one.
    if ((h.includes('grandmother') || h.includes('grandfather')) && (
        a.includes("grandmother-in-law") || a.includes("grandfather-in-law")
    )) {
        return true;
    }

    // [ZEN FIX] Co-In-Law Compatibility (Brother-in-law <-> Co-Father-in-law)
    // Allows fuzzy matching so the Healer doesn't nag users to change correct 'Co-Father' tags back to generic 'Brother-in-law'.
    // e.g. Heuristic suggests "Brother-in-law", Reality is "Co-Father-in-law".
    if ((h.includes('brother-in-law') || h.includes('sister-in-law')) &&
        (a.includes('co-father-in-law') || a.includes('co-mother-in-law') || a.includes('co-parent-in-law'))) {
        return true;
    }

    return false;
};
