const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const THUNDER_API_KEY = process.env.THUNDER_API_KEY;
console.log('THUNDER_API_KEY present:', !!THUNDER_API_KEY);

const THUNDER_BASE_URL = "https://api.thundercompute.com:8443/v1";

async function main() {
    try {
        console.log('Fetching from 8443...');
        const res = await axios.get(`${THUNDER_BASE_URL}/instances/list`, {
            headers: {
                Authorization: `Bearer ${THUNDER_API_KEY}`,
                "Content-Type": "application/json",
            },
        });
        console.log('8443 Response:', JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('8443 Failed:', e.message);
        
        try {
            console.log('Trying without port...');
            const res = await axios.get(`https://api.thundercompute.com/v1/instances/list`, {
                headers: {
                    Authorization: `Bearer ${THUNDER_API_KEY}`,
                    "Content-Type": "application/json",
                },
            });
            console.log('No port Response:', JSON.stringify(res.data, null, 2));
        } catch (e2) {
            console.error('No port Failed:', e2.message);
        }
    }
}

main();
