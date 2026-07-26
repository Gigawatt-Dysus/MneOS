import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ========================================================
// 🎯 TARGET CONFIGURATION
// ========================================================
// Change this to 'RUNPOD' for mass processing, or 'GROK' for premium captions
const TARGET_API = 'RUNPOD'; // 'GROK' or 'RUNPOD'

// RunPod Settings
const RUNPOD_BASE_URL = "https://api.runpod.ai/v2/s36acley5kfr98/openai/v1/chat/completions";
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || "YOUR_RUNPOD_KEY";
const RUNPOD_MODEL = "llava-hf/llava-1.5-13b-hf";

// Grok Settings
const GROK_BASE_URL = "https://api.x.ai/v1/chat/completions";
const GROK_API_KEY = process.env.XAI_API_KEY || process.env.VITE_XAI_API_KEY;
const GROK_MODEL = "grok-4.3";

const SYSTEM_PROMPT = "You are a master storyteller and archivist. Describe this image with vivid, poetic detail and emotional warmth. Do not use robotic phrasing like 'A person wearing...' or 'This is an image of...'. Jump straight into a beautifully painted scene. Focus on the mood, lighting, textures, and the connection between the subjects. Be extremely concise (2-3 sentences max). Absolutely NO meta-commentary, conversational filler, or word counts in your response.";

// ========================================================

const uri = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
if (!uri) {
    console.error("⚠️ MONGODB_URI missing from .env.local");
    process.exit(1);
}

// Convert local file to base64
function getBase64Image(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const bitmap = fs.readFileSync(filePath);
    return Buffer.from(bitmap).toString('base64');
}

// Ensure mime type is correct
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    return 'image/jpeg';
}

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function run() {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();
    const mediaCol = db.collection('media');

    console.log(`\n🚀 Starting Auto-Proposer Daemon using [${TARGET_API}] backend...`);

    while (true) {
        try {
            console.log("\n[ " + new Date().toLocaleTimeString() + " ] 🔍 Initiating auto-proposer sweep...");
            // Find items that need review and haven't been processed by our current target API
            const targetField = TARGET_API === 'GROK' ? 'proposedCaptionGrok' : 'proposedCaptionLLaVA';
            const cursor = mediaCol.find({
                reviewStatus: 'pending_review',
                [targetField]: { $exists: false }
            });

            let count = 0;
            let missingThumbs = 0;

            for await (const doc of cursor) {
                const thumbUrl = doc.thumbnailUrls?.large || doc.thumbnailUrls?.medium || doc.thumbnailUrls?.small || doc.b2Url || doc.url;
                
                if (!thumbUrl) {
                    console.log(`⚠️ Missing thumbnail URL for ${doc._id}`);
                    missingThumbs++;
                    continue;
                }

                console.log(`\n📡 Fetching ${doc._id} to normalize EXIF rotation...`);
                let finalImageUrl = thumbUrl;
                try {
                    const imgRes = await fetch(thumbUrl);
                    if (imgRes.ok) {
                        const buffer = await imgRes.arrayBuffer();
                        const rotatedBuffer = await sharp(buffer).rotate().jpeg({ quality: 85 }).toBuffer();
                        const base64Data = rotatedBuffer.toString('base64');
                        finalImageUrl = `data:image/jpeg;base64,${base64Data}`;
                        console.log(`   ✅ EXIF rotation baked successfully.`);
                    }
                } catch (e) {
                    console.log(`   ⚠️ Failed to pre-process EXIF, falling back to raw URL: ${e.message}`);
                }

                console.log(`📡 Sending to ${TARGET_API}...`);

                const url = TARGET_API === 'GROK' ? GROK_BASE_URL : RUNPOD_BASE_URL;
                const apiKey = TARGET_API === 'GROK' ? GROK_API_KEY : RUNPOD_API_KEY;
                const modelId = TARGET_API === 'GROK' ? GROK_MODEL : RUNPOD_MODEL;

                const payload = {
                    model: modelId,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: SYSTEM_PROMPT },
                                { type: "image_url", image_url: { url: finalImageUrl } }
                            ]
                        }
                    ],
                    max_tokens: 150,
                    temperature: 0.85,
                    top_p: 0.95,
                    presence_penalty: 0.2
                };

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    console.error(`❌ API Error for ${doc._id}:`, await response.text());
                    continue;
                }

                const data = await response.json();
                const proposedText = data.choices?.[0]?.message?.content;

                if (proposedText) {
                    await mediaCol.updateOne(
                        { _id: doc._id },
                        { $set: { [targetField]: proposedText } }
                    );
                    console.log(`✅ Success! Proposal: "${proposedText.substring(0, 50)}..."`);
                    count++;
                }
                
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            console.log(`🎉 Sweep complete. Processed: ${count} | Skipped missing thumbs: ${missingThumbs}`);
            
        } catch (err) {
            console.error("❌ Error during auto-proposer sweep:", err);
        }

        console.log(`💤 Sleeping for ${POLL_INTERVAL / 1000} seconds...`);
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
}

run().catch(console.error);
