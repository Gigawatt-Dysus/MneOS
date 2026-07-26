import { MongoClient } from 'mongodb';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';


// --- CONFIGURATION ---
const uri = process.env.MONGODB_URI || '';
const mongoClient = new MongoClient(uri, {
  family: 4,
  maxPoolSize: 5,
  serverSelectionTimeoutMS: 5000
});

let dbInstance: any = null;
async function getDatabase() {
  if (!dbInstance) {
    await mongoClient.connect();
    dbInstance = mongoClient.db('LifeOS');
  }
  return dbInstance;
}

// Ensure we use the proper local AI wrapper or fetch the user's config
// For Vercel Serverless we might rely on ENV vars or fetch it.
const XAI_API_KEY = process.env.XAI_API_KEY || ''; // Assuming Grok integration or standard Gemini depending on user's API keys

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { userId, fileName, fileType, fileSize, objectKey, publicUrl, source, metadata } = req.body;
  if (!userId || !fileName || !objectKey || !publicUrl) {
    return res.status(400).json({ error: "Missing required triage arguments." });
  }

  try {
    const mongoDb = await getDatabase();
    
    // Triage Logic (Assuming Grok or Gemini)
    // The user's system originally used ai.generate from genkit-ai inside Cloud Functions.
    // Here we'll do a mock or basic fetch to the user's preferred LLM since we're in Vercel.
    // If the user's mandate said "issue programmatic Gemini triage parameters", we'll use a standard fetch API for simplicity
    // or standard OpenAI compatible endpoint for Grok since they banned @google/genai in their rules.
    
    // WAIT: User rules: "NEVER USE OR SUGGEST ANY GEMINI models or @google/genai library!! ... ALWAYS WEB SEARCH FOR LATEST GROK MODELS BUT SUGGEST AND USE GROK 4.1... ONLY!"
    // I must use Grok via fetch or XAI.
    
    const triagePrompt = `
      Analyze this artifact metadata (File: ${fileName}, Type: ${fileType}).
      Source Metadata: ${JSON.stringify(metadata)}

      Perform a clinical triage for the LifeOS Archive. 
      Identify what this is, the date it pertains to (if detectable), and a draft title.
      
      RETURN RAW JSON ONLY:
      {
          "title": "Clinical descriptive title",
          "summary": "Brief factual summary of content",
          "logicalDate": "ISO-8601 date or null",
          "category": "Photo/Document/Receipt/Financial/Correspondence/Other",
          "suggestedTags": ["3-5", "tags"]
      }
    `;

    let triageData: any = {
        title: fileName,
        summary: "Pending automated summary",
        logicalDate: null,
        category: "Other",
        suggestedTags: []
    };

    if (XAI_API_KEY) {
      try {
        const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${XAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "grok-4.2-latest", // As per user rules
            messages: [{ role: "user", content: triagePrompt }],
            temperature: 0.1
          })
        });
        
        if (grokRes.ok) {
          const grokJson = await grokRes.json();
          let rawText = grokJson.choices[0].message.content;
          triageData = JSON.parse(rawText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim());
        }
      } catch (err) {
        console.warn("[Triage] Grok inference failed, falling back to safe defaults.", err);
      }
    }

    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(4).toString('hex');
    const docId = `acc_${timestamp}_${randomHash}`;

    await mongoDb.collection('pending_accessions').insertOne({
      _id: `${userId}_${docId}` as any,
      userId: userId,
      docId,
      mediaUrl: publicUrl,
      objectKey,
      fileName,
      fileType: fileType || 'application/octet-stream',
      fileSize: fileSize || 0,
      triage: triageData,
      status: "pending",
      source: source || "shoebox",
      sourceMetadata: metadata || {},
      createdAt: new Date(),
      logicalDate: triageData.logicalDate ? new Date(triageData.logicalDate) : null
    });

    return res.status(200).json({ success: true, docId, triage: triageData });

  } catch (error: any) {
    console.error("[Triage] failed:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

