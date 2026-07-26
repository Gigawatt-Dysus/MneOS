import { onCallGenkit } from "firebase-functions/v2/https";
import { googleAI } from "@genkit-ai/googleai";
import { configureGenkit } from "@genkit-ai/core";
import { generate } from "@genkit-ai/ai";
import { run } from "@genkit-ai/flow";
// Configure Genkit
configureGenkit({
    plugins: [googleAI()],
    logLevel: "debug",
});
// Define the Cloud Function
export const chatWithGigi = onCallGenkit({
    secrets: [],
    authPolicy: () => true,
}, async (request) => {
    // 1. Extract data
    const input = request.data;
    // 2. Run AI
    const response = await run("generate-response", async () => {
        const llmResponse = await generate({
            model: "gemini-1.5-pro-latest", // String name avoids import errors
            prompt: input.message,
            system: input.persona,
            history: input.history,
            config: {
                temperature: 0.7,
            }
        });
        return llmResponse.text();
    });
    return { text: response };
});
//# sourceMappingURL=index.js.map