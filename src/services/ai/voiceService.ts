// voiceService.ts
// [PROJECT GIGI] - Sovereign Vocal Orchestration Service
// Handles ElevenLabs Premium for Brita and Browser-Native for G.I.G.I.

import { SecretsManager } from '../../utils/SecretsManager';

export interface VoiceConfig {
    voiceId: string;
    stability: number;
    similarityBoost: number;
    style?: number;
}

const SOVEREIGN_FALLBACK_ID = "r57AN8sKRj1Zn7RPvGHV"; // Brita
const OPERATOR_FALLBACK_ID = "sJlLDm2rocmMVCYRvVk5"; // Eric (Operator Clone)

export const VoiceService = {
    /**
     * [PRIMARY] Speak the provided text using the appropriate provider.
     */
    speak: async (text: string, isPrimary: boolean = true, voiceId?: string, preferredModel?: string, speed: number = 1.0, isUser: boolean = false) => {
        if (!text) return;

        // 1. Determine Voice & Provider
        const activeVoiceId = voiceId || (isUser ? OPERATOR_FALLBACK_ID : SOVEREIGN_FALLBACK_ID);
        
        // [ZEN V35] Bicameral Logic: Detect tags to choose model if not specified
        const hasTags = /\[.*?\]/.test(text);
        const modelId = preferredModel || (hasTags ? "eleven_v3" : "eleven_turbo_v2_5");
        
        if (isPrimary) {
            // Brita/Operator Mode: Sovereign Alpha Proxy (xAI)
            await VoiceService.speakAlphaProxy(text, activeVoiceId, modelId, speed, isUser);
        } else {
            // G.I.G.I. Mode: Browser Native
            VoiceService.speakLocal(text);
        }
    },

    /**
     * [ARCHIVE] Download the spoken segment as an audio file.
     */
    download: async (text: string, isPrimary: boolean = true, voiceId?: string, preferredModel?: string, speed: number = 1.0, isUser: boolean = false) => {
        if (!text) {
            console.warn("[VoiceService] Download aborted: No text provided.");
            return;
        }

        const apiKey = SecretsManager.get('elevenlabs');
        const activeVoiceId = voiceId || (isUser ? OPERATOR_FALLBACK_ID : SOVEREIGN_FALLBACK_ID);
        
        // [ZEN V35] Bicameral Logic: Detect tags to choose model if not specified
        const hasTags = /\[.*?\]/.test(text);
        const modelId = preferredModel || (hasTags ? "eleven_v3" : "eleven_turbo_v2_5");

        console.log(`[VoiceService] 📥 Download request received. Voice: ${activeVoiceId}, Model: ${modelId}, Key Present: ${!!apiKey}`);

        if (isPrimary) {
            try {
                console.log(`[VoiceService] 🧬 Synthesizing archive segment via Alpha Proxy (Speed: ${speed})...`);
                const blob = await VoiceService.fetchAlphaProxyBlob(text, activeVoiceId, modelId, speed);
                
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                const fileName = VoiceService.getVoicePrintFileName(isUser ? 'Operator' : 'Brita');
                a.download = fileName;
                
                document.body.appendChild(a);
                a.click();
                
                console.log(`[VoiceService] ✅ Download triggered: ${fileName}`);
                
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            } catch (e) {
                console.error("[VoiceService] ❌ Download failed:", e);
                alert("Neural Audio Archive failed: Alpha Proxy connection error.");
            }
        } else {
            console.warn("[VoiceService] ⚠️ Local/GIGI segments do not support high-fidelity archiving currently.");
            alert("Local browser voices cannot be archived yet. Use Brita for vocal recording.");
        }
    },

    speakAlphaProxy: async (text: string, voiceId: string, modelId: string = "ara", speed: number = 1.0, isUser: boolean = false) => {
        try {
            console.log(`[VoiceService] 🎙️ Synthesizing ${isUser ? 'Operator' : 'Brita'}'s voice via Alpha Proxy at ${speed}x...`);
            const audioBlob = await VoiceService.fetchAlphaProxyBlob(text, voiceId, modelId, speed);
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            await audio.play();
            console.log(`[VoiceService] ✨ ${isUser ? 'Operator' : 'Brita'} is speaking.`);
        } catch (e) {
            console.error("[VoiceService] Alpha Proxy failed. Falling back to local TTS (Dead-zone transit).", e);
            VoiceService.speakLocal(text, speed);
        }
    },

    /**
     * [ZEN V35] Sovereign Syntax Filter
     * - Preserves Vocal Tags [ ] for the v3 engine.
     * - Keeps text inside Narrative Brackets { } but removes the brackets.
     * - Strips Meta (( )) entirely.
     */
    /**
     * [SOVEREIGN SYNTAX FILTER]
     * - Preserves Vocal Tags [ ] for the v3 engine if requested.
     * - Keeps text inside Narrative Brackets { } but removes the brackets.
     * - Strips Meta (( )) entirely.
     */
    prepareSynthesisText: (text: string, stripTags: boolean = false) => {
        let cleaned = text
            .replace(/\(\(.*?(\)\)|$)/g, '') // Strip Meta (( ))
            .replace(/\{(.*?)\}/g, '$1');    // Clean Narrative { } but keep text
        
        if (stripTags) {
            cleaned = cleaned.replace(/\[.*?\]/g, ''); // Strip Vocal Tags [ ]
        }

        return cleaned.trim();
    },

    /**
     * [INTERNAL] Helper to fetch audio blob from Alpha Proxy.
     */
    fetchAlphaProxyBlob: async (text: string, voiceId: string, modelId: string = "ara", speed: number = 1.0): Promise<Blob> => {
        // [ZEN V35] Apply Sovereign Syntax Filter
        // Strip tags since xAI's Ara doesn't use ElevenLabs prompt engineering syntax
        const filteredText = VoiceService.prepareSynthesisText(text, true);

        // We now allow full-length prose to ensure archive integrity.
        const speechText = filteredText.length > 10000 ? filteredText.substring(0, 10000) + "..." : filteredText;
        
        // ADR-022: Sovereign Mobile Voice Architecture
        // All TTS is hard-routed to the Alpha Proxy (GGA) at 100.116.12.18:3334.
        const ALPHA_PROXY_URL = 'http://100.116.12.18:3334/api/tts';
        
        const response = await fetch(ALPHA_PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: speechText,
                voice_id: 'ara' // Forced to Ara per ADR-022
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Alpha Proxy Error: ${response.statusText}`);
        }
        return await response.blob();
    },

    /**
     * [UTILITY] Generate the requested filename schema for Vocal Prints.
     * AI Companion Name__VoicePrint_YYYYMMDD_seq
     */
    getVoicePrintFileName: (companionName: string, sequence: number = 1) => {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
        const seqStr = sequence.toString().padStart(3, '0');
        const cleanName = companionName.replace(/\s+/g, '_');
        return `${cleanName}__VoicePrint_${dateStr}_${seqStr}.mp3`;
    },

    /**
     * [SOVEREIGN] Browser-Native Speech Synthesis
     * Clinical, free, and unlimited for G.I.G.I. and fallbacks.
     */
    speakLocal: (text: string, speed: number = 1.0) => {
        if (!window.speechSynthesis) return;

        // Cancel existing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Find a suitable "Clinical/System" voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Microsoft Zira'));
        
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.rate = speed;
        utterance.pitch = 1.0;

        window.speechSynthesis.speak(utterance);
        console.log(`[VoiceService] 🤖 G.I.G.I. (Local) is speaking at ${speed}x.`);
    },

    stop: () => {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
};

export default VoiceService;
