const { MongoClient } = require('mongodb'); 
require('dotenv').config({path: '.env.local'}); 
const c = new MongoClient(process.env.MONGODB_URI); 
c.connect().then(async () => { 
  const db = c.db(); 
  const media = db.collection('media'); 
  const result = await media.updateMany({ 
    aiProcessed: false, 
    fileType: { $not: /^image\//i }, 
    type: { $ne: 'IMAGE' } 
  }, { 
    $set: { aiProcessed: true } 
  }); 
  console.log('Updated non-images to processed:', result.modifiedCount); 
  c.close(); 
});
