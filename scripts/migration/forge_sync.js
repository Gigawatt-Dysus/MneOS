import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import sqlite3Pkg from 'sqlite3';
import pLimit from 'p-limit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
// Disable Sharp's internal memory-mapped cache to prevent EBUSY locks on Windows
sharp.cache(false);

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Replaced mime-types with a manual lookup to avoid adding dependencies
const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.heic': 'image/heic'
  };
  return mimeMap[ext] || 'application/octet-stream';
};

const sqlite3 = sqlite3Pkg.verbose();
const CONCURRENCY = 2; // [ZEN] Drastically reduced from 8 to leave CPU headroom for Ollama
const BATCH_SIZE = 25; // [ZEN] Reduced from 100 to prevent massive memory spikes
const MAX_STAGING_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB limit per batch

// Initialize B2 Client via S3 API
// Requires B2_ENDPOINT in .env.local (e.g. https://s3.us-east-005.backblazeb2.com)
// If not present, please add it!
const b2 = new S3Client({
  endpoint: process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
  region: process.env.B2_REGION || 'us-east-005', // B2 region usually matches the endpoint
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
  },
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }
});

const B2_BUCKET = process.env.B2_BUCKET_NAME;

const dbPath = path.join(process.cwd(), 'staging.db');
const db = new sqlite3.Database(dbPath);
db.run('PRAGMA journal_mode = WAL;');
db.run('PRAGMA busy_timeout = 5000;');

async function getPendingJobs(limit = BATCH_SIZE) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM airlock_jobs 
      WHERE process_state = 'pending'
      ORDER BY classifiedAt ASC 
      LIMIT ?
    `, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function updateJobState(hash, state, extra = {}) {
  const setParts = Object.keys(extra).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(extra), hash];

  return new Promise((resolve, reject) => {
    db.run(`UPDATE airlock_jobs SET process_state = ?, ${setParts || 'processed_at = CURRENT_TIMESTAMP'} WHERE hash = ?`,
      [state, ...values], (err) => err ? reject(err) : resolve());
  });
}

async function uploadToB2(filePath, objectKey, maxRetries = 3) {
  const contentType = getMimeType(filePath);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (streamErr) => {
      // Catch stream errors (like ENOENT) to prevent Node from crashing with uncaughtException
      console.error(`[SYNC] Stream error for ${filePath}: ${streamErr.message}`);
    });
    
    try {
      // [ZEN OPTIMIZATION]: Transitioned from PutObjectCommand to Upload from @aws-sdk/lib-storage.
      // Single PUT requests stall and drop on multi-GB files. The Upload class
      // automatically breaks massive files into chunks and uploads them via multi-part,
      // seamlessly recovering from dropped TCP sockets.
      const parallelUploads3 = new Upload({
        client: b2,
        params: {
          Bucket: B2_BUCKET,
          Key: objectKey,
          Body: fileStream,
          ContentType: contentType,
        },
        partSize: 5 * 1024 * 1024, // 5MB chunks
        queueSize: 4, // 4 concurrent part uploads
        leavePartsOnError: false // Clean up if it fails completely
      });

      // Add a progress listener so massive files don't appear 'hung' in the terminal
      let lastLoggedPercent = -1;
      parallelUploads3.on("httpUploadProgress", (progress) => {
        if (progress.total) {
          const percent = Math.floor((progress.loaded / progress.total) * 100);
          // Log progress every 5% to avoid spamming the console
          if (percent % 5 === 0 && percent !== lastLoggedPercent) {
            console.log(`[SYNC]   📡 Transmitting ${objectKey}: ${percent}% (${Math.round(progress.loaded / 1024 / 1024)}MB / ${Math.round(progress.total / 1024 / 1024)}MB)`);
            lastLoggedPercent = percent;
          }
        }
      });
      await parallelUploads3.done();
      
      return `https://f005.backblazeb2.com/file/${B2_BUCKET}/${objectKey}`;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const cleanError = err.message.replace(/\r?\n|\r/g, ' ').substring(0, 100);
      console.log(`\n⚠️ B2 Network Drop (${cleanError}...). Retrying upload ${attempt}/${maxRetries} for ${objectKey}...`);
      await new Promise(r => setTimeout(r, 5000 * attempt)); // Backoff
    } finally {
      fileStream.destroy(); // Prevent file descriptor leaks/locks on Windows
    }
  }
}

