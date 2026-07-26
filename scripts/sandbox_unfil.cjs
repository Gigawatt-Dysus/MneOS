const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const ENV_PATH = path.join('C:\\MneOS\\.env.local');
const UNFIL_URL = 'https://api.unfil.ai/v1/images/generations'; // Assuming standard OpenAI-compatible endpoint
const MODEL_NAME = 'Juggernaut Pro Flux'; // Replace with exact Model ID from Unfil dashboard

function getApiKey() {
    if (!fs.existsSync(ENV_PATH)) return null;
    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    const match = envContent.match(/^UNFIL_API_KEY=(.*)$/m);
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

async function testUnfilGeneration() {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.error('[!] UNFIL_API_KEY not found in .env.local');
        console.error('Please add it and try again.');
        return;
    }

    // Grok's Test Prompt
    const prompt = `masterpiece, best quality, photorealistic, extremely detailed skin texture, natural pores and subtle freckles, beautiful young woman with long wavy brown hair and blue eyes, sitting on the edge of a bed wearing an open pink fluffy bathrobe, submissive aroused expression, heavy-lidded eyes in pleasure, slightly parted lips, flushed skin, "Masochistic Ecstasy" state, glistening natural creamy arousal fluids on inner thighs and labia with realistic beading and dripping, detailed anatomy, erect nipples, soft warm bedroom lighting with gentle rim light highlighting skin and fluids`;

    const data = JSON.stringify({
        model: MODEL_NAME,
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        response_format: "url" // or b64_json depending on their API
    });

    console.log(`[+] Spooling Unfil.ai Sandbox...`);
    console.log(`[+] Model: ${MODEL_NAME}`);
    console.log(`[+] Firing prompt... (This may take a moment)`);

    const req = https.request(UNFIL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(data)
        }
    }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            try {
                if (res.statusCode !== 200) {
                    console.error(`[-] API Error: ${res.statusCode}`);
                    console.error(body);
                    return;
                }
                const parsed = JSON.parse(body);
                console.log(`\n[+] Generation Successful!`);
                console.log(`[+] Image Output:`);
                console.log(parsed); // Dump raw output to see URL or Base64 structure
            } catch (e) {
                console.error('[-] Failed to parse response:', e.message);
                console.error('Raw Body:', body);
            }
        });
    });

    req.on('error', (e) => {
        console.error('[-] Request failed:', e.message);
    });

    req.write(data);
    req.end();
}

testUnfilGeneration();
