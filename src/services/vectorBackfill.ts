/**
 * Vector Backfill Utility
 * Full-spectrum embedding generation for all Firestore collections
 * Uses Voyage AI with rate limiting and robust error handling
 * 
 * @author ZEN EWO #130
 */

import { collection, getDocs, doc, updateDoc, query, where, writeBatch, getDoc } from './sovereignDbAdapter';
import { db } from './sovereignCore';
import { getVoyageKey } from './ai/config';
import { typesenseService } from './typesenseService'; // [ZEN FIX] Import for emergency sync

// ============================================================================
// TYPES
// ============================================================================

interface BackfillRecord {
    id: string;
    collectionPath: string;
    text: string;
    type: 'chat' | 'tag' | 'event' | 'media';
    originalData?: any;
}

interface BackfillStats {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
    startTime: number;
    byType: {
        chat: number;
        tag: number;
        event: number;
        media: number;
    };
}

interface BackfillOptions {
    batchSize?: number;
    cooldownMs?: number;
    dryRun?: boolean;
    collections?: ('chat_segments' | 'tags' | 'events' | 'media')[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_COOLDOWN_MS = 500;
const PULSE_INTERVAL = 500; // Report every N records
const MAX_RETRIES = 3;
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3';

// ============================================================================
// SCANNER: Query Firestore for missing embeddings
// ============================================================================

async function scanChatSegments(userId: string): Promise<BackfillRecord[]> {
    const records: BackfillRecord[] = [];
    const collPath = `users/${userId}/chat_segments`;

    try {
        const snapshot = await getDocs(collection(db, 'users', userId, 'chat_segments'));

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();

            // Skip if already has embedding or no content
            if (data.embedding || !data.content || data.content.length < 3) continue;
            // Skip system messages
            if (data.role === 'system') continue;

            records.push({
                id: docSnap.id,
                collectionPath: collPath,
                text: data.content,
                type: 'chat',
                originalData: data
            });
        }

        console.log(`[Scanner] chat_segments: Found ${records.length} records missing embeddings`);
    } catch (error) {
        console.error('[Scanner] Failed to scan chat_segments:', error);
    }

    return records;
}

async function scanTags(userId: string): Promise<BackfillRecord[]> {
    const records: BackfillRecord[] = [];
    const collPath = `users/${userId}/tags`;

    try {
        const snapshot = await getDocs(collection(db, 'users', userId, 'tags'));

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();

            // Skip if already has embedding
            if (data.embedding) continue;

            // Only process "Capital T" tags: Person, Pet, Place, Thing, Event
            const validTypes = ['person', 'pet', 'place', 'thing', 'event'];
            if (!validTypes.includes(data.type)) continue;

            // Build embeddable text from tag data
            const text = buildTagText(data);
            if (!text || text.length < 3) continue;

            records.push({
                id: docSnap.id,
                collectionPath: collPath,
                text,
                type: 'tag',
                originalData: data
            });
        }

        console.log(`[Scanner] tags: Found ${records.length} records missing embeddings`);
    } catch (error) {
        console.error('[Scanner] Failed to scan tags:', error);
    }

    return records;
}

async function scanEvents(userId: string): Promise<BackfillRecord[]> {
    const records: BackfillRecord[] = [];
    const collPath = `users/${userId}/events`;

    try {
        const snapshot = await getDocs(collection(db, 'users', userId, 'events'));

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();

            // Skip if already has embedding
            if (data.embedding) continue;

            // Build embeddable text from event data
            const text = buildEventText(data);
            if (!text || text.length < 3) continue;

            records.push({
                id: docSnap.id,
                collectionPath: collPath,
                text,
                type: 'event',
                originalData: data
            });
        }

        console.log(`[Scanner] events: Found ${records.length} records missing embeddings`);
    } catch (error) {
        console.error('[Scanner] Failed to scan events:', error);
    }

    return records;
}

async function scanMedia(userId: string): Promise<BackfillRecord[]> {
    const records: BackfillRecord[] = [];
    const collPath = `users/${userId}/media`;

    try {
        const snapshot = await getDocs(collection(db, 'users', userId, 'media'));

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();

            // Skip if already has embedding
            if (data.embedding) continue;

            // Build embeddable text from media metadata
            const text = buildMediaText(data);
            if (!text || text.length < 3) continue;

            records.push({
                id: docSnap.id,
                collectionPath: collPath,
                text,
                type: 'media',
                originalData: data
            });
        }

        console.log(`[Scanner] media: Found ${records.length} records missing embeddings`);
    } catch (error) {
        console.error('[Scanner] Failed to scan media:', error);
    }

    return records;
}

