# ADR-022: Sovereign Mobile Voice Architecture (TTS/STT)

## Status
Proposed / Accepted (July 19, 2026) -> (Amended July 19, 2026: Alpha Proxy Pivot)

## Context
The Erato Mobile Application requires bidirectional voice capabilities (Speech-to-Text and Text-to-Speech) to facilitate immersive, hands-free interaction with the Sovereign Brita persona.
Previously, the architecture called for local inference (XTTSv2) on the primary Victus laptop (MneOS-Prime). However, the laptop's presence in a thermally hostile environment (130°F Jeep) and dependence on unstable 5G hotspots during commutes made this structurally unviable. Furthermore, the discovery of the xAI TTS "Ara" voice provides a 1:1 match for the Brita persona with zero censorship and extreme cost efficiency.

## Decision
We will deploy the **Sovereign Alpha Proxy** architecture. Gigi-Genesis-Alpha (GGA), a headless, always-on node sitting on a 1 GB/s fiber connection in the Genesis Cluster, will serve as the exclusive backend proxy for the Android client.

### 1. TTS Engine (The Voice of Brita)
- **Engine:** xAI TTS API (`api.x.ai/v1/tts`), specifically the "Ara" voice.
- **Hardware Routing:** The Android App (Client) transmits the transcript to the Alpha node (GGA) via WebSockets/REST over Tailscale or an exposed port. Alpha securely appends the `XAI_API_KEY` (stored locally on Alpha) and routes the request to the xAI endpoint.
- **Delivery:** Alpha streams the resulting audio chunk back to the Android client for near-zero latency playback. 
- **Security:** The API key never touches the Android APK, and Firebase is completely eliminated from the architecture.

### 2. STT Engine (Transcription)
- **Engine:** (To be determined/migrated - likely Android native STT or routed through Alpha to a cloud endpoint or local Whisper instance on the cluster).
*(Note: Maintain placeholder for STT architectural finalization).*

### 3. Transcript Sanitization (The Noise Filter)
- **Sanitization Layer:** Before the transcript is passed to the primary Qwen 35B brain (OpenRouter), Alpha will run a lightweight sanitization proxy call to fix noisy environments and typos, ensuring pristine LLM context windows.

## Consequences
- **Positive:** 100% Uptime for Brita voice generation, completely independent of the Victus laptop's state or location.
- **Positive:** Zero thermal or computational load on the mobile device or the Victus.
- **Positive:** API keys are secured on a headless server locked in the datacenter (house).
- **Positive:** Eradicates any dependence on Firebase.
- **Negative:** Introduces a dependency on the xAI API (mitigated by lack of censorship and exact voice match).
