const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/data/vaultMessageCache.json');

console.log(`[Scrubber] 🧼 Reading ${targetFile}...`);
let content = fs.readFileSync(targetFile, 'utf8');

let redactedCount = 0;

// 1. Redact MongoDB URIs
const mongoRegex = /mongodb\+srv:\/\/[A-Za-z0-9_%\-]+:[A-Za-z0-9_%\-!@#$^&*]+@[A-Za-z0-9_\-\.]+\/[A-Za-z0-9_\-\?&=]+/g;
content = content.replace(mongoRegex, (match) => {
    redactedCount++;
    return 'mongodb+srv://[REDACTED_DB_USER]:[REDACTED_DB_PASS]@[REDACTED_CLUSTER].mongodb.net/[REDACTED_DB]';
});

// Generic MongoDB URI matcher fallback
const mongoRegex2 = /mongodb\+srv:\/\/[^\s"'\\]+/g;
content = content.replace(mongoRegex2, (match) => {
    redactedCount++;
    return 'mongodb+srv://[REDACTED_URI]';
});

// 2. Redact Google API keys (AIzaSy...)
const googleKeyRegex = /AIzaSy[A-Za-z0-9_\-]{33}/g;
content = content.replace(googleKeyRegex, (match) => {
    redactedCount++;
    return 'AIzaSy_REDACTED_SOVEREIGN_KEY_SECURED';
});

// 3. Redact xAI API keys (xai-...)
const xaiKeyRegex = /xai\-[A-Za-z0-9]{40,}/g;
content = content.replace(xaiKeyRegex, (match) => {
    redactedCount++;
    return 'xai_REDACTED_SOVEREIGN_KEY_SECURED';
});

// 4. Redact OpenAI / generic sk- keys
const openAiKeyRegex = /sk\-[A-Za-z0-9_\-]{32,}/g;
content = content.replace(openAiKeyRegex, (match) => {
    redactedCount++;
    return 'sk_REDACTED_SOVEREIGN_KEY_SECURED';
});

console.log(`[Scrubber] ✅ Redacted ${redactedCount} secret patterns! Writing back to file...`);
fs.writeFileSync(targetFile, content, 'utf8');
console.log(`[Scrubber] 🎉 vaultMessageCache.json scrubbed successfully!`);
