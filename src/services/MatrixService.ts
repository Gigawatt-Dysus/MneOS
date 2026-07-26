import { getFirestore, collection, addDoc, doc, setDoc, deleteDoc, serverTimestamp } from './sovereignDbAdapter';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';
import { MatrixAsset, Media, Tag } from '../types'; // [ZEN] Added Media type for casting
import { StagedAsset } from '../components/AccessioningGateway/types';
import { typesenseService } from './typesenseService'; // [ZEN] Import the Bridge
import { getEmbedding } from './ai/providers';

// --- DELETION LOGIC ---
export const deleteAssets = async (assets: MatrixAsset[], uid: string): Promise<{ success: number; errors: number }> => {
    let successCount = 0;
    let errorCount = 0;

    const promises = assets.map(async (asset) => {
        try {
            const storagePromises = [];
            
            // Delete Original
            if (typeof asset.url === 'string' && asset.url) {
                const originalRef = ref(storage, asset.url);
                storagePromises.push(deleteObject(originalRef).catch(e => console.warn("Original file missing:", e)));
            }

            // Delete Thumbnails
            if (asset.thumbnailUrls) {
                Object.values(asset.thumbnailUrls).forEach(url => {
                    if (typeof url === 'string' && url) {
                        const thumbRef = ref(storage, url);
                        storagePromises.push(deleteObject(thumbRef).catch(e => console.warn("Thumbnail missing:", e)));
                    }
                });
            }

            await Promise.all(storagePromises);
            await deleteDoc(doc(db, 'users', uid, 'media', asset.id));
            
            // [ZEN] Remove from Search Index
            await typesenseService.deleteMedia(asset.id);

            successCount++;
        } catch (error) {
            console.error(`Failed to delete asset ${asset.id}:`, error);
            errorCount++;
        }
    });

    await Promise.all(promises);
    return { success: successCount, errors: errorCount };
};

