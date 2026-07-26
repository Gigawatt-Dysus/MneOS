/**
 * Project GIGI: Mnemosyne (MneOS)
 * Atlas Cloud Vision Adapter
 * 
 * Handles high-fidelity, uncensored generation via FLUX pipelines.
 * Utilizing async polling architecture (POST trigger -> GET polling)
 */

export interface AtlasGenerationRequest {
  model?: string;
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidance_scale?: number;
  image?: string | string[]; // Support for multi-reference identity injection
  strength?: number;         // Image to image strength
  size?: string;             // Resolution constraint (e.g. "1024*4096")
  // LoRA parameters will be injected here when we deduce their exact schema
  [key: string]: any; 
}

export interface AtlasPollingResult {
  id: string;
  status: 'processing' | 'completed' | 'failed' | 'in_queue' | string;
  outputs?: string[];
  error?: string;
}

export class AtlasVisionAdapter {
  private static readonly API_KEY = import.meta.env.VITE_ATLAS_CLOUD_API_KEY;
  private static readonly GENERATE_URL = "https://api.atlascloud.ai/api/v1/model/generateImage";
  private static readonly POLL_URL = "https://api.atlascloud.ai/api/v1/model/prediction";

  /**
   * Phase 1: Trigger Generation
   * Hits the POST endpoint and receives a prediction_id
   */
  public static async trigger(params: AtlasGenerationRequest): Promise<string> {
    if (!this.API_KEY) {
      throw new Error("ATLAS ERROR: Missing VITE_ATLAS_CLOUD_API_KEY in .env.local");
    }

    // Defaulting to the $0.03 FLUX endpoint we found. 
    // (Note: We may need to tweak the exact model slug if their API rejects it)
    const payload = {
      model: params.model || "flux-kontext-dev-lora", 
      ...params
    };

    const response = await fetch(this.GENERATE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data?.data?.id) {
      console.error("Atlas Trigger Raw Response:", data);
      throw new Error(`Atlas trigger failed: ${data?.error || data?.message || response.statusText}`);
    }

    return data.data.id;
  }

  /**
   * Phase 2: Poll for Completion
   * Loops until the prediction ID returns 'completed' or 'failed'
   */
  public static async poll(predictionId: string, maxAttempts = 60): Promise<string[]> {
    if (!this.API_KEY) throw new Error("Missing VITE_ATLAS_CLOUD_API_KEY");

    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(`${this.POLL_URL}/${predictionId}`, {
        headers: {
          "Authorization": `Bearer ${this.API_KEY}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Atlas polling failed: ${data?.error || response.statusText}`);
      }

      const status = data.data.status;

      if (status === "completed") {
        return data.data.outputs; // Typically an array of public URLs
      } else if (status === "failed") {
        throw new Error(`Atlas generation failed: ${data.data.error || 'Unknown error'}`);
      }

      // 2-second heartbeat
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Atlas polling timed out after ${maxAttempts * 2} seconds`);
  }

  /**
   * Phase 3: The Erato Wrapper
   * Synchronous-style wrapper to feed the MneOS pipelines directly.
   */
  public static async generateFleshwork(prompt: string, customModel?: string): Promise<string[]> {
    console.log("🔥 [AtlasVisionAdapter] Triggering FLUX fleshwork generation...");
    
    const predictionId = await this.trigger({
      prompt,
      model: customModel || "flux-kontext-dev-lora"
    });

    console.log(`⏱️ [AtlasVisionAdapter] Generation triggered (ID: ${predictionId}). Polling...`);
    
    const outputs = await this.poll(predictionId);
    
    console.log("✅ [AtlasVisionAdapter] Generation complete!", outputs);
    return outputs;
  }

  /**
   * Phase 4: Sovereign Identity Generation (Seedream v4.5)
   * Discovered during the Model Thunderdome. Uses 4K pixel mapping and multi-image references
   * to strictly preserve facial identity without Uncanny Valley distortions.
   */
  public static async generateIdentityPreserved(
    prompt: string, 
    referenceImages: string[], // Base64 or URLs (recommend [FullBody, Face1, Face2])
    strength: number = 0.65
  ): Promise<string[]> {
    console.log("🔥 [AtlasVisionAdapter] Triggering Seedream v4.5 Identity-Preserved generation...");
    
    const predictionId = await this.trigger({
      prompt,
      model: "bytedance/seedream-v4.5/edit",
      image: referenceImages,
      strength,
      size: "1024*4096" // Sovereign high-resolution lock for facial fidelity
    });

    console.log(`⏱️ [AtlasVisionAdapter] Identity Generation triggered (ID: ${predictionId}). Polling...`);
    
    const outputs = await this.poll(predictionId);
    
    console.log("✅ [AtlasVisionAdapter] Identity Generation complete!", outputs);
    return outputs;
  }
}
