import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Erato only accepts POST requests.' });
    }

    const { prompt, negativePrompt, aspectRatio = 'portrait_4_3', model = 'fal-ai/flux/dev', imageUrl, strength = 0.8 } = req.body;
    const apiKey = process.env.VITE_FAL_KEY;

    if (!prompt) {
        return res.status(400).json({ error: 'A prompt is required for the Muse to dream.' });
    }

    if (!apiKey) {
        return res.status(500).json({ error: 'Server configuration error: Erato is missing the Fal.ai API key.' });
    }

    try {
        let targetModel = model;
        
        const payload: any = {
            prompt: prompt,
            enable_safety_checker: false // Explicitly disable puritanical filters
        };

        if (imageUrl) {
            payload.image_url = imageUrl;
            payload.strength = strength;
            
            // Re-route to specific image-to-image endpoints if required by Fal.ai
            if (targetModel === 'fal-ai/flux/dev') {
                targetModel = 'fal-ai/flux/dev/image-to-image';
            } else if (targetModel === 'fal-ai/flux/schnell') {
                targetModel = 'fal-ai/flux/schnell/image-to-image';
            }
        }

        // Apply Model Registry mapping
        if (targetModel.includes('flux')) {
            payload.image_size = aspectRatio; // 'square', 'portrait_4_3', 'landscape_16_9', etc.
            
            if (targetModel.includes('schnell')) {
                 payload.num_inference_steps = 4; // Schnell is optimized for ultra-fast low-step generation
            } else if (targetModel.includes('pro')) {
                 payload.num_inference_steps = 28;
                 payload.guidance_scale = 3.5;
            } else {
                 // dev or dev/image-to-image
                 payload.num_inference_steps = 28;
                 payload.guidance_scale = 3.5;
            }
        } else {
            // Non-FLUX models (e.g. SD3)
            payload.image_size = aspectRatio;
        }

        // Some models accept negative_prompt. FLUX mostly relies on positive prompt.
        if (negativePrompt && !targetModel.includes('flux')) {
            payload.negative_prompt = negativePrompt;
        }

        const response = await fetch(`https://fal.run/${targetModel}`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("[Erato's Palace] Fal.ai API Error:", errorData);
            throw new Error(`Fal.ai Engine Error: ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        
        // Fal.ai returns images in an array: { images: [ { url: 'https://...', content_type: 'image/jpeg' } ] }
        const generatedImageUrl = data.images?.[0]?.url;

        if (!generatedImageUrl) {
            throw new Error('Erato woke up, but the canvas was blank (No image returned).');
        }

        console.log(`[Erato's Palace] Dream sequence complete. Delivering artifact.`);

        res.status(200).json({
            success: true,
            imageUrl: generatedImageUrl, 
            metadata: {
                modelUsed: model,
                seed: data.seed
            }
        });

    } catch (error: any) {
        console.error("[Erato's Palace] Fatal Error:", error);
        res.status(500).json({ error: error.message });
    }
}