/**
 * [ZEN EWO 004] Scan for AI-enriched media that needs re-vectorization
 * Targets documents with aiEnriched: true but outdated/missing embedding
 */
async function scanEnrichedMedia(userId: string): Promise<BackfillRecord[]> {
    const records: BackfillRecord[] = [];
    const collPath = `users/${userId}/media`;

    try {
        const snapshot = await getDocs(collection(db, 'users', userId, 'media'));

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();

            // [ZEN EWO 004] Target: AI-enriched docs needing vector refresh
            // Conditions:
            // 1. Has narrative (from Grok Vision) but no embedding yet
            // 2. OR has aiEnriched flag but embedding is outdated
            const hasNarrative = data.narrative && data.narrative.length > 20;
            const hasAzureVibe = !!data.azureVibe;
            const needsEmbedding = !data.embedding || data.embeddingVersion !== 'v2-narrative';

            // Skip if not enriched or already has v2 embedding
            if (!hasNarrative && !hasAzureVibe) continue;
            if (!needsEmbedding) continue;

            const text = buildMediaText(data);
            if (!text || text.length < 10) continue;

            records.push({
                id: docSnap.id,
                collectionPath: collPath,
                text,
                type: 'media',
                originalData: data
            });
        }

        console.log(`[Scanner] enriched_media: Found ${records.length} AI-enriched records needing vectorization`);
    } catch (error) {
        console.error('[Scanner] Failed to scan enriched media:', error);
    }

    return records;
}

// ============================================================================
// TEXT BUILDERS: Convert records to embeddable strings
// ============================================================================

function buildTagText(data: any): string {
    const parts: string[] = [];

    // Core identity
    if (data.name) parts.push(data.name);
    if (data.description) parts.push(data.description);

    // Type-specific metadata
    if (data.type === 'person' && data.metadata) {
        const m = data.metadata;
        if (m.givenName) parts.push(`Given name: ${m.givenName}`);
        if (m.familyName) parts.push(`Family name: ${m.familyName}`);
        if (m.jobTitle) parts.push(`Occupation: ${m.jobTitle}`);
        if (m.worksFor) parts.push(`Works for: ${m.worksFor}`);
        if (m.howWeMet) parts.push(`How we met: ${m.howWeMet}`);
        if (m.birthPlace) parts.push(`Born in: ${m.birthPlace}`);

        // [ZEN EWO 001] faceDescriptor removed - migrated to Azure Vision cloud

        // Life facts
        if (m.facts && Array.isArray(m.facts)) {
            for (const fact of m.facts.slice(0, 5)) {
                parts.push(`${fact.type}: ${fact.value}${fact.place ? ` in ${fact.place}` : ''}`);
            }
        }
    }

    if (data.type === 'pet' && data.metadata) {
        const m = data.metadata;
        if (m.species) parts.push(`Species: ${m.species}`);
        if (m.breed) parts.push(`Breed: ${m.breed}`);
    }

    if (data.type === 'place' && data.metadata) {
        const m = data.metadata;
        if (m.significance) parts.push(`Significance: ${m.significance}`);
        if (m.placeType) parts.push(`Type: ${m.placeType}`);
        if (typeof m.address === 'object' && m.address) {
            const addr = m.address;
            parts.push(`Location: ${[addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(', ')}`);
        } else if (typeof m.address === 'string') {
            parts.push(`Address: ${m.address}`);
        }
    }

    if (data.type === 'thing' && data.metadata) {
        const m = data.metadata;
        if (m.purpose) parts.push(`Purpose: ${m.purpose}`);
    }

    // Keywords
    if (data.keywords && Array.isArray(data.keywords)) {
        parts.push(`Keywords: ${data.keywords.join(', ')}`);
    }

    return parts.join('. ').trim();
}

function buildEventText(data: any): string {
    const parts: string[] = [];

    if (data.title) parts.push(data.title);
    if (data.description) parts.push(data.description);
    if (data.date) parts.push(`Date: ${data.date}`);
    if (data.location) parts.push(`Location: ${data.location}`);
    if (data.category) parts.push(`Category: ${data.category}`);

    // Keywords
    if (data.keywords && Array.isArray(data.keywords)) {
        parts.push(`Keywords: ${data.keywords.join(', ')}`);
    }

    return parts.join('. ').trim();
}

