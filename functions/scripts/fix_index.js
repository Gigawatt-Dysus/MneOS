const fs = require('fs');

let content = fs.readFileSync('C:/MneOS/functions/src/index.ts', 'utf-8');

// 1. getFreshAccessToken
content = content.replace(
    /const doc = await db\.collection\('users'\)\.doc\(uid\)\.collection\('secrets'\)\.doc\('googlePhotos'\)\.get\(\);\s*if \(!doc\.exists \|\| !doc\.data\(\)\?\.refreshToken\) throw new Error\("AUTH_REQUIRED"\);\s*const refreshToken = doc\.data\(\)\?\.refreshToken;/g,
    `const mongoClient = await getMongoClient();
  const mongoDb = mongoClient.db("LifeOS");
  const doc = await mongoDb.collection('secrets').findOne({ _id: \`\${uid}_googlePhotos\` as any });
  if (!doc || !doc.refreshToken) throw new Error("AUTH_REQUIRED");
  const refreshToken = doc.refreshToken;`
);

// 2. linkGooglePhotos
content = content.replace(
    /await db\.collection\('users'\)\.doc\(uid\)\.collection\('secrets'\)\.doc\('googlePhotos'\)\.set\(\{\s*refreshToken: refresh_token,\s*updatedAt: admin\.firestore\.FieldValue\.serverTimestamp\(\)\s*\}\);/g,
    `const mongoClient = await getMongoClient();
      const mongoDb = mongoClient.db("LifeOS");
      await mongoDb.collection('secrets').updateOne(
        { _id: \`\${uid}_googlePhotos\` as any },
        { $set: { userId: uid, refreshToken: refresh_token, updatedAt: new Date() } },
        { upsert: true }
      );`
);

// 3. ingestGooglePhotosSession
content = content.replace(
    /const jobRef = await db\.collection\('google_import_jobs'\)\.add\(\{\s*userId: uid,\s*sessionId: session_id,\s*status: 'pending',\s*createdAt: admin\.firestore\.FieldValue\.serverTimestamp\(\),\s*totalItems: 0,\s*processedItems: 0\s*\}\);\s*res\.json\(\{ success: true, jobId: jobRef\.id \}\);/g,
    `const mongoClient = await getMongoClient();
    const mongoDb = mongoClient.db("LifeOS");
    const jobId = \`job_\${Date.now()}\`;
    await mongoDb.collection('import_jobs').insertOne({
      _id: \`\${uid}_\${jobId}\` as any,
      userId: uid,
      jobId,
      sessionId: session_id,
      status: 'pending',
      createdAt: new Date(),
      totalItems: 0,
      processedItems: 0
    });
    res.json({ success: true, jobId });`
);

// 4. sideloadGoogleMedia
content = content.replace(
    /const bucket = storage\.bucket\(\);/g,
    `// const bucket = storage.bucket(); (GCS removed for B2)`
);

content = content.replace(
    /const storageFile = bucket\.file\(destinationPath\);/g,
    `// const storageFile = bucket.file(destinationPath);`
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
    `const mongoClient = await getMongoClient();
    const mongoDb = mongoClient.db("LifeOS");
    const duplicateDoc = await mongoDb.collection('media').findOne({ userId: uid, contentHash });
    const isDuplicate = !!duplicateDoc;
    const duplicateOf = duplicateDoc ? duplicateDoc.docId || duplicateDoc._id : null;`
);

content = content.replace(
    /const accessionRef = await db\.collection\('users'\)\.doc\(uid\)\.collection\('pending_accessions'\)\.add\(\{\s*([\s\S]*?)\s*\}\);\s*res\.json\(\{ success: true, id: accessionRef\.id \}\);/g,
    `const docId = \`acc_\${Date.now()}\`;
    await mongoDb.collection('pending_accessions').insertOne({
      _id: \`\${uid}_\${docId}\` as any,
      userId: uid,
      docId,
      $1
    });
    res.json({ success: true, id: docId });`
);

content = content.replace(/createdAt: admin\.firestore\.FieldValue\.serverTimestamp\(\)/g, "createdAt: new Date()");
content = content.replace(/logicalDate: admin\.firestore\.Timestamp\.fromDate\(new Date\(creationTime\)\)/g, "logicalDate: new Date(creationTime)");

// 5. sovereignai
content = content.replace(
    /const userDoc = await db\.collection\('users'\)\.doc\(uid\)\.get\(\);\s*const lastSeen = userDoc\.data\(\)\?\.last_alexa_interaction\?\.toMillis\(\) \|\| 0;/g,
    `const mongoClient = await getMongoClient();
      const mongoDb = mongoClient.db("LifeOS");
      const userDoc = await mongoDb.collection('users').findOne({ _id: uid as any });
      const lastSeen = userDoc?.last_alexa_interaction ? new Date(userDoc.last_alexa_interaction).getTime() : 0;`
);

