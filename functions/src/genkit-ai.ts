
import { genkit } from "genkit";
import { vertexAI } from "@genkit-ai/google-genai";
import { xAI } from "@genkit-ai/compat-oai/xai";

// [ZEN] Lazy Initialization to prevent Boot Crashes
let _ai: any = null;

export const getAI = (useApiKey: boolean = false) => {
    // [ZEN] Eric has confirmed GCP Billing is ACTIVE.
    // We are using Vertex AI exclusively to avoid the AI Studio "Prepay Trap".
    return genkit({
        plugins: [
            vertexAI({
                projectId: "gigi-time-machine",
                location: "global" // [ZEN FIX] Docs say 3.1 is in 'global' region
            }),
            xAI({ apiKey: process.env.XAI_API_KEY || "placeholder_for_deploy" })
        ],
        // [ZEN 2026] Native Vertex 3.1 ID confirmed via Eric's documentation audit
        model: "vertexai/gemini-3.1-flash-lite-preview", 
    });
};

// [ZEN] Legacy export for compatibility (now lazy)
export const ai = new Proxy({} as any, {
    get: (target, prop) => {
        return (getAI() as any)[prop];
    }
});

export const xaiGrok = xAI.model("grok-beta");
