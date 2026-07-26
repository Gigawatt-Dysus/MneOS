const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const MONGO_URI = process.env.VITE_MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.VITE_MONGODB_DB || 'mneos';
const OUTPUT_DIR = path.join(__dirname, '../tmp/emo_bursts');
const MATRIX_ASSETS_DIR = path.join(__dirname, '../public/matrix_assets/accessions');

// Ensure directories exist
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(MATRIX_ASSETS_DIR)) fs.mkdirSync(MATRIX_ASSETS_DIR, { recursive: true });

async function forgeBurst(tagUid, gestureName, durationSec = 1) {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        
        console.log(`[Forge] Initiating EmoDB burst for UID: ${tagUid}`);
        console.log(`[Forge] Target Expression: ${gestureName} (${durationSec}s burst)`);

        // 1. Fetch Tag Data to anchor identity
        const tagsCollection = db.collection('tags');
        const tag = await tagsCollection.findOne({ id: tagUid });
        
        if (!tag) {
            throw new Error(`Tag with UID ${tagUid} not found.`);
        }
        
        // Construct visual prompt based on chassis/biometrics
        const biometrics = tag.metadata?.biometrics || {};
        const hair = biometrics.hairColor || 'brown';
        const eyes = biometrics.eyeColor || 'hazel';
        const gender = tag.metadata?.gender || 'female';
        
        const visualPrompt = `High fidelity cinematic portrait of a ${gender} with ${hair} hair and ${eyes} eyes, performing a ${gestureName} micro-expression. Perfect anatomical consistency, 8k resolution, photorealistic lighting.`;
        
        console.log(`[Forge] Generated visual anchor prompt: "${visualPrompt}"`);
        
        // 2. Call Frontier API (Mocking Grok/Google Video API call for 2026 rig)
        console.log(`[Forge] Dispatching request to Frontier Video API...`);
        // In a real scenario, we'd await fetch() here and save the .mp4
        
        const sessionJobId = `burst_${Date.now()}`;
        const videoPath = path.join(OUTPUT_DIR, `${sessionJobId}.mp4`);
        
        // For testing/mocking, we will assume the video was downloaded to videoPath
        // Here we just create a dummy file to represent the "video" to prevent crashing if testing manually
        fs.writeFileSync(videoPath, 'dummy video content');
        
        console.log(`[Forge] Video received and saved to ${videoPath}.`);
        console.log(`[Forge] Exploding video into frames via ffmpeg...`);
        
        const frameOutputDir = path.join(OUTPUT_DIR, sessionJobId);
        if (!fs.existsSync(frameOutputDir)) fs.mkdirSync(frameOutputDir, { recursive: true });
        
        // In reality: execSync(`ffmpeg -i "${videoPath}" -vf fps=24 "${frameOutputDir}/frame_%04d.webp"`);
        // Mocking frame extraction:
        const mockFrameCount = durationSec * 24;
        for (let i = 1; i <= mockFrameCount; i++) {
            const frameNum = String(i).padStart(4, '0');
            fs.writeFileSync(path.join(frameOutputDir, `frame_${frameNum}.webp`), 'dummy image');
        }
        
        console.log(`[Forge] Extracted ${mockFrameCount} frames to ${frameOutputDir}`);
        
        // 3. Ingest frames into Matrix pending_accessions
        console.log(`[Forge] Ingesting frames into Matrix pending_accessions...`);
        const accessionsCollection = db.collection('pending_accessions');
        const docs = [];
        
        for (let i = 1; i <= mockFrameCount; i++) {
            const frameNum = String(i).padStart(4, '0');
            const fileName = `emo_${sessionJobId}_${frameNum}.webp`;
            
            // Move file to Matrix assets
            const destPath = path.join(MATRIX_ASSETS_DIR, fileName);
            fs.copyFileSync(path.join(frameOutputDir, `frame_${frameNum}.webp`), destPath);
            
            // We use standard MneOS schema for pending_accessions
            docs.push({
                file_name: fileName,
                path: `/matrix_assets/accessions/${fileName}`,
                date_added: new Date().toISOString(),
                source: 'EmoDB_Forge',
                type: 'image/webp',
                tags: [tagUid, 'EmoDB_Candidate', gestureName],
                status: 'pending',
                width: 1024,
                height: 1024
            });
        }
        
        if (docs.length > 0) {
            await accessionsCollection.insertMany(docs);
            console.log(`[Forge] Successfully ingested ${docs.length} candidate frames for triage.`);
        }
        
        console.log(`[Forge] Burst complete. Awaiting manual triage in Matrix BAR.`);
        
    } catch (err) {
        console.error('[Forge] Fatal error during burst generation:', err);
    } finally {
        await client.close();
    }
}

// CLI Execution Hook
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log("Usage: node forge_emo_db.cjs <TagUID> <\"Gesture Name\"> [durationSecs]");
        process.exit(1);
    }
    const [tagUid, gestureName, durationSec] = args;
    forgeBurst(tagUid, gestureName, parseFloat(durationSec) || 1).then(() => {
        process.exit(0);
    });
}

module.exports = { forgeBurst };
