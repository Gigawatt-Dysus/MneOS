const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const https = require('https');

const artifactDir = "C:\\Users\\artin\\.gemini\\antigravity\\brain\\edcf08f5-d8ee-4eee-97d1-582156d313aa";
const mdFile = path.join(artifactDir, "HITL_Review.md");

async function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadImage(response.headers.location, dest).then(resolve).catch(reject);
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function run() {
    const uri = "mongodb://zen:sovereign@100.116.12.18:27017";
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('LifeOS');
        const coll = db.collection('pending_accessions');
        
        const docs = await coll.find({ aiModel: "llava:13b" })
                               .sort({ aiProcessedAt: -1 })
                               .limit(10)
                               .toArray();
        
        let markdownContent = "# Human-In-The-Loop Review: LLaVA 13B Captions\n\n";
        markdownContent += "Please review the target photos below alongside their generated captions to verify accuracy and check for hallucinations.\n\n";
        
        for (const doc of docs) {
            const filename = doc.originalName || doc.fileName || 'Unknown';
            const thumbs = doc.thumbnailUrls || {};
            const downloadUrl = thumbs.small || thumbs.medium || doc.url;
            
            if (downloadUrl) {
                const ext = path.extname(new URL(downloadUrl).pathname) || '.jpg';
                const safeName = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const imgName = `review_${safeName}_${doc._id}${ext}`;
                const destPath = path.join(artifactDir, imgName);
                
                try {
                    await downloadImage(downloadUrl, destPath);
                    // Use absolute paths in markdown for Antigravity artifacts
                    const absoluteImgPath = `file:///${destPath.replace(/\\/g, '/')}`;
                    
                    markdownContent += `### ${filename}\n`;
                    markdownContent += `![${filename}](${absoluteImgPath})\n\n`;
                    markdownContent += `> **Caption:** ${doc.caption}\n\n`;
                    markdownContent += `---\n\n`;
                } catch (err) {
                    console.error(`Failed to download image for ${filename}:`, err);
                }
            }
        }
        
        fs.writeFileSync(mdFile, markdownContent, 'utf8');
        console.log("HITL Review Artifact generated successfully at: " + mdFile);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
run();