function buildMediaText(data: any): string {
    const parts: string[] = [];

    // [ZEN EWO 004] PRIORITY 1: Grok-generated narrative (richest semantic content)
    if (data.narrative && data.narrative.length > 20) {
        parts.push(data.narrative);
    }

    // [ZEN EWO 004] PRIORITY 2: Azure Vibe summary (emotion/age context)
    if (data.azureVibe) {
        const vibe = data.azureVibe;
        const vibeText: string[] = [];

        if (vibe.dominantEmotion && vibe.dominantEmotion !== 'neutral') {
            vibeText.push(`Mood: ${vibe.dominantEmotion}`);
        }
        if (vibe.smileScore !== undefined && vibe.smileScore > 0.5) {
            vibeText.push('Joyful moment');
        }
        if (vibe.averageAge) {
            vibeText.push(`Age ~${Math.round(vibe.averageAge)}`);
        }
        if (vibe.faceCount > 1) {
            vibeText.push(`${vibe.faceCount} people`);
        }

        if (vibeText.length > 0) {
            parts.push(`[Vibe: ${vibeText.join(', ')}]`);
        }
    }

    // PRIORITY 3: Standard metadata
    if (data.title) parts.push(data.title);
    if (data.caption) parts.push(data.caption);

    // Only use old description if no narrative
    if (!data.narrative && data.description) parts.push(data.description);

    if (data.fileName) parts.push(`File: ${data.fileName}`);

    // Location
    if (data.location?.address) {
        parts.push(`Location: ${data.location.address}`);
    }

    // Date context
    if (data.logicalDate) parts.push(`Date: ${data.logicalDate}`);
    else if (data.year) parts.push(`Year: ${data.year}`);

    // Keywords for semantic richness
    if (data.keywords && Array.isArray(data.keywords)) {
        parts.push(`Keywords: ${data.keywords.join(', ')}`);
    }

    // Legacy AI-generated descriptions (only if no narrative)
    if (!data.narrative && data.aiDescription) parts.push(data.aiDescription);

    return parts.join('. ').trim();
}

// ============================================================================
// VOYAGE AI BATCHER: Rate-limited embedding generation
// ============================================================================

async function callVoyageAI(texts: string[]): Promise<(number[] | null)[]> {
    const apiKey = getVoyageKey();
    if (!apiKey) {
        console.error('[Voyage] No API key found!');
        return texts.map(() => null);
    }

    try {
        const response = await fetch(VOYAGE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: VOYAGE_MODEL,
                input: texts
            })
        });

        if (response.status === 429) {
            console.warn('[Voyage] Rate limited! Backing off...');
            throw new Error('RATE_LIMITED');
        }

        if (!response.ok) {
            const err = await response.text();
            console.error(`[Voyage] API Error (${response.status}): ${err}`);
            return texts.map(() => null);
        }

        const data = await response.json();

        // Extract embeddings in order
        const embeddings: (number[] | null)[] = [];
        for (let i = 0; i < texts.length; i++) {
            const entry = data.data?.find((d: any) => d.index === i);
            embeddings.push(entry?.embedding || null);
        }

        return embeddings;

    } catch (error: any) {
        if (error.message === 'RATE_LIMITED') throw error;
        console.error('[Voyage] Request failed:', error);
        return texts.map(() => null);
    }
}

