export interface PersonRelationship {
  relatedPersonId: string;
  type: string;
}

export interface EducationEntry {
  schoolName: string;
  startDate: string;
  endDate: string;
  isGraduated: boolean;
  degree: string;
  major: string;
}

export interface JobEntry {
  jobTitle: string;
  companyName: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description?: string;
  location?: AddressData;
}

// [ZEN] Rich Timeline Data for "The Navigator"
export interface LifeFact {
  id: string;
  type: 'occupation' | 'residence' | 'education' | 'religion' | 'military' | 'generic' | 'vital';
  date?: string;         // "1980", "1980-1990", "Sep 28, 1967"
  place?: string;        // "Falls Church, VA"
  value: string;         // "Teacher", "123 Main St", "Catholic"
  description?: string;  // "Taught 3rd Grade"
  source?: string;       // "GEDCOM Import", "User"
  confidence?: 'high' | 'low'; // For Navigator suggestions
}

export interface AddressData {
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry?: string;
  coordinates?: { lat: number; lng: number };
}

export interface ChassisBiometrics {
  height: string;
  weight: string;
  breastSize: string;
  groolCapacity: string;
  prm: string;
  fluidCapacitance: string;
  hairColor: string;
  eyeColor: string;
  eyePlacement: string;
  nosePlacement: string;
  mouthPlacement: string;
  jawline: string;
  limbLength: string;
  torsoLength: string;
  headSize: string;
  hairStyle?: string;
  hairLength?: string;
  skinTone?: string;
  chassisModelUrl?: string;
}

export const DEFAULT_CHASSIS_BIOMETRICS: ChassisBiometrics = {
  height: "1.72",
  weight: "58",
  breastSize: "34D",
  groolCapacity: "High",
  prm: "Optimal",
  fluidCapacitance: "94%",
  hairColor: "#E2C98A",
  eyeColor: "Hazel",
  eyePlacement: "50",
  nosePlacement: "50",
  mouthPlacement: "50",
  jawline: "50",
  limbLength: "50",
  torsoLength: "50",
  headSize: "50",
  hairStyle: "Bob",
  hairLength: "50",
  skinTone: "#f1c27d",
  chassisModelUrl: "/Rio.glb"
};

export interface PersonMetadata {
  isProvisional?: boolean; // [ZEN] Flags for Deck Sweeper triage
  potentialMatchId?: string;
  potentialMatchName?: string;
  matchConfidence?: number;
  matchReasoning?: string;
  status?: string;
  givenName?: string;
  familyName?: string;
  additionalName?: string;
  honorificPrefix?: string;
  honorificSuffix?: string;
  suffix?: string;
  alternateName?: string;
  displayName?: string; // [ZEN] User-defined gallery name (e.g. "Lizzie")

  dates?: { 
    birth: string; 
    birthPrecision?: 'exact' | 'day' | 'month' | 'year';
    death?: string;
    deathPrecision?: 'exact' | 'day' | 'month' | 'year';
  };
  birthPlace?: string;
  deathPlace?: string;
  isDeceased?: boolean;
  gender?: string;

  // [ZEN] Life Story / The Navigator Data
  facts?: LifeFact[]; // Structured timeline events (Occupations, Residences, etc.)

  // [ZEN] Narrative Quarantine
  external_notes?: Array<{
    text: string;
    source: string;
    date?: string;
  }>;

  jobTitle?: string;
  worksFor?: string;
  workLocation?: AddressData;
  primaryJobDescription?: string;
  primaryJobStartDate?: string;
  primaryJobEndDate?: string;
  pastJobs?: JobEntry[];
  alumniOf?: EducationEntry[];

  emails?: Array<string>;
  telephone?: Array<string>;
  socials?: Array<{ platform: string; handle: string; url: string }>;
  sameAs?: Array<string>;
  url?: string;

  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
    coordinates?: { lat: number; lng: number };
  };
  locations?: Array<{ label: string; address: string; isCurrent: boolean }>;
  homeLocationId?: string; // Primary residence PlaceTag

  mapZoom?: number;
  relationships?: PersonRelationship[];
  howWeMet?: string;
  researchNotes?: string;
  knowsAbout?: Array<string>;
  contacts?: Array<{ type: 'mobile' | 'home' | 'work'; value: string }>;
  // [ZEN EWO 001] faceDescriptor removed - migrated to Azure Vision cloud
  
  // [ZEN] Fictional Chassis Biometrics for 3D Scanner Two-Way Sync
  biometrics?: ChassisBiometrics;
  
  // [ZEN] Simulacrum Gateway Configuration
  simulacrumTraits?: {
    systemDirective?: string;
    tone?: string;
    coreAxioms?: string;
    coreMemory?: string;
    amendments?: string[];
    lengthLevel?: number;
    affectLevel?: number;
    sessionState?: string;
  };
}

export interface PetMetadata {
  species: string;
  breed?: string;
  dates: { 
    birth?: string; 
    birthPrecision?: 'exact' | 'day' | 'month' | 'year';
    adoption: string; 
    adoptionPrecision?: 'exact' | 'day' | 'month' | 'year';
    death?: string; 
    deathPrecision?: 'exact' | 'day' | 'month' | 'year';
  };
  isDeceased?: boolean;
  medical: { vetName: string; conditions: string[] };
  documents: Array<{ label: string; url: string }>;
}

