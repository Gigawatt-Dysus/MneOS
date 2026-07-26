const fs = require('fs');
const path = require('path');
const http = require('http');

const VAULT_DIR = path.join('G:', 'My Drive', 'MneOS_Memory_Vault');
const LOCAL_DIR = path.join('C:', 'MneOS', '_SESSION_EXPORTS');
const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';

function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9_\-]/gi, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').substring(0, 50);
}

async function generateTitleWithOllama(content) {
    return new Promise((resolve) => {
        let snippet = content.substring(0, 1500);
        let prompt = `Read the following chat log snippet and output a short, descriptive 3-6 word Title for this conversation topic.
DO NOT use generic words like "Session" or "Conversation" or "Chat".
Be specific to the main topic (e.g. "Terr's Chamber Girl Training", "Morning Ritual and Syringe", "Brita Core Prompt Edit", "Quantum Cosmology Discussion").

SNIPPET:
${snippet}

SHORT TITLE (OUTPUT ONLY THE TITLE TEXT):`;

        let postData = JSON.stringify({
            model: 'llama3.2:1b',
            prompt: prompt,
            stream: false,
            options: { temperature: 0.1 }
        });

        let req = http.request(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
            timeout: 10000
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    let parsed = JSON.parse(data);
                    let title = parsed.response ? parsed.response.trim().replace(/^["']|["']$/g, '') : null;
                    if (title) {
                        resolve(sanitizeFilename(title));
                        return;
                    }
                } catch(e) {}
                resolve(null);
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.write(postData);
        req.end();
    });
}

async function renameVaultFiles() {
    console.log('[Renamer] Scanning vault files...');
    let files = fs.readdirSync(VAULT_DIR).filter(f => f.startsWith('GROK_Session_Session_'));

    for (let f of files) {
        let filePath = path.join(VAULT_DIR, f);
        let content = fs.readFileSync(filePath, 'utf8');

        console.log(`[Renamer] Processing ${f}...`);

        let extractedTitle = await generateTitleWithOllama(content);
        if (!extractedTitle || extractedTitle.length < 3) {
            // Fallback: search for first Eric line
            let match = content.match(/\*\*Eric:\*\*\s*\n([^\n]+)/);
            if (match) {
                extractedTitle = sanitizeFilename(match[1]);
            } else {
                extractedTitle = 'Vault_Archive';
            }
        }

        let dateStr = '2026-07-24';
        let matchDate = f.match(/(\d{4}-\d{2}-\d{2})\.md$/);
        if (matchDate) dateStr = matchDate[1];

        let newFilename = `GROK_Session_${extractedTitle}_${dateStr}.md`;

        // Avoid overwrite if file exists
        let newPath = path.join(VAULT_DIR, newFilename);
        let counter = 1;
        while (fs.existsSync(newPath) && newFilename !== f) {
            newFilename = `GROK_Session_${extractedTitle}_${counter}_${dateStr}.md`;
            newPath = path.join(VAULT_DIR, newFilename);
            counter++;
        }

        // Update header inside file content
        let updatedContent = content.replace(/^# GROK Session Log: .*/m, `# GROK Session Log: ${extractedTitle.replace(/_/g, ' ')}`);

        // Save new file & unlink old if name changed
        fs.writeFileSync(newPath, updatedContent, 'utf8');
        if (newFilename !== f) {
            try { fs.unlinkSync(filePath); } catch(e){}
        }

        // Mirror to local exports
        let localOldPath = path.join(LOCAL_DIR, f);
        let localNewPath = path.join(LOCAL_DIR, newFilename);
        fs.writeFileSync(localNewPath, updatedContent, 'utf8');
        if (newFilename !== f && fs.existsSync(localOldPath)) {
            try { fs.unlinkSync(localOldPath); } catch(e){}
        }

        console.log(`  ✅ Renamed -> ${newFilename}`);
    }

    console.log('[Renamer] All sessions successfully renamed to clean human titles!');
}

renameVaultFiles();
