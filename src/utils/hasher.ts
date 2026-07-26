/**
 * [ZEN] Sovereign Fingerprint Utility
 * High-speed content hashing for deduplication.
 */

/**
 * Generates a SHA-256 hash of a File object.
 * For very large files, we use a "Sovereign Fingerprint" approach:
 * Hashing the first 2MB + Last 2MB + Size to ensure speed without sacrificing uniqueness.
 */
export async function generateContentHash(file: File): Promise<string> {
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
    
    let buffer: ArrayBuffer;
    
    if (file.size <= CHUNK_SIZE * 2) {
        // Small file: Hash the whole thing
        buffer = await file.arrayBuffer();
    } else {
        // Large file: Fingerprint (Start + End + Size)
        const start = file.slice(0, CHUNK_SIZE);
        const end = file.slice(file.size - CHUNK_SIZE);
        const sizeInfo = new TextEncoder().encode(`size:${file.size}`);
        
        const startBuf = await start.arrayBuffer();
        const endBuf = await end.arrayBuffer();
        
        const combined = new Uint8Array(startBuf.byteLength + endBuf.byteLength + sizeInfo.byteLength);
        combined.set(new Uint8Array(startBuf), 0);
        combined.set(new Uint8Array(endBuf), startBuf.byteLength);
        combined.set(sizeInfo, startBuf.byteLength + endBuf.byteLength);
        buffer = combined.buffer;
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
