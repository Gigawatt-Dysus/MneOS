/**
 * MneOS Sovereign Vault Local Manifest Generator
 * Generates `src/data/vaultSessionManifest.json` containing all 320+ accessioned sessions
 * across Grok, Gemini, and Erato chambers for sub-millisecond, zero-lag local loading.
 */

const fs = require('fs');
const path = require('path');

const ERIC_UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

const CHAMBER_DIRS = {
    grok: [
        path.join(__dirname, '..', '_SESSION_EXPORTS', 'GROK_SESSIONS', 'DISTILLED')
    ],
    gemini: [
        path.join(__dirname, '..', '_SESSION_EXPORTS', 'GEMINI_SESSIONS', 'RESCUED_ALL_DYSUS2024'),
        path.join(__dirname, '..', '_SESSION_EXPORTS', 'GEMINI_SESSIONS', 'RESCUED_ALL_ARTINAE'),
        path.join(__dirname, '..', '_SESSION_EXPORTS', 'UTTER BULLSHIT', 'GEMINI_SESSIONS', 'RESCUED_ALL')
    ],
    erato: [
        path.join(__dirname, '..', '_SESSION_EXPORTS', 'ERATO_HISTORICAL_RAW')
    ]
};

function cleanTitle(filename) {
    return filename
        .replace(/\.md$/, '')
        .replace(/^DISTILLED_/, '')
        .replace(/^RESCUED_ALL_DYSUS2024_/, '')
        .replace(/^ERATO_Session_/, 'Erato Session: ')
        .replace(/_\d{4}-\d{2}-\d{2}$/, '')
        .replace(/_/g, ' ')
        .trim();
}

function sanitizeText(text) {
    if (!text) return text;
    // Redact any accidental embedded xAI or AI service secret keys
    return text.replace(/xai-[a-zA-Z0-9_-]{20,}/g, '[REDACTED_XAI_KEY]');
}

function parseMarkdownTurns(filePath) {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const lines = rawContent.split('\n');
    const turns = [];
    let currentRole = 'user';
    let currentContent = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isHeaderTurn = line.match(/^###\s+Turn\s+\d+/i) || line.match(/^###\s+(User|Eric|Brita|Model|Assistant)/i);
        const isBoldTurn = line.match(/^\*\*(User|Eric|Architect)\*\*/i) || line.match(/^\*\*(Brita|Model|Assistant|Grok|Gemini)\*\*/i);
        const isRoleLine = line.match(/^(User|Prompt|Eric):/i) || line.match(/^(Model|Assistant|Response|Brita|Grok|Gemini):/i);

        if (isHeaderTurn || isBoldTurn || isRoleLine) {
            if (currentContent.length > 0) {
                const text = sanitizeText(currentContent.join('\n').trim());
                if (text) turns.push({ role: currentRole, content: text });
                currentContent = [];
            }
            const lineLower = line.toLowerCase();
            if (lineLower.includes('brita') || lineLower.includes('model') || lineLower.includes('assistant') || lineLower.includes('grok') || lineLower.includes('gemini') || lineLower.includes('response')) {
                currentRole = 'model';
            } else {
                currentRole = 'user';
            }
        } else {
            if (!line.startsWith('# MneOS') && !line.startsWith('**Platform:**') && !line.startsWith('**Date:**') && !line.startsWith('**Archive Source:**')) {
                currentContent.push(line);
            }
        }
    }

    if (currentContent.length > 0) {
        const text = sanitizeText(currentContent.join('\n').trim());
        if (text) turns.push({ role: currentRole, content: text });
    }

    if (turns.length === 0 && rawContent.trim()) {
        turns.push({ role: 'user', content: sanitizeText(rawContent.trim()) });
    }

    return turns;
}

function generateManifest() {
    console.log(`================================================================`);
    console.log(`⚡ Generating MneOS Vault Local Manifest (src/data/vaultSessionManifest.json)...`);
    console.log(`================================================================`);

    const manifestSessions = [];
    const messageMap = {};
    const seenIds = new Set();

    for (const [chamber, dirList] of Object.entries(CHAMBER_DIRS)) {
        for (const dirPath of dirList) {
            if (!fs.existsSync(dirPath)) continue;

            const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                const cleanId = `vault-${chamber}-${file.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

                if (seenIds.has(cleanId)) continue;
                seenIds.add(cleanId);

                const turns = parseMarkdownTurns(filePath);
                const title = cleanTitle(file);

                const sessionMeta = {
                    id: cleanId,
                    userId: ERIC_UID,
                    tagId: 'brita-default',
                    name: title,
                    chamber: chamber,
                    lastActive: stats.mtimeMs,
                    turnCount: turns.length,
                    isArchived: false,
                    sourceFile: file
                };

                manifestSessions.push(sessionMeta);

                messageMap[cleanId] = turns.map((t, idx) => ({
                    id: `${cleanId}-msg-${idx + 1}`,
                    sessionId: cleanId,
                    userId: ERIC_UID,
                    role: t.role,
                    content: t.content,
                    timestamp: stats.mtimeMs
                }));
            }
        }
    }

    // Sort newest first
    manifestSessions.sort((a, b) => b.lastActive - a.lastActive);

    const outDir = path.join(__dirname, '..', 'src', 'data');
    fs.mkdirSync(outDir, { recursive: true });

    const metaPath = path.join(outDir, 'vaultSessionManifest.json');
    const msgPath = path.join(outDir, 'vaultMessageCache.json');

    fs.writeFileSync(metaPath, JSON.stringify(manifestSessions, null, 2), 'utf8');
    fs.writeFileSync(msgPath, JSON.stringify(messageMap, null, 2), 'utf8');

    console.log(`✅ Exported ${manifestSessions.length} sessions to ${metaPath}`);
    console.log(`✅ Exported turn messages for ${Object.keys(messageMap).length} sessions to ${msgPath}`);
    console.log(`================================================================\n`);
}

generateManifest();
