import { getAuth } from 'firebase/auth';
import { SecretsManager } from '../utils/SecretsManager';
import { TEMPORAL_SHOEBOX_DATE } from '../types/constants';

// [ZEN IMPLEMENTATION] Expanded interfaces to capture FULL Google Metadata
export interface GooglePhotoMetadata {
    cameraMake?: string;
    cameraModel?: string;
    focalLength?: number;
    apertureFNumber?: number;
    isoEquivalent?: number;
    exposureTime?: string;
}

export interface GoogleVideoMetadata {
    cameraMake?: string;
    cameraModel?: string;
    fps?: number;
    status?: string;
}

export interface PickerMediaItem {
    id: string;
    productUrl?: string;
    baseUrl?: string;
    mimeType?: string;
    filename?: string;
    // Option A: Top-level timestamp (common in some responses)
    createTime?: string;
    // Option B: Top-level metadata object (The Standard)
    mediaMetadata?: {
        creationTime?: string;
        width?: string;
        height?: string;
        photo?: GooglePhotoMetadata;
        video?: GoogleVideoMetadata;
    };
    // Option C: Nested inside mediaFile (Legacy/Alternative)
    mediaFile: {
        baseUrl: string;
        mimeType: string;
        filename: string;
        mediaFileMetadata?: {
            creationTime?: string;
            width?: string;
            height?: string;
        };
    };
}

export interface PickerSession {
    id: string;
    pickerUri: string;
}

declare global {
    interface Window {
        google?: any;
    }
}

export class GooglePhotosService {
    private readonly SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
    private codeClient: any;
    private readonly PROXY_URL = 'http://127.0.0.1:5001/lifeos-local/us-central1/proxyGooglePhoto';
    private readonly LINK_URL = 'http://127.0.0.1:5001/lifeos-local/us-central1/linkGooglePhotos';
    private readonly MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB Cap

    constructor() {
        // [CLEARED]
    }

    // --- Public API ---

    async startPickerSession(): Promise<PickerSession> {
        try {
            return await this.createSession();
        } catch (e: any) {
            if (e.message.includes("AUTH_REQUIRED") || e.message.includes("401")) {
                console.log("⚠️ [GooglePhotos] Auth missing. User must initiate connection.");
                // We no longer auto-launch to avoid popup blocking
                throw new Error("GOOGLE_AUTH_REQUIRED");
            }
            throw e;
        }
    }

