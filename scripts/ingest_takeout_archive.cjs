/**
 * 📦 MneOS Sovereign Takeout Ingestion Engine
 * Reads Google Takeout exports (Gemini Apps & NotebookLM), parses raw JSON/HTML chat histories,
 * normalizes them into sovereign MneOS Markdown + JSON metadata schema, and registers them
 * into the local RESCUED_ALL vault for indexing.
 * 
 * Usage: node scripts/ingest_takeout_archive.cjs "C:\Path\To\TakeoutFolder"
 */

const fs = require('fs');
const path = require('path');

const VAULT_DIR = path.join(__dirname, '..', 'RESCUED_ALL');
if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
}

function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase().substring(0, 60);
}

function parseGeminiJson(filePath) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);

        // Handle single chat or array of chats
        const chats = Array.isArray(data) ? data : [data];
        let ingestedCount = 0;

        for (const chat of chats) {
            const title = chat.title || chat.name || 'Gemini_Takeout_Session';
            const timestamp = chat.createTime || chat.updateTime || new Date().toISOString();
            const turns = [];

            // Standard Google Takeout Gemini schema variants
            const rawMessages = chat.messages || chat.parts || chat.turns || chat.conversation || [];

            for (const msg of rawMessages) {
                const speaker = (msg.author === 'user' || msg.role === 'user' || msg.speaker === 'user') ? 'USER' : 'GEMINI';
                let text = '';

                if (typeof msg.text === 'string') {
                    text = msg.text;
                } else if (msg.parts && Array.isArray(msg.parts)) {
                    text = msg.parts.map(p => typeof p === 'string' ? p : p.text || '').join('\n');
                } else if (typeof msg === 'string') {
                    text = msg;
                }

                if (text.trim()) {
                    turns.push({ speaker, text: text.trim(), timestamp: msg.timestamp || timestamp });
                }
            }

            if (turns.length > 0) {
                saveToVault(title, timestamp, turns, filePath);
                ingestedCount++;
            }
        }
        return ingestedCount;
    } catch(e) {
        return 0;
    }
}

function saveToVault(title, timestamp, turns, sourceFile) {
    const dateStr = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
    const safeTitle = sanitizeFilename(title);
    const id = `gemini_takeout_${safeTitle}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const jsonPath = path.join(VAULT_DIR, `${id}.json`);
    const mdPath = path.join(VAULT_DIR, `${id}.md`);

    const metadata = {
        id,
        title,
        platform: 'Gemini',
        source: 'Google_Takeout',
        created_at: timestamp,
        turn_count: turns.length,
        source_file: path.basename(sourceFile)
    };

    let mdContent = `# ${title}\n\n`;
    mdContent += `*Platform*: Gemini (Google Takeout Export)\n`;
    mdContent += `*Imported*: ${new Date().toISOString()}\n`;
    mdContent += `*Created*: ${timestamp}\n\n`;
    mdContent += `---\n\n`;

    for (const turn of turns) {
        const roleLabel = turn.speaker === 'USER' ? '### 👤 User' : '### 🤖 Gemini';
        mdContent += `${roleLabel}\n${turn.text}\n\n`;
    }

    fs.writeFileSync(jsonPath, JSON.stringify({ metadata, turns }, null, 2), 'utf8');
    fs.writeFileSync(mdPath, mdContent, 'utf8');

    console.log(`  [+] Ingested: "${title}" (${turns.length} turns) -> ${id}.json`);
}

function htmlToMarkdown(htmlString) {
    if (!htmlString) return '';
    let text = htmlString;
    // 1. Convert <img src="..."> to ![Embedded Image](src)
    text = text.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, '\n\n![Embedded Image]($1)\n\n');
    // 2. Convert <a href="...">text</a> to [text](href)
    text = text.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    // 3. Convert <br> and block breaks to newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n');
    // 4. Strip remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');
    // 5. Unescape HTML entities
    text = text.replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'");
    return text.trim();
}

function parseGeminiGemsHtml(filePath) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const blocks = raw.split(/<b>Name:<\/b>/i).slice(1);
        let count = 0;

        for (const block of blocks) {
            const nameMatch = block.match(/^(.*?)<br>/i);
            const instMatch = block.match(/<b>Instructions:<\/b>([\s\S]*?)(?:<b>Files:<\/b>|<br><br><b>Name:<\/b>|$)/i);

            const name = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, '').trim() : 'Gemini_Custom_Gem';
            const instructions = instMatch ? htmlToMarkdown(instMatch[1]) : '';

            if (name && (instructions || name)) {
                const turns = [
                    { speaker: 'USER', text: `System Directive Configuration for Gem "${name}"` },
                    { speaker: 'GEMINI', text: instructions || 'No explicit instructions string provided.' }
                ];
                saveToVault(`Gem_Directive_${name}`, new Date().toISOString(), turns, filePath);
                count++;
            }
        }
        return count;
    } catch(e) {
        return 0;
    }
}

function parseMyActivityHtml(filePath) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const items = raw.split(/<div class="outer-cell/i).slice(1);
        let count = 0;

        for (const item of items) {
            const textMatch = item.match(/<div class="content-cell[^">]*">(.*?)<\/div>/is);
            if (textMatch) {
                const cleanText = htmlToMarkdown(textMatch[1]);
                if (cleanText) {
                    const turns = [{ speaker: 'USER', text: cleanText }];
                    saveToVault(`MyActivity_Gemini_${Date.now()}_${count}`, new Date().toISOString(), turns, filePath);
                    count++;
                }
            }
        }
        return count;
    } catch(e) {
        return 0;
    }
}

function scanDirectory(dirPath) {
    console.log(`\n🔍 Scanning directory for Takeout archives: ${dirPath}`);
    let totalIngested = 0;

    function walk(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile()) {
                if (entry.name.endsWith('.json')) {
                    totalIngested += parseGeminiJson(fullPath);
                } else if (entry.name.includes('gems') && entry.name.endsWith('.html')) {
                    totalIngested += parseGeminiGemsHtml(fullPath);
                } else if (entry.name.includes('MyActivity') || entry.name.includes('Activity')) {
                    totalIngested += parseMyActivityHtml(fullPath);
                }
            }
        }
    }

    walk(dirPath);
    console.log(`\n🎉 Ingestion Complete! Total Takeout Sessions & Directives Restored: ${totalIngested}`);
    console.log(`📁 Target Vault: ${VAULT_DIR}`);
}

const targetDir = process.argv[2];
if (!targetDir) {
    console.log('Usage: node scripts/ingest_takeout_archive.cjs "<PathToExtractedTakeoutFolder>"');
    process.exit(1);
}

if (!fs.existsSync(targetDir)) {
    console.error(`Error: Path does not exist: ${targetDir}`);
    process.exit(1);
}

scanDirectory(targetDir);
