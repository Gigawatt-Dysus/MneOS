const fetch = require('node-fetch');
(async () => {
    try {
        const res = await fetch('http://localhost:3001/api/prune/extension', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extension: '.mts' })
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch(e) {
        console.error("Error:", e.message);
    }
})();
