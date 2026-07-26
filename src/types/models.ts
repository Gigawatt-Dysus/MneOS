import { Settings } from './settings';
import { AddressData } from './tags';

// --- AI ---
export type GigiPersona = string;

export interface AiParams {
  temperature?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repetitionPenalty?: number; // [ZEN NEW]
  minP?: number; // [ZEN NEW]
  maxOutputTokens?: number;
  historyLimit?: number; // [ZEN FIX] EWO #05
  userId?: string; // [ZEN V35] Required for stateful prompt caching
  reasoning_intensity?: 'none' | 'low' | 'medium' | 'high'; // [ZEN V36]
  forceStateless?: boolean; // [ZEN FIX] Forces provider to ignore session IDs
  responseFormat?: { type: 'json_object' }; // [ZEN NEW] Enforces strict JSON return schema
  sessionId?: string; // [ZEN] xAI prompt caching session UUID
  tools?: any[]; // [ZEN JIT RAG] Support for model tool calling
}

export interface VoiceProfile {
  id: string;
  name: string;
  shortDesc: string;
  longDesc: string;
}

export interface AiCompanion {
  id: string;
  name: string;
  avatarUrl: string;
  bio: string;
  persona: GigiPersona;
  customPersonaDescription?: string;
  isPrimary: boolean;
  spiceLevel?: number;
  preferredModel?: string;
  aiConfig?: AiParams;
  bubbleBackgroundColor?: string;
  bubbleTextColor?: string;
  traits?: string[];
  styleAnchors?: string[]; // [ZEN NEW] Few-shot DNA for mimicry
  selfConcept?: string; // [ZEN V35] AI Self-Managed Identity Anchor
  selfConceptSnapshot?: string; // [ZEN V42] Distilled Current Self-Concept Layer (Evolving moods & focus)
  voiceId?: string; // [ZEN V35] Current active ElevenLabs ID
  voiceTag?: string; // [ZEN NEW] Global prefix tag for ElevenLabs v3 accents (e.g. [Southern US accent])
  voiceProfiles?: VoiceProfile[]; // [ZEN V35] Library of saved vocal signatures
  vocalSpeed?: number; // [ZEN V36] TTS Playback Speed Multiplier (0.7 - 1.2)
}

// --- BUCKETS / VAULTS ---
export interface Bucket {
  id: string;
  userId: string;
  name: string;
  privacyLevel: 'standard' | 'restricted' | 'ghost';
  passwordHash?: string; // Bcrypt hash or similar for restricted access
  createdAt: number;
}

// --- CHAT ---
export interface Reaction {
  reactorId: string;
  reactorName: string;
  reactorAvatarUrl?: string;
  emoji: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'model' | 'system';
  content: string;
  imageUrl?: string;
  thumbnailUrl?: string; // [ZEN NEW]
  base64Data?: string;
  mimeType?: string;
  author?: { name: string; avatarUrl: string; };
  timestamp: Date;
  reactions?: Reaction[];
  embedding?: number[]; // [ZEN EWO #12]
  source?: string; // [ZEN NEW] Tracks origin (email, alexa, web)
  isDeleted?: boolean;
  deletedAt?: number;
  xaiResponseId?: string; // [ZEN NEW] Stateful xAI tracking
  _manually_edited?: boolean; // [ZEN NEW] Tracks user corrections
  room?: string; // [ZEN V34] Room assignment (slug)
  is_core?: boolean; // [ZEN] Permanent memory anchor
  is_fiction?: boolean; // [ZEN] Dream/Simulation status
  forensicHeal?: boolean; // [ZEN] Tracks data repairs
  valence?: number; // [ZEN] Emotional sentiment weighting
  keywords?: string[]; // [ZEN] Extracted keywords for fast search
  entities?: any[]; // [ZEN] Identified people/places/things
  internal_monologue?: {
    subtext_analysis: string;
    emotional_state: string;
    hidden_intent: string;
  }; // [ZEN NEW] Implicit analytical subtext stream
  user_facing_response?: string; // [ZEN NEW] Pure narrative dialogue stream
  sessionId?: string; // [ZEN NEW] Thread isolation ID
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  lastUpdatedAt: number;
  preview?: string;
  agentContext?: any; // Context/model settings
}

