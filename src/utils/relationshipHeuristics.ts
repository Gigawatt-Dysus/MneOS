import type { PersonTag, Tag } from '../types';

/**
 * [ZEN] Frontend Port of V7 Heuristic Logic
 * Determines the scientifically corrected relationship between two people.
 * 
 * @param source The PERSON describing the relationship (e.g. "I am Eric")
 * @param target The RELATIVE (e.g. "That is Wyatt")
 * @param rawType The RAW TAG type (e.g. "Father", "Son")
 * @returns 
 *  - type: The corrected relationship type (e.g. "Son")
 *  - confidence: 0-1 (1 = Age Data Confirmed, 0.5 = Heuristic Guess)
 *  - reasoning: Explanation for the user.
 *  - warning: If a conflict was detected and flipped.
 */
import { findRelationshipPath } from './relationshipGraph';

export const getSuggestedRelationship = (source: PersonTag, target: PersonTag, rawType: string, allTags?: Tag[]) => {
    // [ZEN] GRAPH-FIRST APPROACH
    // If we have the full tag database, attempt to find the SCIENTIFC path first.
    if (allTags) {
        const graphType = findRelationshipPath(allTags, source.id, target.id);
        if (graphType) {
            // Map generic graph output to Gendered Terms (e.g. "Grandchild-in-law" -> "Grandson-in-law")
            const genderTarget = target.metadata?.gender?.toLowerCase() || 'unknown';
            let finalType = graphType;

            if (graphType === 'Co-Parent-in-law') {
                if (genderTarget === 'male') finalType = 'Co-Father-in-law';
                if (genderTarget === 'female') finalType = 'Co-Mother-in-law';
            }
            if (graphType === 'Grandchild-in-law') {
                if (genderTarget === 'male') finalType = 'Grandson-in-law';
                if (genderTarget === 'female') finalType = 'Granddaughter-in-law';
            }
            if (graphType === 'Child-in-law') {
                if (genderTarget === 'male') finalType = 'Son-in-law';
                if (genderTarget === 'female') finalType = 'Daughter-in-law';
            }
            if (graphType === 'Spouse') {
                if (genderTarget === 'male') finalType = 'Husband';
                if (genderTarget === 'female') finalType = 'Wife';
            }

            console.log(`[Graph] Path Found: ${graphType} -> ${finalType}`);
            return {
                type: finalType,
                confidence: 1.0,
                reasoning: `Scientifically verifiable path: ${graphType}`,
                warning: undefined
            };
        }
    }

    const type = rawType.toLowerCase().trim();
    const genderSource = source.metadata?.gender?.toLowerCase() || 'unknown';
    const genderTarget = target.metadata?.gender?.toLowerCase() || 'unknown';

    // [ZEN FIX] Robust Date Parser 
    const parseDate = (val: any): number => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        if (val.seconds) return val.seconds * 1000; // Firestore Timestamp
        const d = new Date(val);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const birthSource = parseDate(source.metadata?.dates?.birth);
    const birthTarget = parseDate(target.metadata?.dates?.birth);

    const hasAge = birthSource !== 0 && birthTarget !== 0;
    const isSourceOlder = birthSource < birthTarget;

    // Heuristic: A "Child" is anyone born after 2008
    const isSourceKnownChild = birthSource !== 0 && new Date(birthSource).getFullYear() >= 2010;
    const isTargetKnownChild = birthTarget !== 0 && new Date(birthTarget).getFullYear() >= 2010;

    // --- PARENTAL / GRANDPARENTAL HIERARCHY ---
    const seniorTypes = ['mother', 'father', 'parent', 'mother-in-law', 'father-in-law', 'grandmother', 'grandfather', 'great-grandfather', 'great-grandmother'];
    const juniorTypes = ['son', 'daughter', 'child', 'son-in-law', 'daughter-in-law', 'grandson', 'granddaughter'];

    const isSeniorType = seniorTypes.find(t => type.includes(t));
    const isJuniorType = juniorTypes.find(t => type.includes(t));

    // [ZEN FIX] Explicitly handle "Co-In-Law" (Consuegros) as a PEER relationship.
    // This prevents the hierarchy logic below from seeing "Father-in-law" inside "Co-Father-in-law"
    // and incorrectly forcing an age-based "Son-in-law" reversal.
    // [ZEN FIX] Also handle "Possessive" roles (e.g. "Son's Father-in-law", "Granddaughter's Husband")
    // These define specific paths that should NOT be flattened to direct lineage (like "Grandson").
    if (type.startsWith('co-') || type.includes("'s")) {
        return {
            type: rawType, // Trust the user's specific term
            confidence: 1.0,
            reasoning: type.startsWith('co-') ? "Peer Co-In-Law Relationship" : "Complex Path Relationship",
            warning: undefined
        };
    }

    if (isSeniorType || isJuniorType) {
        let senior = source;
        let junior = target;
        let seniorGender = genderSource;
        let warning = undefined;
        let confidence = 0.5;

        // CASE A: Strict Age Hierarchy (Best)
        if (hasAge) {
            senior = isSourceOlder ? source : target;
            junior = isSourceOlder ? target : source;
            seniorGender = isSourceOlder ? genderSource : genderTarget;
            confidence = 1.0;
        } else {
            // CASE B: Fallback (Missing Ages)
            // If rawType="Father", Target is Senior.
            // If rawType="Son", Source is Senior.

            // [ZEN FIX] Gender Compatibility Flip
            const isRoleFemale = type.includes('mother') || type.includes('grandmother');
            const isRoleMale = type.includes('father') || type.includes('grandfather');

            if (isSeniorType) {
                senior = target;
                junior = source;
                seniorGender = genderTarget;
            } else {
                senior = source;
                junior = target;
                seniorGender = genderSource;
            }



            if (seniorGender !== 'unknown') {
                if ((isRoleFemale && seniorGender === 'male') || (isRoleMale && seniorGender === 'female')) {
                    // FLIP!
                    const temp = senior; senior = junior; junior = temp;
                    seniorGender = (senior === source) ? genderSource : genderTarget;
                    warning = "Gender Mismatch Detected: Auto-Flipped Relationship Direction.";
                    confidence = 0.8;
                }
            }
        }

        // Determine Final Role Label relative to SOURCE
        // If Source is Senior, they are [Parent] of Target.
        // If Source is Junior, they are [Child] of Target.

        const isSourceSenior = (senior.id === source.id);
        let finalRole = "";

        if (isSourceSenior) {
            // Source is Parent/Grandparent
            const juniorGender = (junior.id === source.id) ? genderSource : genderTarget;
            // We need to label the relationship FROM Source TO Target.
            // "Target is my [Child]"
            finalRole = (juniorGender === 'male') ? "Son" : "Daughter";
            if (type.includes('grand') || type.includes('great')) {
                finalRole = (juniorGender === 'male') ? "Grandson" : "Granddaughter";
                if (type.includes('great')) finalRole = "Great-" + finalRole;
                if (type.includes('in-law')) finalRole += "-in-law";
            } else if (type.includes('in-law')) {
                finalRole = (juniorGender === 'male') ? "Son-in-law" : "Daughter-in-law";
            }
        } else {
            // Source is Child/Grandchild
            // "Target is my [Parent]"
            //  const seniorGender = (senior.id === source.id) ? genderSource : genderTarget; // Already set above
            finalRole = (seniorGender === 'male') ? "Father" : "Mother";
            if (type.includes('grand') || type.includes('great')) {
                finalRole = (seniorGender === 'male') ? "Grandfather" : "Grandmother";
                if (type.includes('great')) finalRole = "Great-" + finalRole;
                if (type.includes('in-law')) finalRole += "-in-law";
            } else if (type.includes('in-law')) {
                finalRole = (seniorGender === 'male') ? "Father-in-law" : "Mother-in-law";
            }
        }

        return {
            type: finalRole,
            confidence,
            reasoning: hasAge
                ? `Based on birth years (${isSourceOlder ? source.name : target.name} is older).`
                : "Inferred from relationship type and gender compatibility.",
            warning
        };
    }

    // --- SIBLINGS ---
    if (type.includes('brother') || type.includes('sister') || type.includes('sibling')) {
        let label = (genderTarget === 'male') ? "Brother" : "Sister";
        if (type.includes('in-law')) label += "-in-law";
        return { type: label, confidence: 0.9, reasoning: "Matched sibling gender." };
    }

    // --- PARTNERS ---
    if (['wife', 'husband', 'spouse', 'partner', 'fiance'].some(k => type.includes(k))) {
        let label = type;
        if (genderTarget === 'male') label = "Husband";
        if (genderTarget === 'female') label = "Wife";
        if (type.includes('ex')) label = "Ex-" + label;

        return { type: label, confidence: 0.9, reasoning: "Standard partner match." };
    }

    return { type: rawType, confidence: 0.1, reasoning: "Unknown relationship type." };
};

