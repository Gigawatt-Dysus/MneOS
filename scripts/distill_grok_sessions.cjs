/**
 * MneOS Sovereign Grok Session Distillator
 * Normalizes scraped Grok session files into Unified Master Session Logs.
 */

const fs = require('fs');
const path = require('path');

const GROK_BASE_DIR = path.join(__dirname, '..', '_SESSION_EXPORTS', 'GROK_SESSIONS');
const DISTILLED_OUTPUT_DIR = path.join(__dirname, '..', '_SESSION_EXPORTS', 'GROK_SESSIONS', 'DISTILLED');

function processGrokFile(filePath, category) {
    const rawText = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath, '.md');

    // Extract Title / Date
    let titleMatch = rawText.match(/^#\s+(?:GROK Session Log:\s*)?(.+)$/m);
    let sessionTitle = titleMatch ? titleMatch[1].trim() : filename;

    let dateMatch = rawText.match(/#\s*Date:\s*(\d{4}-\d{2}-\d{2})/i) || filename.match(/(\d{4}-\d{2}-\d{2})/);
    let sessionDate = dateMatch ? dateMatch[1] : 'Undated';

    // Parse Turns
    const turnRegex = /(?:\*\*Eric\*\*:?|\*\*Brita\*\*:?|\*\*Zen\*\*:?|\*\*Grok\*\*:?|User:|Assistant:)/gi;
    const turnBlocks = rawText.split(turnRegex);
    const matches = Array.from(rawText.matchAll(turnRegex));

    const turns = [];
    for (let i = 0; i < matches.length; i++) {
        const header = matches[i][0];
        const body = turnBlocks[i + 1] ? turnBlocks[i + 1].trim() : '';
        const isUser = /Eric|User/i.test(header);

        let speakerName = 'Brita';
        if (/Zen|Code|Script/i.test(body) || category === 'TECH_CODE') {
            speakerName = 'Zen';
        }

        if (body.length > 0) {
            turns.push({
                speaker: isUser ? 'Eric' : speakerName,
                content: body
            });
        }
    }

    if (turns.length === 0 && rawText.trim().length > 0) {
        turns.push({
            speaker: 'Eric',
            content: rawText.trim()
        });
    }

    let md = `# MneOS Session Log: ${sessionTitle}\n`;
    md += `* **Source Engine**: xAI Grok\n`;
    md += `* **Date**: ${sessionDate}\n`;
    md += `* **Category**: ${category}\n`;
    md += `* **Turns in Session**: ${turns.length}\n`;
    md += `* **User**: Eric (Architect)\n`;
    md += `* **AI Persona**: ${category === 'TECH_CODE' ? 'Zen' : 'Brita'}\n\n`;
    md += `---\n\n`;
    md += `## 💬 Session Dialogue\n\n`;

    turns.forEach((turn, idx) => {
        md += `**${turn.speaker}**\n`;
        md += `${turn.content}\n\n`;
        if (idx < turns.length - 1) {
            md += `------------------------------------------------------------\n\n`;
        }
    });

    return md;
}

function runGrokDistillation() {
    console.log(`================================================================`);
    console.log(`⚡ MneOS Sovereign Grok Session Distillation Pipeline`);
    console.log(`================================================================`);
    
    fs.mkdirSync(DISTILLED_OUTPUT_DIR, { recursive: true });

    const categories = ['ROLEPLAY_LORE', 'TECH_CODE'];
    let totalCount = 0;

    categories.forEach(cat => {
        const catDir = path.join(GROK_BASE_DIR, cat);
        if (!fs.existsSync(catDir)) return;

        const files = fs.readdirSync(catDir).filter(f => f.endsWith('.md'));
        files.forEach(file => {
            const fullPath = path.join(catDir, file);
            try {
                const distilledMd = processGrokFile(fullPath, cat);
                const outPath = path.join(DISTILLED_OUTPUT_DIR, `DISTILLED_${file}`);
                fs.writeFileSync(outPath, distilledMd, 'utf8');
                totalCount++;
            } catch (err) {
                console.error(`  [!] Error distilling Grok file ${file}: ${err.message}`);
            }
        });
    });

    console.log(`\n================================================================`);
    console.log(`🎉 GROK DISTILLATION COMPLETE!`);
    console.log(`Total Grok Sessions Distilled: ${totalCount}`);
    console.log(`Output Vault: ${DISTILLED_OUTPUT_DIR}`);
    console.log(`================================================================`);
}

runGrokDistillation();
