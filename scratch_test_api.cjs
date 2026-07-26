const http = require('http');

const data = JSON.stringify({
  action: 'getDoc',
  collection: 'users',
  id: '9MPVGVTxE8dXvkCrl1XrWHQzCl23'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/sovereignDbQuery',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
