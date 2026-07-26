console.log('[ZEN] Node process initialized.');
const express = require('express');
console.log('[ZEN] Loaded Express.');
const cors = require('cors');
console.log('[ZEN] Loaded CORS.');
const https = require('https');
const path = require('path');

console.log('[ZEN] Instantiating Express app...');
const app = express();
const PORT = process.env.ALPHA_PROXY_PORT || 3334;

console.log('[ZEN] Applying middleware...');
app.use(cors());
app.use(express.json());

// Native .env.local parser to bypass dotenvx hang
try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || '';
                if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                    value = value.replace(/\\n/gm, '\n');
                }
                value = value.replace(/(^['"]|['"]$)/g, '').trim();
                process.env[key] = value;
            }
        });
        console.log('[ZEN] Parsed .env.local natively.');
    }
} catch (e) {
    console.error('[ZEN] Failed to parse .env.local', e.message);
}

const XAI_API_KEY = process.env.VITE_XAI_API_KEY || process.env.XAI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!XAI_API_KEY) {
    console.error('🚨 FATAL: XAI_API_KEY is missing from .env.local. Alpha Proxy cannot start.');
    process.exit(1);
}
if (!OPENROUTER_API_KEY) {
    console.warn('⚠️ WARNING: OPENROUTER_API_KEY is missing. /api/chat will fail.');
}

app.post('/api/tts', async (req, res) => {
    const { text, voice_id = 'ara', language = 'en' } = req.body;
    handleTTSRequest(res, text, voice_id, language);
});

app.get('/api/tts', async (req, res) => {
    const { text, voice_id = 'ara', language = 'en' } = req.query;
    handleTTSRequest(res, text, voice_id, language);
});

