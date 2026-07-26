import { callXAI } from '../services/ai/providers';
import { SecretsManager } from './SecretsManager';

const testGrok = async () => {
    console.log("Starting Grok API diagnostic...");
    
    // 1. Check API Key
    const xaiEnv = process.env.VITE_XAI_API_KEY || "";
    console.log(`VITE_XAI_API_KEY exists: ${!!xaiEnv}`);
    if (xaiEnv) {
        console.log(`Key Fingerprint: ${xaiEnv.substring(0, 10)}...`);
    }

    try {
        console.log("Calling callXAI with 'grok-4.3'...");
        const response = await callXAI(
            "grok-4.3",
            [{ role: 'user', parts: [{ text: "Hello! Return a single word 'SUCCESS' if you read this." }] }],
            "You are a diagnostic assistant."
        );
        console.log("Success! Response text:", response.text);
    } catch (e: any) {
        console.error("Grok Call Failed!");
        console.error("Error Name:", e.name);
        console.error("Error Message:", e.message);
        console.error("Full Error:", e);
    }
};

testGrok();
