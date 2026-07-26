import type { ChatMessage } from '../../types';

/**
 * [ZEN] Chat Utilities
 * Pure functions for cleaning prose, fingerprinting, and deduplication.
 */

export const cleanProse = (text: string): string => {
    if (!text) return "";
    let clean = text.trim();
    if (!clean) return "";

    // 1. Tag-specific internal cleaning (brackets, braces)
    clean = clean.replace(/\[([^\]]+)\]/g, (_m, tag) => {
        let t = tag.trim();
        t = t.charAt(0).toUpperCase() + t.slice(1);
        if (t.split(' ').length > 1 && !/[.!?]$/.test(t)) t += ".";
        return `[${t}]`;
    });
    clean = clean.replace(/\{([^}]+)\}/g, (_m, tag) => {
        let t = tag.trim();
        t = t.charAt(0).toUpperCase() + t.slice(1);
        if (t.split(' ').length > 1 && !/[.!?]$/.test(t)) t += ".";
        return `{${t}}`;
    });

    // 2. Overall sentence-level cleaning for the whole block
    if (!/^[\[\{]/.test(clean)) { // If doesn't start with a tag
        clean = clean.charAt(0).toUpperCase() + clean.slice(1);
        if (clean.split(' ').length > 1 && !/[.!?]$/.test(clean)) {
            clean += ".";
        }
    }
    return clean;
};

export const createFingerprint = (msg: ChatMessage): string => {
    if ((msg as any).id) return (msg as any).id;
    const contentNorm = (msg.content || '').substring(0, 100).trim().toLowerCase();
    let tsNorm = '';
    if (msg.timestamp) {
        const ts = msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp as any);
        if (!isNaN(ts.getTime())) {
            tsNorm = Math.floor(ts.getTime() / 1000).toString();
        }
    }
    return `${msg.role}|${contentNorm}|${tsNorm}`;
};

export const deduplicateMessages = (rawHistory: ChatMessage[], vaporizedIds: Set<string> = new Set()): ChatMessage[] => {
    const seen = new Set<string>();
    const cleaned: ChatMessage[] = [];
    
    for (const msg of rawHistory) {
        if (msg.isDeleted) continue;
        
        const msgId = (msg as any).id;
        if (msgId && vaporizedIds.has(msgId)) continue;

        const fp = createFingerprint(msg);
        if (!seen.has(fp)) {
            seen.add(fp);
            const cleanMsg = { ...msg };
            if ((cleanMsg as any).base64Data) delete (cleanMsg as any).base64Data;
            cleaned.push(cleanMsg);
        }
    }
    return cleaned;
};