export interface ChatConversation {
  id: string;
  participants: { id: string; name: string; avatarUrl?: string }[];
  lastMessage?: ChatMessage;
  lastTimestamp?: number;
  unreadCount?: Record<string, number>;
  lastReadTimestamp?: Record<string, number>;
}

// --- ATS CAREER NODE ---
export interface CareerNode {
  id?: string; // [ZEN] Unique anchor for stabilization
  type: string;
  title: string;
  organization: string;
  startDate: string;
  endDate: string;
  bullets: string[];
  excludeFromResume?: boolean; // [ZEN NEW] Selective ATS inclusion
  roleType?: string; // [ZEN NEW] e.g. IT, Admin, Healthcare
  anticipatedQuestions?: {
    question: string;
    answer: string;
    audioVisemeUrl?: string; // Foundation for Phase 5.2 Avatar integration
  }[];
}

export interface ResumeStyleConfig {
  id: string;
  name: string;
  fontFamily: 'helvetica' | 'times' | 'courier';
  headerSize: number;
  bodySize: number;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  accentColor: string;
}

// --- USER ---
export interface User {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  phoneNumber?: string; // [ZEN NEW] For Executive Contact Hub
  lifeOsEmail?: string; // [ZEN NEW] Future AI-monitored inbox (slug@gigiwatt.com)
  publicSlug?: string; // [ZEN NEW] Routing feature
  biography?: string; // [ZEN NEW]
  familyContext?: string; // [ZEN NEW]
  currentFocus?: string; // [ZEN NEW]
  careerBiomass?: string; // [ZEN NEW]
  careerNodes?: CareerNode[]; // [ZEN NEW]
  atsDemographics?: {
    pronouns?: string;
    veteranStatus?: string;
    disabilityStatus?: string;
    raceEthnicity?: string;
    primaryLanguage?: string;
    primaryLanguageFluency?: string;
    secondaryLanguages?: string;
    secondaryLanguagesFluency?: string;
    proxyName?: string;
    proxyAvatarUrl?: string;
  };
  atsOnboardingComplete?: boolean;
  gender?: 'Male' | 'Female' | 'Non-binary' | 'Other' | 'Prefer not to say';
  address: {
    street: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
  };
  profilePictureUrl: string;
  birthday?: string; // [ZEN] Dynamic Anchor Resolution support
  birthDate?: string; // [ZEN] Alternative profile birthday syntax
  joinDate: Date;
  aiCompanions: AiCompanion[];
  mediaIds?: string[];
  personTagId?: string;
  bannedUserIds?: string[];
  settings?: Settings;
  role?: 'root' | 'admin' | 'user';
  securityClearance?: number; // [ZEN NEW] Admin vetting hierarchy (1-12)
  publicSlugStatus?: 'active' | 'pending' | 'rejected'; // [ZEN NEW]
  privacy?: { // [ZEN FIX] Made optional to prevent bulk mock/auth breakage
    visibility: 'public' | 'verts_only' | 'stealth';
    autoShareTag: boolean;
    selectiveVertVisibility?: string[]; // [ZEN NEW] List of Vert UIDs hidden from discovery
  };
  blockedVerts?: Record<string, number>; // UID -> Block Level (1: Request, 2: Total)
  valenceMap?: Record<string, number>; // [ZEN NEW] UID -> Valence Level
  vertCount?: number;
  atsSettings?: {
    lookbackYears: number | 'all';
    roleCategories: string[];
    activeTemplateId?: string;
    customTemplates?: Record<string, ResumeStyleConfig>;
  }; // [ZEN NEW] Executive Suite Control Plane
  sovereignMemex?: {
    coreDirectives?: string[]; // [ZEN] Permanent semantic rules forged by the Classroom / Spark Editor
    neuralLessons?: { // [ZEN V41] Weighted feedback for identity grounding
      id: string;
      text: string;
      valence: 'reward' | 'penalty';
      intensity: number;
      timestamp: number;
    }[];
    neuralTemperature?: number;
    neuralStatusText?: string;
    lastAuditAt?: any;
    auditAnalysis?: string;
    suggestedAction?: string;
    narrativePressure?: number;
    tippingPoint?: number;
    reflectionQueued?: boolean;
    neuralConfidence?: number; // [ZEN V41] 0-100: Influences narrative boldness vs hesitation
    neuralResilience?: number; // [ZEN V41] Capacity to handle penalties without identity drift
    neuralRank?: 'FERAL' | 'GROUNDED' | 'REFINED' | 'SOVEREIGN';
    totalNXp?: number; // Cumulative Neural XP
    ascensionLevel?: number;
    neuralArtGallery?: {
      id: string;
      imageUrl: string;
      prompt: string;
      meaning: string;
      timestamp: number;
    }[];
  }; // [ZEN V35] Neural Baffles & Sentinel Tracking
  auditorMemex?: { // [ZEN V41] The "Who Watches the Watchmen" Ledger
    auditorLessons?: {
      id: string;
      text: string;
      valence: 'reward' | 'penalty';
      timestamp: number;
    }[];
  };
}

