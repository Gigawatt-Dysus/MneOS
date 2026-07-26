const fs = require('fs');
let content = fs.readFileSync('C:/MneOS/functions/src/index.ts', 'utf-8');

// Line 188
content = content.replace(
    /const snapshot = await db\.collection\('users'\)\.doc\(uid\)\.collection\('tags'\)\.get\(\);\s*const placeTags = snapshot\.docs\.map\(\(doc: any\) => doc\.data\(\)\)\.filter\(\(t: any\) => t\.type === 'place'\);/g,
    `const placeTags = await mongoDb.collection('tags').find({ userId: uid, type: 'place' }).toArray();`
);

// Line 367
content = content.replace(
    /const configDoc = await db\.collection\('users'\)\.doc\(uid\)\.collection\('zen_config'\)\.doc\('main'\)\.get\(\);\s*const mainConfig = configDoc\.data\(\);/g,
    `const mainConfig = await mongoDb.collection('zen_config').findOne({ _id: \`\${uid}_main\` as any });`
);

// Line 686
content = content.replace(
    /const jobRef = await db\.collection\('google_import_jobs'\)\.add\(\{\s*userId: uid,\s*sessionId: session_id,\s*status: 'pending',\s*createdAt: admin\.firestore\.FieldValue\.serverTimestamp\(\),\s*totalItems: 0,\s*processedItems: 0\s*\}\);\s*res\.json\(\{ success: true, jobId: jobRef\.id \}\);/g,
    `const mongoClient = await getMongoClient(); const mongoDb = mongoClient.db("LifeOS"); const jobId = \`job_\${Date.now()}\`; await mongoDb.collection('import_jobs').insertOne({ _id: \`\${uid}_\${jobId}\` as any, userId: uid, jobId, sessionId: session_id, status: 'pending', createdAt: new Date(), totalItems: 0, processedItems: 0 }); res.json({ success: true, jobId });`
);

// Line 734, 751, 773 - sideloadGoogleMedia
content = content.replace(
    /const bucketName = bucket\.name;/g,
    `const bucketName = "B2-bucket";`
);
content = content.replace(
    /const writeStream = storageFile\.createWriteStream\(\{[^\}]+\}\);\s*await new Promise\(\(resolve, reject\) => \{\s*response\.data\.on\('data', \(chunk: any\) => hash\.update\(chunk\)\);\s*response\.data\.pipe\(writeStream\)\.on\('finish', resolve\)\.on\('error', reject\);\s*\}\);/g,
    `await new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => hash.update(chunk));
      response.data.on('end', resolve).on('error', reject);
    });`
);
content = content.replace(
    /const duplicateQuery = await db\.collection\(`users\/\$\{uid\}\/media`\)\s*\.where\('contentHash', '==', contentHash\)\s*\.limit\(1\)\s*\.get\(\);\s*const isDuplicate = !duplicateQuery\.empty;\s*const duplicateOf = isDuplicate \? duplicateQuery\.docs\[0\]\.id : null;/g,
    `const mongoClient = await getMongoClient(); const mongoDb = mongoClient.db("LifeOS"); const duplicateDoc = await mongoDb.collection('media').findOne({ userId: uid, contentHash }); const isDuplicate = !!duplicateDoc; const duplicateOf = duplicateDoc ? duplicateDoc.docId || duplicateDoc._id : null;`
);

// Line 911, 940, 958, 973 - proxyGooglePhoto
content = content.replace(
    /const userDoc = await db\.collection\('users'\)\.doc\(uid\)\.get\(\);/g,
    `const mongoClient = await getMongoClient(); const mongoDb = mongoClient.db("LifeOS"); const userDoc = await mongoDb.collection('users').findOne({ _id: uid as any });`
);

// We need to just inject `const mongoDb = (await getMongoClient()).db("LifeOS");` into proxyGooglePhoto, but we already did `const mongoDb = mongoClient.db...` above.

// Line 1220
content = content.replace(
    /const nukeSnap = await db\.collection\('users'\)\.doc\(uid\)\.collection\('inbox_queue'\)\.get\(\);\s*const batch = db\.batch\(\);\s*nukeSnap\.docs\.forEach\((doc: any)? => batch\.delete\(doc\.ref\)\);\s*await batch\.commit\(\);/g,
    `const mongoClient = await getMongoClient(); const mongoDb = mongoClient.db("LifeOS"); await mongoDb.collection('inbox_queue').deleteMany({ userId: uid });`
);

// Line 1246
content = content.replace(
    /const allSegments = await db\.collection\('users'\)\.doc\(uid\)\.collection\('chat_segments'\)\s*\.orderBy\('timestamp', 'asc'\)\s*\.get\(\);\s*const transcript = allSegments\.docs\.map\((d: any)? => d\.data\(\)\)\.filter\((d: any)? => d\.source === 'email'\);/g,
    `const mongoClient = await getMongoClient(); const mongoDb = mongoClient.db("LifeOS"); const transcript = await mongoDb.collection('chat_segments').find({ userId: uid, source: 'email' }).sort({ timestamp: 1 }).toArray();`
);

// Line 1272
content = content.replace(
    /const queueSnap = await db\.collection\('users'\)\.doc\(uid\)\.collection\('inbox_queue'\)\s*\.orderBy\('timestamp', 'asc'\)\s*\.get\(\);\s*const queueItems = queueSnap\.docs\.map\((d: any)? => d\.data\(\)\);/g,
    `const mongoClient = await getMongoClient(); const mongoDb = mongoClient.db("LifeOS"); const queueItems = await mongoDb.collection('inbox_queue').find({ userId: uid }).sort({ timestamp: 1 }).toArray();`
);

// Line 1287
content = content.replace(
    /const debugSnap = await db\.collection\('debug_logs'\)\s*\.orderBy\('timestamp', 'desc'\)\s*\.limit\(50\)\s*\.get\(\);\s*const logs = debugSnap\.docs\.map\((d: any)? => \(\{ id: d\.id, \.\.\.d\.data\(\) \}\)\);/g,
    `const mongoClient = await getMongoClient(); const mongoDb = mongoClient.db("LifeOS"); const logs = await mongoDb.collection('debug_logs').find({}).sort({ timestamp: -1 }).limit(50).toArray();`
);

// Handle implicit ANY types by adding "any" to map and filter
content = content.replace(/\.map\(d =>/g, '.map((d: any) =>');
content = content.replace(/\.filter\(d =>/g, '.filter((d: any) =>');
content = content.replace(/\.forEach\(doc =>/g, '.forEach((doc: any) =>');

fs.writeFileSync('C:/MneOS/functions/src/index.ts', content);
console.log('Done 2!');