async function batchEmbed(
    records: BackfillRecord[],
    batchSize: number,
    cooldownMs: number,
    stats: BackfillStats,
    dryRun: boolean
): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>();
    let currentCooldown = cooldownMs;

    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const texts = batch.map(r => r.text);

        console.log(`[Batcher] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)} (${batch.length} records)`);

        let embeddings: (number[] | null)[] = [];
        let retries = 0;

        while (retries < MAX_RETRIES) {
            try {
                if (!dryRun) {
                    embeddings = await callVoyageAI(texts);
                } else {
                    // Dry run: simulate embeddings
                    embeddings = texts.map(() => Array(1024).fill(0).map(() => Math.random()));
                }
                currentCooldown = cooldownMs; // Reset cooldown on success
                break;
            } catch (error: any) {
                if (error.message === 'RATE_LIMITED') {
                    retries++;
                    currentCooldown *= 2; // Exponential backoff
                    console.warn(`[Batcher] Rate limited, retry ${retries}/${MAX_RETRIES} with ${currentCooldown}ms cooldown`);
                    await sleep(currentCooldown);
                } else {
                    console.error('[Batcher] Unrecoverable error:', error);
                    break;
                }
            }
        }

        // Map results back to records
        for (let j = 0; j < batch.length; j++) {
            const record = batch[j];
            const embedding = embeddings[j];

            if (embedding) {
                results.set(`${record.collectionPath}/${record.id}`, embedding);
                stats.successful++;
                stats.byType[record.type]++;
            } else {
                stats.failed++;
            }

            stats.processed++;

            // Pulse report
            if (stats.processed % PULSE_INTERVAL === 0) {
                logPulseReport(stats);
            }
        }

        // Cooldown between batches
        if (i + batchSize < records.length) {
            await sleep(currentCooldown);
        }
    }

    return results;
}

// ============================================================================
// FIRESTORE WRITER: Update records with embeddings
// [ZEN FIX] Reduced batch size to 20 to avoid 10MB payload ceiling
// ============================================================================

const WRITE_BATCH_SIZE = 20; // Small batches to avoid 10MB payload limit

async function writeEmbeddings(
    results: Map<string, number[]>,
    dryRun: boolean
): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    const totalToWrite = results.size;

    console.log(`[Writer] Starting write phase: ${totalToWrite} embeddings to commit`);

    // Group by collection for batch writes
    const byCollection = new Map<string, { id: string; embedding: number[] }[]>();

    for (const [path, embedding] of results) {
        const parts = path.split('/');
        const id = parts.pop()!;
        const collPath = parts.join('/');

        if (!byCollection.has(collPath)) {
            byCollection.set(collPath, []);
        }
        byCollection.get(collPath)!.push({ id, embedding });
    }

    // Write each collection with small sequential batches
    for (const [collPath, items] of byCollection) {
        if (dryRun) {
            console.log(`[Writer] DRY RUN: Would write ${items.length} embeddings to ${collPath}`);
            success += items.length;
            continue;
        }

        console.log(`[Writer] Writing ${items.length} embeddings to ${collPath}...`);

        // [ZEN FIX] Small batches of 20 to stay under 10MB payload limit
        for (let i = 0; i < items.length; i += WRITE_BATCH_SIZE) {
            const batch = writeBatch(db);
            const slice = items.slice(i, i + WRITE_BATCH_SIZE);

            for (const item of slice) {
                const docRef = doc(db, collPath, item.id);
                batch.update(docRef, { embedding: item.embedding });
            }

            try {
                // Sequential commit - await each batch before moving to next
                await batch.commit();
                success += slice.length;

                // Progress logging for visibility
                const progress = success + failed;
                const progressPercent = Math.round((progress / totalToWrite) * 100);
                console.log(`[Writer] ✓ Batch ${Math.floor(i / WRITE_BATCH_SIZE) + 1}/${Math.ceil(items.length / WRITE_BATCH_SIZE)} committed (${slice.length} docs) | Total: ${progress}/${totalToWrite} (${progressPercent}%)`);

            } catch (error) {
                console.error(`[Writer] ✗ Failed to write batch to ${collPath}:`, error);
                failed += slice.length;

                // [ZEN FIX] Continue with remaining batches even if one fails
                console.log(`[Writer] Continuing with remaining batches...`);
            }

            // Small delay between batches to prevent socket overload
            await sleep(100);
        }
    }

    console.log(`[Writer] Write phase complete: ${success} succeeded, ${failed} failed`);
    return { success, failed };
}

// ============================================================================
// PROGRESS REPORTER
// ============================================================================

