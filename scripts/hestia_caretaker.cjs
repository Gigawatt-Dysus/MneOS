const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Configuration
const ENV_PATH = path.join('C:\\MneOS\\.env.local');
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_NAME = 'deepseek/deepseek-chat'; // High-logic cloud model arbitrage
const RULES_DIR = path.join('C:\\MneOS\\.agent\\rules');
const TELEMETRY_FILE = path.join(RULES_DIR, 'session-telemetry.md');
const INTERVAL_MS = 60 * 1000 * 5; // 5-minute daemon heartbeat

let lastDiffHash = '';

function getApiKey() {
    if (!fs.existsSync(ENV_PATH)) return null;
    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    const match = envContent.match(/^OPENROUTER_API_KEY=(.*)$/m);
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

async function askOpenRouter(prompt) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not found in .env.local');

    const data = JSON.stringify({
        model: MODEL_NAME,
        messages: [{ role: 'user', content: prompt }]
    });

    return new Promise((resolve, reject) => {
        const req = https.request(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://mneos.local', // Required by OpenRouter
                'X-Title': 'Project GIGI: MneOS Hestia' // Required by OpenRouter
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) return reject(new Error(`OpenRouter Error: ${res.statusCode} - ${body}`));
                    const parsed = JSON.parse(body);
                    resolve(parsed.choices[0].message.content);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function getGitDiff() {
    try {
        return execSync('git diff', { encoding: 'utf8', cwd: 'C:\\MneOS', windowsHide: true });
    } catch (e) {
        console.error('[Hestia] Git diff failed:', e.message);
        return '';
    }
}

async function runAudit() {
    console.log(`[Hestia] Waking up. Checking hearth at ${new Date().toLocaleTimeString()}...`);
    
    const diff = getGitDiff();
    if (!diff || diff.trim() === '') {
        console.log('[Hestia] No burning changes (empty git diff). Sleeping.');
        return;
    }

    const currentHash = crypto.createHash('md5').update(diff).digest('hex');
    if (currentHash === lastDiffHash) {
        console.log('[Hestia] Changes exist but have already been audited. Sleeping.');
        return;
    }

    console.log('[Hestia] New structural changes detected. Commencing cloud audit...');
    lastDiffHash = currentHash;

    const truncatedDiff = diff.slice(0, 15000); // Prevent massive context blowouts
    const prompt = `You are Hestia, the Caretaker AI for Project GIGI: MneOS.
Your job is to perform a surgical code review on the following git diff.
Identify any syntax errors, memory leaks, missing types, or logical anomalies.
Provide your response as a concise set of bullet points (maximum 5 points).
Do not rewrite the code. Just audit it.

Git Diff:
${truncatedDiff}`;

    try {
        console.log(`[Hestia] Spooling ${MODEL_NAME} via OpenRouter...`);
        const response = await askOpenRouter(prompt);
        
        console.log('[Hestia] Audit complete. Updating telemetry.');
        
        if (fs.existsSync(TELEMETRY_FILE)) {
            const telemetry = fs.readFileSync(TELEMETRY_FILE, 'utf8');
            // Purge previous Hestia notes to keep the HUD clean
            const cleanTelemetry = telemetry.replace(/### 🧹 HESTIA'S CARETAKER NOTES[\s\S]*$/, '').trim();
            const newTelemetry = cleanTelemetry + `\n\n### 🧹 HESTIA'S CARETAKER NOTES (Latest Diff):\n${response}\n`;
            fs.writeFileSync(TELEMETRY_FILE, newTelemetry, 'utf8');
        } else {
            fs.writeFileSync(TELEMETRY_FILE, `### 🧹 HESTIA'S CARETAKER NOTES:\n${response}\n`, 'utf8');
        }

    } catch (err) {
        console.error('[Hestia] Audit failed:', err.message);
        // Reset hash on failure so we try again next tick
        lastDiffHash = '';
    }
}

// Ignition
runAudit();
setInterval(runAudit, INTERVAL_MS);
