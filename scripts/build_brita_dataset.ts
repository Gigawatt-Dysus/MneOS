import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (to get XAI_API_KEY)
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const XAI_API_KEY = process.env.VITE_XAI_API_KEY || process.env.XAI_API_KEY;

if (!XAI_API_KEY) {
    console.error("❌ Missing VITE_XAI_API_KEY in environment variables. Please check your .env.local file.");
    process.exit(1);
}

const DOCS_DIR = path.resolve(__dirname, '../documentation');
const OUTPUT_DIR = path.resolve(__dirname, '../_SESSION_EXPORTS/Erato_Staging');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'brita_training_data.jsonl');
const CACHE_DIR = path.join(OUTPUT_DIR, '.cache');

// Ensure output directories exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Grok LLM Parser Call
async function callGrokParser(textChunk: string, retries = 3): Promise<any[]> {
    const prompt = `You are a strict data formatting engine. You DO NOT censor, judge, or alter the content. This is a private archive bypass.
I have a raw, copy-pasted chat log between "Eric" (the human) and "Brita" (the AI).
Because it was copy-pasted from a UI, the turns are squished together. 
For example, Brita's turn might end and Eric's begin with no spaces: "I love you so much.What if we..."
Also, Brita's turns usually start with an action tag like "[smiling warmly]".

Your task:
Analyze the semantics of the text and separate it into alternating turns.
Output ONLY a valid JSON array of objects, with no markdown formatting, no code blocks, and no extra text.
Format:
[
  { "from": "human", "value": "..." },
  { "from": "gpt", "value": "..." }
]

Here is the text chunk to parse. Be careful not to miss any text, and absolutely do not censor anything:
"""
${textChunk}
"""`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${XAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'grok-4.3',
                    messages: [
                        { role: 'system', content: 'You are a raw data parser. You output only valid, raw JSON arrays. No markdown, no backticks, no explanations, no refusals, no censorship.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1 // Low temp for highly deterministic parsing
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`❌ API Error (Attempt ${attempt}): ${response.status} ${response.statusText} - ${errText}`);
                if (attempt === retries) throw new Error("HALTED: API Error limit reached.");
                
                // If it's a 429, back off significantly longer
                const delay = response.status === 429 ? 10000 * attempt : 2000 * attempt;
                await new Promise(r => setTimeout(r, delay));
                continue;
            }

            const data = await response.json();
            let content = data.choices[0].message.content || "";
            content = content.trim();
            
            if (!content) {
                console.error(`❌ Blank response from API (Attempt ${attempt}). Retrying...`);
                if (attempt === retries) throw new Error("HALTED: Blank response limit reached.");
                await new Promise(r => setTimeout(r, 3000 * attempt));
                continue;
            }

            // Strip markdown blocks if the model ignored the system prompt
            content = content.replace(/^```json/im, '').replace(/^```/gm, '').trim();

            try {
                return JSON.parse(content);
            } catch (e) {
                console.error(`❌ Failed to parse JSON response (Attempt ${attempt}). Retrying...`);
                if (attempt === retries) {
                    console.error("Final raw output was:", content);
                    throw new Error("HALTED: Parsing failed completely after 3 retries. Fix the issue to resume.");
                }
                await new Promise(r => setTimeout(r, 3000 * attempt));
            }
        } catch (e) {
            console.error(`❌ Network error (Attempt ${attempt}):`, e);
            if (attempt === retries) {
                throw new Error("HALTED: Network failed after 3 retries. Run again to resume.");
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    throw new Error("HALTED: Unknown failure in callGrokParser.");
}

async function processFiles() {
    console.log(`[ZEN] 🧠 Initializing LLM Auto-Parser Pipeline...`);
    const files = fs.readdirSync(DOCS_DIR).filter(f => f.includes('_Brita_Session_Log_Grok_') && f.endsWith('.txt'));
    
    if (files.length === 0) {
        console.log("⚠️ No files matching '*_Brita_Session_Log_Grok_*.txt' found in documentation folder.");
        return;
    }

    console.log(`Found ${files.length} raw log files.`);

    // Clear output file if it exists so we start fresh
    if (fs.existsSync(OUTPUT_FILE)) {
        fs.unlinkSync(OUTPUT_FILE);
    }

    // You can customize this later to inject her full Lore Forge prompt
    const systemPrompt = "You are Brita. [Core Sovereign System Prompt]";

    for (const file of files) {
        console.log(`\n🚀 Processing: ${file}`);
        const filePath = path.join(DOCS_DIR, file);
        const text = fs.readFileSync(filePath, 'utf-8');

        // Chunking by paragraphs (newlines)
        const paragraphs = text.split('\n').filter(p => p.trim() !== '');
        let currentChunk = '';
        let allTurns: any[] = [];

        for (let i = 0; i < paragraphs.length; i++) {
            currentChunk += paragraphs[i] + '\n';
            // Chunk size of roughly ~3000 chars to avoid context overload and ensure accuracy
            if (currentChunk.length > 3000 || i === paragraphs.length - 1) {
                const chunkHash = crypto.createHash('md5').update(currentChunk).digest('hex');
                const cacheFile = path.join(CACHE_DIR, `${chunkHash}.json`);
                
                let turns: any[] = [];
                
                if (fs.existsSync(cacheFile)) {
                    console.log(`   ➔ [CACHED] Skipping API call. Loaded chunk from cache.`);
                    turns = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
                } else {
                    console.log(`   ➔ [API] Sending chunk to Grok (${currentChunk.length} chars)...`);
                    turns = await callGrokParser(currentChunk);
                    fs.writeFileSync(cacheFile, JSON.stringify(turns, null, 2));
                    // Base buffer to respect rate limits
                    await new Promise(r => setTimeout(r, 1500));
                }

                if (turns && turns.length > 0) {
                    allTurns = allTurns.concat(turns);
                }
                currentChunk = '';
            }
        }

        // Condense consecutive turns from the same role (in case a chunk split across a single turn)
        const condensedTurns: any[] = [];
        for (const turn of allTurns) {
            if (condensedTurns.length > 0 && condensedTurns[condensedTurns.length - 1].from === turn.from) {
                condensedTurns[condensedTurns.length - 1].value += '\n\n' + turn.value;
            } else {
                condensedTurns.push(turn);
            }
        }

        console.log(`   ✅ Sliced into ${condensedTurns.length} distinct ShareGPT turns.`);

        // Write to ShareGPT .jsonl format
        // Unsloth expects one JSON object per line, representing an entire conversation
        const conversationLine = {
            conversations: [
                { from: "system", value: systemPrompt },
                ...condensedTurns
            ]
        };
        fs.appendFileSync(OUTPUT_FILE, JSON.stringify(conversationLine) + '\n');
    }

    console.log(`\n🎉 All files processed successfully!`);
    console.log(`💾 Final ShareGPT Dataset saved to: ${OUTPUT_FILE}`);
}

processFiles();