// --- SAVE LOGIC ---
export const saveToMatrix = async (asset: StagedAsset, userId: string): Promise<string> => {
    try {
        if (!userId) throw new Error("No user ID provided for Matrix save.");

        // [ZEN] SMART DOCUMENT ACCESSION: Ingest and Vectorize PDF, Word, Excel, Text, Markdown
        if (asset.type === 'document') {
            let downloadUrl = asset.mediaUrl || '';
            let storagePath = asset.objectKey || '';
            const year = asset.logicalDate.getFullYear().toString();

            if (asset.file) {
                const safeFilename = asset.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                storagePath = `users/${userId}/documents/${year}/${safeFilename}`;
                const storageRef = ref(storage, storagePath);
                const snapshot = await uploadBytes(storageRef, asset.file);
                downloadUrl = await getDownloadURL(snapshot.ref);
            }

            const docId = asset.id || `doc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const documentRecord = {
                id: docId,
                userId,
                title: asset.title || 'Untitled Document',
                description: asset.description || '',
                fileName: asset.file?.name || asset.fileName || 'unknown_document',
                fileType: asset.file?.type || asset.fileType || 'application/octet-stream',
                fileSize: asset.file?.size || asset.fileSize || 0,
                storagePath: storagePath,
                downloadUrl: downloadUrl,
                logicalDate: asset.logicalDate.toLocaleDateString('en-CA') + 'T' + asset.logicalDate.toLocaleTimeString('en-GB'),
                datePrecision: asset.datePrecision || 'exact',
                tagIds: asset.tagIds || [],
                extractedText: asset.extractedText || '',
                ragEnabled: asset.ragEnabled !== false,
                status: 'clean',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            await setDoc(doc(db, `users/${userId}/documents`, docId), documentRecord);
            console.log(`[MatrixService] Saved document record ${docId} to users/${userId}/documents`);

            // Index in Typesense
            try {
                const vectorContent = `${documentRecord.title} ${documentRecord.description} ${documentRecord.extractedText.substring(0, 3000)}`;
                const embedding = await getEmbedding(vectorContent);
                
                await typesenseService.upsertArchivalDocument({
                    ...documentRecord,
                    embedding: embedding || null
                });
            } catch (e) {
                console.error("[MatrixService] Document typesense indexing failed:", e);
            }

            return docId;
        }

        // [ZEN] NARRATIVE ACCESSION: Promote jots to Events collection
        if (asset.type === 'event') {
            const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            let finalMediaIds = asset.mediaIds || [];

            // [ZEN] HYBRID PACKAGE: If the event has attached media (e.g. from Facebook ingestion), accession them too!
            const attachedMedia = (asset as any).attachedMedia;
            if (attachedMedia && attachedMedia.length > 0) {
                const newMediaIds = [];
                for (const mediaObj of attachedMedia) {
                    const mId = mediaObj.id || `media-${Math.random().toString(36).substr(2, 9)}`;
                    newMediaIds.push(mId);
                    
                    const mDoc = { ...mediaObj, id: mId, uid: userId, dateAdded: serverTimestamp() };
                    await setDoc(doc(db, `users/${userId}/media`, mId), mDoc);
                    
                    const indexObject = {
                        ...mDoc,
                        timestamp: new Date(mDoc.logicalDate || mDoc.uploadDate || new Date()).getTime(),
                        uploadDate: new Date()
                    };
                    await typesenseService.updateMedia(indexObject as any);
                    console.log(`[MatrixService] Accessioned embedded media ${mId} for event ${eventId}`);
                }
                finalMediaIds = newMediaIds;
            }

            const eventDoc = {
                id: eventId,
                userId,
                title: asset.title || 'New Memory',
                date: asset.logicalDate,
                details: asset.description || '',
                tagIds: asset.tagIds || [],
                mediaIds: finalMediaIds,
                location: asset.location || null,
                status: 'clean',
                datePrecision: asset.datePrecision || 'exact',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await setDoc(doc(db, `users/${userId}/events`, eventId), eventDoc);
            console.log(`[MatrixService] Accessioned narrative jot ${eventId}`);

            // [ZEN] Index Event with Embedding
            try {
                const vectorContent = `${eventDoc.title} ${eventDoc.details}`;
                const embedding = await getEmbedding(vectorContent);
                await typesenseService.updateEvent(eventDoc, userId, embedding || undefined);
            } catch (e) {
                console.error("[MatrixService] Event indexing failed:", e);
            }

            return eventId;
        }

        // [ZEN] SOVEREIGN COMMS: Accession Human Message Logs (Sessions)
        if (asset.type === 'messenger_log') {
            const logId = asset.id || `msg-log-${Date.now()}`;
            const journalDoc = {
                id: logId,
                userId,
                threadId: (asset as any).threadId || 'unknown',
                title: asset.title || 'Untitled Message Log',
                content: (asset as any).content || asset.description || '',
                type: 'messenger_log',
                authorType: 'human',
                source: (asset as any).source || 'facebook_messenger_log',
                creationDate: asset.logicalDate || (asset as any).creationDate || serverTimestamp(),
                endTime: (asset as any).endTime || null,
                tagIds: asset.tagIds || [],
                metadata: (asset as any).metadata || {},
                createdAt: serverTimestamp()
            };

            await setDoc(doc(db, `users/${userId}/communication_archives`, logId), journalDoc);
            
            // [ZEN] STEP 2: Generate High-Fidelity Semantic Embedding (VoyageAI)
            let embedding: number[] | null = null;
            try {
                const sessionMessages = (asset as any).messages || [];
                const sampleTurns = sessionMessages
                    .slice(0, 5)
                    .concat(sessionMessages.length > 5 ? sessionMessages.slice(-5) : [])
                    .map((m: any) => {
                        const time = new Date(m.date || m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const cleanMsg = (m.details || m.content || '')
                            .replace(/Sent from .*? for iPhone/gi, '')
                            .replace(/Sent from Craigslist Mobile/gi, '')
                            .trim();
                        return `[${time}] ${m.senderName || m.author || 'Unknown'}: ${cleanMsg}`;
                    })
                    .join('\n');

                const embeddingText = `
Thread: ${journalDoc.threadId}
Participants: ${journalDoc.metadata?.participants?.join(', ') || 'Unknown'}
Date Range: ${new Date(journalDoc.creationDate).toLocaleDateString()} → ${journalDoc.endTime ? new Date(journalDoc.endTime).toLocaleDateString() : 'ongoing'}
Messages: ${journalDoc.metadata?.messageCount || 0}
Duration: ${journalDoc.metadata?.durationMinutes || 0} minutes

Summary: ${journalDoc.title}

Sample Conversation:
${sampleTurns}
`.trim();
                
                embedding = await getEmbedding(embeddingText);
                
                if (embedding) {
                    await setDoc(doc(db, `users/${userId}/communication_archives`, logId), { embedding }, { merge: true });
                }
            } catch (embedError) {
                console.error("[MatrixService] High-fidelity embedding failed for messenger_log:", embedError);
            }

            // [ZEN] STEP 3: Typesense Sync (Hybrid Search)
            try {
                await typesenseService.upsertMessengerSession({
                    ...journalDoc,
                    sessionId: logId,
                    startTime: journalDoc.creationDate,
                    embedding: embedding || null,
                    content: journalDoc.content
                });
            } catch (tsError) {
                console.error("[MatrixService] Typesense indexing failed for session:", logId, tsError);
            }

            console.log(`[MatrixService] Accessioned Message Log Session ${logId} (Vectorized) to Human Archive`);
            return logId;
        }

        // [ZEN] SIGNAL HUB: Accession Digital Exhaust to Messages
        if (asset.type === 'signal') {
            const msgId = asset.id || `msg-${Date.now()}`;
            const msgDoc = {
                id: msgId,
                userId,
                type: (asset as any).type || 'Facebook',
                subject: asset.title || 'Signal',
                body: (asset as any).body || asset.description || '',
                timestamp: asset.logicalDate,
                from: (asset as any).from || 'Facebook',
                read: true,
                createdAt: serverTimestamp()
            };
            await setDoc(doc(db, `users/${userId}/messages`, msgId), msgDoc);
            console.log(`[MatrixService] Accessioned digital signal ${msgId}`);
            return msgId;
        }

        // [ZEN] PERSON DISCOVERY: Promote provisional tags to Tag collection
        if (asset.type === 'tag') {
            const tagId = asset.id || `tag-${Date.now()}`;
            const tagType = (asset as any).tagType || 'person';
            const tagDoc = {
                ...asset,
                id: tagId,
                userId,
                type: tagType, 
                status: 'active',
                metadata: {
                    ...(asset.metadata || {}),
                    isProvisional: false, 
                    source: asset.source || 'archive_import'
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            
            delete (tagDoc as any).triage;
            delete (tagDoc as any).logicalDate;
            
            await setDoc(doc(db, `users/${userId}/tags`, tagId), tagDoc);
            console.log(`[MatrixService] Promoted provisional tag ${tagId}: ${asset.title}`);

            // [ZEN] Index Tag with Embedding
            try {
                const tag = tagDoc as any;
                const factText = (tag.metadata?.facts || [])
                    .map((f: any) => `${f.type} ${f.value} ${f.date || ''} ${f.place || ''}`)
                    .join(' ');
                const vectorContent = `${tag.name} ${tag.metadata?.bio || tag.description || ''} ${factText}`;
                const embedding = await getEmbedding(vectorContent);
                await typesenseService.upsertTag(tag, userId, embedding || undefined);
            } catch (e) {
                console.error("[MatrixService] Tag indexing failed:", e);
            }

            return tagId;
        }

        let downloadUrl = asset.mediaUrl || '';
        let storagePath = asset.objectKey || '';
        const year = asset.logicalDate.getFullYear().toString();

        // 1. Handle Local Upload if needed
        if (asset.file) {
            const safeFilename = asset.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            storagePath = `users/${userId}/media/${year}/${safeFilename}`;
            const storageRef = ref(storage, storagePath);
            const snapshot = await uploadBytes(storageRef, asset.file);
            downloadUrl = await getDownloadURL(snapshot.ref);
        }

        if (!downloadUrl) throw new Error("Artifact has no media URL or source file.");

        // 2. Construct the "Index Card" (Firestore Document)
        const mediaDoc = {
            uid: userId,
            url: downloadUrl,
            originalName: asset.file?.name || asset.fileName || 'unknown_artifact',
            fileType: asset.file?.type || asset.fileType || 'application/octet-stream',
            size: asset.file?.size || asset.fileSize || 0,
            storagePath: storagePath,
            dateAdded: serverTimestamp(),
            logicalDate: asset.logicalDate.toLocaleDateString('en-CA') + 'T' + asset.logicalDate.toLocaleTimeString('en-GB'),
            datePrecision: asset.datePrecision || 'exact',
            
            // Metadata
            width: asset.metadata.width || 0,
            height: asset.metadata.height || 0,
            aspectRatio: asset.metadata.aspectRatio || 1,
            // @ts-ignore
            googleMetadata: asset.metadata.googlePhotos || null,

            // User Edits
            title: asset.title || '',
            description: asset.description || '',
            caption: asset.caption || '',
            tagIds: asset.tagIds || [],
            location: asset.location || null,
            isPurist: asset.isPurist || false,
            
            // [ZEN] Darkroom Polishing Attributes
            preset: asset.preset || 'original',
            adjustmentStack: asset.adjustmentStack || {},
            polishLayers: asset.polishLayers || [],
            editHistory: asset.editHistory || [],

            // System
            status: 'clean',
            source: asset.source || 'web_accession_import',
            year: parseInt(year),
            contentHash: asset.contentHash || null
        };

        // 4. Write to Firestore
        const docRef = await addDoc(collection(db, `users/${userId}/media`), mediaDoc);
        console.log(`[MatrixService] Saved artifact ${docRef.id}`);

        // 5. [ZEN] Sync to Typesense (Instant Searchability)
        try {
            const vectorContent = `${mediaDoc.title} ${mediaDoc.description} ${mediaDoc.caption}`;
            const embedding = await getEmbedding(vectorContent);
            
            const indexObject = {
                ...mediaDoc,
                id: docRef.id,
                timestamp: new Date(mediaDoc.logicalDate).getTime(),
                uploadDate: new Date(), 
                embedding: embedding || undefined
            };
            await typesenseService.updateMedia(indexObject as unknown as Media);
        } catch (e) {
            console.error("[MatrixService] Media indexing failed:", e);
        }

        return docRef.id;
    } catch (error) {
        console.error("[MatrixService] Save failed:", error);
        throw error;
    }
};