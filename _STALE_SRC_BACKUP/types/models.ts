import { Settings } from './settings';
import { AddressData } from './tags';

// --- AI ---
export type GigiPersona = string;

export interface AiParams {
  temperature: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;
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
  voice?: string;
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
  isDeleted?: boolean;
  deletedAt?: number;
}

export interface ChatConversation {
  id: string;
  participants: { id: string; name: string; avatarUrl?: string }[];
  lastMessage?: ChatMessage;
  lastTimestamp?: number;
  unreadCount?: Record<string, number>;
  lastReadTimestamp?: Record<string, number>;
}

// --- USER ---
export interface User {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  gender?: 'Male' | 'Female' | 'Non-binary' | 'Other' | 'Prefer not to say';
  address: {
    street: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
  };
  profilePictureUrl: string;
  joinDate: Date;
  aiCompanions: AiCompanion[];
  mediaIds?: string[];
  personTagId?: string;
  bannedUserIds?: string[];
  settings?: Settings;
  role?: 'root' | 'admin' | 'user';
  privacy?: { // [ZEN FIX] Made optional to prevent bulk mock/auth breakage
    visibility: 'public' | 'verts_only' | 'stealth';
    autoShareTag: boolean;
    selectiveVertVisibility?: string[]; // [ZEN NEW] List of Vert UIDs hidden from discovery
  };
  blockedVerts?: Record<string, number>; // UID -> Block Level (1: Request, 2: Total)
  valenceMap?: Record<string, number>; // [ZEN NEW] UID -> Valence Level
  vertCount?: number;
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
}

// --- JOURNAL ---
export interface GigiJournalEntry {
  id: string;
  author?: 'user' | 'ai'; // [ZEN FIX] Track creation source
  creationDate: Date;
  title: string;
  content: string;
  relatedChatHistory: ChatMessage[];
  type?: 'reflection' | 'conversation' | 'deep_dive' | 'daydream';
  authorType?: 'human' | 'ai';
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
}

// --- MEDIA ---
export interface Media {
  id: string;
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
  mediaIds?: string[];
  reactions?: Reaction[];
  originalName?: string;
  logicalDate?: string;
  year?: number;
  status?: 'clean' | 'provisional' | 'archived';
  thumbnailUrls?: {
    small: string;
    medium: string;
    large: string;
    custom?: boolean;
  };
  width?: number;
  height?: number;
  title?: string;
  description?: string;
  isFavorite?: boolean;
  mainImageId?: string;
  aiProcessed?: boolean;
  keywords?: string[];
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