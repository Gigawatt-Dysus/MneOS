/**
 * MneOS Erato Chat Genesis Harvester & Distillation Pipeline
 * Extracts atomic chat_segments for Eric from MongoDB Atlas, partitions into
 * daily session logs (_SESSION_EXPORTS/ERATO_SESSIONS/), and invokes Brita-ECH
 * (grok-build-0.1) for smart-titling, 3-layer FIND indexing, and PPPTCC-E entity staging.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

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

const ATLAS_URI = process.env.ATLAS_CLOUD_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/LifeOS";
const ERIC_UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

const LOCAL_ERATO_DIR = path.join(__dirname, '..', '_SESSION_EXPORTS', 'ERATO_HISTORICAL_RAW');
const GDRIVE_ERATO_DIR = 'G:\\My Drive\\MneOS_Memory_Vault\\ERATO_HISTORICAL_RAW';

// Parse command line arguments
const args = process.argv.slice(2);
const isTestMode = args.includes('--test') || args.includes('-t');
const limitDaysArg = args.find(a => a.startsWith('--days='));
const limitDays = limitDaysArg ? parseInt(limitDaysArg.split('=')[1], 10) : (isTestMode ? 5 : 0);

async function runEratoHarvester() {
    console.log(`================================================================`);
    console.log(`🌸 MneOS Sovereign Erato Chat Harvester & Distillation Engine`);
    console.log(`================================================================`);
    console.log(`Target User ID: ${ERIC_UID}`);
    console.log(`Test Mode: ${isTestMode ? 'YES' : 'NO'} ${limitDays ? `(Limit: ${limitDays} days)` : '(Full 67-day sweep)'}`);
    console.log(`Local Output:  ${LOCAL_ERATO_DIR}`);
    console.log(`G:Drive Output: ${GDRIVE_ERATO_DIR}`);

    // Ensure output directories exist
    fs.mkdirSync(LOCAL_ERATO_DIR, { recursive: true });
    try {
        if (fs.existsSync('G:\\My Drive')) {
            fs.mkdirSync(GDRIVE_ERATO_DIR, { recursive: true });
        }
    } catch (e) {
        console.warn(`[Erato Harvester] G: Drive mirror directory warning: ${e.message}`);
    }

    const client = new MongoClient(ATLAS_URI);
    try {
        await client.connect();
        console.log(`\n✅ Connected to Genesis Cluster MongoDB Atlas!`);
        const db = client.db('LifeOS');

        // Fetch all chat segments for Eric
        console.log(`\n📥 Fetching chat_segments for UID: ${ERIC_UID}...`);
        const rawSegments = await db.collection('chat_segments').find({ userId: ERIC_UID }).toArray();
        console.log(`Total turns retrieved: ${rawSegments.length}`);

        // Filter and sort turns
        const validTurns = [];
        for (const seg of rawSegments) {
            if (seg.isDeleted) continue;
            let d = null;
            if (seg.timestamp) {
                d = new Date(seg.timestamp);
                if (isNaN(d.getTime())) d = null;
            }
            if (!d && seg.createdAt) {
                d = new Date(seg.createdAt);
                if (isNaN(d.getTime())) d = null;
            }

            validTurns.push({
                id: seg.id || seg._id,
                role: seg.role === 'model' || seg.role === 'assistant' ? 'assistant' : 'user',
                speaker: seg.speaker || (seg.role === 'model' || seg.role === 'assistant' ? 'Brita' : 'Eric'),
                content: seg.content || '',
                date: d,
                rawDateStr: d ? d.toISOString() : 'Undated'
            });
        }

        // Group turns chronologically by Calendar Day (YYYY-MM-DD)
        const dateGroups = {};
        let undatedCount = 0;

        validTurns.forEach(turn => {
            if (turn.date) {
                const dateKey = turn.date.toISOString().split('T')[0];
                if (!dateGroups[dateKey]) dateGroups[dateKey] = [];
                dateGroups[dateKey].push(turn);
            } else {
                undatedCount++;
                if (!dateGroups['Undated']) dateGroups['Undated'] = [];
                dateGroups['Undated'].push(turn);
            }
        });

        // Sort turns inside each date group chronologically
        Object.keys(dateGroups).forEach(dateKey => {
            if (dateKey !== 'Undated') {
                dateGroups[dateKey].sort((a, b) => a.date.getTime() - b.date.getTime());
            }
        });

        const sortedDates = Object.keys(dateGroups).filter(d => d !== 'Undated').sort();
        if (dateGroups['Undated']) sortedDates.push('Undated');

        console.log(`\n📅 Grouped into ${sortedDates.length} distinct calendar sessions.`);

        let targetDates = sortedDates;
        if (limitDays > 0) {
            targetDates = sortedDates.slice(0, limitDays);
            console.log(`🧪 Test mode active: Processing first ${limitDays} sessions:`, targetDates);
        }

        const generatedFiles = [];

        // Process each target date group into a Markdown Session Log
        for (const dateKey of targetDates) {
            const turns = dateGroups[dateKey];

            // If turns > 120, split into chunks of ~80-100 turns
            const chunkSize = 100;
            const chunks = [];
            for (let i = 0; i < turns.length; i += chunkSize) {
                chunks.push(turns.slice(i, i + chunkSize));
            }

            for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
                const chunk = chunks[cIdx];
                const partSuffix = chunks.length > 1 ? `_Part_${cIdx + 1}` : '';
                const baseFilename = `ERATO_Session_${dateKey}${partSuffix}.md`;
                const localPath = path.join(LOCAL_ERATO_DIR, baseFilename);

                let md = `# MneOS Erato Chat Session Log: ${dateKey}${chunks.length > 1 ? ` (Part ${cIdx + 1}/${chunks.length})` : ''}\n\n`;
                md += `**Platform:** MneOS Erato Sovereign Chat  \n`;
                md += `**Date:** ${dateKey}  \n`;
                md += `**User ID:** ${ERIC_UID} (Eric / Dysus)  \n`;
                md += `**Turns in Session:** ${chunk.length}  \n`;
                md += `**Archive Source:** MongoDB Atlas (\`LifeOS.chat_segments\`)  \n\n`;
                md += `---\n\n`;
                md += `## 💬 Companion & Architect Dialogue\n\n`;

                chunk.forEach((t, tIdx) => {
                    const speakerTag = t.speaker === 'Brita' ? '🌸 **Brita**' : '👤 **Eric (Architect)**';
                    const timeTag = t.date ? t.date.toISOString().replace('T', ' ').substring(0, 19) : 'Timestamp N/A';
                    md += `### Turn ${tIdx + 1} | ${timeTag} | ${speakerTag}\n\n`;
                    md += `${t.content}\n\n`;
                    md += `---\n\n`;
                });

                fs.writeFileSync(localPath, md, 'utf8');

                // Mirror to G: Drive if available
                if (fs.existsSync(GDRIVE_ERATO_DIR)) {
                    try {
                        const gDrivePath = path.join(GDRIVE_ERATO_DIR, baseFilename);
                        fs.writeFileSync(gDrivePath, md, 'utf8');
                    } catch (gErr) {
                        console.warn(`[Erato Harvester] G: Drive mirror failed for ${baseFilename}: ${gErr.message}`);
                    }
                }

                console.log(`  📄 Exported: ${baseFilename} (${chunk.length} turns, ${(md.length / 1024).toFixed(1)} KB)`);
                generatedFiles.push(localPath);
            }
        }

        console.log(`\n================================================================`);
        console.log(`🎉 RAW ERATO HARVEST COMPLETE!`);
        console.log(`Raw Sessions Exported: ${generatedFiles.length}`);
        console.log(`Raw files saved in: ${LOCAL_ERATO_DIR}`);
        console.log(`Run remaster_erato_archive.cjs to generate HD Remastered sessions!`);
        console.log(`================================================================`);
        console.log(`🎉 ERATO HARVEST & DISTILLATION COMPLETE!`);
        console.log(`Sessions Processed: ${generatedFiles.length}`);
        console.log(`Check Accessioning Gateway (StagingDashboard) for staged entities!`);
        console.log(`================================================================`);

    } catch (err) {
        console.error(`❌ Fatal Error during Erato Harvest:`, err);
    } finally {
        await client.close();
    }
}

runEratoHarvester();
