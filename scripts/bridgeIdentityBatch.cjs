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

// User Registry
const REGISTRY = [
    { email: "artinae@gmail.com", legacy_uid: "b1TTYTUyjTR3e7faBT8lex0sn792" },
    { email: "dysus2021@gmail.com", legacy_uid: "8OxaMPSZqfbfW9SKuf7DlcxVfNO2" },
    { email: "dysus2024@gmail.com", legacy_uid: "9MPVGVTxE8dXvkCrl1XrWHQzCl23" },
    { email: "lilly62024@gmail.com", legacy_uid: "psPbuucWxZYyFSy3RRr7FmxIMY42" },
    { email: "lizziecornett40@gmail.com", legacy_uid: "jRSbV42aLtg7l6NepYMbReyehE33" },
    { email: "test@gigwatt.com", legacy_uid: "NqnzFX4aZISAhEzObJWhx5XmOLT2" },
    { email: "testuser@example.com", legacy_uid: "LBZAoH7uGvR4kLL86h0d3HD5rIu2" },
    { email: "zen@gigi.com", legacy_uid: "nFo8PR7vOycge5FHhT0GutEjLBx1" },
    { email: "winterhopefriend689@gmail.com", legacy_uid: "2qQf69l6j5XozM43ZJ2Tyr4qJdg2" }
];

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

// Utility to delay execution to avoid rate limits
const delay = ms => new Promise(res => setTimeout(res, ms));

async function runBatchBridge() {
    console.log(`\n[BatchBridge] 🚀 Initiating Master Graft Sequence for ${REGISTRY.length} users...`);
    
    let successCount = 0;
    let failCount = 0;

    for (const user of REGISTRY) {
        console.log(`\n--------------------------------------------------`);
        console.log(`[BatchBridge] 🔍 Processing: ${user.email}`);
        try {
            // Step 1: Find the user by email
            const users = await request('GET', `/v1/users?email_address=${encodeURIComponent(user.email)}`);

            if (!users || users.length === 0) {
                console.warn(`[BatchBridge] ⚠️ WARNING: No Clerk user found for ${user.email}. Skipping.`);
                failCount++;
                continue;
            }

            const clerkId = users[0].id;
            console.log(`[BatchBridge] ✅ Found Clerk ID: ${clerkId}`);
            console.log(`[BatchBridge] 🔌 Grafting legacy UID: ${user.legacy_uid}...`);

            // Step 2: Patch the metadata
            const payload = JSON.stringify({
                public_metadata: { legacy_uid: user.legacy_uid }
            });

            const updatedUser = await request('PATCH', `/v1/users/${clerkId}`, payload);
            console.log(`[BatchBridge] ✅ SUCCESS! Identity graft complete for ${user.email}.`);
            successCount++;

        } catch (err) {
            console.error(`[BatchBridge] 💥 ERROR processing ${user.email}:`, err.message);
            failCount++;
        }
        
        // Brief pause to respect Clerk API rate limits
        await delay(500);
    }

    console.log(`\n==================================================`);
    console.log(`[BatchBridge] 🏁 MASTER GRAFT SEQUENCE COMPLETE.`);
    console.log(`[BatchBridge] 📊 Summary: ${successCount} successful, ${failCount} failed/skipped.`);
    console.log(`==================================================\n`);
}

runBatchBridge();