/**
 * [ZEN] Inverse Relationship Calculator
 * Determines what B is to A, given what A is to B.
 * 
 * Example:
 * If Eric says Leota is "Grandmother":
 * - type = "Grandmother"
 * - targetGender (Eric) = "Male"
 * - Returns: "Grandson"
 */
/**
 * [ZEN] Inverse Relationship Calculator
 * Determines what B is to A, given what A is to B.
 * 
 * Example:
 * If Eric says Leota is "Grandmother":
 * - type = "Grandmother"
 * - targetGender (Eric) = "Male"
 * - Returns: "Grandson"
 */
export const getInverseRelationship = (type: string, targetGender: string): string => {
    const t = type.toLowerCase().trim();
    const g = targetGender?.toLowerCase() || 'unknown';
    const isMale = g === 'male';

    // 1. Extract and preserve prefixes
    let prefix = "";
    let remainder = t;

    // Handle "Step-" (Hyphen or Space)
    // [ZEN] Fix: Regex to catch "step " and "step-"
    const stepRegex = /step[\s-]/gi;
    if (stepRegex.test(remainder)) {
        prefix += "Step-";
        remainder = remainder.replace(stepRegex, '');
    }

    // Handle "Adopted "
    if (remainder.includes('adopted ')) {
        prefix += "Adopted ";
        remainder = remainder.replace('adopted ', '');
    }

    // Handle "Great-" (Recurse to count depth)
    // [ZEN] Standardization: Accept "Great-" and "Great " (space)
    const greatRegex = /great[\s-]/gi;
    const greatCount = (remainder.match(greatRegex) || []).length;

    if (greatCount > 0) {
        prefix += "Great-".repeat(greatCount);
        remainder = remainder.replace(greatRegex, '');
    }

    // Handle "Grand-" (often mixed with Great, but distinct in some roles)
    // If we have "Great-Grand-Uncle", the "Great-" loop handles Greats. "Grand-" remains.
    // [ZEN] Ensure "Grand " is also handled if distinct.

    // Handle "Ex-"
    const exRegex = /ex[\s-]/gi;
    if (exRegex.test(remainder)) {
        prefix += "Ex-";
        remainder = remainder.replace(exRegex, '');
    }

    // Handle "Half-"
    const halfRegex = /half[\s-]/gi;
    if (halfRegex.test(remainder)) {
        prefix += "Half-";
        remainder = remainder.replace(halfRegex, '');
    }

    // 2. Determine Base Inverse
    let baseInverse = "Relative";

    // Grandparents <-> Grandchildren (Check FIRST to avoid substring collisions with 'Mother'/'Son')
    if (remainder.includes('grandmother') || remainder.includes('grandfather') || remainder.includes('grandparent')) {
        if (remainder.includes('in-law')) {
            baseInverse = isMale ? "Grandson-in-law" : "Granddaughter-in-law";
        } else {
            baseInverse = isMale ? "Grandson" : "Granddaughter";
        }
    }
    else if (remainder.includes('grandson') || remainder.includes('granddaughter') || remainder.includes('grandchild')) {
        if (remainder.includes('in-law')) {
            baseInverse = isMale ? "Grandfather-in-law" : "Grandmother-in-law";
        } else {
            baseInverse = isMale ? "Grandfather" : "Grandmother";
        }
    }

    // Parents <-> Children
    else if (remainder.includes('mother') || remainder.includes('father') || remainder.includes('parent')) {
        // If "Mother-in-law", inverse is "Son/Daughter-in-law"
        if (remainder.includes('in-law')) {
            baseInverse = isMale ? "Son-in-law" : "Daughter-in-law";
        } else {
            baseInverse = isMale ? "Son" : "Daughter";
        }
    }
    else if (remainder.includes('son') || remainder.includes('daughter') || remainder.includes('child')) {
        // If "Son-in-law", inverse is "Father/Mother-in-law"
        if (remainder.includes('in-law')) {
            baseInverse = isMale ? "Father-in-law" : "Mother-in-law";
        } else {
            baseInverse = isMale ? "Father" : "Mother";
        }
    }

    // Siblings
    else if (remainder.includes('brother') || remainder.includes('sister') || remainder.includes('sibling')) {
        if (remainder.includes('in-law')) {
            baseInverse = isMale ? "Brother-in-law" : "Sister-in-law";
        } else {
            baseInverse = isMale ? "Brother" : "Sister";
        }
    }

    // Spouses
    else if (remainder.includes('husband')) baseInverse = "Wife";
    else if (remainder.includes('wife')) baseInverse = "Husband";
    else if (remainder.includes('spouse') || remainder.includes('partner')) baseInverse = "Partner";
    else if (remainder.includes('fiancé')) baseInverse = "Fiancée"; // Assuming female target, or generic "Fiancée" if source claims "Fiancé"
    else if (remainder.includes('fiancée')) baseInverse = "Fiancé";

    // [ZEN] Boyfriend/Girlfriend Logic
    // If the Source calls the Target "Girlfriend", the Target calls the Source... whatever the Source's gender is.
    else if (remainder.includes('girlfriend') || remainder.includes('boyfriend')) {
        baseInverse = isMale ? "Boyfriend" : "Girlfriend";
    }

    // Avuncular
    // Avuncular
    else if (remainder.includes('aunt') || remainder.includes('uncle')) {
        baseInverse = isMale ? "Nephew" : "Niece";
        if (remainder.includes('grand') || remainder.includes('great')) {
            baseInverse = "Great-" + baseInverse;
        }
    }
    else if (remainder.includes('niece') || remainder.includes('nephew')) {
        baseInverse = isMale ? "Uncle" : "Aunt";
        if (remainder.includes('grand') || remainder.includes('great')) {
            baseInverse = "Great-" + baseInverse;
        }
    }

    // Cousin
    // Cousin
    else if (remainder.includes('cousin')) {
        // Cousins are symmetric relationships.
        // A is B's "Nth Cousin Kx Removed" <=> B is A's "Nth Cousin Kx Removed"
        // We simply capitalize the user's term to preserve the degree (2nd, 3rd, 5th, etc).
        baseInverse = remainder.split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    // Friendship
    else if (remainder.includes('best friend')) baseInverse = "Best Friend";
    else if (remainder.includes('friend')) baseInverse = "Friend";

    // Fandom
    else if (remainder.includes('fan')) baseInverse = "Idol";
    else if (remainder.includes('idol') || remainder.includes('hero')) baseInverse = "Fan";

    // [ZEN] Edge Case for "Grandson-in-law's Mother" types
    else if (remainder.includes("'s")) {
        return `Relative (via ${t})`; // Too complex to auto-invert safely without deep graph analysis
    }

    // 3. Reassemble
    return prefix + baseInverse;
};