function logPulseReport(stats: BackfillStats): void {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rate = stats.processed / elapsed;
    const remaining = stats.total - stats.processed;
    const eta = remaining / rate;

    const percent = Math.round((stats.processed / stats.total) * 100);
    const bar = '━'.repeat(Math.floor(percent / 5)) + '─'.repeat(20 - Math.floor(percent / 5));

    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  [PULSE ${stats.processed.toLocaleString()}] ${bar} ${percent}% (${stats.processed.toLocaleString()}/${stats.total.toLocaleString()})
╠══════════════════════════════════════════════════════════════════╣
║  ├─ chat_segments: ${stats.byType.chat.toLocaleString()} ✓
║  ├─ tags: ${stats.byType.tag.toLocaleString()} ✓
║  ├─ events: ${stats.byType.event.toLocaleString()} ✓
║  ├─ media: ${stats.byType.media.toLocaleString()} ✓
║  ├─ Elapsed: ${formatDuration(elapsed)}
║  ├─ Rate: ${rate.toFixed(1)} records/sec
║  ├─ Errors: ${stats.failed} (${((stats.failed / stats.processed) * 100).toFixed(1)}%)
║  └─ ETA: ~${formatDuration(eta)}
╚══════════════════════════════════════════════════════════════════╝
    `);
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

export async function runVectorBackfill(
    userId: string,
    options: BackfillOptions = {}
): Promise<BackfillStats> {
    const {
        batchSize = DEFAULT_BATCH_SIZE,
        cooldownMs = DEFAULT_COOLDOWN_MS,
        dryRun = false,
        collections = ['chat_segments', 'tags', 'events', 'media']
    } = options;

    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           VECTOR BACKFILL UTILITY - VOYAGE AI                    ║
║══════════════════════════════════════════════════════════════════║
║  User ID: ${userId.substring(0, 20)}...
║  Batch Size: ${batchSize}
║  Cooldown: ${cooldownMs}ms
║  Mode: ${dryRun ? '🧪 DRY RUN' : '🚀 LIVE'}
║  Collections: ${collections.join(', ')}
╚══════════════════════════════════════════════════════════════════╝
    `);

    // 1. SCAN PHASE
    console.log('\n[Phase 1/3] SCANNING for missing embeddings...\n');

    const allRecords: BackfillRecord[] = [];

    if (collections.includes('chat_segments')) {
        allRecords.push(...await scanChatSegments(userId));
    }
    if (collections.includes('tags')) {
        allRecords.push(...await scanTags(userId));
    }
    if (collections.includes('events')) {
        allRecords.push(...await scanEvents(userId));
    }
    if (collections.includes('media')) {
        allRecords.push(...await scanMedia(userId));
    }

    if (allRecords.length === 0) {
        console.log('\n✅ All records already have embeddings! Nothing to do.\n');
        return {
            total: 0,
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            startTime: Date.now(),
            byType: { chat: 0, tag: 0, event: 0, media: 0 }
        };
    }

    console.log(`\n📊 Total records to process: ${allRecords.length.toLocaleString()}\n`);

    // Initialize stats
    const stats: BackfillStats = {
        total: allRecords.length,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        startTime: Date.now(),
        byType: { chat: 0, tag: 0, event: 0, media: 0 }
    };

    // 2. EMBED PHASE
    console.log('[Phase 2/3] GENERATING embeddings via Voyage AI...\n');

    const embeddings = await batchEmbed(allRecords, batchSize, cooldownMs, stats, dryRun);

    // 3. WRITE PHASE
    console.log('\n[Phase 3/3] WRITING embeddings to Firestore...\n');

    const writeResult = await writeEmbeddings(embeddings, dryRun);

    // Final report
    const totalTime = (Date.now() - stats.startTime) / 1000;

    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    BACKFILL COMPLETE ✅                          ║