// --- COMMENTS ---
export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  content: string;
  timestamp: Date;
}

// --- EVENTS ---
export interface LifeEvent {
  id: string;
  userId?: string; // [ZEN] Required for Search Indexing
  title: string;
  date: Date;
  details: string;
  privateDetails?: string;
  isPrivateDetailsCloaked?: boolean;
  historical?: string;
  tagIds: string[];
  mediaIds: string[];
  reactions?: Reaction[];
  comments?: Comment[];
  description?: string;
  location?: AddressData;
  datePrecision?: 'exact' | 'day' | 'month' | 'year' | 'unknown' | 'circa' | 'decade';
  importSource?: string;
  metadata?: Record<string, any>;
}

// --- JOURNAL ---
export interface GigiJournalEntry {
  id: string;
  creationDate: Date;
  title: string;
  content: string;
  relatedChatHistory: ChatMessage[];
  type?: 'reflection' | 'conversation' | 'deep_dive' | 'daydream' | 'messenger_log';
  author?: 'user' | 'ai'; // [ZEN FIX] Matches hook usage
  authorType?: 'human' | 'ai'; // [ZEN FIX] Restored for compatibility
  isDeleted?: boolean;
  deletedAt?: number;
  participants?: { name: string; avatarUrl: string }[];
  reactions?: Reaction[];
  comments?: Comment[];
  read?: boolean;
  // The instruction implies these are new, but they already exist in the original code.
  // isDeleted?: boolean;
  // deletedAt?: number;
  isAttached?: boolean;
  relatedEventId?: string;
  tags?: string[];
  sentiment?: string;
  isPrivate?: boolean;
  source?: string;
}

