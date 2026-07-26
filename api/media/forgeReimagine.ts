import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { base64Image, masterPrompt, apiKey } = req.body;

    if (!base64Image || !masterPrompt || !apiKey) {
        return res.status(400).json({ error: 'Missing required parameters.' });
    }

    try {
        // Strip the data:image prefix if present
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

        // Construct the Google AI Studio payload for Gemini 3.1 Flash Image (Nano Banana 2)
        // Requesting native 4K upscaling/re-rendering
        const payload = {
            instances: [
                {
                    prompt: masterPrompt,
                    image: {
                        bytesBase64Encoded: base64Data
                    }
                }
            ],
            parameters: {
                sampleCount: 1,
                // "4K" resolution mapping per Nano Banana 2 capabilities
                outputOptions: {
                    mimeType: "image/jpeg",
                    compressionQuality: 95
                },
                // Trigger upscaling modality
                upscale: true
            }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:predict?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            
            // Safety filter interception handling
            if (errorData.error?.message?.toLowerCase().includes('safety')) {
                return res.status(403).json({
                    error: 'Safety Filter Tripped',
                    isRefused: true,
                    mitigation: 'Corporate safety filters intercepted the render payload at the Google AI layer.'
                });
            }
            throw new Error(`Google API Error: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const generatedBase64 = data.predictions?.[0]?.bytesBase64Encoded;

        if (!generatedBase64) {
             throw new Error('Google API returned an empty prediction array.');
        }

        res.status(200).json({
            success: true,
            base64Data: `data:image/jpeg;base64,${generatedBase64}`
        });

    } catch (error: any) {
        console.error("Sovereign Forge Engine Error:", error);
        res.status(500).json({ error: error.message });
    }
}
