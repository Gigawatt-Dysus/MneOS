import fs from 'fs';
import path from 'path';
import sqlite3Pkg from 'sqlite3';
import pLimit from 'p-limit';
import sharp from 'sharp';

const sqlite3 = sqlite3Pkg.verbose();

// ----------------------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------------------
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'moondream';
const BATCH_SIZE = 100; // Size of SSD Staging Chunks to protect the HDD
const CONCURRENCY = 2;  // Limit simultaneous AI requests to avoid VRAM OOM on RTX 3050
const STAGING_DIR = path.join(process.cwd(), 'temp_vision_staging');

const dbPath = path.join(process.cwd(), 'staging.db');
const db = new sqlite3.Database(dbPath);

const PROMPT = "Describe this image in detail. Be observant and precise. Note the people, objects, environment, lighting, and any prominent text. Keep the description factual and comprehensive.";

async function getPendingJobs(limit = BATCH_SIZE) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM airlock_jobs 
            WHERE caption IS NULL 
              AND error_msg IS NULL
              AND filename LIKE '%.jpg' OR filename LIKE '%.jpeg' OR filename LIKE '%.png' OR filename LIKE '%.webp'
            ORDER BY classifiedAt ASC 
            LIMIT ?
        `, [limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function updateCaption(hash, caption) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE airlock_jobs SET caption = ? WHERE hash = ?`, [caption, hash], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function markError(hash, errorMsg) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE airlock_jobs SET error_msg = ? WHERE hash = ?`, [errorMsg, hash], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function queryOllama(base64Image) {
    const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL_NAME,
            prompt: PROMPT,
            images: [base64Image],
            stream: false
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    return data.response ? data.response.trim() : "";
}

async function main() {
    console.log("=======================================================");
    console.log(`👁️  Forge Vision Captioning Pipeline (${MODEL_NAME})`);
    console.log("=======================================================\n");

    if (!fs.existsSync(STAGING_DIR)) {
        fs.mkdirSync(STAGING_DIR, { recursive: true });
    }

    const limit = pLimit(CONCURRENCY);
    let totalProcessed = 0;

    while (true) {
        const jobs = await getPendingJobs(BATCH_SIZE);
        if (jobs.length === 0) {
            console.log(`\n🎉 No more pending images. Vision Pipeline complete! (Total Processed: ${totalProcessed})`);
            break;
        }

        console.log(`\n📦 Staging batch of ${jobs.length} files from JBOD to SSD...`);
        
        // 1. Sequential Staging to protect the mechanical drive
        for (let job of jobs) {
            try {
                const stagedPath = path.join(STAGING_DIR, `${job.hash}_${job.filename}`);
                await fs.promises.copyFile(job.filepath, stagedPath);
                job.stagedFilepath = stagedPath;
            } catch (err) {
                console.error(`⚠️ Failed to stage ${job.filename}: ${err.message}`);
                job.stagedFilepath = job.filepath; // Fallback to JBOD
            }
        }

        console.log(`🧠 Handing batch to ${MODEL_NAME} (Concurrency: ${CONCURRENCY})...`);

        // 2. Process with AI
        await Promise.all(jobs.map(job => limit(async () => {
            const targetPath = job.stagedFilepath;
            
            try {
                // Downsample in-memory via Sharp before passing to AI to save massive VRAM
                const imageBuffer = await fs.promises.readFile(targetPath);
                const resizedBuffer = await sharp(imageBuffer)
                    .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();
                
                const base64Image = resizedBuffer.toString('base64');

                const caption = await queryOllama(base64Image);
                if (caption) {
                    await updateCaption(job.hash, caption);
                    console.log(`✅ [${job.filename}] -> ${caption.substring(0, 60)}...`);
                } else {
                    console.log(`⚠️ [${job.filename}] -> Model returned empty response.`);
                    await markError(job.hash, 'Empty vision response');
                }
            } catch (err) {
                console.error(`❌ Failed to caption ${job.filename}:`, err.message);
                await markError(job.hash, err.message);
            } finally {
                // 3. Cleanup Staging Buffer
                if (job.stagedFilepath !== job.filepath && fs.existsSync(job.stagedFilepath)) {
                    try {
                        fs.unlinkSync(job.stagedFilepath);
                    } catch (e) {
                        console.error(`⚠️ Cleanup failed for ${job.stagedFilepath}:`, e.message);
                    }
                }
            }
        })));

        totalProcessed += jobs.length;
    }

    db.close();
}

main().catch(console.error);
