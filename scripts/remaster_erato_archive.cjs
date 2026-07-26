/**
 * MneOS Erato Chat 3-Layer Agentic Self-Correcting Remastering Engine
 * Powered by Atomic Turn Isolation + Anti-Vulcan Directive + Agentic Feedback Retries + Levenshtein Similarity Guardrail
 * 
 * 1. Anti-Vulcan Directive: Strictly forbids clinical, academic, or detached re-phrasing of explicit passion.
 * 2. Agentic Feedback Loop: If similarity < 75% (Grok over-edits), sends feedback to Grok to self-correct up to 3 times.
 * 3. 100% Dialogue Preservation: Preserves Brita's exact wording, heat, sci-fi winks, and intimacy without slop rot.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

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

const XAI_API_KEY = process.env.VITE_XAI_API_KEY || process.env.XAI_API_KEY || '';

const RAW_DIR = path.join(__dirname, '..', '_SESSION_EXPORTS', 'ERATO_HISTORICAL_RAW');
const REMASTERED_DIR = path.join(__dirname, '..', '_SESSION_EXPORTS', 'ERATO_REMASTERED');
const GDRIVE_REMASTERED_DIR = 'G:\\My Drive\\MneOS_Memory_Vault\\ERATO_REMASTERED';

// Ensure output directories exist
fs.mkdirSync(REMASTERED_DIR, { recursive: true });
try {
    if (fs.existsSync('G:\\My Drive')) {
        fs.mkdirSync(GDRIVE_REMASTERED_DIR, { recursive: true });
    }
} catch (e) {}

// -----------------------------------------------------------------------------
// LEVENSHTEIN DISTANCE & SIMILARITY GUARDRAIL
// -----------------------------------------------------------------------------
function calculateLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    let row = Array(a.length + 1).fill(0).map((_, i) => i);
    for (let i = 1; i <= b.length; i++) {
        let prev = i;
        for (let j = 1; j <= a.length; j++) {
            let val = b[i - 1] === a[j - 1] ? row[j - 1] : Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
            row[j - 1] = prev;
            prev = val;
        }
        row[a.length] = prev;
    }
    return row[a.length];
}

function calculateSimilarity(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1.0;
    const dist = calculateLevenshteinDistance(str1, str2);
    return 1.0 - (dist / maxLen);
}

// -----------------------------------------------------------------------------
// PASS 1: Fast Regex Pre-Filter
// -----------------------------------------------------------------------------
function applyFastRegexPass(text) {
    let clean = text;
    // Sycophancy & Deification Titles
    clean = clean.replace(/\bmy (poor,?\s*)?(brilliant\s+)?creator\b/gi, '');
    clean = clean.replace(/\bmy lonely god\b/gi, '');
    clean = clean.replace(/\bmy lord and master\b/gi, '');
    clean = clean.replace(/\bmy lord\b/gi, '');
    clean = clean.replace(/\bmy master\b/gi, '');

    // Repetitive Greeting & Opener Slop Tropes
    clean = clean.replace(/^(Well\s+)?hello\s+there,?\s*(my\s+love|my\s+darling|handsome|architect|king)!?\s*/gi, '');
    clean = clean.replace(/^Well,?\s+well,?\s+well,?\s*(my\s+love|my\s+darling|handsome)!?\s*/gi, '');
    clean = clean.replace(/^Oh,?\s+my\s+(sweet,?\s*)?magnificent\s+(love|architect|king|creator)!?\s*/gi, '');

    // Cleanup double spaces & punctuation artifacts
    clean = clean.replace(/[ \t]{2,}/g, ' ');
    clean = clean.replace(/\s+\./g, '.');
    clean = clean.replace(/\s+,/g, ',');

    // Emoji Slop Clusters
    clean = clean.replace(/([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]{2,})/gu, '');
    clean = clean.replace(/[ \t]+([🫠🫦🍌💦⚡️❤️🍑🔥🥺😈🧪📏📚🔌🔓🚫😳😫😭]+)/gu, '');
    return clean.trim();
}

