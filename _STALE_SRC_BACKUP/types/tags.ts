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

export interface AddressData {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry?: string;
    coordinates?: { lat: number; lng: number };
}

export interface PersonMetadata {
  givenName?: string;
  familyName?: string;
  additionalName?: string;
  honorificPrefix?: string;
  honorificSuffix?: string; 
  suffix?: string;
  alternateName?: string;
  
  dates: { birth: string; death?: string };
  isDeceased?: boolean; 
  gender: string; 
  
  jobTitle?: string;
  worksFor?: string; 
  alumniOf?: EducationEntry[]; 
  
  emails: Array<string>;
  telephone?: Array<string>; 
  socials: Array<{ platform: string; handle: string; url: string }>;
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
  locations: Array<{ label: string; address: string; isCurrent: boolean }>; 

  mapZoom?: number;
  relationships: PersonRelationship[];
  howWeMet?: string;
  knowsAbout?: Array<string>; 
  contacts: Array<{ type: 'mobile' | 'home' | 'work'; value: string }>;

  faceDescriptor?: Record<string, number>; 
}

export interface PetMetadata {
  species: string;
  breed?: string;
  dates: { birth?: string; adoption: string; death?: string };
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
  dates?: { firstVisit?: string; lastVisit?: string };
  isDemolished?: boolean; 
  mapZoom?: number;
  
  telephone?: string;
  email?: string;
  url?: string;
  socials?: string[];
}

export interface EventTagMetadata {}

export interface ContextMetadata {
    usageCount?: number;
    isSystem?: boolean; 
}

interface BaseTag {
  id: string;
  name: string;
  mainImageId?: string; 
  mediaGallery: Array<{ type: 'image' | 'video' | 'document' | 'url'; url: string; caption: string }>;
  description: string;
  privateNotes: string;
  isPrivate: boolean;
  tagIds: Array<string>;
  mediaIds: string[];
  keywords?: string[]; 
}

export type PersonTag = BaseTag & { type: 'person'; metadata: PersonMetadata; };
export type PetTag = BaseTag & { type: 'pet'; metadata: PetMetadata; };
export type ThingTag = BaseTag & { type: 'thing'; metadata: ThingMetadata; };
export type PlaceTag = BaseTag & { type: 'place'; metadata: PlaceMetadata; };
export type EventTag = BaseTag & { type: 'event'; metadata: EventTagMetadata; };
export type ContextTag = BaseTag & { type: 'context'; metadata: ContextMetadata; };
export type UnknownTag = BaseTag & { type: 'unknown'; metadata: Record<string, any>; };

export type Tag = PersonTag | PetTag | ThingTag | PlaceTag | EventTag | ContextTag | UnknownTag;