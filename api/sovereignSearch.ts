import { MongoClient } from 'mongodb';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient, verifyToken } from '@clerk/backend';

const clerkSecretKey = process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY_LOCAL || "sk_test_N1wNePld8HNlcMPKIlQUQOC1S3rJhubOMJlW127n0F";
const clerkClient = createClerkClient({ secretKey: clerkSecretKey });

let client: MongoClient | null = null;
let dbInstance: any = null;

async function getDatabase() {
  if (!dbInstance) {
    const defaultCloudUri = "mongodb+srv://dysus2026:2393WhiteTail!@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
    const envUri = process.env.MONGODB_URI || process.env.ATLAS_CLOUD_URI || '';
    const isLocalUri = envUri.includes('100.') || envUri.includes('localhost') || envUri.includes('127.0.0.1');
    const uri = (process.env.VERCEL === '1' || isLocalUri && process.env.VERCEL === '1') 
      ? (process.env.ATLAS_CLOUD_URI || defaultCloudUri)
      : (envUri || defaultCloudUri);

    client = new MongoClient(uri, {
      family: 4,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000
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
    const verifiedToken = await verifyToken(token, {
      secretKey: clerkSecretKey as string,
    });
    
    try {
      const user = await clerkClient.users.getUser(verifiedToken.sub);
      legacyUid = user.publicMetadata?.legacy_uid || '9MPVGVTxE8dXvkCrl1XrWHQzCl23';
    } catch (e) {
      legacyUid = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';
    }

    if (!legacyUid || typeof legacyUid !== 'string') {
      legacyUid = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';
    }
  } catch (error: any) {
    console.error("[Clerk Auth] Failed to verify token:", error);
    return res.status(401).json({ error: `Unauthorized: Invalid or expired token. Details: ${error.message}` });
  }

  // FORCE OVERRIDE userId with the secure, verified legacy UID
  req.body.userId = legacyUid;
  // ---------------------------------

  try {
    const { collectionName, userId, queryText, queryVector, limit = 12 } = req.body;
    
    if (!collectionName || !userId) {
      return res.status(400).json({ error: 'Missing collectionName or userId parameter' });
    }

    const db = await getDatabase();
    const collection = db.collection(collectionName);

    // 1. Run Vector Search and Keyword Search in parallel
    const vectorPromise = queryVector && Array.isArray(queryVector) && queryVector.length > 0
      ? collection.aggregate([
          {
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: queryVector,
              numCandidates: 50,
              limit: limit * 2,
              filter: { userId: userId }
            }
          }
        ]).toArray().catch((e: any) => {
            console.warn("[sovereignSearch] Vector search failed (likely local MongoDB):", e.message);
            return [];
        })
      : Promise.resolve([]);

    const textPromise = queryText
      ? collection.aggregate([
          {
            $search: {
              index: "default",
              text: {
                query: queryText,
                path: ["content", "title", "summary", "caption", "filename"],
                fuzzy: { maxEdits: 1 }
              }
            }
          },
          { $match: { userId: userId } },
          { $limit: limit * 2 }
        ]).toArray().catch(async (e: any) => {
            console.warn("[sovereignSearch] Atlas $search failed, falling back to regex:", e.message);
            const terms = queryText.split(/\s+/).filter((t: string) => t.length > 2);
            if (terms.length === 0) return [];
            const regex = new RegExp(terms.join('|'), 'i');
            return collection.find({
                userId: userId,
                $or: [
                    { content: { $regex: regex } },
                    { caption: { $regex: regex } },
                    { filename: { $regex: regex } }
                ]
            }).limit(limit * 2).toArray();
        })
      : Promise.resolve([]);

    const [vectorResults, textResults] = await Promise.all([vectorPromise, textPromise]);

    // 2. Compute Reciprocal Rank Fusion (RRF) to merge ranks
    const rrfScores: Record<string, { doc: any; score: number }> = {};
    const k = 60; // Standard RRF constant

    const applyRRF = (results: any[]) => {
      results.forEach((doc, index) => {
        const id = doc._id ? doc._id.toString() : doc.id || String(Math.random());
        if (!rrfScores[id]) rrfScores[id] = { doc, score: 0 };
        rrfScores[id].score += 1 / (k + (index + 1));
      });
    };

    applyRRF(vectorResults);
    applyRRF(textResults);

    // 3. Sort, truncate, and deliver final hydrated records
    const sortedDocs = Object.values(rrfScores)
      .sort((a, b) => b.score - a.score)
      .map(item => {
        const cleanDoc = { ...item.doc };
        if (cleanDoc._id) {
          cleanDoc.id = cleanDoc.id || String(cleanDoc._id).replace(`${userId}_`, "");
          delete cleanDoc._id;
        }
        return cleanDoc;
      })
      .slice(0, limit);

    return res.status(200).json({ success: true, data: sortedDocs });
  } catch (error: any) {
    console.error("[sovereignSearch] API failed:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
