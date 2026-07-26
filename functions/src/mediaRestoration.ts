import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

// --- INITIALIZATION ---
const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform'
});

/**
 * processMediaMagic
 * [ZEN] The "Holy Grail" endpoint. Hardened with REST and Neural Fallback.
 */
export const processMediaMagic = onCall({ cors: true, timeoutSeconds: 300, memory: "1GiB" }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Sovereign access required.');
    }

    const { imageUrl, factor = 2 } = request.data;
    if (!imageUrl) {
        throw new HttpsError('invalid-argument', 'Target image URL missing.');
    }

    try {
        console.log(`[MediaRestoration] Initializing hardened pass for: ${imageUrl}`);

        // 1. Fetch Source Artifact
        const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(imageRes.data).toString('base64');
        const mimeType = imageRes.headers['content-type'] || 'image/png';

        // 2. Prepare Authentication
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const token = tokenResponse.token;

        const project = 'gigi-time-machine';
        const location = 'us-east4'; // [ZEN] Shifting to East-4 for better availability
        
        // 3. Neural Attempt Loop (Imagen 2 Workhorse -> 4.0 -> 3.0)
        const models = ['image-generation@006', 'imagen-4.0-upscale-preview', 'imagen-3.0-upscale-preview-0821'];
        let resultBase64 = null;
        let activeModel = '';

        for (const modelId of models) {
            try {
                console.log(`[MediaRestoration] Attempting reconstruction with: ${modelId} in ${location}`);
                activeModel = modelId;
                
                const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${modelId}:predict`;

                // [ZEN] Adjusting payload for Imagen 2 vs 4 compatibility
                const payload: any = {
                    instances: [
                        {
                            image: {
                                bytesBase64Encoded: base64Image,
                                mimeType: mimeType
                            }
                        }
                    ],
                    parameters: {
                        upscaleFactor: `x${factor}`
                    }
                };

                // Specific parameter mapping for image-generation@006
                if (modelId.includes('@006')) {
                    payload.instances[0].upscaleConfig = {
                        upscaleFactor: `x${factor}`
                    };
                    delete payload.parameters.upscaleFactor;
                }

                const aiRes = await axios.post(endpoint, payload, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                const predictions = aiRes.data.predictions;
                if (predictions && predictions.length > 0) {
                    resultBase64 = predictions[0].bytesBase64Encoded || predictions[0].image;
                    if (resultBase64) break; // Success!
                }
            } catch (innerError: any) {
                console.warn(`[MediaRestoration] Model ${modelId} failed:`, innerError.response?.data || innerError.message);
                // Continue to next model
            }
        }

        if (!resultBase64) {
            throw new Error('All neural reconstruction paths exhausted. The magic failed to materialize.');
        }

        // 4. Archival Storage
        const bucket = admin.storage().bucket();
        const fileName = `resurrection_${Date.now()}.png`;
        const filePath = `users/${request.auth.uid}/media/${fileName}`;
        const file = bucket.file(filePath);
        
        await file.save(Buffer.from(resultBase64, 'base64'), {
            metadata: { 
                contentType: 'image/png',
                metadata: {
                    source: 'Neural Resurrection',
                    model: activeModel,
                    originalUrl: imageUrl
                }
            },
        });

        // 5. Generate Sovereign Access URL
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '03-09-2491',
        });

        return { url, fileName, modelUsed: activeModel };
    } catch (error: any) {
        console.error('[MediaRestoration] Reconstruction Failure:', error);
        return { error: error.message || 'The magic failed to materialize.' };
    }
});
