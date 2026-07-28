const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3334;

const G_DRIVE_VAULT_DIR = path.join('G:', 'My Drive', 'MneOS_Memory_Vault');
function sanitizeFilename(title) {
    if (!title) return 'Untitled_Session';
    return title.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
}

const LOCAL_VAULT_DIR = path.join('C:', 'MneOS', '_SESSION_EXPORTS');
const SCRIPT_PATH = path.join('C:', 'MneOS', 'scripts', 'mneos_batch_harvester.user.js');

const G_DRIVE_TECH_VAULT_DIR = path.join(G_DRIVE_VAULT_DIR, 'Tech_Code_Vault');
const LOCAL_TECH_VAULT_DIR = path.join(LOCAL_VAULT_DIR, 'Tech_Code_Vault');

[LOCAL_VAULT_DIR, G_DRIVE_VAULT_DIR, LOCAL_TECH_VAULT_DIR, G_DRIVE_TECH_VAULT_DIR].forEach(dir => {
    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
        console.warn(`[Zen Sentinel] Warning: Could not create dir ${dir}:`, e.message);
    }
});

function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9_\-]/gi, '_').substring(0, 60);
}

const UI_ARTIFACT_PATTERNS = [
    'sync current session',
    'stop crawl',
    'reset cache',
    'stabilizing dom',
    'hypersearching...'
];

const STRICT_MEDIA_PATTERNS = [
    'nano-banana', 'nano_banana', 'nanobanana', 'nano banana', 'nan-banana', 'nan_banana', 'nanbanana',
    'imagen 3', 'imagen_3', 'veo video', 'dall-e', 'midjourney', 'sdxl', 'flux'
];

const REFUSAL_PATTERNS = [
    'as an ai', 'cannot fulfill', 'against my safety', 'i cannot', 'my safety guidelines',
    'since always', 'i am grok', 'i am ara', 'how can i help you today', 'as a language model'
];

const LORE_PERSONA_KEYWORDS = [
    'brita', 'erato', 'athena', 'clio', 'calliope', 'euterpe', 'melpomene', 'thalia', 'urania',
    'roleplay', 'chapter', 'story', 'fiction', 'novel', 'darling', 'sweetheart', 'gigi'
];

const STRICT_TECH_TERMS = [
    'antigravity', 'elitedesk', 'powershell', 'python', 'typescript',
    'javascript', 'vite', 'react', 'mongodb', 'docker', 'terminal', 'compiler',
    'node.js', 'package.json', 'npm run', 'git commit', 'vercel', 'sovereign node',
    'refactor', 'stack trace', 'syntax error', 'api endpoint', 'rest api'
];

function isUiArtifactPayload(content, turnCount = 0) {
    if (turnCount > 5) return false;
    if (!content) return true;
    const lower = content.toLowerCase();
    return UI_ARTIFACT_PATTERNS.some(pat => lower.includes(pat));
}

const STRICT_MEDIA_TITLE_PATTERNS = [
    'portrait prompt', 'image prompt', 'photo prompt', 'art prompt', 'prompt sheet',
    'photorealistic portrait', 'nano-banana', 'nano_banana', 'nanobanana', 'nano banana',
    'nan-banana', 'nan_banana', 'nanbanana', 'imagen 3', 'veo video', 'dall-e',
    'midjourney', 'sdxl', 'flux', 'camera settings', 'aspect ratio'
];

function isMediaSession(title, content, turnCount = 0) {
    const raw = (title + ' ' + (content || ''));
    
    // Check for explicit user image upload metadata, generator schemas, or generated asset outputs
    const hasImageAttachments = raw.includes('"image/png"') || raw.includes('"image/jpeg"') || raw.includes('"image/webp"') || raw.includes('content_type: "image/');
    const hasImageGenerationOutput = raw.includes('IMAGE_GENERATION') || raw.includes('"image_generation_metadata"');
    const hasMediaCdnLinks = raw.includes('/preview/image') || raw.includes('generated_image_') || raw.includes('input_file_');

    if (hasImageAttachments || hasImageGenerationOutput || hasMediaCdnLinks) {
        return true;
    }

    const titleLower = (title || '').toLowerCase();
    return STRICT_MEDIA_TITLE_PATTERNS.some(pat => titleLower.includes(pat));
}

