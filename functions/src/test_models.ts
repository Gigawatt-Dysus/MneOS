import { getAI } from "./genkit-ai";

async function listModels() {
    try {
        const ai = getAI();
        console.log("Detecting available models...");
        // Genkit doesn't have a direct "listModels" for plugins easily without internal access
        // but we can try to generate with a common one to test access
        const testModels = [
            "gemini-3.1-flash-lite-preview",
            "gemini-2.0-flash-exp",
            "gemini-1.5-flash",
            "gemini-1.5-pro"
        ];

        for (const m of testModels) {
            try {
                console.log(`Testing ${m}...`);
                await ai.generate({
                    model: `vertexai/${m}`,
                    prompt: "hi",
                    config: { maxOutputTokens: 5 }
                });
                console.log(`✅ ${m} is AVAILABLE`);
            } catch (e: any) {
                console.log(`❌ ${m} is UNAVAILABLE: ${e.message}`);
            }
        }
    } catch (e) {
        console.error("Diagnostic failed:", e);
    }
}

listModels();
