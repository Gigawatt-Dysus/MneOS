
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getAI } from "./genkit-ai";
import { MongoClient } from "mongodb";

import * as admin from "firebase-admin";
import axios from "axios";
import * as jwt from "jsonwebtoken";
import { Client } from "typesense";
import * as crypto from "crypto";

// [ZEN] Initialize Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = null as any; // Legacy SDK Deprecated
const storage = null as any; // Legacy SDK Deprecated

// [SOVEREIGN MONGO ENGINE] Initialize MongoClient connection pool
const cloudMongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/LifeOS";
const localMongoUri = "mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin";

let cloudClient: MongoClient | null = null;
let localClient: MongoClient | null = null;

export const getDbClients = async () => {
  if (!cloudClient) {
    console.log("[MongoEngine] Connecting to Cloud cluster...");
    cloudClient = new MongoClient(cloudMongoUri, { family: 4, minPoolSize: 0, maxPoolSize: 3, serverSelectionTimeoutMS: 3000 });
    await cloudClient.connect().catch(e => console.error("[MongoEngine] Cloud DB Unreachable"));
  }
  if (!localClient) {
    console.log("[MongoEngine] Connecting to Local GGA cluster...");
    localClient = new MongoClient(localMongoUri, { family: 4, minPoolSize: 0, maxPoolSize: 3, serverSelectionTimeoutMS: 2000 });
    await localClient.connect().catch(e => console.error("[MongoEngine] Local DB Unreachable"));
  }
  return { 
    cloudDb: cloudClient ? cloudClient.db("LifeOS") : null,
    localDb: localClient ? localClient.db("LifeOS") : null 
  };
};

export const getMongoClient = async (): Promise<MongoClient> => {
  // Legacy fallback for generic functions (prioritizes local for speed)
  await getDbClients();
  if (localClient) return localClient;
  if (cloudClient) return cloudClient;
  throw new Error("No database connections available");
};


// --- CONFIGURATION ---
const CLIENT_ID = '459534779564-bp6l3b1cncl53cbh5eu7m6q0ng96bsmh.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'postmessage';
const JWT_SECRET = 'gigi-skeleton-key-12345';

// --- RAG HELPERS (Ported for Cloud) ---

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "am", "an", "and", "any", "are", "as", "at",
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can", "did", "do", "does", "doing", "don", "down", "during", "each", "few", "for",
  "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "i", "im", "if", "in", "into", "is", "it", "its", "itself",
  "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off",
  "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own",
  "s", "same", "she", "should", "so", "some", "such", "t", "than", "that", "the", "their",
  "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those",
  "through", "to", "too", "under", "until", "up", "very", "was", "we", "were", "what",
  "when", "where", "which", "while", "who", "whom", "why", "will", "with", "you", "your",
  "yours", "yourself", "yourselves",
  "hey", "hello", "hi", "ok", "okay", "actually", "basically", "literally",
  "remember", "recall", "guess", "maybe", "like", "yeah", "yep", "nope"
]);

const extractKeywords = (query: string): string => {
  const clean = query.toLowerCase().replace(/[?.,!;"'()]/g, '');
  const words = clean.split(/\s+/);
  const keywords = words.filter(w => (!STOP_WORDS.has(w) && w.length > 2) || !isNaN(Number(w)));
  if (keywords.length === 0) return clean;
  return [...new Set(keywords)].join(' ');
};

async function searchMemory(userId: string, query: string, config: any): Promise<string> {
  if (!config.typesenseHost || !config.typesenseKey) {
    console.log("[RAG] Missing Typesense Keys. Skipping Memory.");
    return "";
  }

  try {
    const client = new Client({
      nodes: [{ host: config.typesenseHost, port: 443, protocol: 'https' }],
      apiKey: config.typesenseKey,
      connectionTimeoutSeconds: 5
    });

    const optimizedQuery = extractKeywords(query);
    console.log(`[RAG] Searching for: "${optimizedQuery}"`);

    const searchParams = {
      q: optimizedQuery,
      query_by: 'keywords,title,summary,content',
      query_by_weights: '4,4,2,1',
      collection: 'chat_memory_v2_robust',
      per_page: 5,
      filter_by: `user_id:= [${userId}, unknown]`,
      sort_by: '_text_match:desc,timestamp:desc'
    };

    const result = await client.multiSearch.perform({ searches: [searchParams] });
    const hits = (result.results[0] as any)?.hits || [];

    if (hits.length === 0) return "";

    const contextDocs = hits.map((h: any) => {
      const doc = h.document;
      const dateStr = new Date(doc.timestamp).toLocaleDateString('en-US');
      return `[MEMORY ID:${doc.id} DATE:${dateStr}]\n${doc.content} `;
    });

    console.log(`[RAG] Found ${hits.length} memories.`);
    return `\n === RELEVANT MEMORIES ===\n${contextDocs.join('\n\n')} \n === END MEMORIES ===\n`;

  } catch (e: any) {
    console.error("[RAG] Search Failed:", e.message);
    return "";
  }
}

// --- SSML & EMOTION HELPERS ---

function wrapInSSML(text: string, voice: string = "Joanna", audioPrepend: string = ""): string {
  const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `< speak > ${audioPrepend} <voice name="${voice}" > ${safeText} </voice></speak > `;
}

function parseStageDirections(text: string): string {
  return text;
}

function sanitizeForUI(text: string): string {
  return text.replace(/\([^)]*\)/g, '').trim();
}

// --- ALEXA SKILL LOGIC ---

const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput: HandlerInput): Promise<Response> {
    const { requestEnvelope } = handlerInput;
    const accessToken = requestEnvelope.context.System.user.accessToken;

    console.log(`[Alexa] LaunchRequest received.Authenticated: ${!!accessToken} `);

    if (!accessToken) {
      const speakOutput = 'Welcome to Life Archivist. I need to link your GIGI account to proceed. I have sent a link to your Alexa app. Please check your phone.';
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .withLinkAccountCard()
        .getResponse();
    }

    const now = Date.now();
    let greeting = "Life Archivist online. I am Brita, what is on your mind?";
    let earcon = "";

    try {
      const uid = (jwt.verify(accessToken, JWT_SECRET) as any).uid;
      const userDoc = await db.collection('users').doc(uid).get();
      const lastSeen = userDoc.data()?.last_alexa_interaction?.toMillis() || 0;
      const diffMins = (now - lastSeen) / 60000;

      if (diffMins < 20) {
        // HOT state: Trek Computer Sound
        // earcon = '<audio src="https://www.trekcore.com/audio/computer/incoming_message.mp3"/>';
        greeting = "I'm here.";
      } else if (diffMins < 240) {
        greeting = "Ready, Eric.";
      }
    } catch (e) {
      console.warn("[Alexa] Greeting Logic Failed:", e);
    }

    return handlerInput.responseBuilder
      .speak(wrapInSSML(greeting, "Joanna", earcon))
      .reprompt(wrapInSSML("I'm still here. Anything you'd like to talk about?"))
      .withShouldEndSession(false)
      .getResponse();
  },
};

// [ZEN] FAMILY GRAPH BUILDER (Ported from Client)
async function fetchUserTags(uid: string) {
  try {
    const snapshot = await db.collection('users').doc(uid).collection('tags').get();
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.warn("[FamilyGraph] Tag Fetch Failed:", e);
    return [];
  }
}

