
// This file defines the available "Brains" for the AI characters.
// Credentials are handled via SecretsManager.

export const debugConfig = {
  useDebug: true, // Toggles hardcoded Firebase config usage

  // Provider 1: xAI (Grok)
  xai: {
    baseURL: "https://api.x.ai/v1",
    models: [
      { id: "grok-4.3", label: "Grok 4.3 (Flagship)" },
      { id: "grok-4.20-multi-agent", label: "Grok 4.2 Multi-Agent (Collective)" },
      { id: "grok-4.20-0309-reasoning", label: "Grok 4.20 Reasoning" },
    ]
  },

  // Provider 3: Local (Ollama)
  local: {
    enabled: false, // Disabled by default to prevent "Failed to fetch" errors
    url: "http://localhost:11434/v1",
    mainModel: "wetdream",        // 70B Custom Model
    timeout: 900000 // 15 Minutes
  },

  // Placeholder Firebase Config (Overridden by SecretsManager if injected)
  firebase: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID",
  }
};
