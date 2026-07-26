const fetch = require('node-fetch');

async function testApi() {
  const payload = {
    collectionName: 'pending_accessions',
    userId: '9MPVGVTxE8dXvkCrl1XrWHQzCl23',
    operation: 'count'
  };

  try {
    const res = await fetch('http://localhost:3000/api/sovereignDbQuery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Response:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testApi();
