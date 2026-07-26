/**
 * SOCIAL GEOMETRY: VERTEX & VALENCE TYPES
 * Part of Project GIGI: LifeOS
 */

export type ValenceLevel =
    | 1 // K-Shell (Closest): Full Access / Co-Author / "Emergency Contact"
    | 2 // L-Shell (Mid): View Timeline / Standard Media Access
    | 3; // M-Shell (Outer): Public Profile / Restricted View

export type VertStatus =
    | 'airlock'  // Pending (In the quarantine zone)
    | 'linked'   // Active (Orbiting)
    | 'vented'   // Blocked/Rejected (Ejected into space)
    | 'drift';   // Lost Signal (Account deleted/inactive)

export interface Vert {
    uid: string;              // The remote user's Firebase UID
    displayName: string;      // Their public GIGI name
    profilePictureUrl?: string;
    localNickname?: string;   // What YOU call them (e.g., "Dad", "The Boss")

    valence: ValenceLevel;    // 1, 2, or 3
    status: VertStatus;

    // Security & Networking
    publicKey: string;        // For end-to-end encryption
    linkedAt: number;         // Timestamp of when they left the Airlock
    lastPing: number;         // Last time they were online/synced

    // Relationship Mapping
    associatedTagId?: string; // Links this Vert to a "Person" tag in your local DB
}

export interface AirlockRequest {
    requestId: string;
    fromUid: string;
    toUid: string;
    fromName: string;
    timestamp: number;
    message?: string; // "Hey, it's me from the conference."
    status: 'pending' | 'accepted' | 'rejected';
    type?: 'link' | 'share';
    mediaIds?: string[];
}

export interface PeerChatSegment {
    id: string;
    fromUid: string;
    fromName: string;
    fromAvatarUrl?: string;
    content: string;
    timestamp: number;
    attachedMediaIds?: string[];
    imageUrl?: string; // [ZEN NEW] Direct link for peer bypass
    thumbnailUrl?: string; // [ZEN NEW] For video posters/fast loading
    mimeType?: string; // [ZEN NEW] For rendering (e.g. video/mp4)
    isAiResponse?: boolean;
    responderAgentId?: string; // If isAiResponse is true
    authorType: 'human' | 'ai';
    isDeleted?: boolean;
    deletedAt?: number;
    isSystemMessage?: boolean; // For "added to matrix" etc
}

export interface PeerChatSession {
    sessionId: string;
    participants: string[]; // [uidA, uidB]
    lastMessage?: string;
    lastTimestamp?: number;
    unreadCount?: Record<string, number>;
    lastReadTimestamp?: Record<string, number>;
    typing?: Record<string, boolean>; // [ZEN NEW] Track who is typing
}