export interface ThingMetadata {
  acquisition: { date: string; cost: number; sourceTagId: string };
  status: { currentVal: number; condition: string; locationTagId: string };
  purpose: string;
  isDestroyed?: boolean;
}

export interface PlaceMetadata {
  address: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
    coordinates?: { lat: number; lng: number };
  } | string;

  significance: string;
  coordinates?: { lat: number; lng: number };
  placeType?: string;
  dates?: { 
    firstVisit?: string; 
    firstVisitPrecision?: 'exact' | 'day' | 'month' | 'year';
    lastVisit?: string; 
    lastVisitPrecision?: 'exact' | 'day' | 'month' | 'year';
    foundedDate?: string;     // [ZEN] Historical Establishment
    dissolvedDate?: string;   // [ZEN] Abandoned/Renamed/Destroyed
  };
  
  isLost?: boolean;           // [ZEN] Broader than demolished, covers ghost towns/relocations
  isGhostLocation?: boolean;  // [ZEN] For visual badging in archive
  isDemolished?: boolean;
  isSovereignPoint?: boolean; // [ZEN] Coordinates are manually pinned, skip geocoding sync
  
  // [ZEN] Public Memorial / Heritage Roadmap
  urlSlug?: string;           // Custom URL for memorial site
  isPublicMemorial?: boolean;
  allowCommunityArtifacts?: boolean;
  transformationHistory?: string; // [ZEN] GIGI's "Teaching Moment" notes
  
  mapZoom?: number;

  telephone?: string;
  email?: string;
  url?: string;
  socials?: string[];
}

export interface EventTagMetadata { }

export interface ConceptMetadata {
  flavor: string;              // Presets or user-created strings
  startDate?: string;          // Origin / Formation Date
  endDate?: string;            // Demise / Dissolution Date
  cradlePlaceString?: string;  // Cradle / Place of Origin
  parentConceptId?: string;    // Precursors / Parent Concepts (hierarchy)
}

export interface CommsMetadata {
  source: 'facebook' | 'messenger' | 'sms' | 'email' | 'whatsapp' | 'other';
  participants: string[]; // Tag IDs of people in the thread
  lastInteractionAt: any;
  platformThreadId?: string;
  totalMessages?: number;
}

export interface ContextMetadata {
  usageCount?: number;
  isSystem?: boolean;
}



interface BaseTag {
  id: string;
  userId?: string; // [ZEN] Required for Search Indexing
  name: string;
  mainImageId?: string;
  mediaGallery: Array<{
    type: 'image' | 'video' | 'document' | 'url';
    url: string;
    caption: string;
    // [ZEN] GEDCOM Hydration Fields
    date?: string;       // "1973"
    placeString?: string; // "Lorton, VA"
    placeTagId?: string;
    originalTitle?: string; // For fuzzy matching (e.g. "Eric - age 5")
    isExternalReference?: boolean; // If true, opens in new tab (Ancestry URL)
  }>;
  description: string;
  privateNotes: string;
  aiDirective?: string; // [ZEN] Replaces MneTag. Universal Context Infusion Directive
  compiledContext?: string; // [ZEN] Pre-compiled JSON/Text payload for instant LLM infusion
  isPrivate: boolean;
  tagIds: Array<string>;
  mediaIds: string[];
  keywords?: string[];
  // [ZEN V32] Vantablack Shutter Protocol
  exposure_mode?: 'white' | 'grey' | 'black'; // white=Open, grey=Passive, black=Vantablack (Hidden from Creative)
  
  // [CREATIVE ENGINE] Quantum Multiverse sandboxing coordinates
  isFiction?: boolean;
  isVariant?: boolean;
  anchorTagId?: string;
  universeIds?: string[];
  pendingInferences?: string;
  inferences?: string;
  inferredMediaCount?: number;
  inferencesLastUpdated?: string;

  // [ZEN] EmoDB Tensor Mapping (Gestures & Expressions)
  tensorMap?: Record<string, string[]>;
}

export type PersonTag = BaseTag & { type: 'person'; metadata: PersonMetadata; };
export type PetTag = BaseTag & { type: 'pet'; metadata: PetMetadata; };
export type ThingTag = BaseTag & { type: 'thing'; metadata: ThingMetadata; };
export type PlaceTag = BaseTag & { type: 'place'; metadata: PlaceMetadata; };
export type EventTag = BaseTag & { type: 'event'; metadata: EventTagMetadata; };
export type ConceptTag = BaseTag & { type: 'concept'; metadata: ConceptMetadata; };
export type CommsTag = BaseTag & { type: 'comms'; metadata: CommsMetadata; };
export type ContextTag = BaseTag & { type: 'context'; metadata: ContextMetadata; };
export type UnknownTag = BaseTag & { type: 'unknown'; metadata: Record<string, any>; };

export type Tag = PersonTag | PetTag | ThingTag | PlaceTag | EventTag | ConceptTag | CommsTag | ContextTag | UnknownTag;