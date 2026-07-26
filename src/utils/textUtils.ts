/**
 * [ZEN] NEURAL TEXT UTILITIES
 * 
 * Centralized logic for sanitizing, scrubbing, and formatting neural fragments
 * before they reach the UI or the Vector Index.
 */

/**
 * Robustly sanitizes content by removing raw email/MIME artifacts, 
 * large base64 blocks, and noise that degrades RAG/Vector performance.
 */
export const sanitizeContent = (text: string): string => {
    if (!text) return "";

    let clean = text;

    // 1. Scrub Raw MIME Boundaries (e.g., --000000000000cdb857064df455e2)
    clean = clean.replace(/--[a-f0-9]{20,}/gi, '');

    // 2. Scrub Email Headers within text
    const headerPatterns = [
        /Content-Type:.*?\n/gi,
        /Content-Transfer-Encoding:.*?\n/gi,
        /Content-Disposition:.*?\n/gi,
        /X-Google-DKIM-Signature:.*?\n/gi,
        /Delivered-To:.*?\n/gi,
        /Received:.*?\n/gi,
        /MIME-Version:.*?\n/gi
    ];
    headerPatterns.forEach(pattern => {
        clean = clean.replace(pattern, '');
    });

    // 3. Scrub/Decode Large Base64 Blocks
    clean = clean.replace(/([A-Za-z0-9+/]{100,}=*)/g, (match) => {
        try {
            // Attempt to decode
            const decoded = atob(match.trim());
            // Sanity check: ensure it's not binary junk (non-printable chars)
            if (/[\x00-\x08\x0E-\x1F]/.test(decoded)) {
                if (match.length > 500) return "[EXCISE: LARGE BINARY BLOCK]";
                return match; 
            }
            return decoded;
        } catch (e) {
            if (match.length > 500) return "[EXCISE: LARGE UNPARSABLE BLOCK]";
            return match; 
        }
    });

    // 4. Scrub Base64 Image URI patterns (data:image/...)
    clean = clean.replace(/data:image\/[a-zA-Z]+;base64,[^\s"']+/g, "[IMAGE]");

    // 5. Scrub HTML artifacts sometimes found in emails
    clean = clean.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    clean = clean.replace(/<[^>]+>/g, '');

    // 6. Clean up excessive whitespace created by scrubbing
    clean = clean.replace(/\n{3,}/g, '\n\n').trim();

    // 7. Safety Limit for Indexing/LLM Context
    if (clean.length > 25000) {
        clean = clean.substring(0, 25000) + "\n... [CONTENT TRUNCATED FOR NEURAL STABILITY]";
    }

    return clean;
};

/**
 * Checks if a string looks like a structural failure (Missing GIGI Tags)
 */
export const isStructurallyFailed = (content: string): boolean => {
    if (!content) return true;
    const hasAudioTag = /\[.*?\]/.test(content);
    const hasActionTag = /\{.*?\}/.test(content) || /\(\(.*?\)\)/.test(content);
    return !hasAudioTag && !hasActionTag;
};