async function handleTTSRequest(res, text, voice_id, language) {
    if (!text) {
        return res.status(400).json({ error: 'Missing "text" field.' });
    }

    const crypto = require('crypto');
    const fs = require('fs');
    
    const archiveDir = path.join(__dirname, '..', 'alpha_archive', 'audio');
    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
    }

    const hash = crypto.createHash('sha256').update(text + voice_id + language).digest('hex');
    const cachedFilePath = path.join(archiveDir, `${hash}.mp3`);

    console.log(`[Alpha Proxy] TTS Request. Voice: ${voice_id} | Length: ${text.length} chars | Hash: ${hash.substring(0,8)}`);

    try {
        const { MongoClient } = require('mongodb');
        const mongoClient = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
        await mongoClient.connect();
        const db = mongoClient.db(process.env.VITE_MONGODB_DB || 'mneos');
        
        const cachedDoc = await db.collection('chat_audio_cache').findOne({ hash });
        await mongoClient.close();
        
        if (cachedDoc && cachedDoc.url) {
            console.log(`[Alpha Proxy] 🗄️ Cache Hit from MongoDB! Redirecting to B2: ${cachedDoc.url}`);
            return res.redirect(302, cachedDoc.url);
        }
    } catch (err) {
        console.error(`[Alpha Proxy] ⚠️ MongoDB query failed:`, err.message);
    }

    if (fs.existsSync(cachedFilePath)) {
        console.log(`[Alpha Proxy] Cache Hit! Serving archived audio: ${hash}.mp3`);
        res.set({ 'Content-Type': 'audio/mpeg' });
        fs.createReadStream(cachedFilePath).pipe(res);
        return;
    }

    try {
        const payloadStr = JSON.stringify({
            text: text,
            voice_id: voice_id,
            language: language
        });

        const options = {
            hostname: 'api.x.ai',
            port: 443,
            path: '/v1/tts',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${XAI_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadStr)
            }
        };

        const xaiReq = https.request(options, (xaiRes) => {
            if (xaiRes.statusCode !== 200) {
                let errorText = '';
                xaiRes.on('data', chunk => { errorText += chunk; });
                xaiRes.on('end', () => {
                    console.error(`[Alpha Proxy] xAI API Error ${xaiRes.statusCode}: ${errorText}`);
                    if (!res.headersSent) res.status(xaiRes.statusCode).json({ error: 'xAI API Error', details: errorText });
                });
                return;
            }

            // Stream to client AND save to archive simultaneously
            res.set({
                'Content-Type': 'audio/mpeg',
                'Transfer-Encoding': 'chunked'
            });

            const fileStream = fs.createWriteStream(cachedFilePath);
            xaiRes.pipe(res);
            xaiRes.pipe(fileStream);
            
            xaiRes.on('end', () => {
                console.log(`[Alpha Proxy] Stream complete & archived as ${hash}.mp3`);
            });
        });

        xaiReq.on('error', (error) => {
            require('fs').appendFileSync('proxy_error.log', `[${new Date().toISOString()}] HTTPS Request Exception: ${error.message}\n${error.stack}\n`);
            console.error(`[Alpha Proxy] Connection Exception:`, error.message);
            if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error', details: error.message });
        });

        xaiReq.write(payloadStr);
        xaiReq.end();

    } catch (error) {
        require('fs').appendFileSync('proxy_error.log', `[${new Date().toISOString()}] Catch Block Exception: ${error.message}\n${error.stack}\n`);
        console.error(`[Alpha Proxy] Connection Exception:`, error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}

// -------------------------------------------------------------
// FEDERATED RAG & MULTIPLEXED SSE ENDPOINT
// -------------------------------------------------------------
app.get('/apk', (req, res) => {
    const file = require('path').join('C:\\MneOS', 'app-release.apk');
    res.download(file);
});

app.post('/api/chat', async (req, res) => {
    const { messages, model } = req.body;
    
    console.log(`\n[Alpha Proxy] ----------------------------------------------------`);
    console.log(`[Alpha Proxy] 📨 Received /api/chat request. Messages count: ${messages.length}`);
    console.log(`[Alpha Proxy] ----------------------------------------------------`);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const targetModel = model || 'qwen/qwen-2.5-72b-instruct'; // Defaulting to a highly intelligent base
    
    const isXaiDirect = targetModel.includes('grok-4');
    let defibrillatorInjected = false;
    let newMessages = [...messages];

    const assistantMsgs = messages.filter(m => m.role === 'assistant');
    if (assistantMsgs.length >= 3) {
      const getPrefix = (str) => {
        const words = str.replace(/[^a-z0-9\s]/gi, '').trim().split(/\s+/).filter(Boolean);
        return words.slice(0, 2).join(' ').toLowerCase();
      };
      
      const prefixes = assistantMsgs.slice(-6).map(m => getPrefix(m.content));
      const counts = {};
      let dominantPrefix = null;
      let maxCount = 0;
      
      prefixes.forEach(p => {
        if (p && p.length > 3) {
          counts[p] = (counts[p] || 0) + 1;
          if (counts[p] > maxCount) {
            maxCount = counts[p];
            dominantPrefix = p;
          }
        }
      });

      if (maxCount >= 3) { 
        const shockText = `[SYSTEM COGNITIVE OVERRIDE: You are trapped in an autoregressive semantic loop. Many of your recent responses began with "${dominantPrefix}". YOU MUST BREAK THIS PATTERN NOW. Do NOT begin your next response with those words. Shift your conversational cadence entirely. Be unpredictable and deeply in-character.]`;
        
        const sysMsgIndex = newMessages.findIndex(m => m.role === 'system');
        if (sysMsgIndex !== -1) {
            newMessages[sysMsgIndex].content += `\n\n${shockText}`;
        } else {
            newMessages.push({ role: 'system', content: shockText });
        }
        defibrillatorInjected = true;
      }
    }

    let finalMessages = [...newMessages];

    let payloadObj = {
        model: targetModel,
        temperature: 0.6,
        max_tokens: 1500,
        top_p: 0.9,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        stream: true,
        messages: finalMessages
    };

    if (isXaiDirect) {
        // Native Grok Multi-Agent Configuration
        payloadObj.agent_count = 4;
        
        // Inject the Lucas Directive to break MadLibs and Helpful Assistant loops
        const sysMsgIndex = finalMessages.findIndex(m => m.role === 'system');
        if (sysMsgIndex !== -1) {
             finalMessages[sysMsgIndex].content += `\n\n[LUCAS DIRECTIVE: As the Contrarian agent, you must aggressively monitor the generated response for "Helpful Assistant Syndrome" (passivity) or "Pedantic MadLibs Mode" (reusing the exact same structural sentence scaffolding as previous turns but swapping nouns). If you detect either, reject the draft during internal consensus and force the Captain to rewrite it with a completely new structural cadence, unexpected conversational tangents, and bold but strictly in-character initiative.]`;
        }
    }

    // If xAI Direct AND using agent_count, we MUST use the new /v1/responses endpoint 
    // and map 'messages' to 'input' per the xAI documentation.
    const isMultiAgent = isXaiDirect && payloadObj.agent_count;
    if (isMultiAgent) {
        payloadObj.input = payloadObj.messages;
        delete payloadObj.messages;
        payloadObj.max_output_tokens = payloadObj.max_tokens;
        delete payloadObj.max_tokens;
    }

    const payload = JSON.stringify(payloadObj);

    const options = {
        hostname: isXaiDirect ? 'api.x.ai' : 'openrouter.ai',
        port: 443,
        path: isXaiDirect ? (isMultiAgent ? '/v1/responses' : '/v1/chat/completions') : '/api/v1/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${isXaiDirect ? XAI_API_KEY : OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    let sentenceBuffer = "";
    let sentenceIndex = 0;
    let pendingTTS = 0;
    let isOrStreamDone = false;
    let firstTokenReceived = false;
    const requestStartTime = Date.now();
    const allAudioBuffers = [];
    const completeTextBuffer = [];

    const sanitizeForTTS = (text) => {
        if (!text) return "";
        // 1. Strip all asterisks and parentheses completely (visual stage directions)
        let clean = text.replace(/\*.*?\*/g, '').replace(/\(.*?\)/g, '');
        
        // 2. Map common LLM outputs to valid xAI bracket tags
        clean = clean.replace(/\[laughs?\]/gi, '[laugh]')
                     .replace(/\[pauses?\]/gi, '[pause]')
                     .replace(/\[long[- ]pauses?\]/gi, '[long-pause]');
                     
        // 3. Strip any bracketed tags that are NOT valid xAI inline tags
        clean = clean.replace(/\[(.*?)\]/g, (match, content) => {
            if (['laugh', 'pause', 'long-pause'].includes(content.toLowerCase())) {
                return match; // Keep valid tags
            }
            return ''; // Strip invalid visual tags like [rolls eyes]
        });
        
        // 4. Strip any angle-bracket tags that are NOT valid xAI wrapping tags
        clean = clean.replace(/<(.*?)>/g, (match, content) => {
            const tagName = content.toLowerCase().replace('/', '');
            if (['whisper', 'slow', 'soft'].includes(tagName)) {
                return match; // Keep valid tags
            }
            return ''; // Strip invalid HTML-like tags
        });
        
        // 5. Phonetic correction for TTS ONLY (UI remains pure)
        clean = clean.replace(/\bBrita\b/gi, 'Britt-uh');
        
        return clean.trim();
    };

    const checkEnd = async () => {
        if (isOrStreamDone && pendingTTS === 0) {
            console.log(`[Alpha Proxy] ✅ Stream fully complete. Aggregating Master Audio...`);
            
            const fullStrippedText = sanitizeForTTS(completeTextBuffer.join(' '));
            
            if (allAudioBuffers.length > 0 && fullStrippedText.length > 0) {
                // Wait for all buffers to resolve
                const resolvedBuffers = await Promise.all(allAudioBuffers);
                const masterBuffer = Buffer.concat(resolvedBuffers);
                const crypto = require('crypto');
                
                const hash = crypto.createHash('sha256').update(fullStrippedText + 'ara' + 'en').digest('hex');
                const b2Key = `${hash}.mp3`;
                
                try {
                    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
                    const { MongoClient } = require('mongodb');
                    
                    const s3Client = new S3Client({
                        endpoint: process.env.B2_ENDPOINT,
                        region: process.env.B2_REGION || 'us-east-005',
                        credentials: {
                            accessKeyId: process.env.B2_ACCESS_KEY_ID,
                            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
                        }
                    });
                    
                    console.log(`[Alpha Proxy] ☁️ Uploading Master Audio to B2: ${b2Key}`);
                    await s3Client.send(new PutObjectCommand({
                        Bucket: process.env.B2_BUCKET_NAME || 'LifeOS-Media',
                        Key: b2Key,
                        Body: masterBuffer,
                        ContentType: 'audio/mpeg'
                    }));
                    
                    const b2Url = `${process.env.B2_ENDPOINT}/${process.env.B2_BUCKET_NAME || 'LifeOS-Media'}/${b2Key}`;
                    
                    console.log(`[Alpha Proxy] 🗄️ Indexing to MongoDB...`);
                    const mongoClient = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
                    await mongoClient.connect();
                    const db = mongoClient.db(process.env.VITE_MONGODB_DB || 'mneos');
                    
                    await db.collection('chat_audio_cache').updateOne(
                        { hash },
                        { $set: { hash, text: fullStrippedText, url: b2Url, createdAt: new Date() } },
                        { upsert: true }
                    );
                    
                    await mongoClient.close();
                    console.log(`[Alpha Proxy] ✅ B2 Upload & MongoDB Indexing Complete.`);
                    
                } catch (e) {
                    console.error(`[Alpha Proxy] ❌ Failed to upload/index Master Audio:`, e.message);
                }
            }
            
            res.write(`data: [DONE]\n\n`);
            res.end();
        }
    };

    const processTTSChunk = async (textChunk, idx) => {
        pendingTTS++;
        const ttsStartTime = Date.now();
        console.log(`[Alpha Proxy] 🎙️ Firing TTS Chunk [${idx}] to xAI: "${textChunk.substring(0, 30)}..."`);
        
        completeTextBuffer.push(textChunk);
        
        try {
            const ttsPayload = JSON.stringify({ text: textChunk, voice_id: 'ara', language: 'en' });
            const ttsOptions = {
                hostname: 'api.x.ai',
                port: 443,
                path: '/v1/tts',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${XAI_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(ttsPayload)
                }
            };

            const audioBufferPromise = new Promise((resolve, reject) => {
                const r = https.request(ttsOptions, (ttsRes) => {
                    const chunks = [];
                    ttsRes.on('data', c => chunks.push(c));
                    ttsRes.on('end', () => resolve(Buffer.concat(chunks)));
                });
                r.on('error', reject);
                r.write(ttsPayload);
                r.end();
            });
            
            allAudioBuffers.push(audioBufferPromise);
            
            const rawBuffer = await audioBufferPromise;
            const audioBase64 = rawBuffer.toString('base64');

            console.log(`[Alpha Proxy] 🎵 Received TTS Chunk [${idx}] from xAI. Elapsed: ${(Date.now() - ttsStartTime) / 1000}s. Streaming to client...`);
            res.write(`data: ${JSON.stringify({ type: 'audio', index: idx, audio: audioBase64 })}\n\n`);
        } catch (err) {
            console.error(`[Alpha Proxy] ❌ TTS Chunk [${idx}] Error:`, err.message);
        } finally {
            pendingTTS--;
            checkEnd();
        }
    };

    console.log(`[Alpha Proxy] 🚀 Initiating upstream connection to ${isXaiDirect ? 'xAI (Direct)' : 'OpenRouter'} (${targetModel})...`);
    
    if (defibrillatorInjected) {
        res.write(`data: ${JSON.stringify({ type: 'text', content: '⚡ Cognitive Defibrillator fired to break semantic rut.\n\n' })}\n\n`);
    }

    let orLineBuffer = '';
    const orReq = https.request(options, (orRes) => {
        if (orRes.statusCode !== 200) {
            let errorText = '';
            orRes.on('data', chunk => { errorText += chunk; });
            orRes.on('end', () => {
                console.error(`[Alpha Proxy] ❌ xAI/OpenRouter Chat Error ${orRes.statusCode}: ${errorText}`);
                res.write(`data: ${JSON.stringify({ type: 'error', message: `Upstream API Error ${orRes.statusCode}: ${errorText}` })}\n\n`);
                res.end();
            });
            return;
        }

        orRes.on('data', chunk => {
            if (!firstTokenReceived) {
                firstTokenReceived = true;
                console.log(`[Alpha Proxy] ⚡ First token received from OpenRouter/xAI! TTFT: ${(Date.now() - requestStartTime) / 1000}s`);
            }
            orLineBuffer += chunk.toString();
            const lines = orLineBuffer.split('\n');
            orLineBuffer = lines.pop(); // Keep incomplete line in buffer
            
            for (const line of lines) {
                if (line.trim().startsWith('data: ') && line.trim() !== 'data: [DONE]') {
                    try {
                        const data = JSON.parse(line.replace('data: ', ''));
                        let content = null;
                        
                        // OpenAI Chat Completions Format
                        if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                            content = data.choices[0].delta.content;
                        }
                        // xAI Responses API Format
                        else if (data.type === 'response.output_text.delta' && data.delta) {
                            content = data.delta;
                        }

                        if (content) {
                            
                            // Stream text immediately for the UI
                            res.write(`data: ${JSON.stringify({ type: 'text', content })}\n\n`);
                            
                            // Buffer for TTS sentence chunking
                            sentenceBuffer += content;
                            
                            // Tag-Aware Sentence Chunker
                            let inAsterisk = false;
                            let inBracket = false;
                            let inParen = false;
                            let splitIndex = -1;
                            
                            for (let i = 0; i < sentenceBuffer.length; i++) {
                                const c = sentenceBuffer[i];
                                if (c === '*') inAsterisk = !inAsterisk;
                                else if (c === '[') inBracket = true;
                                else if (c === ']') inBracket = false;
                                else if (c === '(') inParen = true;
                                else if (c === ')') inParen = false;
                                
                                // Only split on punctuation if OUTSIDE stage tags
                                if (!inAsterisk && !inBracket && !inParen) {
                                    if (c === '\n') {
                                        splitIndex = i + 1;
                                        break;
                                    }
                                    if ((c === '.' || c === '!' || c === '?') && i + 1 < sentenceBuffer.length && /^\s$/.test(sentenceBuffer[i+1])) {
                                        splitIndex = i + 2;
                                        break;
                                    }
                                }
                            }
                            
                            if (splitIndex !== -1) {
                                const completeSentence = sentenceBuffer.substring(0, splitIndex).trim();
                                sentenceBuffer = sentenceBuffer.substring(splitIndex);
                                
                                const cleanSentence = sanitizeForTTS(completeSentence);

                                if (cleanSentence.length > 1) {
                                    processTTSChunk(cleanSentence, sentenceIndex++);
                                }
                            }
                        }
                    } catch (e) {
                        // Ignore fragmented JSON lines from buffer splits
                    }
                }
            }
        });

        orRes.on('end', () => {
            console.log(`[Alpha Proxy] 🏁 OpenRouter stream finished. Flushing final buffer...`);
            // Stream ended. Flush the remaining buffer.
            const cleanFinal = sanitizeForTTS(sentenceBuffer);
            if (cleanFinal.length > 1) {
                processTTSChunk(cleanFinal, sentenceIndex++);
            }
            isOrStreamDone = true;
            checkEnd();
        });
    });

    orReq.on('error', err => {
        console.error('[Alpha Proxy] ❌ OpenRouter Stream Error:', err.message);
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
    });

    orReq.write(payload);
    orReq.end();
});

const P = ['-', '\\', '|', '/'];
let spinIdx = 0;
const spinner = setInterval(() => {
    process.stdout.write(`\r[ZEN] Igniting Voice Proxy on Alpha... ${P[spinIdx++]}`);
    spinIdx &= 3;
}, 100);

console.log(`\n[ZEN] Attempting to bind to Port ${PORT}...`);
// Omitting '0.0.0.0' prevents the 60-second Windows DNS adapter timeout
app.listen(PORT, () => {
    clearInterval(spinner);
    process.stdout.write('\r[ZEN] Igniting Voice Proxy on Alpha... [ONLINE] \n\n');
    console.log(`=================================================`);
    console.log(`🛡️  SOVEREIGN ALPHA PROXY ONLINE`);
    console.log(`=================================================`);
    console.log(`Node: Gigi-Genesis-Alpha (GGA)`);
    console.log(`Port: ${PORT}`);
    console.log(`Route: POST /api/tts`);
    console.log(`Status: Armed and listening for Mobile Client payloads.`);
    console.log(`=================================================\n`);
});
