const fs = require('fs');
const path = require('path');
const https = require('https');

// --- 1. ZERO-DEPENDENCY DOTENV PARSER ---
function loadEnv() {
    try {
        const envPath = path.join(__dirname, '../.env.local');
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
    } catch (err) {}
}

loadEnv();
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY_LOCAL;

if (!CLERK_SECRET_KEY) {
    console.error("FATAL: CLERK_SECRET_KEY missing");
    process.exit(1);
}

// --- 2. THE MASTER MIGRATION LIST ---
const MIGRATION_LIST = [
    { email: "artinae@gmail.com", uid: "b1TTYTUyjTR3e7faBT8lex0sn792" },
    { email: "dysus2021@gmail.com", uid: "8OxaMPSZqfbfW9SKuf7DlcxVfNO2" },
    { email: "dysus2024@gmail.com", uid: "9MPVGVTxE8dXvkCrl1XrWHQzCl23" },
    { email: "lilly62024@gmail.com", uid: "psPbuucWxZYyFSy3RRr7FmxIMY42" },
    { email: "lizziecornett40@gmail.com", uid: "jRSbV42aLtg7l6NepYMbReyehE33" },
    { email: "test@gigwatt.com", uid: "NqnzFX4aZISAhEzObJWhx5XmOLT2" },
    { email: "testuser@example.com", uid: "LBZAoH7uGvR4kLL86h0d3HD5rIu2" },
    { email: "zen@gigi.com", uid: "nFo8PR7vOycge5FHhT0GutEjLBx1" },
    { email: "winterhopefriend689@gmail.com", uid: "2qQf69l6j5XozM43ZJ2Tyr4qJdg2" }
];

// --- 3. HTTPS PROMISE WRAPPER ---
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

// --- 4. THE PROVISIONING ENGINE ---
async function runProvisioning() {
    console.log(`\n[Shadow Provisioning] 🚀 Initiating batch account creation and metadata graft...\n`);

    for (const user of MIGRATION_LIST) {
        console.log(`[Provisioning] Processing: ${user.email}`);
        
        try {
            // Step A: Check if the user already exists
            const existingUsers = await request('GET', `/v1/users?email_address=${encodeURIComponent(user.email)}`);
            
            if (existingUsers && existingUsers.length > 0) {
                // User exists -> Patch their metadata
                const clerkId = existingUsers[0].id;
                console.log(`   -> ⚠️ Account exists (${clerkId}). Patching metadata...`);
                
                await request('PATCH', `/v1/users/${clerkId}`, JSON.stringify({
                    public_metadata: { legacy_uid: user.uid }
                }));
                console.log(`   -> ✅ Metadata successfully grafted.`);
            } else {
                // User does not exist -> Create shadow account with metadata
                console.log(`   -> 🏗️ Account missing. Provisioning shadow account...`);
                
                // Generate a highly secure, mathematically random password for the shadow account
                const crypto = require('crypto');
                const dummyPassword = crypto.randomBytes(32).toString('hex');
                
                await request('POST', `/v1/users`, JSON.stringify({
                    email_address: [user.email],
                    password: dummyPassword,
                    public_metadata: { legacy_uid: user.uid },
                    skip_password_checks: true
                }));
                console.log(`   -> ✅ Shadow account successfully created and grafted.`);
            }
        } catch (err) {
            console.error(`   -> 💥 CRITICAL FAILURE:`, err.message);
        }
        console.log('--------------------------------------------------');
    }
    
    console.log(`\n[Shadow Provisioning] 🎉 Batch operation complete. All identities secured.\n`);
}

runProvisioning();
