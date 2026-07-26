
export interface GedcomDatePlace {
    date?: string;
    place?: string;
    source?: string;
}

export interface GedcomMediaRef {
    id: string; // The @O123@ ID
    url: string; // The raw URL often in FORM jpg or FILE tag
    title: string;
    date?: string;
    place?: string;
    isExternal: boolean; // True if it's a webpage not an image
    mimeType?: string;
}

export interface GedcomEvent {
    type: 'BIRT' | 'DEAT' | 'MARR' | 'CENS' | 'EVEN' | string;
    date?: string;
    place?: string;
    description?: string; // Standard description
    notes?: string[];     // Quarantined notes for this event
    rawDate?: string;     // For preservation
}

export interface GedcomNote {
    text: string;
    sourceId?: string; // @S123@ reference usually
    isQuarantined: boolean; // Always true for Narrative Hygiene
}

export interface GedcomPerson {
    id: string; // @I123@
    name: {
        given: string;
        surname: string;
        full: string;
    };
    sex: 'M' | 'F' | 'U';

    events: GedcomEvent[];
    media: GedcomMediaRef[];
    notes: GedcomNote[]; // Narrative Quarantine
    raw?: string; // [ZEN] Original GEDCOM block for AI Parsing

    // Graph Links
    spouseFamilyIds: string[]; // @F456@ (Where I am parent)
    parentFamilyIds: string[]; // @F789@ (Where I am child)
}

export interface GedcomFamily {
    id: string;
    husbandId?: string;
    wifeId?: string;
    childrenIds: string[];
    events: GedcomEvent[]; // Marriage events
}

export interface GedcomData {
    people: Record<string, GedcomPerson>;
    families: Record<string, GedcomFamily>;
    media: Record<string, GedcomMediaRef>;
    metadata: {
        submitter: string;
        gedcomVersion: string;
    };
}