async function main() {
  console.log("=======================================================");
  console.log("🚀 Forge Sync Pipeline (Thumbnails + B2 + Mongo)");
  console.log("=======================================================\n");

  if (!process.env.B2_ACCESS_KEY_ID || !B2_BUCKET) {
    console.error("❌ ERROR: Missing B2 credentials in .env.local");
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
  console.log("📡 Connecting to MongoDB Atlas...");
  const client = new MongoClient(uri);
  await client.connect();
  const mongoDb = client.db();
  const mediaCollection = mongoDb.collection('media');
  const pendingCollection = mongoDb.collection('pending_accessions');

  // Grab the inferred userId for the pending gateway documents
  const validMedia = await mediaCollection.findOne({ userId: { $exists: true } });
  const systemUserId = process.env.USER_ID || (validMedia ? validMedia.userId : 'unknown');
  console.log(`👤 Using System User ID: ${systemUserId}`);
  const limit = pLimit(CONCURRENCY);

  let totalProcessed = 0;

  while (true) {
    const jobs = await getPendingJobs(BATCH_SIZE);
    if (jobs.length === 0) {
      console.log(`\n⏳ Glass is empty. Waiting 5 seconds for the Vision worker to refill... (Total Processed: ${totalProcessed})`);
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    console.log(`\n📦 Processing Batch of ${jobs.length} jobs...`);
    const mediaOperations = [];
    const pendingOperations = [];
    // Map to keep track of operations for updating SQLite job states safely
    const batchJobHashes = [];

    // [ZEN OPTIMIZATION]: SSD STAGING BUFFER (Sequential I/O)
    // We copy the entire batch from the mechanical JBOD to the fast SSD sequentially.
    // This entirely prevents the mechanical drive head from thrashing when 8 concurrent workers hit it.
    console.log(`🗄️  Staging ${jobs.length} files from JBOD to SSD (Sequential Read)...`);
    const stagingDir = path.join(process.cwd(), 'temp_staging');
    if (!fs.existsSync(stagingDir)) fs.mkdirSync(stagingDir, { recursive: true });

    let currentStagingBytes = 0;
    let hasLoggedStagingLimit = false;

    for (let job of jobs) {
      try {
        if (currentStagingBytes + job.size > MAX_STAGING_BYTES) {
          if (!hasLoggedStagingLimit) {
            console.log(`⚠️ Staging limit (5GB) reached for this batch. Skipping staging for remaining files to protect SSD.`);
            hasLoggedStagingLimit = true;
          }
          job.stagedFilepath = job.filepath; // Fallback to JBOD
          continue;
        }

        const stagedPath = path.join(stagingDir, `${job.hash}_${job.filename}`);
        await fs.promises.copyFile(job.filepath, stagedPath);
        job.stagedFilepath = stagedPath;
        currentStagingBytes += job.size;
      } catch (err) {
        console.error(`⚠️ Failed to stage ${job.filename} to SSD: ${err.message}`);
        job.stagedFilepath = job.filepath; // Fallback to JBOD if copy fails
      }
    }

    await Promise.all(jobs.map(job => limit(async () => {
      try {
        const { hash, filepath, filename, status, existingMongoId, stagedFilepath } = job;
        const isUpgrade = status === 'UPGRADE_SSOT' && existingMongoId;

        let existingDoc = null;
        if (isUpgrade) {
          existingDoc = await mediaCollection.findOne({ _id: existingMongoId });
        }

        // [ZEN SAFETY CHECK]: Detect Destructive LifeOS Edits
        const hasEdits = existingDoc && (
          existingDoc.url?.includes('edit_') ||
          (existingDoc.editHistory && existingDoc.editHistory.length > 0) ||
          (existingDoc.adjustmentStack && Object.keys(existingDoc.adjustmentStack).length > 0) ||
          (existingDoc.polishLayers && existingDoc.polishLayers.length > 0)
        );

        let updatePayload = {
          lastProcessedAt: new Date()
        };

        const isImage = /\.(jpg|jpeg|png|webp|gif|heic|tiff)$/i.test(filename);

        // Only flag for AI processing if it's an image and hasn't been captioned yet
        if (!existingDoc || !existingDoc.caption) {
            updatePayload.aiProcessed = !isImage;
        }

        if (hasEdits) {
          console.log(`🛡️  Protected Edit Detected: [${filename}] → Enriching metadata only (Vector/Caption). Skipping URL/Thumb swaps.`);
        } else {
          // It's safe to overwrite the physical assets!
          const thumbDir = path.join(process.cwd(), 'temp_thumbs');
          if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

          const baseName = path.parse(filename).name;
          const cleanName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
          
          // Original upload (From SSD Staging)
          const originalKey = `users/migration/takeout/${cleanName}_${Date.now()}${path.extname(filename)}`;
          const originalB2Url = await uploadToB2(stagedFilepath, originalKey);

          let thumbUrls = {};

          // Generate & Upload Thumbs if it's an image
          // Skip thumbnail generation for pure video formats, or we'd need ffmpeg here.
          if (isImage) {
            const smallPath = path.join(thumbDir, `${hash}_${cleanName}_small.webp`);
            const mediumPath = path.join(thumbDir, `${hash}_${cleanName}_medium.webp`);
            const largePath = path.join(thumbDir, `${hash}_${cleanName}_large.webp`);

            // Serial Downsampling with WebP Dimension Safety Net
            try {
              // [ZEN RESILIENCE]: Attempt 1 - Force decode corrupted JPEGs (ignore invalid SOS blocks)
              await sharp(stagedFilepath, { failOnError: false }).resize(1600, null, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(largePath);
              await sharp(largePath, { failOnError: false }).resize(800, null, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(mediumPath);
              await sharp(mediumPath, { failOnError: false }).resize(400, null, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(smallPath);

              const ts = Date.now();
              thumbUrls.small = await uploadToB2(smallPath, `users/migration/thumbs/${cleanName}_${ts}_small.webp`);
              thumbUrls.medium = await uploadToB2(mediumPath, `users/migration/thumbs/${cleanName}_${ts}_medium.webp`);
              thumbUrls.large = await uploadToB2(largePath, `users/migration/thumbs/${cleanName}_${ts}_large.webp`);
            } catch (thumbErr) {
              const cleanErrMsg = thumbErr.message.replace(/\r?\n/g, ' | ');
              console.log(`⚠️ Thumbnail generation failed despite lenient decoding for ${filename}: ${cleanErrMsg}. Generating Synthetic Fallback Thumbs...`);
              
              // [ZEN FALLBACK]: Generate synthetic "Corrupted Media" placeholders so Matrix Gallery never 404s
              try {
                const svgText = `<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100%" height="100%" fill="#1a1a1a" />
                  <path d="M400,200 L450,300 L350,300 Z" fill="#ff4444"/>
                  <text x="50%" y="50%" font-family="Arial, sans-serif" font-weight="bold" font-size="48" fill="#ff4444" text-anchor="middle" dy=".3em">CORRUPTED MEDIA</text>
                  <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="24" fill="#888888" text-anchor="middle">${filename}</text>
                </svg>`;
                const fallbackBuffer = Buffer.from(svgText);
                
                await sharp(fallbackBuffer).resize(1600, 1600, { fit: 'inside' }).webp({ quality: 80 }).toFile(largePath);
                await sharp(fallbackBuffer).resize(800, 800, { fit: 'inside' }).webp({ quality: 80 }).toFile(mediumPath);
                await sharp(fallbackBuffer).resize(400, 400, { fit: 'inside' }).webp({ quality: 80 }).toFile(smallPath);

                const ts = Date.now();
                thumbUrls.small = await uploadToB2(smallPath, `users/migration/thumbs/FALLBACK_${cleanName}_${ts}_small.webp`);
                thumbUrls.medium = await uploadToB2(mediumPath, `users/migration/thumbs/FALLBACK_${cleanName}_${ts}_medium.webp`);
                thumbUrls.large = await uploadToB2(largePath, `users/migration/thumbs/FALLBACK_${cleanName}_${ts}_large.webp`);
                console.log(`🛡️  Synthetic fallback thumbs deployed for [${filename}]`);
              } catch (fallbackErr) {
                console.error(`💥 CRITICAL: Failed to even generate fallback thumbs for ${filename}:`, fallbackErr.message);
              }
            }

            // Cleanup local temp thumbs
            try {
              if (fs.existsSync(smallPath)) fs.unlinkSync(smallPath);
              if (fs.existsSync(mediumPath)) fs.unlinkSync(mediumPath);
              if (fs.existsSync(largePath)) fs.unlinkSync(largePath);
            } catch (e) {
              // Silently ignore.
            }
          }

          if (isUpgrade) {
            updatePayload.url = originalB2Url;
            if (Object.keys(thumbUrls).length > 0) updatePayload.thumbnailUrls = thumbUrls;
            updatePayload.size = job.size;
            console.log(`🔄 Full SSOT Upgrade: [${filename}] → Replaced URL & Generated Thumbs`);
          } else {
            updatePayload.url = originalB2Url;
            if (Object.keys(thumbUrls).length > 0) updatePayload.thumbnailUrls = thumbUrls;
            updatePayload.size = job.size;
            updatePayload.originalName = filename;
            updatePayload.fileType = getMimeType(filename);
            updatePayload.status = 'pending'; // Staging queue status!
            updatePayload.userId = systemUserId; // Required for Accession Gateway filtering
            updatePayload.createdAt = new Date();
            
            // Build the standard triage object
            updatePayload.triage = {
              title: filename,
              summary: '',
              suggestedTags: []
            };

            console.log(`✨ Net-New Staged to Airlock: [${filename}]`);
          }
        }

        // Build the Bulk Write Ops
        if (isUpgrade) {
          mediaOperations.push({
            updateOne: {
              filter: { _id: existingMongoId },
              update: { $set: updatePayload }
            }
          });
        } else {
          // Completely new asset goes to pending_accessions!
          pendingOperations.push({
            insertOne: { document: { ...updatePayload } }
          });
        }

        batchJobHashes.push(hash); // Mark for state update after bulkWrite
      } catch (err) {
        console.error(`❌ Failed job ${job.filename}:`, err.message);
        await updateJobState(job.hash, 'error', { error_msg: err.message });
      } finally {
        // [ZEN CLEANUP] Remove the staged file from the SSD buffer to free up space
        if (job.stagedFilepath !== job.filepath && fs.existsSync(job.stagedFilepath)) {
          try {
            fs.unlinkSync(job.stagedFilepath);
          } catch (e) {
            console.error(`⚠️ Failed to clean up staged file ${job.stagedFilepath}:`, e.message);
          }
        }
      }
    })));

    // Execute the MongoDB Bulk Writes
    if (mediaOperations.length > 0 || pendingOperations.length > 0) {
      try {
        let inserted = 0;
        let updated = 0;

        if (mediaOperations.length > 0) {
           const r1 = await mediaCollection.bulkWrite(mediaOperations, { ordered: false });
           updated = r1.modifiedCount;
        }

        if (pendingOperations.length > 0) {
           const r2 = await pendingCollection.bulkWrite(pendingOperations, { ordered: false });
           inserted = r2.insertedCount;
        }
        
        console.log(`✅ BulkWrite Batch complete. Inserted (to pending): ${inserted} | Updated (in media): ${updated}`);
        
        // Mark SQLite Jobs as fully synced
        await Promise.all(batchJobHashes.map(h => updateJobState(h, 'mongo_synced')));
        totalProcessed += batchJobHashes.length;
      } catch (bulkErr) {
        console.error("❌ BulkWrite Error (some documents may have failed):", bulkErr.message);
        // Hard to map bulkWrite errors back to exact sqlite rows cleanly if unordered, 
        // but we'll mark the entire batch as error for manual inspection
        await Promise.all(batchJobHashes.map(h => updateJobState(h, 'error', { error_msg: bulkErr.message })));
      }
    }
  }

  await client.close();
  db.close();
}

main().catch(console.error);
