// This file defines the available "Brains" for the AI characters.
// Credentials are handled via SecretsManager.

export const debugConfig = {
  useDebug: true, // Toggles hardcoded Firebase config usage

  // Provider 1: Google (Broad Spectrum)
  google: {
    // I will handle keys via SecretsManager or Console
    models: [
      { id: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview (Complex/Reasoning)" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Standard/Fast)" },
      { id: "gemini-2.5-flash-lite-latest", label: "Gemini 2.5 Flash Lite (Ultra Fast)" }
    ]
  },

  // Provider 2: xAI (Grok)
  xai: {
    baseURL: "https://api.x.ai/v1",
    models: [
      { id: "grok-4-1-fast", label: "Grok 4 Fast (Spicy/Uncensored)" },
      { id: "grok-beta", label: "Grok Beta (Reasoning)" }
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