content = content.replace(
    /const snapshot = await db\.collection\('users'\)\.doc\(uid\)\.collection\('tags'\)\.get\(\);\s*const placeTags = snapshot\.docs\.map\(\(doc: any\) => doc\.data\(\)\)\.filter\(\(t: any\) => t\.type === 'place'\);/g,
    `const placeTags = await mongoDb.collection('tags').find({ userId: uid, type: 'place' }).toArray();`
);

content = content.replace(
    /const configDoc = await db\.collection\('users'\)\.doc\(uid\)\.collection\('zen_config'\)\.doc\('main'\)\.get\(\);\s*const mainConfig = configDoc\.data\(\);/g,
    `const mainConfig = await mongoDb.collection('zen_config').findOne({ _id: \`\${uid}_main\` as any });`
);

// 6. proxyGooglePhoto
content = content.replace(
    /const userDoc = await db\.collection\('users'\)\.doc\(uid\)\.get\(\);\s*if \(!userDoc\.exists\) \{ res\.status\(404\)\.send\('User not found'\); return; \}\s*const configRef = await db\.collection\('users'\)\.doc\(uid\)\.collection\('zen_config'\)\.doc\('main'\)\.get\(\);\s*const config = configRef\.data\(\);/g,
    `const mongoClient = await getMongoClient();
          const mongoDb = mongoClient.db("LifeOS");
          const userDoc = await mongoDb.collection('users').findOne({ _id: uid as any });
          if (!userDoc) { res.status(404).send('User not found'); return; }
          const config = await mongoDb.collection('zen_config').findOne({ _id: \`\${uid}_main\` as any });`
);

content = content.replace(
    /await db\.collection\('users'\)\.doc\(uid\)\.collection\('chat_segments'\)\.add\(\{\s*([\s\S]*?)\s*\}\);/g,
    `const docId = \`chat_\${Date.now()}\`;
        await mongoDb.collection('chat_segments').insertOne({
          _id: \`\${uid}_\${docId}\` as any,
          userId: uid,
          docId,
          $1
        });`
);

content = content.replace(
    /db\.collection\('users'\)\.doc\(uid\)\.set\(\{ last_alexa_interaction: admin\.firestore\.FieldValue\.serverTimestamp\(\) \}, \{ merge: true \}\)\.catch\(\(\) => \{ \}\);/g,
    `mongoDb.collection('users').updateOne({ _id: uid as any }, { $set: { last_alexa_interaction: new Date() } }).catch(() => { });`
);

// 7. initEmailChat
content = content.replace(
    /const nukeSnap = await db\.collection\('users'\)\.doc\(uid\)\.collection\('inbox_queue'\)\.get\(\);\s*const batch = db\.batch\(\);\s*nukeSnap\.docs\.forEach\((doc: any)? => batch\.delete\(doc\.ref\)\);\s*await batch\.commit\(\);/g,
    `const mongoClient = await getMongoClient();
    const mongoDb = mongoClient.db("LifeOS");
    await mongoDb.collection('inbox_queue').deleteMany({ userId: uid });`
);

// 8. checkBritaInbox
content = content.replace(
    /const userDoc = await db\.collection\('users'\)\.doc\(uid\)\.get\(\);\s*if \(!userDoc\.exists\) return \{ success: false, error: 'User not found' \};/g,
    `const mongoClient = await getMongoClient();
    const mongoDb = mongoClient.db("LifeOS");
    const userDoc = await mongoDb.collection('users').findOne({ _id: uid as any });
    if (!userDoc) return { success: false, error: 'User not found' };`
);

content = content.replace(
    /const allSegments = await db\.collection\('users'\)\.doc\(uid\)\.collection\('chat_segments'\)\s*\.orderBy\('timestamp', 'asc'\)\s*\.get\(\);\s*const transcript = allSegments\.docs\.map\((d: any)? => d\.data\(\)\)\.filter\((d: any)? => d\.source === 'email'\);/g,
    `const transcript = await mongoDb.collection('chat_segments').find({ userId: uid, source: 'email' }).sort({ timestamp: 1 }).toArray();`
);

content = content.replace(
    /const queueSnap = await db\.collection\('users'\)\.doc\(uid\)\.collection\('inbox_queue'\)\s*\.orderBy\('timestamp', 'asc'\)\s*\.get\(\);\s*const queueItems = queueSnap\.docs\.map\((d: any)? => d\.data\(\)\);/g,
    `const queueItems = await mongoDb.collection('inbox_queue').find({ userId: uid }).sort({ timestamp: 1 }).toArray();`
);

content = content.replace(
    /const debugSnap = await db\.collection\('debug_logs'\)\s*\.orderBy\('timestamp', 'desc'\)\s*\.limit\(50\)\s*\.get\(\);\s*const logs = debugSnap\.docs\.map\((d: any)? => \(\{ id: d\.id, \.\.\.d\.data\(\) \}\)\);/g,
    `const mongoClient = await getMongoClient();
    const mongoDb = mongoClient.db("LifeOS");
    const logs = await mongoDb.collection('debug_logs').find({}).sort({ timestamp: -1 }).limit(50).toArray();`
);

fs.writeFileSync('C:/MneOS/functions/src/index.ts', content);
console.log('Done!');