// [ZEN] Heuristic Relationship Resolver V7 (Gender Compatibility & Sibling-in-Laws)
function resolveRelationshipString(p1: any, p2: any, rawType: string): string | null {
  const type = rawType.toLowerCase().trim();
  const gender1 = p1.metadata?.gender?.toLowerCase() || 'unknown';
  const gender2 = p2.metadata?.gender?.toLowerCase() || 'unknown';

  // [ZEN FIX] Robust Date Parser 
  const parseDate = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (val.toDate && typeof val.toDate === 'function') return val.toDate().getTime();
    if (val._seconds) return val._seconds * 1000;
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const birth1 = parseDate(p1.metadata?.dates?.birth);
  const birth2 = parseDate(p2.metadata?.dates?.birth);

  const hasAge = birth1 !== 0 && birth2 !== 0;
  const isP1Older = birth1 < birth2;

  const isP1KnownChild = birth1 !== 0 && new Date(birth1).getFullYear() >= 2010;
  const isP2KnownChild = birth2 !== 0 && new Date(birth2).getFullYear() >= 2010;

  // --- PARENTAL / GRANDPARENTAL HIERARCHY ---
  const seniorTypes = ['mother', 'father', 'parent', 'mother-in-law', 'father-in-law', 'grandmother', 'grandfather', 'great-grandfather', 'great-grandmother'];
  const juniorTypes = ['son', 'daughter', 'child', 'son-in-law', 'daughter-in-law', 'grandson', 'granddaughter'];

  const isSeniorType = seniorTypes.find(t => type.includes(t));
  const isJuniorType = juniorTypes.find(t => type.includes(t));

  if (isSeniorType || isJuniorType) {
    let senior = p1;
    let junior = p2;
    let seniorGender = gender1;

    // CASE A: Strict Age Hierarchy (Best)
    if (hasAge) {
      senior = isP1Older ? p1 : p2;
      junior = isP1Older ? p2 : p1;
      seniorGender = isP1Older ? gender1 : gender2;
    } else {
      // CASE B: Fallback (Missing Ages)

      if (isSeniorType) {
        senior = p2; junior = p1; seniorGender = gender2;
      } else {
        senior = p1; junior = p2; seniorGender = gender1;
      }

      // [ZEN FIX] Gender Compatibility Flip
      const isRoleFemale = type.includes('mother') || type.includes('grandmother');
      const isRoleMale = type.includes('father') || type.includes('grandfather');

      const seniorGenderKnown = seniorGender !== 'unknown';

      if (seniorGenderKnown) {
        if (isRoleFemale && seniorGender === 'male') {
          // FLIP!
          const temp = senior; senior = junior; junior = temp;
          seniorGender = (senior === p1) ? gender1 : gender2;
        } else if (isRoleMale && seniorGender === 'female') {
          // FLIP!
          const temp = senior; senior = junior; junior = temp;
          seniorGender = (senior === p1) ? gender1 : gender2;
        }
      }
    }

    // [Safety] Child Check
    if ((senior === p1 && isP1KnownChild) || (senior === p2 && isP2KnownChild)) return null;

    // Role Assignment with Gender Inference
    let finalGender = seniorGender;
    if (finalGender === 'unknown') {
      if (type.includes('mother')) finalGender = 'female';
      if (type.includes('father')) finalGender = 'male';
    }

    let role = (finalGender === 'male') ? "Father" : "Mother";
    if (type.includes('grand') || type.includes('great')) {
      role = (finalGender === 'male') ? "Grandfather" : "Grandmother";
      if (type.includes('great')) role = "Great-" + role;
    } else if (type.includes('in-law')) {
      role = (finalGender === 'male') ? "Father-in-law" : "Mother-in-law";
    }

    return `${senior.name} is ${role} of ${junior.name}`;
  }

  // --- SIBLINGS (Horizontal) ---
  if (['brother', 'sister', 'sibling', 'half-brother'].includes(type) || type.includes('brother') || type.includes('sister')) {
    const isBrother = gender1 === 'male' || (gender1 === 'unknown' && type.includes('brother'));
    let p1Label = isBrother ? "Brother" : "Sister";

    // [ZEN FIX] Persist "in-law"
    if (type.includes('in-law')) p1Label += "-in-law";

    return `${p1.name} is ${p1Label} of ${p2.name}`;
  }

  // --- PARTNERS ---
  if (type.includes('wife') || type.includes('husband') || type.includes('spouse') || type.includes('partner') || type.includes('ex-')) {
    if (type.includes('wife') || type.includes('girl')) {
      const female = (gender1 === 'female') ? p1 : (gender2 === 'female' ? p2 : null);
      const other = (female === p1) ? p2 : p1;
      if (female) return `${female.name} is ${type} of ${other.name}`;
    }
    if (type.includes('husband') || type.includes('boy')) {
      const male = (gender1 === 'male') ? p1 : (gender2 === 'male' ? p2 : null);
      const other = (male === p1) ? p2 : p1;
      if (male) return `${male.name} is ${type} of ${other.name}`;
    }
    return `${p1.name} is ${type} of ${p2.name}`;
  }

  return `${p1.name} is ${type} of ${p2.name}`;
}

// [ZEN] Graph Builder now returns trace for debugging
function buildFamilyGraphContext(tags: any[]): { graph: string, trace: string[] } {
  const people = tags.filter((t: any) => t.type === 'person');
  if (people.length === 0) return { graph: "", trace: ["No people tags found"] };

  const relationships = new Set<string>();
  const trace: string[] = [];
  const tagMap = new Map(tags.map((t: any) => [t.id, t]));

  people.forEach((sourcePerson: any) => {
    if (sourcePerson.metadata?.relationships?.length > 0) {
      sourcePerson.metadata.relationships.forEach((rel: any) => {
        const targetPerson = tagMap.get(rel.relatedPersonId);
        if (!targetPerson) return;

        const rawType = rel.type || "unknown";
        const sentence = resolveRelationshipString(sourcePerson, targetPerson, rawType);

        // [ZEN DEBUG] Deep Date Trace
        const getRaw = (p: any) => p.metadata?.dates?.birth ? JSON.stringify(p.metadata.dates.birth) : "MISSING";
        const getYear = (p: any) => {
          const val = p.metadata?.dates?.birth;
          if (!val) return "N/A";
          if (val.toDate) return val.toDate().getFullYear();
          if (val._seconds) return new Date(val._seconds * 1000).getFullYear();
          return new Date(val).getFullYear();
        };

        const d1 = getRaw(sourcePerson);
        const d2 = getRaw(targetPerson);
        const y1 = getYear(sourcePerson);
        const y2 = getYear(targetPerson);

        if (sentence) {
          relationships.add(sentence);
          trace.push(`[RESOLVED] ${sourcePerson.name}(${y1})->${targetPerson.name}(${y2}) [${rawType}] => "${sentence}"`);
        } else {
          trace.push(`[DROPPED] ${sourcePerson.name}(Raw:${d1})->${targetPerson.name}(Raw:${d2}) [${rawType}] - Failed V6 Checks.`);
        }
      });
    }
  });

  const graph = relationships.size === 0 ? "" : `FAMILY GRAPH CONTEXT:\n${Array.from(relationships).join('\n')}`;
  return { graph, trace };
}

// --- AI CORE & ROSTER LOGIC ---

async function fetchUserRoster(uid: string) {
  try {
    const configDoc = await db.collection('users').doc(uid).collection('zen_config').doc('main').get();
    if (!configDoc.exists) return null;
    return configDoc.data();
  } catch (e) {
    console.error("[Roster] Failed to fetch config:", e);
    return null;
  }
}