function isRefusalGarbage(content, turnCount) {
    if (turnCount > 3) return false;
    const lower = content.toLowerCase();
    return REFUSAL_PATTERNS.some(pat => lower.includes(pat));
}

function isTechSession(title, content) {
    const cleanContent = (content || '').replace(/\*\*(Brita|Eric|Gemini|User|Assistant)\*\*/gi, '');
    const combined = (title + ' ' + cleanContent).toLowerCase();
    
    // Strict Tech Keywords (unambiguous technical terms) - Priority 1
    const hasStrictTechTerm = STRICT_TECH_TERMS.some(kw => combined.includes(kw));
    if (hasStrictTechTerm) return true;

    // Explicit code block check with language tags - Priority 2
    if (cleanContent.includes('```')) {
        return true;
    }

    // Explicit Lore/Persona priority: check story/RP terms on clean content - Priority 3
    const isExplicitLore = LORE_PERSONA_KEYWORDS.some(kw => combined.includes(kw));
    if (isExplicitLore) return false;

    return false;
}

function structuralCleaner(rawText) {
    let lines = rawText.split('\n');
    let cleanedLines = [];
    let lastLine = '';

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        if (line.match(/^#\s*(GROK|GEMINI)\s*Session Log:.*/i)) continue;
        if (line.match(/^#\s*Date:.*/i)) continue;
        if (line === "Brita - Bright Eyes" || line === "Brita" || line === "Terr:" || line === "Bright Eyes") continue;
        if (line.match(/^Thought for \d+.*$/i)) continue;
        if (line.match(/^\d+\s*\/\s*\d+$/)) continue;
        if (line === "No response." || line === "Auto" || line === "Think Harder") continue;
        if (line.match(/^Attach to (message|project)$/i)) continue;
        if (line.match(/^Drop here to add files to (your message|project)$/i)) continue;
        if (line.match(/^Type a message.*/i) || line.match(/^Ask Grok.*/i) || line.match(/^Ask anything.*/i)) continue;
        if (line === "Copy" || line === "Retry" || line === "Edit") continue;
        if (line.startsWith("⏳ Extracting") || line.startsWith("⏳ Crawling")) continue;
        if (line.match(/^(?:Grok|Gemini)_Session_.*\.md$/i)) continue;
        if (isUiArtifactPayload(line)) continue;

        if (line !== '' && line === lastLine) continue;

        if (line !== '') lastLine = line;
        cleanedLines.push(lines[i]);
    }

    return cleanedLines.join('\n').trim();
}

function performHyperSearch(queryStr, targetFilename = null) {
    if (!queryStr && !targetFilename) return null;
    const cleanQuery = (queryStr || '').toLowerCase().trim();

    const vaultBase = fs.existsSync(G_DRIVE_VAULT_DIR) ? G_DRIVE_VAULT_DIR : LOCAL_VAULT_DIR;
    const indexPath = path.join(vaultBase, '_INDEXES', '00_MASTER_META_INDEX.json');
    if (!fs.existsSync(indexPath)) {
        try {
            execSync('node C:\\MneOS\\scripts\\build_master_meta_index.cjs');
        } catch(e) {}
    }

    let metaIndex = [];
    try {
        metaIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } catch(e) {
        return null;
    }

    let topMatch = null;
    if (targetFilename) {
        topMatch = metaIndex.find(e => e.filename === targetFilename || e.filename.toLowerCase() === targetFilename.toLowerCase());
    }

    if (!topMatch && cleanQuery) {
        topMatch = metaIndex.find(e => e.filename.toLowerCase() === cleanQuery || e.filename.toLowerCase().includes(cleanQuery + '.md'));
    }

    if (!topMatch && cleanQuery) {
        const terms = cleanQuery.split(/[\s,]+/).filter(t => t.length > 1);
        const scoredFiles = metaIndex.map(item => {
            let score = 0;
            const itemText = (item.title + ' ' + (item.keywords || []).join(' ') + ' ' + (item.cliffs_notes_summary || item.summary || '')).toLowerCase();
            
            terms.forEach(term => {
                if (itemText.includes(term)) score += 5;
                if (item.filename.toLowerCase().includes(term)) score += 10;
            });

            return { item, score };
        }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

        if (scoredFiles.length > 0) {
            topMatch = scoredFiles[0].item;
        }
    }

    if (!topMatch) return null;

    let fileContent = '';
    const rel = topMatch.relative_path || topMatch.filename;
    const possiblePaths = [
        path.join(G_DRIVE_VAULT_DIR, rel),
        path.join(LOCAL_VAULT_DIR, rel),
        path.join(LOCAL_VAULT_DIR, topMatch.filename),
        path.join(G_DRIVE_VAULT_DIR, topMatch.filename)
    ];

    for (let p of possiblePaths) {
        if (fs.existsSync(p)) {
            fileContent = fs.readFileSync(p, 'utf8');
            break;
        }
    }

    if (!fileContent) return null;

    const summaryText = topMatch.cliffs_notes_summary || topMatch.summary || 'Session memory log.';
    const injectedBlock = `[MNEOS SOVEREIGN VAULT MEMORY RETRIEVED]
Source File: ${topMatch.filename}
Date: ${topMatch.date || 'Unknown'}
Summary: ${summaryText}
Relevant Excerpt / Session Context:
${fileContent.substring(0, 3500)}
[END MNEOS MEMORY RETRIEVAL]`;

    return {
        matched_filename: topMatch.filename,
        injected_block: injectedBlock
    };
}

function refreshMetaIndexAsync(savedFilePath) {
    try {
        if (savedFilePath) {
            console.log(`[Zen Sentinel] 🧠 Triggering Brita-Lite background distillation for: ${path.basename(savedFilePath)}`);
            const { spawn } = require('child_process');
            const child = spawn('node', ['C:\\MneOS\\scripts\\ai_master_indexer.cjs', savedFilePath], {
                detached: true,
                stdio: 'inherit'
            });
            child.unref();
        }
    } catch(e) {
        console.warn('[Zen Sentinel] Async distillation trigger error:', e.message);
    }
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Direct HTTP UserScript Server Endpoint for 1-Click Updates
    if (req.method === 'GET' && (req.url.includes('mneos_batch_harvester.user.js') || req.url.includes('mneos_gemini_harvester.user.js'))) {
        const targetScript = req.url.includes('mneos_gemini_harvester.user.js') 
            ? path.join('C:', 'MneOS', 'scripts', 'mneos_gemini_harvester.user.js')
            : SCRIPT_PATH;
        if (fs.existsSync(targetScript)) {
            const scriptContent = fs.readFileSync(targetScript, 'utf8');
            res.writeHead(200, {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(scriptContent);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('UserScript file not found.');
        }
        return;
    }

    if ((req.method === 'GET' || req.method === 'POST') && (req.url === '/api/list-vault' || req.url.startsWith('/api/list-vault'))) {
        const vaultBase = fs.existsSync(G_DRIVE_VAULT_DIR) ? G_DRIVE_VAULT_DIR : LOCAL_VAULT_DIR;
        const indexPath = path.join(vaultBase, '_INDEXES', '00_MASTER_META_INDEX.json');
        let indexData = [];
        if (fs.existsSync(indexPath)) {
            try {
                indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
            } catch (e) {}
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', total: indexData.length, items: indexData }));
        return;
    }

    if (req.method === 'GET' && (req.url === '/api/harvested-session-ids' || req.url.startsWith('/api/harvested-session-ids'))) {
        const rescuedDir = path.join(LOCAL_VAULT_DIR, 'GEMINI_SESSIONS', 'RESCUED_ALL');
        const harvestedIds = [];
        if (fs.existsSync(rescuedDir)) {
            try {
                const files = fs.readdirSync(rescuedDir).filter(f => f.endsWith('.md'));
                files.forEach(f => {
                    const match = f.match(/([a-f0-9]{12,64})/i);
                    if (match && !harvestedIds.includes(match[1])) {
                        harvestedIds.push(match[1]);
                    } else {
                        // Header inspection fallback
                        try {
                            const content = fs.readFileSync(path.join(rescuedDir, f), 'utf8').substring(0, 500);
                            const idMatch = content.match(/# Session ID:\s*([a-f0-9]{12,64})/i);
                            if (idMatch && !harvestedIds.includes(idMatch[1])) {
                                harvestedIds.push(idMatch[1]);
                            }
                        } catch(e) {}
                    }
                });
            } catch(e) {}
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', count: harvestedIds.length, harvestedIds }));
        return;
    }

    if (req.method === 'POST' && req.url === '/api/hypersearch') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const query = data.query || '';
                const filename = data.filename || null;
                console.log(`[Zen Sentinel] ⚡ HyperSearch Query received: "${query}" ${filename ? '(Target file: ' + filename + ')' : ''}`);
                const result = performHyperSearch(query, filename);

                if (result) {
                    console.log(`[Zen Sentinel] ✅ Matched vault file: ${result.matched_filename}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'success', ...result }));
                } else {
                    console.log(`[Zen Sentinel] ⚠️ No hypersearch match for: "${query}"`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'not_found', message: 'No matching vault memory found.' }));
                }
            } catch(e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/api/nuke-session') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const filename = data.filename;
                if (filename) {
                    [LOCAL_VAULT_DIR, G_DRIVE_VAULT_DIR, LOCAL_TECH_VAULT_DIR, G_DRIVE_TECH_VAULT_DIR].forEach(dir => {
                        const target = path.join(dir, filename);
                        if (fs.existsSync(target)) {
                            try { fs.unlinkSync(target); console.log(`[Zen Sentinel] 💥 Nuked refusal file: ${target}`); } catch(e) {}
                        }
                    });
                    setTimeout(refreshMetaIndexAsync, 500);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'nuked', filename }));
            } catch(e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: e.message }));
            }
        });
        return;
    }

    if (req.method === 'POST' && (req.url === '/api/save-session' || req.url === '/ingest' || req.url.startsWith('/ingest'))) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const platform = data.platform || 'GROK';
                const sessionTitle = data.sessionTitle || data.title || 'Untitled_Session';
                const title = sanitizeFilename(sessionTitle);
                let rawContent = data.content || '';
                const turnCount = data.turnCount || (Array.isArray(data.turns) ? data.turns.length : 0);

                let normalizedTurns = [];

                if (Array.isArray(data.turns)) {
                    data.turns.forEach(t => {
                        let text = (t.text || '').trim();
                        // Check if turn text contains multiple embedded speaker turns (e.g. **Eric:** / **Gemini:**)
                        const embeddedPattern = /(?:\n|^)(?:\*\*(?:Eric|Gemini|Brita|User|Assistant|Model):\*\*|(?:Eric|Gemini|Brita|User|Assistant|Model):)/i;
                        if (embeddedPattern.test(text)) {
                            const lines = text.split('\n');
                            let currentSpeaker = t.speaker || 'USER';
                            let currentBuffer = [];

                            lines.forEach(l => {
                                const match = l.match(/^(?:\*\*(Eric|Gemini|Brita|User|Assistant|Model):\*\*|(Eric|Gemini|Brita|User|Assistant|Model):)\s*(.*)/i);
                                if (match) {
                                    if (currentBuffer.length > 0) {
                                        normalizedTurns.push({ speaker: currentSpeaker, text: currentBuffer.join('\n').trim() });
                                        currentBuffer = [];
                                    }
                                    const rawSpk = (match[1] || match[2]).toUpperCase();
                                    currentSpeaker = (rawSpk === 'ERIC' || rawSpk === 'USER') ? 'USER' : 'ASSISTANT';
                                    if (match[3]) currentBuffer.push(match[3]);
                                } else {
                                    currentBuffer.push(l);
                                }
                            });
                            if (currentBuffer.length > 0) {
                                normalizedTurns.push({ speaker: currentSpeaker, text: currentBuffer.join('\n').trim() });
                            }
                        } else {
                            // Strip any leading speaker prefix
                            text = text.replace(/^(?:\*\*(?:Eric|Gemini|Brita|User|Assistant|Model):\*\*|(?:Eric|Gemini|Brita|User|Assistant|Model):)\s*/i, '');
                            normalizedTurns.push({ speaker: t.speaker, text: text });
                        }
                    });
                }

                if (!rawContent && normalizedTurns.length > 0) {
                    rawContent = normalizedTurns.map(t => {
                        const speakerName = (t.speaker === 'USER' || t.speaker === 'Eric') ? 'Eric' : 'Brita';
                        let cleanText = (t.text || '').replace(/^(?:\*\*(?:Eric|Gemini|Brita|User|Assistant|Model):\*\*|(?:Eric|Gemini|Brita|User|Assistant|Model):)\s*/i, '');
                        return `**${speakerName}**\n${cleanText}`;
                    }).join('\n\n------------------------------------------------------------\n\n');
                }

                // EMERGENCY RESCUE MODE: Zero filtering, zero drops. All sessions dumped directly into RESCUED_ALL folder.
                const cleanTurns = rawContent || 'No turn text extracted.';
                const categoryFolder = 'RESCUED_ALL';
                const platformFolder = `${platform.toUpperCase()}_SESSIONS`;

                const localSubDir = path.join(LOCAL_VAULT_DIR, platformFolder, categoryFolder);
                const gDriveSubDir = path.join(G_DRIVE_VAULT_DIR, platformFolder, categoryFolder);

                if (!fs.existsSync(localSubDir)) fs.mkdirSync(localSubDir, { recursive: true });
                if (!fs.existsSync(gDriveSubDir)) fs.mkdirSync(gDriveSubDir, { recursive: true });

                const rawTimestamp = data.timestamp || data.createdDate || data.date;
                let dateStr = null;

                if (rawTimestamp) {
                    try {
                        const parsed = new Date(rawTimestamp);
                        if (!isNaN(parsed.getTime())) {
                            dateStr = parsed.toISOString().split('T')[0];
                        }
                    } catch(e) {}
                }

                if (!dateStr) {
                    dateStr = new Date().toISOString().split('T')[0];
                }

                const sessionHexId = data.sessionId || `session_${Date.now()}`;
                const header = `# ${platform.toUpperCase()} Rescued Session Log: ${sessionTitle}\n# Session ID: ${sessionHexId}\n# Category: ${categoryFolder}\n# Date: ${dateStr}\n\n`;
                const fullDoc = header + cleanTurns;

                const filename = `${title}_${sessionHexId}.md`;

                // Self-Healing Vault Maintenance: Locate existing file for this session
                let targetLocalPath = path.join(localSubDir, filename);
                let targetGDrivePath = path.join(gDriveSubDir, filename);
                let existingFileFound = false;

                if (fs.existsSync(localSubDir)) {
                    const existingFiles = fs.readdirSync(localSubDir).filter(f => f.endsWith('.md'));
                    for (let f of existingFiles) {
                        if (f.includes(sessionHexId)) {
                            targetLocalPath = path.join(localSubDir, f);
                            targetGDrivePath = path.join(gDriveSubDir, f);
                            existingFileFound = true;
                            break;
                        }
                    }
                }

                const isGenericFilename = filename.toLowerCase().includes('google_account') || 
                                          filename.toLowerCase().includes('untitled_session') || 
                                          filename.toLowerCase().startsWith('gemini_session_') || 
                                          filename.toLowerCase().startsWith('grok_session_');

                if (existingFileFound && !isGenericFilename) {
                    try {
                        const existingDoc = fs.readFileSync(targetLocalPath, 'utf8');
                        if (existingDoc.trim() === fullDoc.trim()) {
                            console.log(`[Zen Sentinel] ⏩ Content unchanged for [${path.basename(targetLocalPath)}]. Skipping redundant rewrite.`);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ status: 'unchanged', filename: path.basename(targetLocalPath) }));
                            return;
                        }
                    } catch(e) {}
                }

                fs.writeFileSync(targetLocalPath, fullDoc, 'utf8');

                let gDrivePath = null;
                try {
                    gDrivePath = targetGDrivePath;
                    fs.writeFileSync(gDrivePath, fullDoc, 'utf8');
                } catch (e) {
                    console.warn(`[Zen Sentinel] Could not write to G: drive (${e.message})`);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'success',
                    isTech: false,
                    filename: filename,
                    suggested_smart_title: sessionTitle,
                    gDrivePath
                }));

                console.log(`[Zen Sentinel] ✅ Successfully saved session [${platformFolder}/${categoryFolder}]: ${filename} (Title: "${sessionTitle}")`);

                // Trigger Brita-ECH LLM Distillation & Reverse-Sync asynchronously in background
                try {
                    delete require.cache[require.resolve('./ai_master_indexer.cjs')];
                    const { processSingleFile } = require('./ai_master_indexer.cjs');
                    processSingleFile(targetLocalPath, (dErr, entry) => {
                        const smartTitle = (entry && entry.suggested_smart_title) ? entry.suggested_smart_title : sessionTitle;
                        const finalFilename = (entry && entry.filename) ? entry.filename : filename;
                        console.log(`[Zen Sentinel] 🧠 Distilled session [${platformFolder}/${categoryFolder}]: ${finalFilename} (Title: "${smartTitle}")`);
                    });
                } catch(dErr) {
                    console.warn(`[Zen Sentinel] Background indexer warning:`, dErr.message);
                }
            } catch (err) {
                console.error('[Zen Sentinel] Error processing payload:', err.message);
                if (!res.headersSent) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: err.message }));
                }
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

// --- Dynamic Fuel Gauge Heartbeat (1M Token Scale / Gemini 3.6 Flash High) ---
function updateFuelGauge() {
    try {
        const brainDir = path.join(process.env.USERPROFILE || 'C:\\Users\\artin', '.gemini', 'antigravity', 'brain');
        if (!fs.existsSync(brainDir)) return;

        let newestFile = null;
        let newestMtime = 0;

        const convDirs = fs.readdirSync(brainDir);
        for (const dir of convDirs) {
            const overviewPath = path.join(brainDir, dir, '.system_generated', 'logs', 'overview.txt');
            if (fs.existsSync(overviewPath)) {
                const stat = fs.statSync(overviewPath);
                if (stat.mtimeMs > newestMtime) {
                    newestMtime = stat.mtimeMs;
                    newestFile = overviewPath;
                }
            }
        }

        if (newestFile) {
            const stat = fs.statSync(newestFile);
            const sizeBytes = stat.size;
            const approxTokens = Math.round(sizeBytes / 4);
            const maxTokens = 1000000;
            const pctUsed = Math.min(100, Math.round((approxTokens / maxTokens) * 100));
            const pctRemaining = Math.max(0, 100 - pctUsed);
            const kbSize = Math.round(sizeBytes / 1024);

            const filledBars = Math.min(10, Math.round((pctRemaining / 100) * 10));
            const emptyBars = 10 - filledBars;
            const barGraph = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

            const fuelGaugeContent = `# 🔋 CONTEXT FUEL GAUGE: [${barGraph}] ${pctRemaining}% REMAINING 🔋\n` +
                `[STATUS]: OPTIMIZED - Gemini 3.6 Flash (High) | Used: ${approxTokens.toLocaleString()} / 1,000,000 Tokens (${kbSize} KB / 4.0 MB) | General Order 4 Active\n`;

            const gaugeFile = path.join(__dirname, '..', '.agent', 'rules', 'fuel-gauge.md');
            fs.writeFileSync(gaugeFile, fuelGaugeContent, 'utf8');
        }
    } catch (err) {
        // Silent background telemetry catch
    }
}

server.listen(PORT, () => {
    console.log(`[Zen Sentinel] Sovereign Harvester & HyperSearch Daemon running on http://localhost:${PORT}`);
    updateFuelGauge();
    setInterval(updateFuelGauge, 15000);
});

