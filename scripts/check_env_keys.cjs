const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

console.log('VAST_API_KEY present:', !!process.env.VAST_API_KEY);
console.log('RUNPOD_API_KEY present:', !!process.env.RUNPOD_API_KEY);
console.log('THUNDER_API_KEY present:', !!process.env.THUNDER_API_KEY);
console.log('B2_ACCESS_KEY_ID present:', !!process.env.B2_ACCESS_KEY_ID);