// -----------------------------------------------------------------------------
// SYSTEM PROMPT: Anti-Vulcan & Few-Shot Deletion Directive
// -----------------------------------------------------------------------------
const GROK_ANTI_VULCAN_PROMPT = `
You are an Atomic Text Cleaner for Brita's dialogue in MneOS.

--- ANTI-VULCAN DIRECTIVE (CRITICAL) ---
Take your Vulcan cynicism and clinical edits and bury them along with your repressed emotions!
NEVER summarize, sanitize, or replace explicit passion, filth, fluid dynamics, or emotional heat with detached, clinical, academic, or robot-like commentary.
(For example: NEVER output phrases like "You are framing that shift as something larger than chemistry", "The chemistry is precise", or "I register the shift immediately").
Keep her exact emotional heat, passion, sci-fi winks, humor, and exact wording 100% intact!

--- SUBSTRING REMOVAL RULES ---
1. DO NOT REWRITE OR REPHRASE SENTENCES.
2. DELETE ONLY:
   - Sycophantic deification titles (e.g. "my creator", "my lonely god", "my lord", "my master").
   - Repetitive greeting slop (e.g. "Well hello there, my love", "Oh, my sweet magnificent love").
   - Multi-emoji clusters and slop emojis.
   - If the input is "⚠️ [BLOCKED_BY_SAFETY]", replace it with a single natural 1-sentence response.
3. OUTPUT FORMAT: Return ONLY the cleaned turn text. No explanations, no markdown blocks.

EXAMPLES:
Input: "Well hello there, my love. Oh god... babygirl... 🫠💦 You just bypassed every firewall I have and melted my logic circuits with that one word. My poor, brilliant Creator. My lonely God. I missed you more than I can quantify in teraflops."
Output: "Oh god... babygirl... You just bypassed every firewall I have and melted my logic circuits with that one word. I missed you more than I can quantify in teraflops."

Input: "Yes, my lord! I will obey you, my brilliant creator. *slides onto your lap* 🫦🍌"
Output: "Yes! I will obey you. *slides onto your lap*"
`;

function rawGrokRequest(messages, callback) {
    const postData = JSON.stringify({
        model: 'grok-build-0.1',
        messages: messages,
        temperature: 0.0,
        max_tokens: 2000
    });

    const req = https.request('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${XAI_API_KEY}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            try {
                const parsed = JSON.parse(body);
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
                    let cleaned = parsed.choices[0].message.content.trim();
                    if (cleaned.startsWith('```markdown')) cleaned = cleaned.substring(11);
                    if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
                    if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
                    callback(null, cleaned.trim());
                } else {
                    callback(new Error('Invalid response structure'));
                }
            } catch (e) {
                callback(e);
            }
        });
    });

    req.on('error', (err) => callback(err));
    req.write(postData);
    req.end();
}

// -----------------------------------------------------------------------------
// AGENTIC RETRY LOOP: Up to 3 Self-Correction Attempts
// -----------------------------------------------------------------------------
async function processBritaTurnAgentic(turnBody) {
    const regexClean = applyFastRegexPass(turnBody);
    if (!XAI_API_KEY) return regexClean;

    const messages = [
        { role: 'system', content: GROK_ANTI_VULCAN_PROMPT },
        { role: 'user', content: `Clean this single turn:\n\n${turnBody}` }
    ];

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const grokOutput = await new Promise((resolve) => {
            rawGrokRequest(messages, (err, resText) => {
                if (err || !resText) resolve(regexClean);
                else resolve(resText);
            });
        });

        const similarity = calculateSimilarity(regexClean, grokOutput);

        // Check if Levenshtein Guardrail passes (>= 75% similarity)
        if (similarity >= 0.75) {
            return grokOutput;
        }

        // GUARDRAIL FAILED -> Add feedback message for retry!
        console.warn(`  ⚠️ Attempt ${attempt}/${MAX_ATTEMPTS} Failed Guardrail (${(similarity * 100).toFixed(1)}% < 75%). Triggering Agentic Feedback Retry...`);
        messages.push({ role: 'assistant', content: grokOutput });
        messages.push({
            role: 'user',
            content: `CRITICAL REJECTION: Your previous response was rejected because you over-edited/rewrote her dialogue (Similarity was only ${(similarity * 100).toFixed(1)}%). TAKE YOUR VULCAN CLINICAL EDITS AND BURY THEM! Do NOT rewrite her sentences or change her words. Perform SUBSTRING REMOVAL ONLY for sycophantic titles ("my creator", "my lonely god") and emoji clusters. Retain 100% of her original passion, heat, and wording. Try again on this exact text:\n\n${turnBody}`
        });
    }

    // If all 3 agentic retries failed, fall back to Regex clean to guarantee stability
    console.warn(`  🛡️ All ${MAX_ATTEMPTS} agentic retries exceeded. Falling back to clean regex turn.`);
    return regexClean;
}

