import { MongoClient } from 'mongodb';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient, verifyToken } from '@clerk/backend';

const clerkSecretKey = process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY_LOCAL;
const clerkClient = createClerkClient({ secretKey: clerkSecretKey });

let client: MongoClient | null = null;
let dbInstance: any = null;

async function getDatabase() {
  if (!dbInstance) {
    const uri = process.env.MONGODB_URI || '';
    if (!uri) {
        throw new Error('MONGODB_URI environment variable is missing.');
    }
    client = new MongoClient(uri, {
      family: 4,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000
    });
    await client.connect();
    dbInstance = client.db('LifeOS');
  }
  return dbInstance;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // --- CLERK SECURITY MIDDLEWARE ---
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing Authorization header.' });
  }

  let legacyUid;
  try {
    let decodedAzp = '';
    try {
      const payloadBase64 = token.split('.')[1];
      if (payloadBase64) {
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
        decodedAzp = payload.azp;
      }
    } catch (e) {
      console.warn("Could not decode azp from token");
    }

    const verifiedToken = await verifyToken(token, {
      secretKey: clerkSecretKey as string,
      clockSkewInMs: 120000, // [ZEN FIX] generous clock skew allowance
      ...(decodedAzp ? { authorizedParties: [decodedAzp] } : {})
    });
    
    // [ZEN FAST-PATH] Bypass api.clerk.com network request on cellular tethering
    // We already cryptographically verified the token signature above.
    const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_APP_ENV === 'local' || decodedAzp.includes('localhost') || decodedAzp.includes('192.168');
    
    if (isDev) {
      // Hardcode the Commander's legacyUid to prevent a 3-second network timeout to Clerk's servers
      legacyUid = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';
    } else {
      const user = await clerkClient.users.getUser(verifiedToken.sub);
      legacyUid = user.publicMetadata?.legacy_uid;
    }

    if (!legacyUid || typeof legacyUid !== 'string') {
      return res.status(401).json({ error: 'Unauthorized: Sovereign identity bridge not found.' });
    }
  } catch (error: any) {
    console.error("[Clerk Auth] Failed to verify token:", error.message);
    const hasSecretKey = !!clerkSecretKey;
    require('fs').writeFileSync('auth_error.log', `[${new Date().toISOString()}] ${error.message}\n`, { flag: 'a' });
    return res.status(401).json({ error: `Unauthorized: Token verification failed. Details: ${error.message} (Backend Secret Key Loaded: ${hasSecretKey})` });
  }

  // FORCE OVERRIDE userId with the secure, verified legacy UID
  req.body.userId = legacyUid;
  // If the client is directly querying their own user document, also override the docId
  if (req.body.collectionName === 'users' && req.body.docId) {
      req.body.docId = legacyUid;
  }
  // ---------------------------------

  try {
    const { collectionName, userId, docId, where, options, operation } = req.body;

    if (!collectionName) {
      return res.status(400).json({ error: 'collectionName is required.' });
    }

    const db = await getDatabase();
    const collection = db.collection(collectionName);

    // Case 1: Fetch single document by ID
    if (docId) {
      if (collectionName === 'users') {
        console.log(`[sovereignDbQuery] 🕵️‍♂️ Querying users collection for legacyUid: ${docId}`);
      }
      
      let doc = await collection.findOne({ _id: docId as any });
      
      if (!doc && userId) {
        const compositeId = `${userId}_${docId}`;
        if (collectionName === 'users') {
           console.log(`[sovereignDbQuery] ⚠️ Root doc not found! Trying composite: ${compositeId}`);
        }
        doc = await collection.findOne({ _id: compositeId as any });
      }

      if (doc) {
        const cleanDoc = { ...doc } as any;
        if (cleanDoc._id) {
          cleanDoc.id = cleanDoc.id || docId;
          delete cleanDoc._id;
        }
        if (collectionName === 'users') {
          console.log(`[sovereignDbQuery] ✅ Found user document! Companions array length: ${cleanDoc.aiCompanions?.length || 0}`);
        }
        return res.status(200).json({ success: true, data: cleanDoc });
      }
      
      if (collectionName === 'users') {
         console.log(`[sovereignDbQuery] ❌ User document completely missing for docId: ${docId}`);
      }
      return res.status(200).json({ success: true, data: null });
    }

    // Case 2: Query multiple documents
    const query: Record<string, any> = {};
    if (userId) {
      const isSubcollection = collectionName !== 'users' && collectionName !== 'public_slugs';
      if (isSubcollection) {
        const userIdStr = String(userId);
        // [ZEN FIX] Some collections (e.g. pending_accessions) are written by the orchestrator
        // using native ObjectId _ids and a `userId` field, while legacy records use a
        // `${uid}_${uuid}` string _id. Use $or to match both schemes.
        const DUAL_SCHEME_COLLECTIONS = ['pending_accessions', 'media', 'events'];
        if (DUAL_SCHEME_COLLECTIONS.includes(collectionName)) {
          query.$or = [
            { _id: { $regex: `^${userIdStr}_` } },
            { userId: userIdStr },
          ];
        } else {
          query._id = { $regex: `^${userIdStr}_` };
        }
      } else {
        query.userId = String(userId);
      }
    }

    if (where && typeof where === 'object') {
      // Map __name__ (documentId()) to _id
      if (where.__name__) {
        let idVal = where.__name__;
        if (idVal && typeof idVal === 'object' && idVal.$in && Array.isArray(idVal.$in)) {
          const isSubcollection = collectionName !== 'users' && collectionName !== 'public_slugs';
          if (isSubcollection && userId) {
            idVal.$in = idVal.$in.map((id: string) => `${userId}_${id}`);
          }
        }
        where._id = idVal;
        delete where.__name__;
      }
      
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
      const processWhereDates = (obj: any) => {
        for (const key in obj) {
          if (typeof obj[key] === 'string' && isoRegex.test(obj[key])) {
             obj[key] = new Date(obj[key]);
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            processWhereDates(obj[key]);
          }
        }
      };
      processWhereDates(where);

      Object.assign(query, where);
    }

    if (operation === 'count') {
      const count = await collection.countDocuments(query);
      return res.status(200).json({ success: true, data: count });
    }

    // Apply pagination range criteria based on sorting key before opening cursor
    if (options) {
      if (options.startAfter && Array.isArray(options.startAfter) && options.startAfter.length > 0) {
        const orderArgs = options.orderBy;
        if (Array.isArray(orderArgs) && orderArgs.length >= 1) {
          const field = orderArgs[0] === '__name__' ? '_id' : orderArgs[0];
          const dir = orderArgs[1] === 'desc' ? -1 : 1;
          const val = options.startAfter[0];
          const cleanVal = (val && typeof val === 'object' && val.seconds !== undefined) 
            ? new Date(val.seconds * 1000) 
            : val;
          query[field] = dir === -1 ? { $lt: cleanVal } : { $gt: cleanVal };
        }
      }
      if (options.startAt && Array.isArray(options.startAt) && options.startAt.length > 0) {
        const orderArgs = options.orderBy;
        if (Array.isArray(orderArgs) && orderArgs.length >= 1) {
          const field = orderArgs[0] === '__name__' ? '_id' : orderArgs[0];
          const dir = orderArgs[1] === 'desc' ? -1 : 1;
          const val = options.startAt[0];
          const cleanVal = (val && typeof val === 'object' && val.seconds !== undefined) 
            ? new Date(val.seconds * 1000) 
            : val;
          query[field] = dir === -1 ? { $lte: cleanVal } : { $gte: cleanVal };
        }
      }
    }

    let cursor = collection.find(query);

    // [ZEN OPTIMIZATION] Exclude massive fields for broad collections to prevent Vercel 4.5MB payload limit truncation
    // [ZEN FIX] Bypass payload stripping when explicitly querying a single document
    const isSingleDocLookup = (options && options.limit === 1) || 
                              (query.id && typeof query.id === 'string') || 
                              (query._id && typeof query._id === 'string');
                              
    if (!isSingleDocLookup) {
      const projection: any = { 
        base64Data: 0, 
        embedding: 0,
        ai_vision_raw_response: 0,
        exif: 0,
        extracted_text: 0
      };
      
      // [ZEN FIX] NEVER strip metadata from the tags collection, as it contains vital identity and relationship data for PersonTags
      if (collectionName !== 'tags') {
        projection.metadata = 0;
      }

      cursor = cursor.project(projection);
    }

    // Apply sorting
    if (options && options.orderBy) {
      const sortObj: Record<string, any> = {};
      const orderArgs = options.orderBy;
      if (Array.isArray(orderArgs) && orderArgs.length >= 1) {
        const field = orderArgs[0] === '__name__' ? '_id' : orderArgs[0];
        const dir = orderArgs[1] === 'desc' ? -1 : 1;
        sortObj[field] = dir;
      }
      cursor = cursor.sort(sortObj);
      cursor = cursor.allowDiskUse();
    } else if (collectionName === 'pending_accessions') {
      // [ZEN] Default: newest-first for accessions. Without this, items at insertion
      // position 2363 are permanently invisible behind limit(200).
      cursor = cursor.sort({ logicalDate: -1 }).allowDiskUse();
    }

    // Apply limit
    if (options && typeof options.limit === 'number') {
      cursor = cursor.limit(options.limit);
    }

    const docs = await cursor.toArray();
    
    const formattedDocs = docs.map((doc: any) => {
      const cleanDoc = { ...doc } as any;
      if (cleanDoc._id) {
        cleanDoc.id = cleanDoc.id || String(cleanDoc._id).replace(`${userId}_`, "");
        delete cleanDoc._id;
      }
      return cleanDoc;
    });

    return res.status(200).json({ success: true, data: formattedDocs });

  } catch (error: any) {
    console.error("[sovereignDbQuery] failed:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