async function callFireworksDirect(modelId: string, prompt: string, apiKey: string, persona: string) {
  const url = "https://api.fireworks.ai/inference/v1/chat/completions";
  const response = await axios.post(url, {
    model: modelId,
    messages: [
      { role: "system", content: persona },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 1024 // Shorter tokens for voice
  }, {
    headers: { "Authorization": `Bearer ${apiKey} `, "Content-Type": "application/json" },
    timeout: 7000
  });
  return response.data.choices[0]?.message?.content;
}

async function callXAIDirect(modelId: string, prompt: string, apiKey: string, persona: string) {
  const url = "https://api.x.ai/v1/chat/completions";
  const response = await axios.post(url, {
    model: modelId,
    messages: [
      { role: "system", content: persona },
      { role: "user", content: prompt }
    ],
    temperature: 0.7
  }, {
    headers: { "Authorization": `Bearer ${apiKey} `, "Content-Type": "application/json" },
    timeout: 7000
  });
  return response.data.choices[0]?.message?.content;
}

// [ZEN] Genkit History Normalizer
function normalizeHistory(history: any[]): any[] {
  if (!history || !Array.isArray(history)) return [];
  return history.map(m => ({
    role: m.role === 'model' ? 'assistant' : m.role,
    content: m.content || m.parts || []
  }));
}

export async function executeRosterRequest(uid: string, prompt: string, basePersona: string, preferredModel?: string, history?: any[]) {
  // 1. Fetch Roster & Keys (Including Typesense)
  const config = await fetchUserRoster(uid);
  if (!config) throw new Error("USER_CONFIG_MISSING");

  // 2. [RAG INJECTION] Fetch Memory
  const memoryContext = await searchMemory(uid, prompt, config);
  const fullPersona = `${basePersona} \n${memoryContext} `;

  // [ZEN] Model Normalizer: Map to Billed Vertex IDs
  const normalizeModel = (m: string) => {
    if (!m) return "gemini-3.1-flash-lite-preview"; 
    // [ZEN 2026] 3.1 is now verified on the 'global' Vertex endpoint
    if (m.includes("gemini-3.1")) return "gemini-3.1-flash-lite-preview";
    if (m.includes("1.5-flash")) return "gemini-1.5-flash-002";
    return m;
  };

  const geminiId = normalizeModel(preferredModel || config.modelGemini || DEFAULT_FALLBACK_MODEL);

  const roster = [
    { name: 'Primary (Fireworks)', id: config.modelFireworks, key: config.fireworksKey, provider: 'fireworks' },
    { name: 'Reserve', id: config.modelReserve, key: config.fireworksKey, provider: 'fireworks' },
    { name: 'xAI (Grok)', id: config.modelXAI, key: config.grokKey, provider: 'xai' },
    { name: 'Sovereign Gemini', id: geminiId, key: config.geminiKey, provider: 'google' }
  ];

  let lastError = null;

  for (const slot of roster) {
    if (!slot.id || slot.id.trim() === '') continue;

    try {
      console.log(`[Roster] Trying ${slot.name}: ${slot.id} `);
      let result = "";

      if (slot.provider === 'fireworks') {
        if (!slot.key) throw new Error("Key Missing: Fireworks");
        result = await callFireworksDirect(slot.id, prompt, slot.key, fullPersona);
      } else if (slot.provider === 'xai') {
        if (!slot.key) throw new Error("Key Missing: xAI");
        result = await callXAIDirect(slot.id, prompt, slot.key, fullPersona);
      } else if (slot.provider === 'google') {
        try {
          const llmResponse = await getAI().generate({
            model: `vertexai/${normalizeModel(slot.id)}`,
            system: fullPersona,
            prompt: history ? undefined : prompt,
            messages: normalizeHistory(history || []),
            config: { temperature: 0.7 },
          });
          result = llmResponse.text;
        } catch (vertexErr: any) {
          console.error(`[Sovereign Error] Vertex AI failed for ${slot.id}:`, vertexErr.message);
          throw vertexErr; // Do NOT drop to GoogleAI Studio (429/Prepay Trap)
        }
      }

      if (result) return result;
    } catch (e: any) {
      console.warn(`[Roster] Failed ${slot.name}: ${e.message} `);
      lastError = e;
    }
  }

  throw lastError || new Error("ROSTER_EXHAUSTED");
}

// [ZEN CONFIG] Updated Dec 27 2025 per Google Changelog
// https://ai.google.dev/gemini-api/docs/changelog
const DEFAULT_FALLBACK_MODEL = "gemini-3.1-flash-lite-preview";

async function getSystemFallbackModel() {
  return process.env.SYSTEM_MODEL_ID || DEFAULT_FALLBACK_MODEL;
}

async function generateGigiResponse(uid: string, message: string, history: any[] = [], persona?: string) {
  const defaultPersona = "You are Gigi, a friendly and helpful digital archivist companion. Document the user's story with empathy and accuracy.";
  // [ZEN SAFETY] Force AI to reject "Life OS" identity to prevent sci-fi hallucinations
  const antiHallucinationGuard = " IMPORTANT: You are NOT 'Life OS'. You are 'Gigi' (or 'Brita'). Do NOT use phrases like 'Emotional Resonance Calibration' or 'System Online'. Speak naturally and warmly.";
  const activePersona = (persona || defaultPersona) + antiHallucinationGuard;

  console.log(`[GenAI] Generating response for ${uid}...`);
  const startTime = Date.now();

  try {
    if (uid && uid !== "anonymous") {
      return await executeRosterRequest(uid, message, activePersona);
    }

    // 2. Fallback for Anonymous (Configurable via ENV)
    const fallbackModel = await getSystemFallbackModel();
    console.log(`[GenAI] Using Fallback Model: ${fallbackModel}`);

    const fullPrompt = `SYSTEM INSTRUCTION: ${activePersona} \n\nUSER MESSAGE: ${message} `;
    const llmResponse = await getAI().generate({
      model: fallbackModel,
      prompt: fullPrompt,
      messages: history,
      config: { temperature: 0.7 },
    });
    return llmResponse.text;

  } catch (error: any) {
    console.warn(`[GenAI] Generation Failed: ${error.message}`);

    // Ultimate Fallback
    const emergencyModel = "gemini-3.1-flash-lite-preview";
    const fullPrompt = `SYSTEM INSTRUCTION: ${activePersona} \n\nUSER MESSAGE: ${message} `;
    const llmResponse = await getAI().generate({
      model: emergencyModel,
      prompt: fullPrompt,
      config: { temperature: 0.7 },
    });
    return llmResponse.text;
  }
}

// Mobile/Web Chat Function
export const chatWithGigi = onCall({ cors: true }, async (request) => {
  const input = request.data as { history: any[]; message: string; persona: string };
  const uid = request.auth?.uid || "anonymous";
  try {
    const text = await generateGigiResponse(uid, input.message, input.history, input.persona);
    return { text };
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return { text: "System overload. Please try again." };
  }
});

/**
 * [ZEN] Sovereign AI Proxy (The "sovereignai" bridge)
 * Direct backend bridge for all neural operations.
 */
export const sovereignai = onRequest({ cors: true }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { prompt, persona, modelId, systemInstruction, history } = (req.body?.data || req.body) as any;
  const authHeader = req.headers.authorization;
  let uid = "anonymous";

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      uid = decodedToken.uid;
    } catch (e) { }
  }

  try {
    const activePersona = persona || systemInstruction || "You are a helpful digital archivist.";
    const targetModel = modelId || "gemini-3.1-flash-lite-preview";
    
    let responseText = "";
    if (uid !== "anonymous") {
      responseText = await executeRosterRequest(uid, prompt, activePersona, targetModel, history);
    } else {
      try {
        const llmResponse = await getAI().generate({
          model: `vertexai/${targetModel}`,
          system: activePersona,
          prompt: history ? undefined : prompt,
          messages: normalizeHistory(history || []),
          config: { temperature: 0.7 },
        });
        responseText = llmResponse.text;
      } catch (vertexErr: any) {
        console.error(`[Sovereign Error] Proxy Vertex AI failed:`, vertexErr.message);
        throw vertexErr; // Do NOT drop to GoogleAI Studio (429/Prepay Trap)
      }
    }

    console.log(`[SovereignAI] V-ZEN-RECOVERY-AIPROXY: Success for ${uid}`);
    res.json({ data: { text: responseText } });
  } catch (error: any) {
    res.status(500).json({ data: { error: error.message } });
  }
});

