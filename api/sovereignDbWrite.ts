import { MongoClient, ObjectId } from 'mongodb';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
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
    return res.status(401).json({ error: `Unauthorized: Token verification failed. Details: ${error.message}` });
  }

  // FORCE OVERRIDE userId with the secure, verified legacy UID
  req.body.userId = legacyUid;
  // If the client is directly querying their own user document, also override the docId
  if (req.body.collectionName === 'users' && req.body.docId) {
      req.body.docId = legacyUid;
  }
  // ---------------------------------

  try {
    const { collectionName, userId, docId, operation, data, options } = req.body;

    if (!collectionName || !userId || !operation) {
      return res.status(400).json({ error: "Missing required transaction arguments." });
    }

    const emitMutation = (docIdToEmit?: string | string[]) => {
      if ((req as any).io) {
        (req as any).io.emit('db_mutated', { collection: collectionName, operation, docId: docIdToEmit });
      }
    };

    const db = await getDatabase();
    const collection = db.collection(collectionName);
    const isSubcollection = collectionName !== 'users' && collectionName !== 'public_slugs';

    // [ZEN FIX] Recursively parse ISO strings back to Date objects to prevent MongoDB string sorting bugs
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
    const processDataDates = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string' && isoRegex.test(obj[key])) {
           obj[key] = new Date(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          processDataDates(obj[key]);
        }
      }
    };
    if (data && typeof data === 'object') {
      processDataDates(data);
    }

    if (operation === 'set') {
      if (!docId) return res.status(400).json({ error: "docId required for set operation." });
      
      const keyId = isSubcollection ? `${userId}_${docId}` : docId;
      const cleanData = { ...data };
      delete cleanData.id;
      delete cleanData._id;

      const payload = {
        id: docId,
        ...(isSubcollection ? { userId } : {}),
        ...cleanData,
        updatedAt: new Date()
      };

      // [ZEN FIX] Dual-Scheme Support: Check if doc exists under native ObjectId or alternate schema
      let filterId: any = keyId;
      const DUAL_SCHEME_COLLECTIONS = ['pending_accessions', 'media', 'events'];
      if (DUAL_SCHEME_COLLECTIONS.includes(collectionName)) {
        const orConditions: any[] = [{ _id: keyId }];
        if (typeof docId === 'string' && docId.length === 24 && /^[0-9a-fA-F]{24}$/.test(docId)) {
          try { orConditions.push({ _id: new ObjectId(docId), userId: userId }); } catch(e) {}
        } else {
          orConditions.push({ _id: docId, userId: userId });
        }
        const existingDoc = await collection.findOne({ $or: orConditions }, { projection: { _id: 1 } });
        if (existingDoc) {
           filterId = existingDoc._id;
        }
      }

      // [ZEN FIX] Force merge mode for the core users collection to prevent total profile obliteration
      const isMerge = options?.merge || collectionName === 'users';

      if (isMerge) {
        const $set: Record<string, any> = { updatedAt: new Date() };
        const $addToSet: Record<string, any> = {};
        const $inc: Record<string, any> = {};

        Object.keys(payload).forEach(key => {
          const val = payload[key];
          if (val && typeof val === 'object' && val.type === 'arrayUnion-facade') {
            $addToSet[key] = { $each: val.elements };
          } else if (val && typeof val === 'object' && val.type === 'increment-facade') {
            $inc[key] = val.value;
          } else {
            $set[key] = val;
          }
        });

        const updatePayload: Record<string, any> = {};
        if (Object.keys($set).length > 0) updatePayload.$set = $set;
        if (Object.keys($addToSet).length > 0) updatePayload.$addToSet = $addToSet;
        if (Object.keys($inc).length > 0) updatePayload.$inc = $inc;

        await collection.updateOne(
          { _id: filterId },
          updatePayload,
          { upsert: true }
        );
      } else {
        await collection.replaceOne(
          { _id: filterId },
          { _id: filterId, ...payload },
          { upsert: true }
        );
      }
      emitMutation(docId);
      return res.status(200).json({ success: true, data: { success: true, id: docId } });
    }

    if (operation === 'add') {
      const generatedId = crypto.randomUUID();
      const keyId = isSubcollection ? `${userId}_${generatedId}` : generatedId;
      const cleanData = { ...data };
      delete cleanData.id;
      delete cleanData._id;

      const payload = {
        _id: keyId,
        id: generatedId,
        ...(isSubcollection ? { userId } : {}),
        ...cleanData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await collection.insertOne(payload);
      emitMutation(generatedId);
      return res.status(200).json({ success: true, data: { success: true, id: generatedId } });
    }

    if (operation === 'delete') {
      if (!docId) return res.status(400).json({ error: "docId required for delete operation." });
      const keyId = isSubcollection ? `${userId}_${docId}` : docId;
      
      let filter: any = { _id: keyId as any };
      const DUAL_SCHEME_COLLECTIONS = ['pending_accessions', 'media', 'events'];
      if (DUAL_SCHEME_COLLECTIONS.includes(collectionName)) {
        const orConditions: any[] = [{ _id: keyId }];
        if (typeof docId === 'string' && docId.length === 24 && /^[0-9a-fA-F]{24}$/.test(docId)) {
          try { orConditions.push({ _id: new ObjectId(docId), userId: userId }); } catch(e) {}
        } else {
          orConditions.push({ _id: docId, userId: userId });
        }
        filter = { $or: orConditions };
      }
      
      const originalDoc = await collection.findOne(filter);
      if (originalDoc) {
          const ledgerCollection = db.collection('ledger');
          const sha256 = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
          const contentStr = JSON.stringify(originalDoc);
          
          const ledgerEntry = {
            _id: `ledger_${crypto.randomUUID()}`,
            originalId: originalDoc._id,
            originalCollection: collectionName,
            checksum: sha256(contentStr),
            deletedAt: new Date(),
            operator: "Eric Carl Douglas Cornett",
            backupText: contentStr.substring(0, 500),
            originalDoc: originalDoc
          };
          
          await ledgerCollection.insertOne(ledgerEntry);
          await collection.deleteOne({ _id: originalDoc._id });
      } else {
          // If not found in dual schema, just attempt default
          await collection.deleteOne({ _id: keyId as any });
      }

      emitMutation(docId);
      return res.status(200).json({ success: true, data: { success: true } });
    }

    if (operation === 'bulkUpdate') {
      const { ids, updateFields } = data as { ids: string[]; updateFields: Record<string, any> };
      if (!ids || !Array.isArray(ids) || !updateFields) {
        return res.status(400).json({ error: "ids array and updateFields required for bulkUpdate." });
      }

      const bulkOps = ids.map(id => {
        const keyId = isSubcollection ? `${userId}_${id}` : id;
        return {
          updateOne: {
            filter: { _id: keyId as any },
            update: { $set: { ...updateFields, updatedAt: new Date() } }
          }
        };
      });

      await collection.bulkWrite(bulkOps);
      emitMutation(ids);
      return res.status(200).json({ success: true, data: { success: true } });
    }

    return res.status(501).json({ error: `Operation "${operation}" is not supported.` });

  } catch (error: any) {
    console.error("[sovereignDbWrite] failed:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