╠══════════════════════════════════════════════════════════════════╣
║  Total Processed: ${stats.processed.toLocaleString()}
║  Successful: ${stats.successful.toLocaleString()}
║  Failed: ${stats.failed.toLocaleString()}
║  Write Success: ${writeResult.success.toLocaleString()}
║  Write Failed: ${writeResult.failed.toLocaleString()}
║  ──────────────────────────────────────────────────────────────
║  By Type:
║    • chat_segments: ${stats.byType.chat.toLocaleString()}
║    • tags: ${stats.byType.tag.toLocaleString()}
║    • events: ${stats.byType.event.toLocaleString()}
║    • media: ${stats.byType.media.toLocaleString()}
║  ──────────────────────────────────────────────────────────────
║  Total Time: ${formatDuration(totalTime)}
║  Average Rate: ${(stats.processed / totalTime).toFixed(1)} records/sec
╚══════════════════════════════════════════════════════════════════╝
    `);

    return stats;
}

/**
 * [ZEN EWO 004] Run vectorization specifically for AI-enriched media
 * Targets media with Grok narratives and/or Azure vibe data
 */
async function runEnrichedMedia(
    userId: string,
    options?: {
        batchSize?: number;
        cooldownMs?: number;
        dryRun?: boolean;
    }
): Promise<BackfillStats> {
    const batchSize = options?.batchSize || DEFAULT_BATCH_SIZE;
    const cooldownMs = options?.cooldownMs || DEFAULT_COOLDOWN_MS;
    const dryRun = options?.dryRun || false;

    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║        [ZEN EWO 004] ENRICHED MEDIA VECTORIZATION                ║
║        Memory Forge: Narrative → Vector Transformation            ║
╚══════════════════════════════════════════════════════════════════╝
    `);

    console.log('[Phase 1/3] SCANNING for AI-enriched media...\n');

    const records = await scanEnrichedMedia(userId);

    if (records.length === 0) {
        console.log('✅ No enriched media needs vectorization.');
        return {
            total: 0,
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            startTime: Date.now(),
            byType: { chat: 0, tag: 0, event: 0, media: 0 }
        };
    }

    console.log(`📊 Found ${records.length} enriched records needing vectors\n`);

    const stats: BackfillStats = {
        total: records.length,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        startTime: Date.now(),
        byType: { chat: 0, tag: 0, event: 0, media: records.length }
    };

    // 2. EMBED PHASE
    console.log('[Phase 2/3] GENERATING narrative-enriched embeddings via Voyage AI...\n');

    const embeddings = await batchEmbed(records, batchSize, cooldownMs, stats, dryRun);

    // 3. WRITE PHASE with v2 version tag
    console.log('\n[Phase 3/3] WRITING v2 embeddings to Firestore...\n');

    const writeResult = await writeEnrichedEmbeddings(embeddings, dryRun);

    const totalTime = (Date.now() - stats.startTime) / 1000;

    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║            ENRICHED VECTORIZATION COMPLETE ✅                    ║
