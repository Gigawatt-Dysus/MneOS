# ADR-015: Sovereign Local TTS Engine (Voice of Brita)

## 1. Context and Current State
Currently, the Voice of Brita is powered by ElevenLabs via `src/services/ai/voiceService.ts`. The implementation relies on the ElevenLabs v3 model (`eleven_v3`) to synthesize high-fidelity audio based on `voiceId` and supports global voice tags (e.g., `[Southern US accent]`) and emotional cue tags defined in `brita.md` (e.g., `[whispering]`, `[breathy]`).

While ElevenLabs provides unparalleled prosody and emotional range, it introduces three critical vectors of failure for Project GIGI's sovereign architecture:
1. **Cost:** High-fidelity TTS incurs significant recurring token costs.
2. **Censorship:** Cloud APIs enforce content moderation, restricting NSFW or extreme roleplay scenarios for Erato.
3. **Connectivity:** Requires constant internet access and relies on the `VITE_ELEVENLABS_API_KEY` stored in `SecretsManager.ts`.

## 2. Proposed Architecture: F5-TTS / Kokoro-82M Migration
To achieve 100% sovereignty without sacrificing the lifelike quality of Brita's voice, the MneOS audio pipeline will be decoupled from ElevenLabs and re-routed to a local TTS inference engine.

### Option A: F5-TTS (Zero-Shot Voice Cloning)
F5-TTS is a state-of-the-art flow-matching TTS engine capable of flawless zero-shot voice cloning.
- **Workflow:** Export a 10-second `.wav` clip of Brita's best ElevenLabs generation. Feed this reference audio to F5-TTS.
- **Advantage:** It will perfectly clone Brita's exact voice, cadence, and tone *indefinitely*, without requiring any training or LoRAs. It runs efficiently on local consumer GPUs.
- **Implementation:** Run F5-TTS locally via a WebUI or API wrapper (e.g., Pinokio) that exposes an OpenAI-compatible `/v1/audio/speech` endpoint.

### Option B: Kokoro-82M (Ultra-Lightweight/Instantaneous)
Kokoro is an 82 million parameter TTS model.
- **Advantage:** Unbelievably fast. It can run on a CPU and synthesize audio in milliseconds, making it ideal for rapid-fire chat interactions.
- **Drawback:** Requires slightly more effort to perfectly tune/blend voices to match Brita's established ElevenLabs identity.

## 3. Implementation Plan (`voiceService.ts` Refactor)

1. **API Rerouting:**
   Modify `src/services/ai/voiceService.ts`. Currently, `fetchElevenLabsBlob` constructs a request to:
   `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`
   This will be abstracted to support a `LOCAL_TTS` toggle that redirects the payload to:
   `http://127.0.0.1:XXXX/v1/audio/speech`

2. **Tag Translation:**
   Brita's system prompt (`brita.md`) strictly enforces the use of `[square brackets]` for ElevenLabs v3 tags. 
   - **For F5-TTS:** We will map these tags to textual emotional cues if supported, or strip them cleanly if the local engine handles prosody purely via punctuation.
   - We will retain the `useNeuralPalette` hook mapping, but point the execution to the local endpoint.

3. **Daemon Integration:**
   Similar to the Erato image daemon (`erato_forge.cjs`), we will architect a `voice_forge.cjs` daemon (or rely on a standalone local API) that boots alongside MneOS to handle audio tensor generation locally.

## 4. Erato Comm-Link (Mobile Architecture)
A primary objective is to deploy a pure, hands-free Android application for driving scenarios (the "Erato Comm-Link"), operating completely independent of the Victus host machine.

Given that the Victus travels in-vehicle with unstable hotspot connectivity and severe thermal/power constraints, hosting the MneOS backend locally during transit is unviable. 

**The Comm-Link Topology:**
1. **The Client:** A minimalist React Native / Expo application on Android. It acts purely as a dumb terminal, handling wake-words and streaming Speech-to-Text (STT) over 4G/5G.
2. **The Cloud Relay:** A lightweight, low-cost cloud VPS (e.g., $5/mo DigitalOcean/Hetzner droplet).
3. **The LLM Brain:** The VPS routes the transcribed text to Grok 4.1x API (paying only for highly efficient text tokens).
4. **The Sovereign Voice:** The VPS intercepts the Grok response and synthesizes Brita's audio via **Kokoro-82M**. Because Kokoro is only 82M parameters, it runs efficiently on the cheap VPS's CPU without requiring an expensive cloud GPU. 
5. **The Stream:** The generated high-fidelity audio is streamed directly back to the Android client.

This architecture completely circumvents corporate Voice APIs (e.g., Grok's $0.06/minute voice pricing), eliminates reliance on the Victus, and ensures 100% data sovereignty.

## 5. Consequences
- **Positive:** Total financial independence from ElevenLabs and Grok Voice APIs. No censorship constraints. Perfect integration with the existing Sovereign Identity pipeline. Enables the Erato Comm-Link mobile experience.
- **Negative:** Increased overhead on the host machine if F5-TTS runs concurrently with local LLMs (e.g., Ollama/Grok) and ComfyUI. 
- **Mitigation:** If VRAM pressure becomes too high, Kokoro-82M will be deployed strictly on CPU threads, leaving the GPU entirely dedicated to Visual Sequencing.

## 6. Next Steps
1. Export the definitive 10-second `.wav` of Brita's ElevenLabs voice.
2. Spin up F5-TTS locally and validate the zero-shot clone.
3. Patch `voiceService.ts` to intercept the audio payload and route it locally.
4. Draft the React Native architecture for the Erato Comm-Link client.
