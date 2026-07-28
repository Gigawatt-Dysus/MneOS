const fs = require('fs');
const path = require('path');

const RESCUED_DIR = path.join('C:', 'MneOS', '_SESSION_EXPORTS', 'GEMINI_SESSIONS', 'RESCUED_ALL');
const files = fs.readdirSync(RESCUED_DIR).filter(f => f.endsWith('.md'));

let stampedCount = 0;

files.forEach(filename => {
    const filePath = path.join(RESCUED_DIR, filename);
    let content = fs.readFileSync(filePath, 'utf8');

    // Look for existing session ID in filename or content
    let hexId = null;
    const fileMatch = filename.match(/([a-f0-9]{12,64})/i);
    if (fileMatch) {
        hexId = fileMatch[1];
    } else {
        const contentMatch = content.match(/(?:gemini\.google\.com\/app\/|# Session ID:\s*|Conversation_with_Gemini_)([a-f0-9]{12,64})/i);
        if (contentMatch) {
            hexId = contentMatch[1];
        }
    }

    if (hexId) {
        let updated = false;
        if (!content.includes(`# Session ID: ${hexId}`)) {
            content = `# Session ID: ${hexId}\n` + content;
            fs.writeFileSync(filePath, content, 'utf8');
            updated = true;
        }

        // Rename file to include hexId if missing
        if (!filename.includes(hexId)) {
            const baseName = filename.replace(/\.md$/i, '').replace(/_\d{4}-\d{2}-\d{2}$/, '');
            const newFilename = `${baseName}_${hexId}.md`;
            const newPath = path.join(RESCUED_DIR, newFilename);
            if (!fs.existsSync(newPath)) {
                fs.renameSync(filePath, newPath);
                console.log(`[Stamped & Renamed] ${filename} -> ${newFilename}`);
            }
        } else if (updated) {
            console.log(`[Header Stamped] ${filename}`);
        }
        stampedCount++;
    }
});

console.log(`Finished stamping ${stampedCount} files with Session IDs.`);
