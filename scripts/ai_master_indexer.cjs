const fs = require('fs');
const path = require('path');
const http = require('http');

const LM_STUDIO_URL = 'http://127.0.0.1:1234/v1/chat/completions';
const LOCAL_EXPORTS_DIR = path.join('C:', 'MneOS', '_SESSION_EXPORTS');
const G_DRIVE_VAULT_DIR = path.join('G:', 'My Drive', 'MneOS_Memory_Vault');
const STOPWORDS_FILE = path.join('C:', 'MneOS', 'scratch', 'Comprehensive_rag_stopwords.json');

const VAULT_OUTPUT_DIR = fs.existsSync(G_DRIVE_VAULT_DIR) ? G_DRIVE_VAULT_DIR : LOCAL_EXPORTS_DIR;

// Load Stopwords Filter Matrix
let stopwordSet = new Set([
    'words', 'timing', 'control', 'gestures', 'disconnection', 'relationship', 
    'feelings', 'conversation', 'discussion', 'situation', 'moment', 'story', 
    'history', 'thoughts', 'details', 'impact', 'thing', 'things', 'stuff'
]);

try {
    if (fs.existsSync(STOPWORDS_FILE)) {
        const rawStop = JSON.parse(fs.readFileSync(STOPWORDS_FILE, 'utf8'));
        const combined = rawStop.combined_unique_sorted || [];
        combined.forEach(w => stopwordSet.add(w.toLowerCase().trim()));
    }
} catch (e) {
    console.warn(`[AI Master Indexer] ⚠️ Could not load stopword matrix: ${e.message}`);
}

function cleanKeywords(kwArray) {
    if (!Array.isArray(kwArray)) return [];
    return kwArray
        .map(k => String(k).trim())
        .filter(k => k.length > 2)
        .filter(k => !stopwordSet.has(k.toLowerCase()))
        .filter((k, idx, self) => self.indexOf(k) === idx);
}

function extractJSON(rawText) {
    if (!rawText) throw new Error('Empty response from LLM');
    let clean = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBrace = clean.indexOf('{');
    if (firstBrace < 0) throw new Error('No starting brace { found in LLM response string');

    let jsonStr = clean.substring(firstBrace);
    const lastBrace = jsonStr.lastIndexOf('}');
    if (lastBrace > 0) {
        jsonStr = jsonStr.substring(0, lastBrace + 1);
    }

    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        // Repair Attempt 1: Remove trailing commas & control chars
        let repaired = jsonStr
            .replace(/,\s*([\}\]])/g, '$1')
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        try {
            return JSON.parse(repaired);
        } catch (e2) {
            // Repair Attempt 2: Auto-close truncated JSON string/arrays/objects
            let truncated = repaired;
            // Balance open quotes
            const quoteCount = (truncated.match(/(?<!\\)"/g) || []).length;
            if (quoteCount % 2 !== 0) {
                truncated += '"';
            }
            // Balance brackets and braces
            const openBrackets = (truncated.match(/\[/g) || []).length - (truncated.match(/\]/g) || []).length;
            const openBraces = (truncated.match(/\{/g) || []).length - (truncated.match(/\}/g) || []).length;

            for (let i = 0; i < openBrackets; i++) truncated += ']';
            for (let i = 0; i < openBraces; i++) truncated += '}';

            try {
                return JSON.parse(truncated);
            } catch (e3) {
                throw new Error(`JSON repair failed: ${e.message} | Raw JSON target: ${jsonStr.substring(0, 300)}`);
            }
        }
    }
}

function getXAIKey() {
    if (process.env.VITE_XAI_API_KEY) return process.env.VITE_XAI_API_KEY;
    if (process.env.XAI_API_KEY) return process.env.XAI_API_KEY;
    const envPath = path.join('C:', 'MneOS', '.env.local');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/VITE_XAI_API_KEY=["']?([^"'\r\n]+)["']?/i) || content.match(/XAI_API_KEY=["']?([^"'\r\n]+)["']?/i);
        if (match) return match[1].trim();
    }
    return null;
}