// Helper: Get Fresh Token
async function getFreshAccessToken(uid: string): Promise<string> {
  const doc = await db.collection('users').doc(uid).collection('secrets').doc('googlePhotos').get();
  if (!doc.exists || !doc.data()?.refreshToken) throw new Error("AUTH_REQUIRED");

  const refreshToken = doc.data()?.refreshToken;
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });
    return response.data.access_token;
  } catch (e: any) {
    const errorMsg = e.response?.data?.error || e.message;
    console.error(`[GoogleAuth] Token Refresh Failed for user ${uid}:`, errorMsg);
    // Specifically catch revoked/invalid tokens
    if (errorMsg === 'invalid_grant' || e.response?.status === 400 || e.response?.status === 401) {
      throw new Error("AUTH_REQUIRED");
    }
    throw e;
  }
}

// Account Linker
export const linkGooglePhotos = onRequest({ cors: true }, async (req, res) => {
  const { code, uid } = req.body;
  if (!code || !uid) { res.status(400).send("Missing code or uid"); return; }

  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      code: code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    const { refresh_token, access_token } = response.data;

    if (refresh_token) {
      await db.collection('users').doc(uid).collection('secrets').doc('googlePhotos').set({
        refreshToken: refresh_token,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    res.json({ success: true, token: access_token });

  } catch (error: any) {
    console.error("Link Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Linking Failed" });
  }
});
// [ZEN] Ingestion Engine: The Batch Redesign
// This handles the entire lifecycle of a Google Photos import session.

// [ZEN NEW] GIGI Ingestion Engine: Step 1 (The Handoff)
// Accepts a sessionId, creates a tracking job, and exits immediately.
export const ingestGooglePhotosSession = onRequest({ 
  cors: true, 
  timeoutSeconds: 60, 
  memory: "256MiB" 
}, async (req, res) => {
  const { sessionId, userId: rawUserId } = req.body;
  const userId = rawUserId?.trim();

  if (!sessionId || !userId) {
    res.status(400).json({ error: "Missing sessionId or userId" });
    return;
  }

  try {
    const accessToken = await getFreshAccessToken(userId);
    console.log(`[Ingestor] Initializing handoff for session: ${sessionId}`);

    // Create the Job Record - This triggers the background worker
    const jobRef = await db.collection('google_import_jobs').add({
      userId,
      sessionId,
      status: 'pending',
      totalItems: 0,
      processedItems: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, jobId: jobRef.id });

  } catch (error: any) {
    console.error("[Ingestor] Handoff Failure:", error.message);
    res.status(500).json({ error: "Failed to initialize ingestion", details: error.message });
  }
});

// [ZEN] Ingestion Engine: Handled via modular trigger export below.

// [ZEN NEW] The Slingshot: Streams directly from Google to Firebase Storage
export const sideloadGoogleMedia = onRequest({ cors: true, timeoutSeconds: 540, memory: "1GiB" }, async (req, res) => {
  const { url, uid: rawUid, fileName, mimeType, creationTime } = req.body;
  const uid = rawUid?.trim();

  if (!url || !uid || !fileName) {
    res.status(400).json({ error: "Missing required fields (url, uid, fileName)" });
    return;
  }

  try {
    const accessToken = await getFreshAccessToken(uid);
    console.log(`[Slingshot] Starting stream for ${fileName}...`);

    const bucket = storage.bucket();
    // [ZEN HARDENING] Strip ALL whitespace from path components before construction.
    // This is the nuclear option: even if uid or fileName arrive with unicode spaces,
    // non-breaking spaces, or deployment artifacts from the old template, the path will be clean.
    const safeUid = uid.replace(/\s+/g, '');
    const safeFileName = (fileName as string).replace(/\s+/g, '_');
    const destinationPath = `users/${safeUid}/uploads/${safeFileName}`;
    console.log(`[Slingshot] Safe destination path: ${destinationPath}`);
    const storageFile = bucket.file(destinationPath);

    // [ZEN] Generate a Firebase Storage download token.
    // This embeds auth directly in the URL — no IAM signing permission needed,
    // works with Public Access Prevention, and never expires.
    const downloadToken = crypto.randomUUID();
    const bucketName = bucket.name;
    const encodedPath = encodeURIComponent(destinationPath);
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    // 1. Request the stream from Google
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    // 2. Setup Hashing (The Sentinel)
    const hash = crypto.createHash('sha256');

    // 3. Pipe the stream directly to Firebase Storage AND the hasher
    // Embed the download token in the file metadata so Firebase Storage honors it.
    const writeStream = storageFile.createWriteStream({
      metadata: {
        contentType: mimeType || 'application/octet-stream',
        metadata: {
          originalCreationTime: creationTime ? String(creationTime) : new Date().toISOString(),
          source: 'google-photos-sideload',
          firebaseStorageDownloadTokens: downloadToken
        }
      }
    });

    await new Promise((resolve, reject) => {
      response.data.on('data', (chunk: any) => hash.update(chunk));
      response.data.pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    const contentHash = hash.digest('hex');
    console.log(`[Slingshot] Generated Hash: ${contentHash}`);

    // 4. Check for existing duplicates
    const duplicateQuery = await db.collection(`users/${uid}/media`)
      .where('contentHash', '==', contentHash)
      .limit(1)
      .get();

    if (!duplicateQuery.empty) {
      // [ZEN FIX] Duplicate found in media collection — but the existing file may be at a
      // corrupted path (spaces in url from old CF). Instead of deleting our new clean upload
      // and returning the old bad URL, we KEEP the new upload and return its token URL.
      // This permanently replaces the corrupted copy with a clean-path, token-authenticated one.
      console.warn(`[Slingshot] Duplicate detected — keeping new clean upload, returning token URL.`);
      console.log(`[Slingshot] Token download URL: ${downloadUrl}`);
      res.json({
        success: true,
        url: downloadUrl,
        path: destinationPath,
        isDuplicate: true,
        duplicateOf: duplicateQuery.docs[0].id,
        contentHash
      });
      return;
    }

    // 5. Success — return the token download URL constructed before upload.
    // No signing permission needed; token is embedded in file metadata.
    console.log(`[Slingshot] Success. Token URL: ${downloadUrl}`);
    res.json({ success: true, url: downloadUrl, path: destinationPath, contentHash, isDuplicate: false });

  } catch (error: any) {
    console.error("[Slingshot] Failed:", error);
    res.status(500).json({ error: "Sideload failed", details: error.message });
  }
});

// Legacy Proxy (Kept for small image previews if needed)
export const proxyGooglePhoto = onRequest({ cors: true }, async (req, res) => {
  const { baseUrl, url, endpoint, uid, method = 'GET', body } = req.body;

  try {
    const accessToken = await getFreshAccessToken(uid);

    // MODE A: API Proxy (JSON)
    if (endpoint) {
      const config: any = {
        url: endpoint,
        method: method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };
      if (method !== 'GET') config.data = body || {};

      const apiResponse = await axios(config);
      res.json(apiResponse.data);
      return;
    }

    // MODE B: Download Proxy (Buffer)
    const targetUrl = url || (baseUrl ? `${baseUrl}=d` : null);

    if (targetUrl) {
      const imageResponse = await axios({
        method: "get",
        url: targetUrl,
        responseType: "arraybuffer",
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (imageResponse.headers["content-type"]) {
        res.set("Content-Type", String(imageResponse.headers["content-type"]));
      }
      if (imageResponse.headers["content-length"]) {
        res.set("Content-Length", String(imageResponse.headers["content-length"]));
      }

      res.status(200).send(imageResponse.data);
      return;
    }

    res.status(400).send("Invalid Request");

  } catch (error: any) {
    // [ZEN] Explicit Auth Handling
    if (error.message === "AUTH_REQUIRED" || error.response?.status === 401) {
      console.warn(`[Proxy] Auth required for UID: ${uid}`);
      res.status(401).json({ error: "AUTH_REQUIRED", details: error.message });
      return;
    }
    
    console.error("[Proxy] Critical Error:", error.response?.data || error.message);
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ 
      error: "Proxy Failed", 
      details: error.message,
      code: statusCode 
    });
  }
});

// [ZEN] Alexa Skill Implementation
import { SkillBuilders, ErrorHandler, HandlerInput, RequestHandler, getSlotValue } from 'ask-sdk-core';
import { Response, SessionEndedRequest, LaunchRequest, IntentRequest } from 'ask-sdk-model';
const verifierPath = require('alexa-verifier');


const GigiChatIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'GigiChatIntent';
  },
  async handle(handlerInput: HandlerInput): Promise<Response> {
    const { requestEnvelope, attributesManager } = handlerInput;
    const userPrompt = getSlotValue(requestEnvelope, 'query');
    const accessToken = requestEnvelope.context.System.user.accessToken;
    const sessionAttributes = attributesManager.getSessionAttributes();

    console.log(`[Alexa] Chat Intent: "${userPrompt}"`);

    if (!userPrompt) {
      return handlerInput.responseBuilder
        .speak("I'm sorry, I didn't catch that. Could you repeat it?")
        .reprompt("What would you like to say?")
        .withShouldEndSession(false)
        .getResponse();
    }

    try {
      // 1. Resolve Identity and Persona
      let uid = "anonymous";
      let voicePersona = "You are Gigi, a friendly and helpful digital life archivist companion. Keep responses concise for voice.";
      let selectedVoice = "Joanna"; // Default to best US Neural Conversational

      if (accessToken) {
        try {
          const decoded = jwt.verify(accessToken, JWT_SECRET) as { uid: string };
          uid = decoded.uid;

          const userDoc = await db.collection('users').doc(uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            const primaryCompanion = userData?.aiCompanions?.find((c: any) => c.isPrimary) || userData?.aiCompanions?.[0];
            if (primaryCompanion) {
              voicePersona = `You are ${primaryCompanion.name}. ${primaryCompanion.persona}. ${primaryCompanion.customPersonaDescription || ''} Respond and stay in character.`;

              // Check for custom voice override
              if (primaryCompanion.voiceSettings?.alexaVoiceName) {
                // selectedVoice = primaryCompanion.voiceSettings.alexaVoiceName; 
                // SAFETY OVERRIDE: Force Joanna until we validate list
                selectedVoice = "Joanna";
              }

              console.log(`[Alexa] Using Persona: ${primaryCompanion.name}, Voice: ${selectedVoice}`);
            }
          }
        } catch (e: any) {
          console.warn("[Alexa] Token/Persona Resolve Failed:", e);
          return handlerInput.responseBuilder
            .speak("I am having trouble verifying your account security token. Please try relinking your account in the Alexa app.")
            .withShouldEndSession(true)
            .getResponse();
        }
      }

      // 2. [ZEN] SYNC WRITE 1: User Message (Establish Order)
      if (uid !== "anonymous") {
        await db.collection('users').doc(uid).collection('chat_segments').add({
          role: 'user',
          content: userPrompt,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          source: 'alexa'
        });
      }

      // 3. Generate AI Response (NOW WITH RAG!)
      console.log(`[Alexa] Generating response for ${uid}...`);
      const speakOutput = await generateGigiResponse(uid, userPrompt, [], voicePersona);

      // 4. [ZEN] SYNC WRITE 2: Model Message (Guarantees it appears AFTER user)
      if (uid !== "anonymous") {
        await db.collection('users').doc(uid).collection('chat_segments').add({
          role: 'model',
          content: sanitizeForUI(speakOutput),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          source: 'alexa'
        });
      }

      console.log(`[Alexa] Success. Speak: "${speakOutput.substring(0, 50)}..."`);

      // Update last interaction time for Smart Greetings
      if (uid !== "anonymous") {
        db.collection('users').doc(uid).set({ last_alexa_interaction: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => { });
      }

      const repromptText = "I'm still listening. Anything else on your mind?";
      const finalReprompt = wrapInSSML(repromptText, selectedVoice);

      return handlerInput.responseBuilder
        .speak(wrapInSSML(speakOutput, selectedVoice))
        .reprompt(finalReprompt)
        .withShouldEndSession(false)
        .getResponse();

    } catch (error: any) {
      console.error("[Alexa] Execution Error:", error);
      return handlerInput.responseBuilder
        .speak("I'm having a little trouble with my neural core. Could you try asking that again?")
        .reprompt("I'm still here if you want to try again.")
        .withShouldEndSession(false)
        .getResponse();
    }
  },
};

const FallbackIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput: HandlerInput): Response {
    console.log("[Alexa] Fallback Triggered.");
    const speakOutput = 'I am sorry, I did not catch that. Could you try saying it a different way? I am still listening.';
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt('What was that you wanted to discuss?')
      .withShouldEndSession(false)
      .getResponse();
  },
};

const HelpIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput: HandlerInput): Response {
    const speakOutput = 'You can talk to GIGI about your day, ask her to remember things, or look up your history. What would you like to do?';
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .withShouldEndSession(false)
      .getResponse();
  },
};

const CancelAndStopIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput: HandlerInput): Response {
    const speakOutput = 'Goodbye for now. I will be here when you need me.';
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .withShouldEndSession(true)
      .getResponse();
  },
};

const SessionEndedRequestHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput: HandlerInput): Response {
    const request = handlerInput.requestEnvelope.request as SessionEndedRequest;
    console.log(`[Alexa] Session Ended. Reason: ${request.reason}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const AlexaErrorHandler: ErrorHandler = {
  canHandle(): boolean { return true; },
  handle(handlerInput: HandlerInput, error: Error): Response {
    console.log(`[Alexa] Global Error: ${error.message}`);
    return handlerInput.responseBuilder
      .speak('I encountered an error. Please try again in a moment.')
      .reprompt('Are you still there?')
      .withShouldEndSession(false)
      .getResponse();
  },
};

const skillBuilder = SkillBuilders.custom();

// 5. Alexa Skill Entry Point
const alexaGigiChat = onRequest({ cors: true }, async (req: any, res: any) => {
  console.log(">>> Alexa Invocation Request received.");

  const skill = skillBuilder
    .addRequestHandlers(
      LaunchRequestHandler,
      GigiChatIntentHandler,
      FallbackIntentHandler,
      HelpIntentHandler,
      CancelAndStopIntentHandler,
      SessionEndedRequestHandler
    )
    .addErrorHandlers(AlexaErrorHandler)
    .create();

  try {
    const responseEnvelope = await skill.invoke(req.body);
    res.json(responseEnvelope);
  } catch (error) {
    console.error("[Alexa] Skill Invoke Error:", error);
    res.status(500).send("Internal Skill Error");
  }
});

export { enrichChatSegment } from "./triggers/enrichmentTrigger";
// export { syncToTypesense } removed from "./triggers/syncTrigger";
// export { onShoeboxUpload } removed
// export { onImportJobCreated } removed
// [ZEN] onMediaWritten trigger removed — was corrupting Tag mediaGallery arrays.
// Needs careful redesign with read-verify-before-write logic before redeployment.
export { alexaGigiChat };
export { onSovereignReflectionTrigger } from "./triggers/reflectionTrigger";
export { serveBiodata } from "./serveBiodata";
export { processMediaMagic } from "./mediaRestoration";
export { generateB2UploadUrl, proxyUploadToB2 } from "./b2Storage";

// --- [ZEN] EMAIL-AS-CHAT ENGINE ---
import { initEmailChat as _initEmailChat, checkBritaInbox as _checkBritaInbox, startNewEmailThread } from "./emailChat";
export const initEmailChat = _initEmailChat;
export const checkBritaInbox = _checkBritaInbox;
export { processSovereignWebhook } from "./emailChat";
export { processQueuedEmail } from "./triggers/emailInboxTrigger";

// --- [ZEN] EMAIL NOTIFIER ---
import { sendEmail } from "./notifier";

// On-demand: callable from the front-end, Alexa, or any internal trigger.
// Usage: functions.httpsCallable('sendEmailNotification')({ to, subject, text, html })
export const sendEmailNotification = onCall({ cors: true }, async (request) => {
  const { to, subject, text, html } = request.data as {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  };

  if (!to || !subject) {
    throw new Error("Missing required fields: 'to' and 'subject'");
  }

  try {
    const info = await sendEmail({ to, subject, text, html });
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[ZEN NOTIFIER] Send Failed:", error.message);
    throw new Error(`Email send failed: ${error.message}`);
  }
});

// Scheduled Digest (UNCOMMENT when ready — pick your cadence):
// import { onSchedule } from "firebase-functions/v2/scheduler";
// export const dailyDigest = onSchedule("every day 08:00", async () => {
//   await sendEmail({
//     to: "dysus2024@gmail.com",
//     subject: "🌅 Zen Daily Digest",
//     html: "<h2>Good morning, Eric.</h2><p>Here's your daily summary from Project GIGI...</p>"
//   });
// });

// [ZEN DEBUG] Typesense Integrity Check
export const debugTypesenseState = onRequest({ cors: true, invoker: "public" }, async (req: any, res: any) => {
  const uid = "9MPVGVTxE8dXvkCrl1XrWHQzCl23"; // Hardcoded for Eric

  // 1. Fetch Config
  const configDoc = await admin.firestore().collection('users').doc(uid).collection('zen_config').doc('main').get();
  const config = configDoc.data();

  if (!config || !config.typesenseKey) {
    res.status(500).send("No Config Found");
    return;
  }

  const client = new Client({
    nodes: [{ host: config.typesenseHost, port: 443, protocol: 'https' }],
    apiKey: config.typesenseKey,
    connectionTimeoutSeconds: 5
  });

  try {
    const stats = await client.collections('chat_memory_v2_robust').retrieve();

    // HUNT FOR THE GHOST
    const ghostId = "msg-1766514997963";
    let ghostStatus = "Missing";
    try {
      const ghost = await client.collections('chat_memory_v2_robust').documents(ghostId).retrieve() as any;
      ghostStatus = "FOUND: " + (ghost.title || "Untitled");
    } catch (e) { ghostStatus = "NOT FOUND (404)"; }

    const search = await client.collections('chat_memory_v2_robust').documents().search({
      q: '*',
      filter_by: `user_id:=${uid}`,
      per_page: 0
    });

    res.json({
      collection_stats: stats,
      user_record_count: search.found,
      ghost_hunt: ghostStatus, // <--- The Smoking Gun
      status: "Online"
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// [ZEN DEBUG] Brain Integrity Check (What does the AI actually SEE?)
export const debugBrain = onRequest({ cors: true, invoker: "public" }, async (req: any, res: any) => {
  console.log("[Verifying Deployment] Genkit V9 Active - Timestamp " + Date.now());
  console.log("[debugBrain] Query Params:", JSON.stringify(req.query));
  const uid = "9MPVGVTxE8dXvkCrl1XrWHQzCl23"; // Eric's ID

  // [ZEN] Manual Email Trigger (Force Brita to write to Eric)
  if (req.query.trigger_email === 'true') {
    try {
      const result = await startNewEmailThread(uid);
      res.json({ status: "Email Triggered", result });
      return;
    } catch (e: any) {
      res.status(500).json({ error: e.message });
      return;
    }
  }

  const testQuery = req.query.q || "What about Lizzie?";

  try {
    const log: any[] = [];

    // [ZEN] Nuke Logic - Force clear stuck queue from Cloud
    if (req.query.mode === 'nuke') {
      log.push("☢️ NUKE SEQUENCE INITIATED");
      const nukeSnap = await db.collection('users').doc(uid).collection('inbox_queue').get();
      for (const doc of nukeSnap.docs) {
        await doc.ref.delete();
      }
      log.push(`Vaporized ${nukeSnap.size} stuck items.`);
    }

    // 1. Fetch Config
    log.push("Fetching Config...");
    const config = await fetchUserRoster(uid);

    // 2. Fetch Tags
    log.push("Fetching Tags...");
    const tags = await fetchUserTags(uid);
    log.push(`Found ${tags.length} tags.`);

    // 3. Build Family Graph
    log.push("Building Graph...");
    const { graph, trace } = buildFamilyGraphContext(tags);

    // 4. RAG
    log.push(`Searching RAG for "${testQuery}"...`);
    const rag = await searchMemory(uid, testQuery as string, config);

    // 5. Fetch Persona (Real Check)
    log.push("Fetching Persona...");
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    const primaryCompanion = userData?.aiCompanions?.find((c: any) => c.isPrimary) || userData?.aiCompanions?.[0];
    const realPersona = primaryCompanion ? primaryCompanion.persona : "DEFAULT GIGI";

    // 6. Construct Prompts
    const systemPrompt = `${realPersona}\n\n${graph}`;

    // 7. Fetch Recent Segments (Simple query, filter in-memory to avoid index error)
    const allSegments = await db.collection('users').doc(uid).collection('chat_segments')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const emailHistory = allSegments.docs
      .filter((d: any) => d.data().source === 'email')
      .slice(0, 5)
      .map((d: any) => ({
        id: d.id,
        role: d.data().role,
        content: d.data().content,
        timestamp: d.data().timestamp?.toMillis()
      }));

    // [ZEN] Queue Audit
    log.push("Auditing Inbox Queue...");
    const queueSnap = await db.collection('users').doc(uid).collection('inbox_queue')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    const queueItems = queueSnap.docs.map((d: any) => ({
      id: d.id,
      status: d.data().status,
      subject: d.data().subject,
      error: d.data().error,
      timestamp: d.data().timestamp?.toMillis()
    }));

    // [ZEN] Webhook Flight Recorder Audit
    log.push("Auditing Debug Logs...");
    const debugSnap = await db.collection('debug_logs')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    const debugItems = debugSnap.docs.map((d: any) => ({
      id: d.id,
      source: d.data().source,
      action: d.data().action,
      error: d.data().error,
      timestamp: d.data().timestamp?.toMillis()
    }));

    res.json({
      status: "Complete (V-ZEN-RECOVERY)",
      steps: log,
      brain_dump: {
        family_graph: graph,
        rag_context: rag,
        final_system_prompt_preview: systemPrompt,
        logic_audit: trace,
        email_history: emailHistory,
        inbox_queue: queueItems,
        debug_logs: debugItems
      }
    });

  } catch (e: any) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// [ZEN] 3D Mesh Generation Proxy (Replicate)
// This proxy protects the API key from frontend leakage and handles the 30-45s polling loop.
export const proxyReplicateMesh = onCall({ cors: true, timeoutSeconds: 300, memory: "1GiB" }, async (request) => {
  const { imageBase64, replicateKey, modelId = "tencent/hunyuan3d-2" } = request.data as any;
  const uid = request.auth?.uid;

  if (!uid) throw new Error("Unauthorized");
  if (!imageBase64 || !replicateKey) throw new Error("Missing image or API key");

  console.log(`[ReplicateProxy] Starting 3D generation for ${uid} using ${modelId}...`);

  try {
    // Replicate requires version hashes instead of friendly slugs for some advanced models to avoid 404s.
    const versionHash = modelId === "tencent/hunyuan3d-2" 
        ? "b1b9449a1277e10402781c5d41eb30c0a0683504fb23fab591ca9dfc2aabe1cb"
        : modelId === "firtoz/trellis"
        ? "e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c"
        : undefined;

    // 1. Kick off the prediction
    const url = versionHash 
        ? `https://api.replicate.com/v1/predictions` 
        : `https://api.replicate.com/v1/models/${modelId}/predictions`;
    
    let inputPayload: any = { image: imageBase64 };
    if (modelId === "firtoz/trellis") {
      inputPayload = {
        images: [imageBase64],
        generate_model: true,
        generate_color: true,
        texture_size: 1024,
        mesh_simplify: 0.95
      };
    }

    const payload = versionHash 
        ? { version: versionHash, input: inputPayload }
        : { input: inputPayload };

    const startResponse = await axios.post(
      url,
      payload,
      { headers: { "Authorization": `Bearer ${replicateKey}`, "Content-Type": "application/json" } }
    );

    let prediction = startResponse.data;
    const pollUrl = prediction.urls.get;
    console.log(`[ReplicateProxy] Prediction started: ${prediction.id}`);

    // 2. Poll for completion (up to 4 minutes max)
    const maxRetries = 120; // 120 * 2s = 240s
    let retries = 0;

    while (prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled" && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
      
      const pollResponse = await axios.get(pollUrl, {
        headers: { "Authorization": `Bearer ${replicateKey}` }
      });
      prediction = pollResponse.data;
      retries++;
      
      if (retries % 5 === 0) console.log(`[ReplicateProxy] Polling ${prediction.id}... Status: ${prediction.status}`);
    }

    if (prediction.status === "succeeded") {
      console.log(`[ReplicateProxy] Success! output:`, prediction.output);
      // output could be a string URL, or an array/object depending on model.
      return { status: "success", output: prediction.output };
    } else {
      console.error(`[ReplicateProxy] Failed with status: ${prediction.status}`, prediction.error);
      throw new Error(`Generation failed: ${prediction.error || prediction.status}`);
    }
  } catch (error: any) {
    console.error("[ReplicateProxy] Error:", error?.response?.data || error.message);
    throw new Error(error?.response?.data?.detail || error.message);
  }
});

