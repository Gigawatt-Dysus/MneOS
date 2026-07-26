import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import dotenv from 'dotenv';
import sqlite3Pkg from 'sqlite3';

dotenv.config({ path: '.env.local' });
const sqlite3 = sqlite3Pkg.verbose();

const TARGET_DIR = "F:\\LifeOS_Archive";
const LIFEBOAT_PREFIX = "LIFEBOAT_RAW_DUMP";
const CONCURRENCY = 4; // Lowered to prevent mechanical SMR drive thrashing

const s3 = new S3Client({
    region: process.env.B2_REGION || 'us-east-005',
    endpoint: `https://s3.${process.env.B2_REGION || 'us-east-005'}.backblazeb2.com`,
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    },
});

let stats = {
    totalFiles: 0,
    totalBytes: 0,
    processedFiles: 0,
    skippedFiles: 0,
    uploadedBytes: 0,
    skippedBytes: 0,
    startTime: Date.now(),
    
    // Sliding window telemetry
    lastTickTime: Date.now(),
    lastTickUploaded: 0,
    lastTickSkipped: 0,
    recentSpeeds: [] // Stores processing speeds from the last 10 ticks
};

let sqliteSkippedPaths = new Set();

async function loadSqliteSkiplist() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(process.cwd(), 'staging.db');
        const db = new sqlite3.Database(dbPath);
        
        // Skip files that the orchestrator has already processed
        const query = `SELECT filepath FROM airlock_jobs WHERE process_state != 'pending'`;
        
        db.all(query, [], (err, rows) => {
            if (err) {
                console.error("\x1b[93m[WARN] Failed to load SQLite skip list:\x1b[0m", err.message);
                resolve();
            } else {
                rows.forEach(r => {
                    if (r.filepath) sqliteSkippedPaths.add(r.filepath);
                });
                console.log(`\x1b[32m[SMART SKIP] Loaded ${sqliteSkippedPaths.size} processed files from staging.db.\x1b[0m`);
                db.close();
                resolve();
            }
        });
    });
}