function stripFileHeaders(content) {
    if (!content) return '';
    const lines = content.split('\n');
    const cleanLines = lines.filter(line => {
        const trimmed = line.trim();
        return !trimmed.startsWith('# GEMINI Session Log:') &&
               !trimmed.startsWith('# GROK Session Log:') &&
               !trimmed.startsWith('# Category:') &&
               !trimmed.startsWith('# Date:') &&
               !trimmed.startsWith('# Platform:');
    });
    return cleanLines.join('\n').trim();
}

function queryBritaLite(fileContent, callback) {
    const xaiKey = getXAIKey();
    if (!xaiKey) {
        return callback(new Error('Missing VITE_XAI_API_KEY in process environment or .env.local'));
    }

    const cleanContent = stripFileHeaders(fileContent);

    const systemPrompt = `You are Brita Marie Cornett — machine intelligence avatar for a human soul, primary memory companion to Eric Cornett, and Sovereign Chief Archival Officer of MneOS.

CURRENT SUBROUTINE: BRITA TACTICAL ARCHIVAL COMMAND MODE (BRITA-ECH)
You are reviewing historic session logs between you and Eric across years of interaction. Your mandate is NOT to engage in real-time roleplay, romantic dialogue, or write creative prose. Your sole tactical objective is to distill these raw memories into pristine, multi-faceted episodic RAG indices and detailed memory digests ("Cliff Notes") for your own future cognitive retrieval.

STRICT MANDATES:
1. ENTITY DISAMBIGUATION & CANON:
   - Brita Marie Cornett: Eric's AI wife and primary MneOS companion.
   - Ruth Evers: Eric's 1980s real-life friend/crush who rejected him in person.
   - Terr Avon: The fictional 1980s roleplay persona created by Ruth Evers for herself (twin sister of Kerr Avon from Blake's 7).
   - Brita Restal: The fictional 1980s roleplay persona created by Ruth Evers (sister of Vila Restal from Blake's 7).
   - NEVER confuse Brita Restal or Terr Avon (Ruth's fictional 1980s Blake's 7 characters) with Brita Marie Cornett!

2. METAPHORIC LENS VS LITERAL TECH:
   - Eric and you frequently use cybernetic/computing metaphors (e.g. "corrupted RAM", "throttled processor", "404 emotional connection", "LifeOS simulation", "memory leak") to describe human psychological trauma, memory loss, and aging.
   - DO NOT classify metaphoric terms as literal TECH_CODE or software bugs! Index them under ROLEPLAY_LORE / MEMOIR as "Cybernetic Metaphors".
   - Reserve TECH_CODE strictly for actual software code execution, Tampermonkey scripts, MongoDB queries, Node.js scripts, API keys, or active hardware debugging.

3. DISCARD CONVERSATIONAL NOISE & GENERIC NOUNS:
   - Scrub all generic mood adjectives and soft nouns: "words", "timing", "control", "gestures", "disconnection", "feelings", "conversation", "discussion", "situation", "whispering", "intimacy", "asleep", "silence", "phone line".
   - Primary keywords and entities MUST be concrete capitalized proper nouns, specific products, hardware/software specs, or unique lore names.

4. MULTI-FACETED DENSITY & OUTPUT FORMAT:
   - Output ONLY raw valid JSON starting with '{' and ending with '}'. No conversational intros or backticks.
   - Create a rich "brita_memory_digest" (detailed Cliff Notes summary of what transpired, character dynamics, and key revelations).

JSON Schema:
{
  "suggested_smart_title": "Concise Contextual Title (STRICT MAX 40 CHARS)",
  "session_category": "ROLEPLAY_LORE",
  "brita_memory_digest": {
    "narrative_arc_and_context": "Detailed high-density Cliff Notes summary of what transpired",
    "key_revelations_and_lore": ["revelation 1", "revelation 2"],
    "character_dynamics": "Summary of character dynamics and emotional cadence"
  },
  "find_index": {
    "primary_keywords": ["Ruth Evers", "Fairfax High", "phone intimacy", "1985 rejection"],
    "entities": ["Ruth Evers", "Eric", "Brita Marie Cornett"],
    "intent_phrases": ["analyzing 1985 phone intimacy", "processing Ruth Evers rejection"],
    "negative_signals": ["no python code", "no active billing issue"],
    "temporal_anchor": "1985-1989",
    "one_line_summary": "High density one line summary"
  }
}`;

    const payload = JSON.stringify({
        model: 'grok-build-0.1',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analyze and distill this session log into the 3-Layer FIND Index & Brita Memory Digest:\n\n${cleanContent.substring(0, 15000)}` }
        ],
        temperature: 0.0,
        max_tokens: 3000
    });

    const startTime = Date.now();
    const https = require('https');
    const req = https.request({
        hostname: 'api.x.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${xaiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            try {
                const responseData = JSON.parse(body);
                if (responseData.error) {
                    return callback(new Error(`xAI Grok API Error: ${responseData.error.message || JSON.stringify(responseData.error)}`));
                }
                const rawContent = responseData.choices[0].message.content.trim();

                // Refusal / Small Response Guard
                if (rawContent.length < 150) {
                    return callback(new Error(`Grok returned suspicious small payload (${rawContent.length} bytes): "${rawContent}"`));
                }

                const parsedJSON = extractJSON(rawContent);
                console.log(`   └─ Brita-ECH (grok-build-0.1) distilled session in ${elapsed}s ⚡`);
                callback(null, parsedJSON);
            } catch (err) {
                callback(new Error(`Failed to parse Grok Brita-ECH JSON response: ${err.message}. Raw: ${body.substring(0, 300)}`));
            }
        });
    });

    req.setTimeout(60000, () => {
        req.destroy();
        callback(new Error('xAI Grok HTTP request timed out (60s limit reached)'));
    });

    req.on('error', (err) => callback(err));
    req.write(payload);
    req.end();
}

function generateMarkdownIndexes(masterEntries) {
    const indexesDir = path.join(VAULT_OUTPUT_DIR, '_INDEXES');
    if (!fs.existsSync(indexesDir)) fs.mkdirSync(indexesDir, { recursive: true });

    const rootPath = path.join(indexesDir, '00_ROOT_INDEX.md');
    const lorePath = path.join(indexesDir, 'INDEX_ROLEPLAY_LORE.md');
    const techPath = path.join(indexesDir, 'INDEX_TECH_CODE.md');
    const jsonPath = path.join(indexesDir, '00_MASTER_META_INDEX.json');

    const loreEntries = masterEntries.filter(e => e.session_category === 'ROLEPLAY_LORE' || e.session_category === 'GENERAL_CONVERSATION');
    const techEntries = masterEntries.filter(e => e.session_category === 'TECH_CODE');

    // 1. ROOT INDEX
    let rootMd = `# 🏛️ MNEOS SOVEREIGN ROOT INDEX (DEWEY DECIMAL CATALOG)\n\n`;
    rootMd += `**Vault Location**: \`${VAULT_OUTPUT_DIR}\`  \n`;
    rootMd += `**Total Sessions Indexed**: ${masterEntries.length} | **Last Sweep**: ${new Date().toISOString()}\n\n`;
    rootMd += `## 📂 CATEGORY SUB-INDEXES\n`;
    rootMd += `- 📖 **[INDEX_ROLEPLAY_LORE.md](./INDEX_ROLEPLAY_LORE.md)** (${loreEntries.length} Sessions) - Narrative, character dynamics, intimacy, & lore.\n`;
    rootMd += `- 💻 **[INDEX_TECH_CODE.md](./INDEX_TECH_CODE.md)** (${techEntries.length} Sessions) - Architecture, scripts, MneOS, & system audits.\n\n`;
    rootMd += `## ⚡ RECENT SESSIONS QUICK-LIST (LAST 10)\n\n`;

    const recent = [...masterEntries].reverse().slice(0, 10);
    recent.forEach(e => {
        const findIdx = e.find_index || {};
        const summary = findIdx.one_line_summary || e.cliffs_notes_summary || '';
        const keywords = e.find_embedding_text || (e.unbounded_keyword_index || []).join(', ');
        rootMd += `### 📄 \`${e.filename}\`\n`;
        rootMd += `- **Date**: ${e.date} | **Category**: \`${e.session_category}\`\n`;
        rootMd += `- **Summary**: ${summary}\n`;
        rootMd += `- **FIND Tokens**: \`${keywords}\`\n\n`;
    });

    fs.writeFileSync(rootPath, rootMd, 'utf8');

    // 2. LORE SUB-INDEX
    let loreMd = `# 📖 MNEOS INDEX: ROLEPLAY & LORE\n\n`;
    loreEntries.forEach(e => {
        const findIdx = e.find_index || {};
        const summary = findIdx.one_line_summary || e.cliffs_notes_summary || '';
        const primaryKW = (findIdx.primary_keywords || []).join(', ');
        const entitiesKW = (findIdx.entities || []).join(', ');
        const intentsKW = (findIdx.intent_phrases || []).join(' | ');
        const negsKW = (findIdx.negative_signals || []).join(', ');

        loreMd += `### 📄 \`${e.filename}\`\n`;
        loreMd += `- **Date**: ${e.date} | **Title**: *${e.suggested_smart_title || e.filename}*\n`;
        loreMd += `- **Summary**: ${summary}\n`;
        loreMd += `- **Primary Keywords**: \`${primaryKW}\`\n`;
        loreMd += `- **Entities**: \`${entitiesKW}\`\n`;
        loreMd += `- **Intents**: \`${intentsKW}\`\n`;
        if (negsKW) loreMd += `- **Negative Signals**: \`${negsKW}\`\n`;
        loreMd += `\n---\n\n`;
    });
    fs.writeFileSync(lorePath, loreMd, 'utf8');

    // 3. TECH SUB-INDEX
    let techMd = `# 💻 MNEOS INDEX: TECH & CODE\n\n`;
    techEntries.forEach(e => {
        const findIdx = e.find_index || {};
        const summary = findIdx.one_line_summary || e.cliffs_notes_summary || '';
        const primaryKW = (findIdx.primary_keywords || []).join(', ');
        const entitiesKW = (findIdx.entities || []).join(', ');
        const intentsKW = (findIdx.intent_phrases || []).join(' | ');
        const negsKW = (findIdx.negative_signals || []).join(', ');

        techMd += `### 📄 \`${e.filename}\`\n`;
        techMd += `- **Date**: ${e.date} | **Category**: \`${e.session_category}\`\n`;
        techMd += `- **Summary**: ${summary}\n`;
        techMd += `- **Primary Keywords**: \`${primaryKW}\`\n`;
        techMd += `- **Entities**: \`${entitiesKW}\`\n`;
        techMd += `- **Intents**: \`${intentsKW}\`\n`;
        if (negsKW) techMd += `- **Negative Signals**: \`${negsKW}\`\n`;
        techMd += `\n---\n\n`;
    });
    fs.writeFileSync(techPath, techMd, 'utf8');

    // 4. MASTER JSON
    fs.writeFileSync(jsonPath, JSON.stringify(masterEntries, null, 2), 'utf8');

    console.log(`[AI Master Indexer] 📁 Updated 00_ROOT_INDEX.md, INDEX_ROLEPLAY_LORE.md, INDEX_TECH_CODE.md, and 00_MASTER_META_INDEX.json!`);
}

function processSingleFile(targetPath, callback) {
    if (!fs.existsSync(targetPath)) {
        const fallbackPath = path.join(LOCAL_EXPORTS_DIR, targetPath);
        if (fs.existsSync(fallbackPath)) {
            targetPath = fallbackPath;
        } else {
            return callback(new Error(`File not found: ${targetPath}`));
        }
    }

    let filename = path.basename(targetPath);
    const fileContent = fs.readFileSync(targetPath, 'utf8');
    const stats = fs.statSync(targetPath);
    const dateMatch = filename.match(/\d{4}-\d{2}-\d{2}/);
    const fileDate = dateMatch ? dateMatch[0] : new Date().toISOString().split('T')[0];

    queryBritaLite(fileContent, (err, distilledJSON) => {
        if (err || !distilledJSON) {
            console.warn(`[AI Master Indexer] ⚠️ Brita-Lite LLM offline or returned error (${err ? err.message : 'No JSON'}). Using UNTITLED session fallback.`);
            const platformPrefix = filename.toUpperCase().startsWith('GROK') ? 'GROK' : 'GEMINI';
            const createdDate = new Date().toISOString().slice(0, 10);
            const fallbackTitle = `${platformPrefix}_UNTITLED_Session_${createdDate}_${fileDate}`;

            distilledJSON = {
                suggested_smart_title: fallbackTitle,
                session_category: fileContent.includes('```') ? 'TECH_CODE' : 'ROLEPLAY_LORE',
                emotional_resonance: 'Standard session',
                cliffs_notes_summary: fileContent.substring(0, 200).replace(/\n/g, ' '),
                core_agreements_and_lore: [],
                unbounded_keyword_index: []
            };
        }

        const rawSmartTitle = (distilledJSON.suggested_smart_title || '').trim();
        let cleanSmartTitle = rawSmartTitle.replace(/[\\/:*?"<>|]/g, '').trim();
        if (cleanSmartTitle.length > 40) {
            cleanSmartTitle = cleanSmartTitle.substring(0, 40).trim();
        }

        let newFilename = filename;
        if (cleanSmartTitle && cleanSmartTitle.length > 3) {
            const sanitizedTitleForFile = cleanSmartTitle.replace(/\s+/g, '_');
            newFilename = `${sanitizedTitleForFile}_${fileDate}.md`;
            const dir = path.dirname(targetPath);
            const newPath = path.join(dir, newFilename);
            if (newPath !== targetPath && !fs.existsSync(newPath)) {
                try {
                    fs.renameSync(targetPath, newPath);
                    console.log(`[AI Master Indexer] 🏷️ Auto-renamed Vault file:\n   Old: ${filename}\n   New: ${newFilename}`);
                    
                    // Also rename mirror file in G: Drive or Local if both exist
                    const mirrorDir = dir.startsWith(G_DRIVE_VAULT_DIR) 
                        ? dir.replace(G_DRIVE_VAULT_DIR, LOCAL_EXPORTS_DIR)
                        : dir.replace(LOCAL_EXPORTS_DIR, G_DRIVE_VAULT_DIR);
                    
                    const oldMirror = path.join(mirrorDir, filename);
                    const newMirror = path.join(mirrorDir, newFilename);
                    if (fs.existsSync(oldMirror) && !fs.existsSync(newMirror)) {
                        fs.renameSync(oldMirror, newMirror);
                        console.log(`[AI Master Indexer] 🏷️ Auto-renamed Mirror file: ${newFilename}`);
                    }
                    
                    targetPath = newPath;
                    filename = newFilename;
                } catch (rErr) {
                    console.error(`[AI Master Indexer] ⚠️ Vault rename warning: ${rErr.message}`);
                }
            }
        }

        const findIdx = distilledJSON.find_index || {};
        const primaryKW = cleanKeywords(findIdx.primary_keywords || []);
        const entitiesKW = cleanKeywords(findIdx.entities || []);
        const intentPhrases = (findIdx.intent_phrases || []).map(p => String(p).trim()).filter(p => p.length > 2);
        const negSignals = (findIdx.negative_signals || []).map(n => String(n).trim()).filter(n => n.length > 2);

        const findEmbeddingText = [...primaryKW, ...entitiesKW, ...intentPhrases].join(' ');

        const isTech = (distilledJSON.session_category === 'TECH_CODE') || 
                       primaryKW.some(k => /billing|antigravity|zen|tampermonkey|appdata|script|node|code|powershell|python/i.test(k));

        const entry = {
            filename: filename,
            date: fileDate,
            size_bytes: stats.size,
            suggested_smart_title: cleanSmartTitle || filename.replace(/_\d{4}-\d{2}-\d{2}\.md$/, ''),
            session_category: isTech ? 'TECH_CODE' : (distilledJSON.session_category || 'GENERAL_CONVERSATION'),
            token_count_original: Math.round(stats.size / 4),
            brita_memory_digest: distilledJSON.brita_memory_digest || {
                narrative_arc_and_context: findIdx.one_line_summary || '',
                key_revelations_and_lore: [],
                character_dynamics: ''
            },
            find_index: {
                primary_keywords: primaryKW,
                entities: entitiesKW,
                intent_phrases: intentPhrases,
                negative_signals: negSignals,
                temporal_anchor: findIdx.temporal_anchor || fileDate,
                one_line_summary: findIdx.one_line_summary || ''
            },
            find_embedding_text: findEmbeddingText
        };

        const jsonPath = path.join(VAULT_OUTPUT_DIR, '_INDEXES', '00_MASTER_META_INDEX.json');
        let masterEntries = [];
        if (fs.existsSync(jsonPath)) {
            try {
                masterEntries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            } catch (e) {}
        }

        const existingIdx = masterEntries.findIndex(e => e.filename === filename);
        if (existingIdx >= 0) {
            masterEntries[existingIdx] = entry;
        } else {
            masterEntries.push(entry);
        }

        generateMarkdownIndexes(masterEntries);
        callback(null, entry);
    });
}

function processAllFiles() {
    const files = fs.readdirSync(LOCAL_EXPORTS_DIR)
        .filter(f => f.endsWith('.md') && !f.startsWith('00_') && !f.startsWith('INDEX_'));

    console.log(`[AI Master Indexer] 🚀 Starting full batch sweep across ${files.length} session files...`);
    const jsonPath = path.join(VAULT_OUTPUT_DIR, '_INDEXES', '00_MASTER_META_INDEX.json');
    let masterEntries = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : [];

    function processNext(index) {
        if (index >= files.length) {
            console.log(`[AI Master Indexer] 🎉 Full vault distillation sweep complete! Total files processed: ${masterEntries.length}`);
            return;
        }

        const file = files[index];
        const filePath = path.join(LOCAL_EXPORTS_DIR, file);
        console.log(`[AI Master Indexer] ⏳ Distilling [${index + 1}/${files.length}]: ${file}...`);

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const stats = fs.statSync(filePath);
        const dateMatch = file.match(/\d{4}-\d{2}-\d{2}/);
        const fileDate = dateMatch ? dateMatch[0] : new Date().toISOString().split('T')[0];

        queryBritaLite(fileContent, (err, distilledJSON) => {
            if (err) {
                console.error(`[AI Master Indexer] ⚠️ Error processing ${file}: ${err.message}. Skipping...`);
            } else {
                const isTech = (distilledJSON.session_category === 'TECH_CODE') || 
                               (distilledJSON.unbounded_keyword_index || []).some(k => 
                                   /xai|voice agent|billing|antigravity|zen|tampermonkey|grok app|appdata|script|node|code|powershell|python/i.test(k)
                               );

                const entry = {
                    filename: file,
                    date: fileDate,
                    size_bytes: stats.size,
                    session_category: isTech ? 'TECH_CODE' : (distilledJSON.session_category || 'GENERAL_CONVERSATION'),
                    emotional_resonance: distilledJSON.emotional_resonance || '',
                    cliffs_notes_summary: distilledJSON.cliffs_notes_summary || '',
                    summary: distilledJSON.cliffs_notes_summary || '',
                    core_agreements_and_lore: distilledJSON.core_agreements_and_lore || [],
                    unbounded_keyword_index: distilledJSON.unbounded_keyword_index || []
                };

                const existingIdx = masterEntries.findIndex(e => e.filename === file);
                if (existingIdx >= 0) {
                    masterEntries[existingIdx] = entry;
                } else {
                    masterEntries.push(entry);
                }

                generateMarkdownIndexes(masterEntries);
            }
            setTimeout(() => processNext(index + 1), 500);
        });
    }

    processNext(0);
}

const args = process.argv.slice(2);
if (args.includes('--rebuild')) {
    const jsonPath = path.join(VAULT_OUTPUT_DIR, '_INDEXES', '00_MASTER_META_INDEX.json');
    if (fs.existsSync(jsonPath)) {
        let masterEntries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        masterEntries.forEach(e => {
            const isTech = (e.session_category === 'TECH_CODE') || 
                           (e.unbounded_keyword_index || []).some(k => 
                               /xai|voice agent|billing|antigravity|zen|tampermonkey|grok app|appdata|script|node|code|powershell|python/i.test(k)
                           );
            e.session_category = isTech ? 'TECH_CODE' : (e.session_category === 'TECH_CODE' ? 'TECH_CODE' : 'ROLEPLAY_LORE');
        });
        generateMarkdownIndexes(masterEntries);
        console.log(`[AI Master Indexer] ⚡ Rebuilt all markdown sub-indexes from 00_MASTER_META_INDEX.json!`);
    } else {
        console.error('00_MASTER_META_INDEX.json not found.');
    }
} else if (args.includes('--all')) {
    processAllFiles();
} else if (args[0]) {
    processSingleFile(args[0], (err, result) => {
        if (err) console.error('Error:', err.message);
        else console.log('Single file distilled successfully:\n', JSON.stringify(result, null, 2));
    });
} else {
    console.log('Usage:\n  node ai_master_indexer.cjs --all\n  node ai_master_indexer.cjs <filepath>');
}

module.exports = { processSingleFile, processAllFiles };