╠══════════════════════════════════════════════════════════════════╣
║  Records Processed: ${stats.processed.toLocaleString()}
║  Vectors Generated: ${stats.successful.toLocaleString()}
║  Write Success: ${writeResult.success.toLocaleString()}
║  Write Failed: ${writeResult.failed.toLocaleString()}
║  ──────────────────────────────────────────────────────────────
║  Total Time: ${formatDuration(totalTime)}
║  Average Rate: ${(stats.processed / totalTime).toFixed(1)} records/sec
║  ──────────────────────────────────────────────────────────────
║  🔮 Narratives now searchable via semantic query!
╚══════════════════════════════════════════════════════════════════╝
    `);

    return stats;
}

/**
 * [ZEN EWO 004] Write embeddings with v2-narrative version tag
 * Allows identification of which embeddings include Grok narratives
 */
async function writeEnrichedEmbeddings(
    embeddings: Map<string, number[]>,
    dryRun: boolean
): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    if (dryRun) {
        console.log(`[DRY RUN] Would write ${embeddings.size} v2 embeddings`);
        return { success: embeddings.size, failed: 0 };
    }

    // Group by collection for batched writes
    const byCollection = new Map<string, Array<{ id: string; embedding: number[] }>>();

    for (const [key, embedding] of embeddings) {
        // [ZEN EWO 010] Fix Ghost ID - batchEmbed uses '/' separator, not ':::'
        const parts = key.split('/');
        const docId = parts.pop()!;
        const collPath = parts.join('/');

        // [ZEN EWO 007] Path validation - prevent fromString errors
        if (!collPath || !docId || collPath.trim() === '' || docId.trim() === '') {
            console.warn(`[Writer] Skipping invalid path: collPath="${collPath}", docId="${docId}"`);
            failed++;
            continue;
        }

        // Validate path segments are valid (no undefined/null in path)
        const pathSegments = collPath.split('/');
        const hasInvalidSegment = pathSegments.some(seg => !seg || seg === 'undefined' || seg === 'null');
        if (hasInvalidSegment) {
            console.warn(`[Writer] Skipping path with invalid segments: ${collPath}`);
            failed++;
            continue;
        }

        if (!byCollection.has(collPath)) {
            byCollection.set(collPath, []);
        }
        byCollection.get(collPath)!.push({ id: docId, embedding });
    }

    // Write in batches per collection
    for (const [collPath, docs] of byCollection) {
        for (let i = 0; i < docs.length; i += 500) {
            const batch = docs.slice(i, i + 500);

            try {
                const firestoreBatch = writeBatch(db);

                for (const { id, embedding } of batch) {
                    const docRef = doc(db, collPath, id);
                    firestoreBatch.update(docRef, {
                        embedding,
                        embeddingVersion: 'v2-narrative', // [ZEN EWO 004] Version tag
                        embeddingGeneratedAt: new Date().toISOString()
                    });
                }

                await firestoreBatch.commit();
                success += batch.length;
            } catch (error) {
                console.error(`[Writer] Batch write failed for ${collPath}:`, error);
                failed += batch.length;
            }
        }
    }

    return { success, failed };
}

/**
 * [ZEN EWO 008] Immediate re-vectorization for single items
 * Called after manual narrative edits to refresh the embedding instantly
 */
export async function updateSingleMedia(userId: string, mediaId: string): Promise<boolean> {
    console.log(`[Vector] 🔄 Instant re-vectorization for ${mediaId}...`);
    try {
        const docRef = doc(db, 'users', userId, 'media', mediaId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
            console.error('[Vector] Media not found:', mediaId);
            return false;
        }

        const data = snapshot.data();
        const text = buildMediaText(data);
        const results = await callVoyageAI([text]);
        const embedding = results[0];

        if (embedding) {
            await updateDoc(docRef, {
                embedding,
                embeddingVersion: 'v2-manual', // [ZEN EWO 008] Manual override tag
                embeddingGeneratedAt: new Date().toISOString()
            });
            console.log('[Vector] ✅ Instant update complete (v2-manual)');
            return true;
        }
        return false;
    } catch (e) {
        console.error('[Vector] Instant update failed:', e);
        return false;
    }
}

// ============================================================================
// [ZEN FIX] EMERGENCY TYPESENSE SYNC
// ============================================================================

async function syncMissingTypesenseMedia(userId: string) {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║        [ZEN FIX] EMERGENCY TYPESENSE MEDIA SYNC                  ║
╚══════════════════════════════════════════════════════════════════╝
    `);
    console.log(`[Typesense Sync] Scanning Firestore for user ${userId} media...`);
    try {
        const snapshot = await getDocs(collection(db, 'users', userId, 'media'));
        console.log(`[Typesense Sync] Found ${snapshot.size} media records. Re-syncing to Typesense...`);
        
        let success = 0, failed = 0;
        
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const indexObject: any = {
                ...data,
                id: docSnap.id,
                timestamp: new Date(data.logicalDate || data.dateAdded?.toDate?.() || Date.now()).getTime(),
                uploadDate: data.dateAdded?.toDate?.() || new Date()
            };
            
            // Typesense doesn't like Firestore Timestamp objects, strip them before sync
            Object.keys(indexObject).forEach(key => {
                if (indexObject[key] && typeof indexObject[key].toDate === 'function') {
                    delete indexObject[key];
                }
            });

            const ok = await typesenseService.updateMedia(indexObject);
            if (ok) success++;
            else failed++;

            if ((success + failed) % 50 === 0) {
                console.log(`[Typesense Sync] Progress: ${success + failed} / ${snapshot.size}`);
            }
        }
        
        console.log(`[Typesense Sync] Complete. Successfully Synced: ${success}, Failed: ${failed}`);
    } catch (e) {
        console.error(`[Typesense Sync] Failed:`, e);
    }
}

// ============================================================================
// CONSOLE ACCESS
// ============================================================================

// Expose to window for console access
if (typeof window !== 'undefined') {
    (window as any).vectorBackfill = {
        run: runVectorBackfill,
        dryRun: (userId: string) => runVectorBackfill(userId, { dryRun: true }),
        chatOnly: (userId: string) => runVectorBackfill(userId, { collections: ['chat_segments'] }),
        tagsOnly: (userId: string) => runVectorBackfill(userId, { collections: ['tags'] }),
        // [ZEN EWO 004] New enriched media vectorization
        runEnriched: runEnrichedMedia,
        enrichedDryRun: (userId: string) => runEnrichedMedia(userId, { dryRun: true }),
        // [ZEN EWO 008] Immediate single-item update
        updateSingle: updateSingleMedia,
        // [ZEN FIX] Emergency fix for Typesense 400s
        syncTypesense: syncMissingTypesenseMedia,
    };
    // console.log('[Vector Backfill] Utility loaded. Use window.vectorBackfill.runEnriched(userId) for narrative vectors');
    // console.log('[Typesense Fix] Use window.vectorBackfill.syncTypesense(userId) to repair missing media indices');
}