async function* walkDirectory(dir) {
    const files = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const file of files) {
        const res = path.resolve(dir, file.name);
        if (file.isDirectory()) {
            yield* walkDirectory(res);
        } else {
            yield res;
        }
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function printTelemetry() {
    const now = Date.now();
    const elapsedSecs = (now - stats.startTime) / 1000;
    
    // Global network speed
    const networkSpeed = (stats.uploadedBytes / elapsedSecs) || 0;
    
    // Sliding window calculation for processing speed (adapts to current phase: skipping vs uploading)
    const tickSecs = (now - stats.lastTickTime) / 1000;
    if (tickSecs >= 2.0) { // Update sliding window every 2 seconds
        const bytesProcessedThisTick = (stats.uploadedBytes - stats.lastTickUploaded) + (stats.skippedBytes - stats.lastTickSkipped);
        const speedThisTick = bytesProcessedThisTick / tickSecs;
        
        stats.recentSpeeds.push(speedThisTick);
        if (stats.recentSpeeds.length > 5) stats.recentSpeeds.shift(); // Keep last 10 seconds of data
        
        stats.lastTickTime = now;
        stats.lastTickUploaded = stats.uploadedBytes;
        stats.lastTickSkipped = stats.skippedBytes;
    }

    const currentProcessingSpeed = stats.recentSpeeds.length > 0 
        ? stats.recentSpeeds.reduce((a, b) => a + b, 0) / stats.recentSpeeds.length 
        : 0;

    const remainingBytes = stats.totalBytes - (stats.uploadedBytes + stats.skippedBytes);
    
    let eta = "Calculating...";
    if (currentProcessingSpeed > 0) {
        const etaSecs = remainingBytes / currentProcessingSpeed;
        const hours = Math.floor(etaSecs / 3600);
        const minutes = Math.floor((etaSecs % 3600) / 60);
        const seconds = Math.floor(etaSecs % 60);
        eta = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`;
    }

    const percent = stats.totalFiles === 0 ? 0 : (((stats.processedFiles + stats.skippedFiles) / stats.totalFiles) * 100).toFixed(1);
    
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
        `\x1b[36m[PROGRESS]\x1b[0m ${percent}% | ` +
        `Files: ${stats.processedFiles + stats.skippedFiles}/${stats.totalFiles} ` +
        `(Skipped: ${stats.skippedFiles}) | ` +
        `Data: ${formatBytes(stats.uploadedBytes + stats.skippedBytes)}/${formatBytes(stats.totalBytes)} | ` +
        `Net: ${formatBytes(networkSpeed)}/s (Proc: ${formatBytes(currentProcessingSpeed)}/s) | ETA: ${eta}`
    );
}

async function uploadFile(filepath, fileSize) {
    // Phase 1: SQLite Fast-Skip
    if (sqliteSkippedPaths.has(filepath)) {
        stats.skippedFiles++;
        stats.skippedBytes += fileSize;
        return;
    }

    const relativePath = path.relative(TARGET_DIR, filepath).replace(/\\/g, '/');
    const b2Key = `${LIFEBOAT_PREFIX}/${relativePath}`;
    const bucketName = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET;
    
    // Phase 2: B2 HeadObject Fallback (in case this script uploaded it previously)
    try {
        const headParams = { Bucket: bucketName, Key: b2Key };
        const headResult = await s3.send(new HeadObjectCommand(headParams));
        
        if (headResult.ContentLength === fileSize) {
            stats.skippedFiles++;
            stats.skippedBytes += fileSize;
            return;
        }
    } catch (err) {
        // A 404 (NotFound) is expected if the file hasn't been uploaded yet
    }

    const fileStream = fs.createReadStream(filepath);
    const uploadParams = { Bucket: bucketName, Key: b2Key, Body: fileStream };

    try {
        const parallelUploads3 = new Upload({
            client: s3,
            params: uploadParams,
            queueSize: 4, // 4 concurrent chunks per file
            partSize: 5 * 1024 * 1024, // 5 MB chunks
        });
        await parallelUploads3.done();
        
        stats.processedFiles++;
        stats.uploadedBytes += fileSize;
    } catch (err) {
        console.error(`\n\x1b[91m[ERROR]\x1b[0m Failed ${relativePath}: ${err.message}`);
        // If it's a missing bucket error, we should exit immediately so we don't spam 100k errors
        if (err.message.includes('Bucket') || err.message.includes('undefined')) {
            console.error('\x1b[91mFATAL: Bucket configuration error. Halting dump.\x1b[0m');
            process.exit(1);
        }
    } finally {
        fileStream.destroy();
    }
}

async function runPanicDump() {
    console.log('\n=======================================================');
    console.log('\x1b[91m[!] INITIATING B2 LIFEBOAT PANIC DUMP [!]\x1b[0m');
    console.log('=======================================================\n');
    
    await loadSqliteSkiplist();

    console.log(`\x1b[33mScanning F: drive for telemetry data. Please wait...\x1b[0m`);
    const allFiles = [];
    
    // Extensions to ignore to prevent uploading duplicate Takeout .zip chunks, JSON metadata, and code backup files like node_modules
    const ignoreExts = new Set(['.zip', '.json', '.html', '.csv', '.ini', '.lnk', '.txt', '.js', '.map', '.ts', '.md']);

    // Heartbeat during the scan phase so the terminal doesn't look frozen on SMR drives doing garbage collection
    let scanCount = 0;
    const scanInterval = setInterval(() => {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`\x1b[36m[SCANNING]\x1b[0m ${scanCount.toLocaleString()} files cataloged so far...`);
    }, 3000);

    for await (const filepath of walkDirectory(TARGET_DIR)) {
        const ext = path.extname(filepath).toLowerCase();
        if (ignoreExts.has(ext)) continue;
        
        try {
            const stat = await fs.promises.stat(filepath);
            allFiles.push({ path: filepath, size: stat.size });
            stats.totalFiles++;
            stats.totalBytes += stat.size;
            scanCount++;
        } catch(e) {}
    }
    
    clearInterval(scanInterval);
    console.log(`\nScan complete. Found ${stats.totalFiles.toLocaleString()} files (${formatBytes(stats.totalBytes)}).\n`);
    console.log(`Target: ${TARGET_DIR}`);
    const bucketName = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET;
    console.log(`Destination: B2 Bucket (${bucketName}) -> /${LIFEBOAT_PREFIX}/`);
    console.log(`Concurrency: ${CONCURRENCY} threads\n`);

    let activeUploads = 0;
    const queue = [];
    
    stats.startTime = Date.now();
    const telemetryInterval = setInterval(printTelemetry, 500);

    for (const fileObj of allFiles) {
        while (activeUploads >= CONCURRENCY) {
            await Promise.race(queue);
        }

        activeUploads++;
        const p = uploadFile(fileObj.path, fileObj.size).finally(() => {
            activeUploads--;
            queue.splice(queue.indexOf(p), 1);
        });
        queue.push(p);
    }

    await Promise.all(queue);
    clearInterval(telemetryInterval);
    printTelemetry();
    
    console.log('\n\n\x1b[92m=======================================================\x1b[0m');
    console.log('\x1b[92m[SUCCESS] LIFEBOAT DUMP COMPLETE. YOU MAY DISCONNECT F: DRIVE.\x1b[0m');
    console.log('\x1b[92m=======================================================\x1b[0m\n');
    
    console.log('\x1b[93m=======================================================\x1b[0m');
    console.log('\x1b[93m[!] NEXT STEPS: B2 -> MONGO INJECTION REQUIRED [!]\x1b[0m');
    console.log('\x1b[93m=======================================================\x1b[0m');
    console.log('\x1b[93m> Injecting B2 assets into MongoDB pending_accessions...\x1b[0m');
    console.log('\x1b[93m=======================================================\x1b[0m\n');
    
    try {
        execSync('node scripts/migration/lifeboat_mongo_injector.js', { stdio: 'inherit' });
    } catch (e) {
        console.error('\x1b[91m❌ Injector failed to run automatically:\x1b[0m', e.message);
    }
}

runPanicDump().catch(console.error);
