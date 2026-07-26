
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { imageBase64, replicateKey, modelId = "tencent/hunyuan3d-2" } = req.body;

    if (!imageBase64 || !replicateKey) {
      return res.status(400).json({ error: "Missing imageBase64 or replicateKey parameters" });
    }

    console.log(`[ReplicateProxy] Starting 3D generation using ${modelId}...`);

    const versionHash = modelId === "tencent/hunyuan3d-2" 
        ? "b1b9449a1277e10402781c5d41eb30c0a0683504fb23fab591ca9dfc2aabe1cb"
        : modelId === "firtoz/trellis"
        ? "e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c"
        : undefined;

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

    const startResponse = await fetch(
      url,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${replicateKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    if (!startResponse.ok) {
        const errText = await startResponse.text();
        throw new Error(`Replicate API Error: ${errText}`);
    }

    let prediction = await startResponse.json();
    const pollUrl = prediction.urls.get;
    console.log(`[ReplicateProxy] Prediction started: ${prediction.id}`);

    // Poll for completion (up to 3 minutes max to comply with Vercel function timeouts)
    const maxRetries = 90; // 90 * 2s = 180s
    let retries = 0;

    while (prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled" && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pollResponse = await fetch(pollUrl, {
        headers: { "Authorization": `Bearer ${replicateKey}` }
      });
      if (!pollResponse.ok) {
         throw new Error(`Polling failed: ${await pollResponse.text()}`);
      }
      prediction = await pollResponse.json();
      retries++;
    }

    if (prediction.status === "succeeded") {
      console.log(`[ReplicateProxy] Success! Output:`, prediction.output);
      return res.status(200).json({ success: true, data: { status: "success", output: prediction.output } });
    } else {
      console.error(`[ReplicateProxy] Failed with status: ${prediction.status}`, prediction.error);
      return res.status(500).json({ success: false, error: `Generation failed: ${prediction.error || prediction.status}` });
    }

  } catch (error: any) {
    console.error("[ReplicateProxy] Error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