// --- MEDIA ---
export interface Media {
  id: string;
  adjustmentStack?: any;
  userId?: string; // [ZEN] Required for Search Indexing
  url: string;
  thumbnailUrl: string;
  caption: string;
  location?: {
    address?: string;
    lat?: number;
    lng?: number;
  };
  uploadDate: Date;
  fileType: string;
  fileName?: string;
  size?: number;
  base64Data?: string;
  tagIds: string[];
  mediaIds?: string[]; // [ZEN FIX] Added to match importer usage
  isFiction?: boolean; // [ZEN] Fictional media isolation
  universeIds?: string[]; // [ZEN] Multiverse coordinates
  reactions?: Reaction[];
  originalName?: string;
  logicalDate?: string;
  year?: number;
  status?: 'clean' | 'provisional' | 'archived';
  isAvatar?: boolean; // [ZEN] Hidden from Matrix/Artifacts
  isInboxDismissed?: boolean; // [ZEN] Cleared from Inbox Card
  thumbnailUrls?: {
    small: string;
    medium: string;
    large: string;
    custom?: boolean;
  };
  width?: number;
  height?: number;
  aspectRatio?: number; // [ZEN] Added for layout stabilization
  title?: string;
  description?: string;
  privateDetails?: string; // [ZEN] Private Shutter Details
  dateTaken?: Date | string | null; // [ZEN FIX]
  narrative?: string; // [ZEN FIX]
  isFavorite?: boolean;
  mainImageId?: string;
  aiProcessed?: boolean;
  keywords?: string[];
  datePrecision?: 'exact' | 'day' | 'month' | 'year' | 'unknown' | 'circa' | 'decade';
  polishLayers?: string[]; // [ZEN] Neural editing metadata
  metadata?: any; // [ZEN] Fictional/AI generation metadata
  triage?: any; // [ZEN] Added to fix TS error
  orientation_flag?: string; // [ZEN] Rotational state flag
  rotation?: number; // [ZEN] Canonical rotation in degrees (0, 90, 180, 270)
  aiRetryCount?: number; // [ZEN] Added to fix TS error
  aiGenerator?: string; // [ZEN] Tracks which AI last generated the caption
  aiModel?: string; // [ZEN] Tracks specific model version used
  aiDescription?: string; // [ZEN] Caches the raw AI description text
  skipAI?: boolean; // [ZEN] Forces AI captioning bypass
  
  // [ZEN] Memorial Airlock Ingestion
  contributionStatus?: 'verified' | 'pending' | 'rejected';
  contributorName?: string;
  contributionDate?: any;
  contributionSource?: string; // e.g. "Public Memorial Site"
  bucketId?: string; // [ZEN] The custom silo/vault this media belongs to
}

export type AssetStatus = 'clean' | 'provisional' | 'archived';

export interface ForensicsData {
  originalFileName: string;
  originalFilePath: string;
  exifDate: string | null;
  inferredDate: string | null;
  confidenceDelta: number;
  flaggedReason: 'date_mismatch' | 'no_reliable_date' | 'system_junk' | null;
}

export interface MatrixAsset {
  id: string;
  uid: string;
  url: string;
  thumbnailUrls?: { small: string; medium: string; large: string; custom?: boolean; };
  originalName: string;
  fileType: string;
  size: number;
  width?: number;
  height?: number;
  storagePath: string;
  dateAdded: any;
  logicalDate: string;
  status: AssetStatus;
  forensics?: ForensicsData;
  source?: string;
  year?: number;
  caption?: string;
  title?: string;
  description?: string;
  rotation?: number;
  aiGenerator?: string; // [ZEN] Tracks which AI last generated the caption
  aiModel?: string;
  aiDescription?: string;
  skipAI?: boolean;
  isInboxDismissed?: boolean;
  isFiction?: boolean; // [ZEN] Fictional media isolation
  universeIds?: string[]; // [ZEN] Multiverse coordinates
  bucketId?: string; // [ZEN]
}

// --- IMPORTS ---
export interface CommsMessage {
  id: string;
  type: 'Email' | 'SMS';
  subject: string;
  body: string;
  timestamp: Date;
  from: string;
  read: boolean;
  // [ZEN FIX] Added missing property
  encrypted?: boolean;
}

export type ImportStatus =
  | { type: 'idle' }
  | { type: 'confirming', file: File }
  | { type: 'loading', message: string }
  | { type: 'success', message: string }
  | { type: 'error', message: string };

// --- DAYDREAM STUDIO ---
export interface DaydreamStory {
  id: string;
  userId: string;
  title: string;
  content: Record<string, any>; // TipTap JSON structure
  createdAt: Date;
  updatedAt: Date;
  activeCast: string[]; // IDs of AiCompanions participating
  settingTagId?: string; // Where the story takes place
  status: 'draft' | 'published' | 'archived';
  tags: string[];
  coverImageId?: string; // For the gallery view
  genre?: string;
  tone?: string;
  // Director Controls Snapshot (Last utilized settings)
  directorState?: {
    temperature: number;
    length: 'short' | 'medium' | 'long';
    intensity: 'tame' | 'feral' | 'unhinged';
  };
}