import { MongoClient } from 'mongodb';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const uri = process.env.MONGODB_URI || '';
const client = new MongoClient(uri, {
  family: 4,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000
});

let dbInstance: any = null;

async function getDatabase() {
  if (!dbInstance) {
    await client.connect();
    dbInstance = client.db('LifeOS');
  }
  return dbInstance;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { action, mediaId, sourceTagId, targetTagId } = req.body;
    if (!action || !mediaId || !targetTagId) {
      return res.status(400).json({ error: 'action, mediaId, and targetTagId are required.' });
    }

    const db = await getDatabase();
    const tagsCollection = db.collection('tags');
    const mediaCollection = db.collection('media');

    // 1. Process target tag
    const targetTag = await tagsCollection.findOne({ _id: targetTagId });
    if (!targetTag) {
      return res.status(404).json({ error: `Target tag (${targetTagId}) not found.` });
    }

    // Initialize arrays
    if (!targetTag.mediaIds) targetTag.mediaIds = [];
    if (!targetTag.mediaGallery) targetTag.mediaGallery = [];

    // 2. Fetch original media item
    const mediaDoc = await mediaCollection.findOne({ _id: mediaId });
    if (!mediaDoc) {
      return res.status(404).json({ error: `Media item (${mediaId}) not found.` });
    }

    if (!mediaDoc.tagIds) mediaDoc.tagIds = [];

    // Keep track of source gallery item if transferring
    let galleryItemToTransfer: any = null;

    if (action === 'transplant') {
      if (!sourceTagId) {
        return res.status(400).json({ error: 'sourceTagId is required for transplant action.' });
      }

      // Process source tag
      const sourceTag = await tagsCollection.findOne({ _id: sourceTagId });
      if (sourceTag) {
        const sourceMediaIds = sourceTag.mediaIds || [];
        const sourceGallery = sourceTag.mediaGallery || [];

        // Save gallery item for transfer
        galleryItemToTransfer = sourceGallery.find((item: any) => item.id === mediaId || item.url === mediaDoc.url);

        // Filter out
        const updatedMediaIds = sourceMediaIds.filter((id: string) => id !== mediaId);
        const updatedGallery = sourceGallery.filter((item: any) => item.id !== mediaId && item.url !== mediaDoc.url);

        await tagsCollection.updateOne(
          { _id: sourceTagId },
          { $set: { mediaIds: updatedMediaIds, mediaGallery: updatedGallery } }
        );
      }

      // Update media doc's tagIds
      const updatedMediaTagIds = mediaDoc.tagIds.filter((id: string) => id !== sourceTagId);
      if (!updatedMediaTagIds.includes(targetTagId)) {
        updatedMediaTagIds.push(targetTagId);
      }
      await mediaCollection.updateOne(
        { _id: mediaId },
        { $set: { tagIds: updatedMediaTagIds } }
      );
    } 
    else if (action === 'clone') {
      // Share/clone pointer to target tag
      if (!mediaDoc.tagIds.includes(targetTagId)) {
        mediaDoc.tagIds.push(targetTagId);
      }
      await mediaCollection.updateOne(
        { _id: mediaId },
        { $set: { tagIds: mediaDoc.tagIds } }
      );
    }

    // Add media reference to target tag
    if (!targetTag.mediaIds.includes(mediaId)) {
      targetTag.mediaIds.push(mediaId);
    }

    const hasInGallery = targetTag.mediaGallery.some((item: any) => item.id === mediaId || item.url === mediaDoc.url);
    if (!hasInGallery) {
      if (galleryItemToTransfer) {
        targetTag.mediaGallery.push(galleryItemToTransfer);
      } else {
        targetTag.mediaGallery.push({
          id: mediaId,
          type: mediaDoc.type || 'image',
          url: mediaDoc.url,
          caption: mediaDoc.caption || 'Shared Pointer Asset',
          date: new Date().toISOString()
        });
      }
    }

    await tagsCollection.updateOne(
      { _id: targetTagId },
      { $set: { mediaIds: targetTag.mediaIds, mediaGallery: targetTag.mediaGallery } }
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[transplantAsset] failed:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
