/**
 * MneOS 3-Chamber Sovereign Vault Ingestion & Accessioning Pipeline
 * Reads 290+ historical session markdown files across 3 chambers:
 * 1. Grok Vault: _SESSION_EXPORTS/GROK_SESSIONS/DISTILLED/ (46 sessions)
 * 2. Gemini Vault: RESCUED_ALL_DYSUS2024 (77) + RESCUED_ALL_ARTINAE (92) = 169 sessions
 * 3. Erato Vault: _SESSION_EXPORTS/ERATO_HISTORICAL_RAW/ (75 sessions)
 * 
 * Upserts session metadata & chat turns into MongoDB Atlas collections:
 * - `LifeOS.simulacrum_session_meta`
 * - `LifeOS.simulacrum_chat_messages`
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Load environment variables from .env.local if present
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*["']?(.*?)["']?\s*$/);
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2];
        }
    });
}

const ATLAS_URI = process.env.ATLAS_CLOUD_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/LifeOS";
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

// Parse a markdown file into discrete turn messages
function parseMarkdownSession(filePath, chamber, filename) {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    
    // Clean title from filename
    let title = filename
        .replace(/\.md$/, '')
        .replace(/^DISTILLED_/, '')
        .replace(/^RESCUED_ALL_DYSUS2024_/, '')
        .replace(/^ERATO_Session_/, 'Erato Session: ')
        .replace(/_\d{4}-\d{2}-\d{2}$/, '')
        .replace(/_/g, ' ')
        .trim();

    if (!title) title = filename;

    const turns = [];
    const lines = rawContent.split('\n');
    
    let currentRole = 'user';
    let currentContent = [];
    let turnTimestamp = stats.mtimeMs;

    // Detect turn markers like "### Turn", "User:", "Model:", "**Eric**", "**Brita**", "Prompt:", "Response:"
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        const isHeaderTurn = line.match(/^###\s+Turn\s+\d+/i) || line.match(/^###\s+(User|Eric|Brita|Model|Assistant)/i);
        const isBoldTurn = line.match(/^\*\*(User|Eric|Architect)\*\*/i) || line.match(/^\*\*(Brita|Model|Assistant|Grok|Gemini)\*\*/i);
        const isRoleLine = line.match(/^(User|Prompt|Eric):/i) || line.match(/^(Model|Assistant|Response|Brita|Grok|Gemini):/i);

        if (isHeaderTurn || isBoldTurn || isRoleLine) {
            // Save previous turn if content exists
            if (currentContent.length > 0) {
                const text = currentContent.join('\n').trim();
                if (text) {
                    turns.push({
                        role: currentRole,
                        content: text,
                        timestamp: turnTimestamp
                    });
                }
                currentContent = [];
            }

            // Determine role
            const lineLower = line.toLowerCase();
            if (lineLower.includes('brita') || lineLower.includes('model') || lineLower.includes('assistant') || lineLower.includes('grok') || lineLower.includes('gemini') || lineLower.includes('response')) {
                currentRole = 'model';
            } else {
                currentRole = 'user';
            }
        } else {
            // Filter out file title header markdown lines
            if (!line.startsWith('# MneOS') && !line.startsWith('**Platform:**') && !line.startsWith('**Date:**') && !line.startsWith('**Archive Source:**')) {
                currentContent.push(line);
            }
        }
    }

    // Save final turn
    if (currentContent.length > 0) {
        const text = currentContent.join('\n').trim();
        if (text) {
            turns.push({
                role: currentRole,
                content: text,
                timestamp: turnTimestamp
            });
        }
    }

    // Fallback if no turn delimiters were found: create 1 turn with entire content
    if (turns.length === 0 && rawContent.trim()) {
        turns.push({
            role: 'user',
            content: rawContent.trim(),
            timestamp: stats.mtimeMs
        });
    }

    // Generate deterministic session ID based on chamber + filename
    const cleanId = `vault-${chamber}-${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    const sessionMeta = {
        id: cleanId,
        userId: ERIC_UID,
        tagId: 'brita-default',
        name: title,
        chamber: chamber, // 'grok' | 'gemini' | 'erato'
        lastActive: stats.mtimeMs,
        turnCount: turns.length,
        isArchived: false,
        sourceFile: filename
    };

    const messages = turns.map((t, idx) => ({
        id: `${cleanId}-msg-${idx + 1}`,
        sessionId: cleanId,
        userId: ERIC_UID,
        role: t.role,
        content: t.content,
        timestamp: t.timestamp || stats.mtimeMs
    }));

    return { sessionMeta, messages };
}

async function runIngestion() {
    console.log(`================================================================`);
    console.log(`🏛️ MneOS 3-Chamber Sovereign Vault Ingestor`);
    console.log(`================================================================`);
    
    const client = new MongoClient(ATLAS_URI);

    try {
        await client.connect();
        console.log(`\n✅ Connected to MongoDB Atlas!`);
        const db = client.db('LifeOS');
        const metaColl = db.collection('simulacrum_session_meta');
        const msgColl = db.collection('simulacrum_chat_messages');

        let totalSessionsProcessed = 0;
        let totalMessagesProcessed = 0;

        for (const [chamber, dirList] of Object.entries(CHAMBER_DIRS)) {
            console.log(`\n📦 Processing Chamber [${chamber.toUpperCase()}]...`);
            let chamberSessionCount = 0;

            for (const dirPath of dirList) {
                if (!fs.existsSync(dirPath)) {
                    console.warn(`  ⚠️ Directory not found: ${dirPath}`);
                    continue;
                }

                const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
                console.log(`  📁 Folder: ${path.basename(dirPath)} (${files.length} files)`);

                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    const { sessionMeta, messages } = parseMarkdownSession(filePath, chamber, file);

                    // Upsert session meta into MongoDB
                    await metaColl.updateOne(
                        { id: sessionMeta.id },
                        { $set: sessionMeta },
                        { upsert: true }
                    );

                    // Bulk upsert messages
                    if (messages.length > 0) {
                        const bulkOps = messages.map(m => ({
                            updateOne: {
                                filter: { id: m.id },
                                update: { $set: m },
                                upsert: true
                            }
                        }));
                        await msgColl.bulkWrite(bulkOps);
                    }

                    chamberSessionCount++;
                    totalSessionsProcessed++;
                    totalMessagesProcessed += messages.length;
                }
            }

            console.log(`  ✅ [${chamber.toUpperCase()}] Ingested total ${chamberSessionCount} sessions.`);
        }

        console.log(`\n================================================================`);
        console.log(`🎉 3-CHAMBER VAULT INGESTION COMPLETE!`);
        console.log(`Total Sessions Accessioned: ${totalSessionsProcessed}`);
        console.log(`Total Turn Messages Ingested: ${totalMessagesProcessed}`);
        console.log(`================================================================\n`);

    } catch (err) {
        console.error(`❌ Ingestion error:`, err);
    } finally {
        await client.close();
    }
}

runIngestion();