// ======================================================
// 🛡️ SOVEREIGN DATABASE PROXY (V-ZEN-MIGRATION-CORE)
// ======================================================

export const sovereignDbQuery = onCall({ cors: true, memory: "256MiB" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Auth required.");
  }

  const { collectionName, userId, docId, where, options } = request.data as {
    collectionName: string;
    userId?: string;
    docId?: string;
    where?: Record<string, any>;
    options?: { limit?: number; sort?: any; orderBy?: [string, string] };
  };

  if (!collectionName) {
    throw new HttpsError("invalid-argument", "collectionName is required.");
  }

  try {
    const { localDb, cloudDb } = await getDbClients();
    
    // Belt and Suspenders: Prefer Local for 0-latency reads, fallback to Cloud
    const targetDb = localDb || cloudDb;
    if (!targetDb) throw new Error("No active database available for read.");
    
    const collection = targetDb.collection(collectionName);

    // Case 1: Fetch single document by ID
    if (docId) {
      // 1. Try exact match (e.g. root collections like 'users')
      let doc = await collection.findOne({ _id: docId as any });
      
      // 2. Try composite key match (e.g. subcollections)
      if (!doc && userId) {
        const compositeId = `${userId}_${docId}`;
        doc = await collection.findOne({ _id: compositeId as any });
      }

      if (doc) {
        const cleanDoc = { ...doc } as any;
        if (cleanDoc._id) {
          cleanDoc.id = cleanDoc.id || docId;
          delete cleanDoc._id;
        }
        return { data: cleanDoc };
      }
      return { data: null };
    }

    // Case 2: Query multiple documents
    const query: Record<string, any> = {};
    if (userId) {
      query.userId = userId;
    }
    if (where && typeof where === 'object') {
      Object.assign(query, where);
    }

    let cursor = collection.find(query);
    if (options?.orderBy) {
      const [field, direction] = options.orderBy;
      cursor = cursor.sort({ [field]: direction === 'desc' ? -1 : 1 });
    } else if (collectionName === 'pending_accessions') {
      // [ZEN] Default: always surface newest accessions first. Without this,
      // items inserted at position 2363+ are permanently invisible behind limit(200).
      cursor = cursor.sort({ logicalDate: -1 });
    }
    if (options?.limit) {
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

    return { data: formattedDocs };

  } catch (error: any) {
    console.error(`[SovereignDB] Query error for ${collectionName}:`, error);
    throw new HttpsError("internal", `Query failed: ${error.message}`);
  }
});