    async waitForUserSelection(sessionId: string, pickerWindow?: Window | null): Promise<boolean> {
        console.log("⏳ [Poll] Waiting for user selection...");
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const check = async () => {
                try {
                    const data = await this.callProxy(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, 'GET');
                    if (data.mediaItemsSet) {
                        console.log("✅ [Poll] Selection detected!");
                        resolve(true);
                        return;
                    }
                } catch (e) {
                    // Ignore errors during polling
                }

                // [ZEN] Dead-man's switch: Only abort if we haven't detected a selection yet
                if (pickerWindow && pickerWindow.closed) {
                    console.log("⚠️ [Poll] Window reports closed. Entering 45-second forensic grace period...");
                    
                    // Google can be slow to update the session state — especially with multiple
                    // images selected. 10s was too tight; 45s gives the API room to breathe.
                    for (let i = 0; i < 45; i++) {
                        await new Promise(r => setTimeout(r, 1000));
                        try {
                            const data = await this.callProxy(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, 'GET');
                            console.log(`[Poll] Session ${sessionId} Check ${i+1}/45:`, data.mediaItemsSet ? '✅ SET' : '⏳ waiting...');
                            
                            if (data.mediaItemsSet) {
                                console.log("✅ [Poll] Selection detected during grace period!");
                                resolve(true);
                                return;
                            }
                        } catch (e) {
                            console.warn(`[Poll] Grace check ${i+1} failed:`, e);
                        }
                    }

                    console.log("🛑 [Poll] Window closed and no selection found after 45s. Aborting.");
                    resolve(false);
                    return;
                }

                if (attempts++ > 600) {
                    reject(new Error("Timeout"));
                    return;
                }
                
                setTimeout(check, 1000);
            };
            check();
        });
    }

    async finishImport(sessionId: string): Promise<{ success: boolean; jobId: string; totalItems: number }> {
        const uid = getAuth().currentUser?.uid?.trim();
        if (!uid) throw new Error("AUTH_REQUIRED");

        console.log(`➡️ [IngestionEngine] Handing off session ${sessionId} to GIGI Ingestion Engine...`);

        const INGEST_URL = 'http://127.0.0.1:5001/lifeos-local/us-central1/ingestGooglePhotosSession';
        
        const response = await fetch(INGEST_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, userId: uid })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Batch Ingestion Handoff Failed");
        }

        const data = await response.json();
        console.log(`✅ [IngestionEngine] Handoff complete. Job ID: ${data.jobId}`);
        return data;
    }

    // Deprecated: Moving logic to backend ingestion engine
    private async sideloadViaProxy(item: PickerMediaItem): Promise<any> {
        console.warn("[Legacy] sideloadViaProxy is deprecated. Use finishImport for batch ingestion.");
        return null;
    }

    async checkLinkStatus(): Promise<boolean> {
        try {
            // [ZEN] We ping a valid Google endpoint.
            // If the proxy returns anything EXCEPT 401, our token handshake is healthy.
            await this.callProxy('https://www.googleapis.com/oauth2/v3/tokeninfo', 'GET');
            return true;
        } catch (e: any) {
            // [ZEN] We only treat 401 as 'Unlinked'. 404/403 means the token is fine but endpoint is restricted.
            if (e.message?.includes("401") || e.message?.includes("AUTH_REQUIRED")) {
                console.log("ℹ️ [GooglePhotos] Status: Unlinked or Session Expired.");
                return false;
            }
            return true; // Token is alive!
        }
    }

    // --- Internal ---

    async connect(): Promise<void> {
        console.log("🚀 [GooglePhotos] Initiating manual Auth flow...");
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.codeClient) await this.initCodeClient();
                this.codeClient.requestCode();
                (window as any).onGoogleLinkSuccess = resolve;
                (window as any).onGoogleLinkError = reject;
            } catch (err) {
                reject(err);
            }
        });
    }

    private initCodeClient(): Promise<void> {
        return new Promise((resolve, reject) => {
            const init = () => {
                if (!window.google?.accounts) {
                    reject("GIS script missing");
                    return;
                }
                const clientId = SecretsManager.get('google_client_id') || '459534779564-bp6l3b1cncl53cbh5eu7m6q0ng96bsmh.apps.googleusercontent.com';

                this.codeClient = window.google.accounts.oauth2.initCodeClient({
                    client_id: clientId,
                    scope: this.SCOPE,
                    ux_mode: 'popup',
                    callback: async (response: any) => {
                        if (response.code) {
                            try {
                                await this.sendCodeToBackend(response.code);
                                if ((window as any).onGoogleLinkSuccess) (window as any).onGoogleLinkSuccess();
                            } catch (err) {
                                if ((window as any).onGoogleLinkError) (window as any).onGoogleLinkError(err);
                            }
                        }
                    },
                });
                resolve();
            };
            if (window.google?.accounts) init(); else setTimeout(init, 1000);
        });
    }

    private async sendCodeToBackend(code: string) {
        const uid = getAuth().currentUser?.uid?.trim();
        if (!uid) throw new Error("No User Logged In");

        const response = await fetch(this.LINK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, uid })
        });
        if (!response.ok) throw new Error(await response.text());
    }

    private async callProxy(endpoint: string, method: 'GET' | 'POST', body?: any): Promise<any> {
        const uid = getAuth().currentUser?.uid?.trim();
        if (!uid) throw new Error("User not logged in");

        const payload: any = { endpoint, method, uid };
        if (method !== 'GET') payload.body = body;

        const response = await fetch(this.PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.status === 401) {
            console.warn("⚠️ [GooglePhotos] Unauthorized/Revoked. Clearing local state cache.");
            throw new Error("AUTH_REQUIRED");
        }
        
        if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ [GooglePhotos] Proxy Error (${response.status}):`, errText);
            throw new Error(errText || "Proxy Failed");
        }
        return await response.json();
    }

    private async createSession(): Promise<PickerSession> {
        const data = await this.callProxy('https://photospicker.googleapis.com/v1/sessions', 'POST', {});
        const uri = new URL(data.pickerUri);
        // [ZEN] We don't use autoClose because we want to control the lifecycle and prevent race conditions with the poller
        return { id: data.id, pickerUri: uri.toString() };
    }

    // [ZEN V34] LIBRARIAN SEARCH STUB
    // This will be expanded to use the Google Photos Library API search endpoint
    // once the 'photoslibrary.readonly' scope is approved by the user.
    async searchPhotos(query: string): Promise<any[]> {
        console.log(`[GooglePhotos] 🔍 Librarian search for "${query}" - Scope currently restricted to Picker.`);
        return []; 
    }
}

export const googlePhotosService = new GooglePhotosService();