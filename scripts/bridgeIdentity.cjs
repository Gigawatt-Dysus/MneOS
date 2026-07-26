const fs = require('fs');
const path = require('path');
const https = require('https');

// --- 1. ZERO-DEPENDENCY DOTENV PARSER ---
function loadEnv() {
    try {
        const envPath = path.join(__dirname, '../.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || '';
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                process.env[key] = value;
            }
        });
    } catch (err) { }
}

loadEnv();
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY_LOCAL;

if (!CLERK_SECRET_KEY) {
    console.error("FATAL: CLERK_SECRET_KEY missing");
    process.exit(1);
}

// WE USE EMAIL NOW. NO MORE RANDOM IDs.
const TARGET_EMAIL = "dysus2024@gmail.com";
const LEGACY_FIREBASE_UID = "9MPVGVTxE8dXvkCrl1XrWHQzCl23";

function request(method, endpoint, payload = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.clerk.com',
            port: 443,
            path: endpoint,
            method: method,
            headers: {
                'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        if (payload) {
            options.headers['Content-Length'] = Buffer.byteLength(payload);
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data || '{}'));
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function runBridge() {
    console.log(`\n[Bridge] 🔍 Looking up Clerk user by email: ${TARGET_EMAIL}...`);
    try {
        // Step 1: Find the user by email
        const users = await request('GET', `/v1/users?email_address=${encodeURIComponent(TARGET_EMAIL)}`);

        if (!users || users.length === 0) {
            console.error(`[Bridge] 🛑 ERROR: No user found with email ${TARGET_EMAIL}.`);
            return;
        }

        const clerkId = users[0].id;
        console.log(`[Bridge] ✅ Found actual Clerk ID: ${clerkId}`);
        console.log(`[Bridge] 🔌 Grafting legacy UID: ${LEGACY_FIREBASE_UID}...`);

        // Step 2: Patch the metadata
        const payload = JSON.stringify({
            public_metadata: { legacy_uid: LEGACY_FIREBASE_UID }
        });

        const updatedUser = await request('PATCH', `/v1/users/${clerkId}`, payload);
        console.log(`[Bridge] ✅ SUCCESS! Identity graft complete.`);
        console.log(`[Bridge] Verified Public Metadata:`, updatedUser.public_metadata);

    } catch (err) {
        console.error(`\n[Bridge] 💥 CRITICAL FAILURE:`, err.message);
    }
}

runBridge();