export { forceRebakeOrientation } from './mediaOrientation';

export const sovereignDbWrite = onCall({ cors: true, memory: "256MiB" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Auth required.");
  }

  const { collectionName, userId, docId, operation, data, options } = request.data as {
    collectionName: string;
    userId: string;
    docId?: string;
    operation: 'set' | 'delete' | 'add' | 'bulkUpdate' | 'bulkWrite';
    data?: any;
    options?: { merge?: boolean };
  };

  if (!collectionName || !userId || !operation) {
    throw new HttpsError("invalid-argument", "Missing required transaction arguments.");
  }

  try {
    const { localDb, cloudDb } = await getDbClients();
    
    // Execute a write operation on a specific database instance
    const executeOnDb = async (mongoDb: any) => {
      if (!mongoDb) return null;
      const collection = mongoDb.collection(collectionName);
      const isSubcollection = collectionName !== 'users' && collectionName !== 'public_slugs';
      
      if (operation === 'set') {
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

        if (options?.merge) {
          await collection.updateOne({ _id: keyId as any }, { $set: payload }, { upsert: true });
        } else {
          await collection.replaceOne({ _id: keyId as any }, { _id: keyId, ...payload }, { upsert: true });
        }
        return { success: true, id: docId };
      }

      if (operation === 'add') {
        // ID generation happens OUTSIDE this helper so both DBs get the EXACT SAME ID
        const keyId = isSubcollection ? `${userId}_${data._generatedId}` : data._generatedId;
        const cleanData = { ...data };
        delete cleanData.id;
        delete cleanData._id;
        delete cleanData._generatedId;

        const payload = {
          _id: keyId,
          id: data._generatedId,
          ...(isSubcollection ? { userId } : {}),
          ...cleanData,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await collection.insertOne(payload);
        return { success: true, id: data._generatedId };
      }

      if (operation === 'delete') {
        const keyId = isSubcollection ? `${userId}_${docId}` : docId;
        
        let filter: any = { _id: keyId as any };
        const DUAL_SCHEME_COLLECTIONS = ['pending_accessions', 'media', 'events', 'tags', 'gigiJournal', 'communication_archives'];
        
        if (docId) {
          const orConditions: any[] = [{ _id: keyId as any }];
          // Support for MongoDB native ObjectIds
          if (typeof docId === 'string' && docId.length === 24 && /^[0-9a-fA-F]{24}$/.test(docId)) {
            try {
              const { ObjectId } = require('mongodb');
              orConditions.push({ _id: new ObjectId(docId) });
            } catch (e) {}
          }
          // Support for Clerk migration (where _id has legacyUid but inner field has new userId)
          if (userId) {
            orConditions.push({ id: docId, userId: userId });
          } else {
            orConditions.push({ id: docId });
          }
          filter = { $or: orConditions };
        }
        
        const originalDoc = await collection.findOne(filter);
        
        if (originalDoc) {
            // [ZEN] Defensive ledger tombstone logging before absolute hard-delete
            try {
                const ledgerCollection = mongoDb.collection('ledger');
                const sha256 = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
                const contentStr = JSON.stringify(originalDoc);
                
                const ledgerEntry = {
                  _id: `ledger_${crypto.randomUUID()}`,
                  originalId: String(originalDoc._id),
                  originalCollection: collectionName,
                  checksum: sha256(contentStr),
                  deletedAt: new Date(),
                  operator: "System - sovereignDbWrite",
                  backupText: contentStr.substring(0, 1000),
                  originalDoc: originalDoc
                };
                await ledgerCollection.insertOne(ledgerEntry);
            } catch (ledgerErr) {
                console.error("[SovereignDB] Ledger tombstone failed:", ledgerErr);
            }
            
            await collection.deleteOne({ _id: originalDoc._id });
        } else {
            // Fallback
            await collection.deleteOne({ _id: keyId as any });
        }
        
        return { success: true };
      }

      if (operation === 'bulkUpdate') {
        const { ids, updateFields } = data as { ids: string[]; updateFields: Record<string, any> };
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
        return { success: true };
      }

      if (operation === 'bulkWrite') {
        const { operations } = data as { operations: any[] };
        const bulkOps = operations.map(op => {
          const keyId = isSubcollection ? `${userId}_${op.id}` : op.id;
          if (op.type === 'delete') {
            return {
              deleteOne: {
                filter: { _id: keyId as any }
              }
            };
          } else if (op.type === 'set' || op.type === 'update') {
            const cleanData = { ...op.data };
            delete cleanData.id;
            delete cleanData._id;
            const payload = {
              id: op.id,
              ...(isSubcollection ? { userId } : {}),
              ...cleanData,
              updatedAt: new Date()
            };
            if (op.merge) {
              return {
                updateOne: {
                  filter: { _id: keyId as any },
                  update: { $set: payload },
                  upsert: true
                }
              };
            } else {
              return {
                replaceOne: {
                  filter: { _id: keyId as any },
                  replacement: { _id: keyId as any, ...payload },
                  upsert: true
                }
              };
            }
          }
          return null;
        }).filter(Boolean);
        
        if (bulkOps.length > 0) {
          await collection.bulkWrite(bulkOps as any[]);
        }
        return { success: true };
      }
      return null;
    };

    // Pre-generate UUID for "add" so both databases receive identical records
    if (operation === 'add') {
      data._generatedId = crypto.randomUUID();
    }

    // [ZEN] MASTER CONTROL GUARDIAN: Anti-Spam / Anti-Duplication Lock for Tags
    if (collectionName === 'tags' && (operation === 'set' || operation === 'add') && data?.name) {
      const targetDb = localDb || cloudDb;
      if (targetDb) {
        const activeId = docId || data._generatedId;
        // Escape regex characters in the incoming name
        const escapedName = data.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const duplicateCheck = await targetDb.collection('tags').findOne({
          userId: userId,
          name: new RegExp(`^${escapedName}$`, 'i'),
          id: { $ne: activeId }
        });

        if (duplicateCheck) {
          console.error(`[GUARDIAN LOG] Blocked duplicate tag creation for name: "${data.name}". Existing ID: ${duplicateCheck.id}`);
          throw new HttpsError("already-exists", `GUARDIAN PROTOCOL: A Tag with the name "${data.name}" already exists in the Sovereign Database (ID: ${duplicateCheck.id}). Duplication is strictly prohibited.`);
        }
      }
    }

    // 🔥 DUAL-WRITE EXECUTION (Parallel)
    const [localResult, cloudResult] = await Promise.allSettled([
      executeOnDb(localDb),
      executeOnDb(cloudDb)
    ]);

    // Log failures silently so UI doesn't crash if one network path fails
    if (localResult.status === 'rejected') {
      console.error(`[DualWrite] LOCAL Failed:`, localResult.reason);
    }
    
    if (cloudResult.status === 'rejected') {
      console.error(`[DualWrite] CLOUD Failed:`, cloudResult.reason);
      
      // 🛡️ DEAD LETTER QUEUE (DLQ)
      // If the cloud fails, write the payload to the local DB queue for eventual consistency
      if (localDb && localResult.status === 'fulfilled') {
        try {
          const dlqCollection = localDb.collection('_cloud_sync_queue');
          await dlqCollection.insertOne({
            _id: crypto.randomUUID() as any,
            collectionName,
            userId,
            docId: data?._generatedId || docId || null,
            operation,
            payload: data,
            options: options || null,
            enqueuedAt: new Date().getTime(),
            status: 'pending',
            errorReason: String(cloudResult.reason)
          });
          console.log(`[DLQ] Operation enqueued safely for eventual sync to Atlas.`);
        } catch (dlqError) {
          console.error(`[DLQ] CRITICAL: Failed to write to Dead Letter Queue:`, dlqError);
        }
      }
    }

    // As long as ONE database succeeded, we consider it a success
    if (localResult.status === 'rejected' && cloudResult.status === 'rejected') {
      throw new Error("Both local and cloud dual-write targets failed.");
    }

    return localResult.status === 'fulfilled' && localResult.value 
           ? localResult.value 
           : (cloudResult as any).value;

  } catch (error: any) {
    console.error(`[SovereignDB] Write error for ${collectionName}:`, error);
    throw new HttpsError("internal", `Write failed: ${error.message}`);
  }
});

