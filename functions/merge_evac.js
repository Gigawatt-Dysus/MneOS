const { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const readline = require("readline");

const client = new S3Client({
    endpoint: "https://s3.us-east-005.backblazeb2.com",
    region: "us-east-005",
    credentials: {
        accessKeyId: "0055db00fff7f080000000001",
        secretAccessKey: "K005E7JF0eHwRQlKUVP+bN+esrLy6sI"
    }
});

const BUCKET = "LifeOS-Media";
const PREFIX = "google-evac-temp/";
const CONCURRENCY = 50;

async function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => rl.question(query, (ans) => {
        rl.close();
        resolve(ans);
    }));
}

async function runMerge(dryRun = true) {
    console.log(`\n======================================================`);
    console.log(`🚀 LIFEOS SATELLITE: EVACUATION HARVESTER (${dryRun ? 'DRY-RUN' : 'LIVE MERGE'})`);
    console.log(`======================================================`);
    console.log(`Source Prefix: ${PREFIX}`);
    console.log(`Destination:   [Root of Bucket]`);
    console.log(`Bucket Name:   ${BUCKET}`);
    console.log(`Concurrency:   ${CONCURRENCY} files at once\n`);

    let continuationToken = undefined;
    let allObjects = [];
    let fetchCount = 1;

    console.log("Listing all objects inside google-evac-temp/ from Backblaze...");
    do {
        const listCommand = new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: PREFIX,
            ContinuationToken: continuationToken
        });
        const response = await client.send(listCommand);
        if (response.Contents) {
            allObjects = allObjects.concat(response.Contents);
            process.stdout.write(`  Fetched page ${fetchCount++}: ${allObjects.length} files found...\r`);
        }
        continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    
    console.log(`\n\nTotal objects to process: ${allObjects.length}`);
    
    // Filter out directory placeholders (ending in /) if size is 0
    const filesToMove = allObjects.filter(obj => {
        if (obj.Key.endsWith("/") && obj.Size === 0) return false;
        return true;
    });

    console.log(`Filtered files to transfer (excluding empty folders): ${filesToMove.length}`);

    if (filesToMove.length === 0) {
        console.log("No files found to merge!");
        return;
    }

    if (dryRun) {
        console.log("\n--- DRY-RUN SAMPLE (First 10 files) ---");
        filesToMove.slice(0, 10).forEach(file => {
            const destKey = file.Key.replace(PREFIX, "");
            console.log(`  [DRY] Copy: "${file.Key}" -> "${destKey}" (Size: ${(file.Size / 1024 / 1024).toFixed(2)} MB)`);
        });
        console.log(`\nDry run complete. No modifications were made.`);
        console.log(`======================================================\n`);
        return filesToMove.length;
    }

    let successCount = 0;
    let failCount = 0;
    let activeWorkers = 0;
    let currentIndex = 0;

    const startTime = Date.now();

    return new Promise((resolve) => {
        async function next() {
            if (currentIndex >= filesToMove.length) {
                if (activeWorkers === 0) {
                    const elapsed = (Date.now() - startTime) / 1000;
                    console.log(`\n\n======================================================`);
                    console.log(`🎉 LIVE MERGE COMPLETED IN ${elapsed.toFixed(1)} SECONDS!`);
                    console.log(`Successfully merged: ${successCount} files`);
                    console.log(`Failed to merge:      ${failCount} files`);
                    console.log(`======================================================\n`);
                    resolve();
                }
                return;
            }

            const itemIndex = currentIndex++;
            const file = filesToMove[itemIndex];
            const destKey = file.Key.replace(PREFIX, "");

            activeWorkers++;

            try {
                // 1. Copy file
                // CopySource format: /bucket-name/url-encoded-key
                const encodedSource = encodeURIComponent(file.Key).replace(/%2F/g, '/');
                const copyCommand = new CopyObjectCommand({
                    Bucket: BUCKET,
                    CopySource: `/${BUCKET}/${encodedSource}`,
                    Key: destKey
                });
                await client.send(copyCommand);

                // 2. Verify destination file exists and matches size
                const headCommand = new HeadObjectCommand({
                    Bucket: BUCKET,
                    Key: destKey
                });
                const headRes = await client.send(headCommand);

                if (headRes.ContentLength === file.Size) {
                    // 3. Delete source file
                    const deleteCommand = new DeleteObjectCommand({
                        Bucket: BUCKET,
                        Key: file.Key
                    });
                    await client.send(deleteCommand);
                    successCount++;
                } else {
                    throw new Error(`Size mismatch: source ${file.Size} vs dest ${headRes.ContentLength}`);
                }
            } catch (err) {
                console.error(`\n❌ Error moving "${file.Key}":`, err.message);
                failCount++;
            }

            activeWorkers--;
            
            // Log progress every 50 files
            const totalDone = successCount + failCount;
            if (totalDone % 50 === 0 || totalDone === filesToMove.length) {
                const pct = ((totalDone / filesToMove.length) * 100).toFixed(1);
                process.stdout.write(`  Progress: ${pct}% (${totalDone}/${filesToMove.length}) | Success: ${successCount} | Failed: ${failCount}\r`);
            }

            // Trigger next worker
            next();
        }

        // Spawn initial workers
        const limit = Math.min(CONCURRENCY, filesToMove.length);
        for (let i = 0; i < limit; i++) {
            next();
        }
    });
}

async function main() {
    // 1. Run dry run
    const count = await runMerge(true);
    if (!count) return;

    // 2. Ask user for confirmation
    const answer = await askQuestion(`Are you ready to initiate the Live Harvest and merge all ${count} files directly into the LifeOS root? (y/n): `);
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        await runMerge(false);
    } else {
        console.log("Merge aborted by user.");
    }
}

main();
