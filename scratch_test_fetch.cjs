const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });
async function test() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LifeOS');
  const media = await db.collection('media').findOne({ source: { $regex: 'blogspot' } });
  if (media) {
    console.log('URL in DB:', media.url);
    const res = await fetch(media.url);
    console.log('Fetch DB URL status:', res.status, res.statusText);
    
    if (media.url.includes('s3.')) {
      const altUrl = media.url.replace(/https:\/\/[^.]+\.s3\.[^/]+\//, 'https://media.gigiwatt.com/file/LifeOS-Media/');
      console.log('Alt URL:', altUrl);
      const res2 = await fetch(altUrl);
      console.log('Fetch Alt URL status:', res2.status, res2.statusText);
    }
  } else {
    console.log('No blogspot media found.');
  }
  await client.close();
}
test().catch(console.error);
