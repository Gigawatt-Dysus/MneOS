const http = require('http');

const payload = JSON.stringify({
    model: 'mlabonne-meta-llama-3.1-8b-instruct-abliterated',
    messages: [
        { role: 'user', content: 'Say hello in 5 words.' }
    ],
    temperature: 0.1,
    max_tokens: 50
});

const req = http.request({
    hostname: '127.0.0.1',
    port: 1234,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log('Response:', body));
});

req.setTimeout(10000, () => {
    console.error('Timed out!');
    req.destroy();
});

req.on('error', err => console.error('Error:', err.message));
req.write(payload);
req.end();
