/**
 * MneOS Sovereign Gemini Takeout Session Distillator
 * Transforms raw Takeout Markdown files in RESCUED_ALL into pristine, Unified Master Session Logs.
 * Strips Google web app noise (Show thinking, Export to Sheets, prompt echoes) and formats speaker tags.
 */

const fs = require('fs');
const path = require('path');

const RAW_VAULT_DIR = path.join(__dirname, '..', 'RESCUED_ALL');
const DISTILLED_OUTPUT_DIR = path.join(__dirname, '..', '_SESSION_EXPORTS', 'GEMINI_SESSIONS', 'DISTILLED');

const args = process.argv.slice(2);
const isTestMode = args.includes('--test') || args.includes('-t');
const testLimit = 50;

function cleanTurnContent(content) {
    if (!content) return '';

    let cleaned = content;

    // Strip Google Web App artifacts
    cleaned = cleaned.replace(/^Prompted\s+Here is the log of the last chat:\s*\[[\s\S]*?\]\s*/gi, '');
    cleaned = cleaned.replace(/Show thinking/gi, '');
    cleaned = cleaned.replace(/Export to Sheets/gi, '');
    cleaned = cleaned.replace(/Export to Docs/gi, '');
    cleaned = cleaned.replace(/You stopped this response/gi, '');
    cleaned = cleaned.replace(/Sorry, something went wrong\. Please try your request again\./gi, '');

    // Normalize whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

    return cleaned;
}

function processTakeoutMarkdownFile(filePath) {
    const rawText = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath, '.md');

    // Extract Title / Metadata if available
    let titleMatch = rawText.match(/^#\s+(.+)$/m);
    let sessionTitle = titleMatch ? titleMatch[1].replace(/^MyActivity_Gemini_/i, 'Gemini Takeout Session ').trim() : filename;
    
    // Extract Date
    let dateMatch = rawText.match(/\*Imported\*:\s*(\d{4}-\d{2}-\d{2})/i) || 
                    rawText.match(/\*Created\*:\s*(\d{4}-\d{2}-\d{2})/i) ||
                    rawText.match(/(\d{4}-\d{2}-\d{2})/);
    let sessionDate = dateMatch ? dateMatch[1] : 'Undated';

    // Extract Turns (User / Assistant)
    // Matches "### 👤 User" or "### 🤖 Assistant" or "**Eric**" / "**Brita**" / "User:" / "Prompted"
    const turnRegex = /(?:###\s+👤\s+User|###\s+🤖\s+Assistant|\*\*User\*\*|\*\*Assistant\*\*|\*\*Eric\*\*|\*\*Brita\*\*|User:|Assistant:)/gi;
    
    const turnBlocks = rawText.split(turnRegex);
    const turns = [];

    // Simple heuristic for turn role detection
    const matches = Array.from(rawText.matchAll(turnRegex));

    for (let i = 0; i < matches.length; i++) {
        const header = matches[i][0];
        const body = turnBlocks[i + 1] ? turnBlocks[i + 1] : '';
        const isUser = /User|Eric/i.test(header);

        // Detect AI Persona
        let assistantName = 'Brita';
        if (/Zen|Code|Script|IDE/i.test(body)) {
            assistantName = 'Zen';
        }

        const cleanedBody = cleanTurnContent(body);
        if (cleanedBody.length > 0) {
            turns.push({
                speaker: isUser ? 'Eric' : assistantName,
                content: cleanedBody
            });
        }
    }

    // Fallback if regex split yielded no structured turns
    if (turns.length === 0) {
        const cleanedRaw = cleanTurnContent(rawText);
        if (cleanedRaw.length > 0) {
            turns.push({
                speaker: 'Eric',
                content: cleanedRaw
            });
        }
    }

    // Format into Unified Master Session Schema
    let md = `# MneOS Session Log: ${sessionTitle}\n`;
    md += `* **Source Engine**: Gemini (Takeout Export)\n`;
    md += `* **Date**: ${sessionDate}\n`;
    md += `* **Category**: RESCUED_ALL\n`;
    md += `* **Turns in Session**: ${turns.length}\n`;
    md += `* **User**: Eric (Architect)\n`;
    md += `* **AI Persona**: ${turns.some(t => t.speaker === 'Zen') ? 'Zen' : 'Brita'}\n\n`;
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

function runTakeoutDistillation() {
    console.log(`================================================================`);
    console.log(`🚀 MneOS Sovereign Gemini Takeout Distillation Pipeline`);
    console.log(`================================================================`);
    console.log(`Source Vault: ${RAW_VAULT_DIR}`);
    console.log(`Output Vault: ${DISTILLED_OUTPUT_DIR}`);
    console.log(`Test Mode:    ${isTestMode ? `YES (Limit: ${testLimit} files)` : 'NO (Full Batch)'}`);

    fs.mkdirSync(DISTILLED_OUTPUT_DIR, { recursive: true });

    const files = fs.readdirSync(RAW_VAULT_DIR).filter(f => f.endsWith('.md'));
    console.log(`Found ${files.length} raw Markdown files in RESCUED_ALL.`);

    const targetFiles = isTestMode ? files.slice(0, testLimit) : files;
    let processedCount = 0;

    targetFiles.forEach((file, idx) => {
        const fullPath = path.join(RAW_VAULT_DIR, file);
        try {
            const distilledMd = processTakeoutMarkdownFile(fullPath);
            const outPath = path.join(DISTILLED_OUTPUT_DIR, `DISTILLED_${file}`);
            fs.writeFileSync(outPath, distilledMd, 'utf8');
            processedCount++;
            if (processedCount % 500 === 0 || isTestMode) {
                console.log(`  [✓] Processed (${processedCount}/${targetFiles.length}): ${file}`);
            }
        } catch (err) {
            console.error(`  [!] Error processing ${file}: ${err.message}`);
        }
    });

    console.log(`\n================================================================`);
    console.log(`🎉 GEMINI TAKEOUT DISTILLATION COMPLETE!`);
    console.log(`Files Distilled: ${processedCount}`);
    console.log(`Saved in: ${DISTILLED_OUTPUT_DIR}`);
    console.log(`================================================================`);
}

runTakeoutDistillation();