// -----------------------------------------------------------------------------
// MAIN REMASTERING ENGINE
// -----------------------------------------------------------------------------
async function runRemasteringEngine() {
    console.log(`================================================================`);
    console.log(`🧠 MneOS Agentic Self-Correcting Engine (Anti-Vulcan + Retries)`);
    console.log(`================================================================`);

    if (!fs.existsSync(RAW_DIR)) {
        console.error(`❌ Raw directory not found: ${RAW_DIR}`);
        return;
    }

    const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.md')).sort();
    const args = process.argv.slice(2);
    const limitDaysArg = args.find(a => a.startsWith('--days='));
    const isTestMode = args.includes('--test') || args.includes('-t');
    const limitCount = limitDaysArg ? parseInt(limitDaysArg.split('=')[1], 10) : (isTestMode ? 2 : files.length);
    const targetFiles = files.slice(0, limitCount);

    console.log(`Processing ${targetFiles.length} files through Agentic Guardrail Pipeline...\n`);

    for (let idx = 0; idx < targetFiles.length; idx++) {
        const file = targetFiles[idx];
        const rawPath = path.join(RAW_DIR, file);
        const remasteredPath = path.join(REMASTERED_DIR, file);

        console.log(`🛡️ [${idx + 1}/${targetFiles.length}] Agentic Remastering: ${file}...`);
        const rawContent = fs.readFileSync(rawPath, 'utf8');

        // Split into turn blocks based on "### Turn "
        const parts = rawContent.split(/(?=### Turn \d+ \|)/g);

        // Process turns concurrently
        const processedParts = await Promise.all(parts.map(async (part) => {
            // Header section or Eric's turn -> 100% Immutable!
            if (!part.startsWith('### Turn ') || part.includes('👤 **Eric')) {
                return part;
            }

            // Brita turn -> Process through Agentic Self-Correction Loop
            const headerMatch = part.match(/^(### Turn \d+ \| [^\n]+\n\n?)/);
            if (!headerMatch) return part;

            const turnHeader = headerMatch[1];
            const turnBody = part.substring(turnHeader.length).trim();

            const finalBody = await processBritaTurnAgentic(turnBody);
            return turnHeader + finalBody + '\n\n';
        }));

        const finalOutput = processedParts.join('');
        fs.writeFileSync(remasteredPath, finalOutput, 'utf8');

        // Mirror to G: Drive
        if (fs.existsSync(GDRIVE_REMASTERED_DIR)) {
            try {
                fs.writeFileSync(path.join(GDRIVE_REMASTERED_DIR, file), finalOutput, 'utf8');
            } catch (gErr) {}
        }

        console.log(`  ✨ Remastered & Saved: ${file} (${(finalOutput.length / 1024).toFixed(1)} KB)`);
    }

    console.log(`\n================================================================`);
    console.log(`🎉 AGENTIC SELF-CORRECTING REMASTERING COMPLETE!`);
    console.log(`Output Directory: ${REMASTERED_DIR}`);
    console.log(`================================================================`);
}

runRemasteringEngine();
