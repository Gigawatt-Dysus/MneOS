import { getAuth } from 'firebase/auth';

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
    private readonly PROXY_URL = 'https://us-central1-gigi-time-machine.cloudfunctions.net/proxyGooglePhoto';
    private readonly LINK_URL = 'https://us-central1-gigi-time-machine.cloudfunctions.net/linkGooglePhotos';
    private readonly MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB Cap

    constructor() {
        console.log("[GooglePhotos] Service v20 (Zen Metadata Hoarder) initialized.");
    }

    // --- Public API ---

    async startPickerSession(): Promise<PickerSession> {
        try {
            return await this.createSession();
        } catch (e: any) {
            if (e.message.includes("AUTH_REQUIRED") || e.message.includes("401")) {
                console.log("⚠️ [GooglePhotos] Auth missing. Launching Link Flow...");
                await this.linkAccount();
                return await this.createSession();
            }
            throw e;
        }
    }

    async waitForUserSelection(sessionId: string): Promise<boolean> {
        console.log("⏳ [Poll] Waiting for user selection...");
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const check = async () => {
                if (attempts++ > 600) {
                    reject("Timeout");
                    return;
                }
                try {
                    const data = await this.callProxy(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, 'GET');
                    if (data.mediaItemsSet) {
                        console.log("✅ [Poll] Selection detected!");
                        resolve(true);
                    } else setTimeout(check, 1000);
                } catch (e) {
                    setTimeout(check, 1000);
                }
            };
            check();
        });
    }

    async finishImport(sessionId: string): Promise<File[]> {
        const mediaItems = await this.listPickedItems(sessionId);
        console.log(`➡️ [Download] Starting sequential batch download of ${mediaItems.length} items...`);
        
        const results: File[] = [];
        const BATCH_SIZE = 3;

        for (let i = 0; i < mediaItems.length; i += BATCH_SIZE) {
            const batch = mediaItems.slice(i, i + BATCH_SIZE);
            console.log(`   Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(mediaItems.length / BATCH_SIZE)} (${batch.length} items)...`);
            
            const batchFiles = await Promise.all(
                batch.map(item => this.downloadViaProxy(item).catch(e => {
                    console.error(`Failed to download item ${item.id}`, e);
                    return null;
                }))
            );
            results.push(...batchFiles.filter((f): f is File => f !== null));
        }
        return results;
    }

    // --- Internal ---

    private async linkAccount(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            if (!this.codeClient) await this.initCodeClient();
            this.codeClient.requestCode();
            (window as any).onGoogleLinkSuccess = resolve;
            (window as any).onGoogleLinkError = reject;
        });
    }

    private initCodeClient(): Promise<void> {
        return new Promise((resolve, reject) => {
            const init = () => {
                if (!window.google?.accounts) {
                    reject("GIS script missing");
                    return;
                }
                this.codeClient = window.google.accounts.oauth2.initCodeClient({
                    client_id: '459534779564-bp6l3b1cncl53cbh5eu7m6q0ng96bsmh.apps.googleusercontent.com',
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
        const uid = getAuth().currentUser?.uid;
        if (!uid) throw new Error("No User Logged In");
        
        const response = await fetch(this.LINK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, uid })
        });
        if (!response.ok) throw new Error(await response.text());
    }

    private async callProxy(endpoint: string, method: 'GET' | 'POST', body?: any): Promise<any> {
        const uid = getAuth().currentUser?.uid;
        if (!uid) throw new Error("User not logged in");

        const payload: any = { endpoint, method, uid };
        if (method !== 'GET') payload.body = body;

        const response = await fetch(this.PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.status === 401) throw new Error("AUTH_REQUIRED");
        if (!response.ok) throw new Error(await response.text());
        return await response.json();
    }

    private async createSession(): Promise<PickerSession> {
        const data = await this.callProxy('https://photospicker.googleapis.com/v1/sessions', 'POST', {});
        const uri = new URL(data.pickerUri);
        uri.searchParams.set('autoClose', 'true'); 
        if (!uri.pathname.endsWith('/autoclose')) {
            uri.pathname = uri.pathname.replace(/\/+$/, '') + '/autoclose';
        }
        return { id: data.id, pickerUri: uri.toString() };
    }

    private async listPickedItems(sessionId: string): Promise<PickerMediaItem[]> {
        let allItems: PickerMediaItem[] = [];
        let pageToken: string | undefined = undefined;
        let pageCount = 0;

        do {
            pageCount++;
            let url = `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}&pageSize=100`;
            if (pageToken) {
                url += `&pageToken=${pageToken}`;
            }
            console.log(`📑 [GooglePhotos] Fetching manifest page ${pageCount}...`);
            const data = await this.callProxy(url, 'GET');
            if (data.mediaItems) {
                allItems = [...allItems, ...data.mediaItems];
            }
            pageToken = data.nextPageToken;
        } while (pageToken);

        console.log(`✅ [GooglePhotos] Manifest complete. Total items: ${allItems.length}`);
        return allItems;
    }

    private async downloadViaProxy(item: PickerMediaItem): Promise<File> {
        const uid = getAuth().currentUser?.uid;
        const fileData = item.mediaFile;
        
        if (!fileData || !fileData.baseUrl) throw new Error("Invalid Media Item Structure");

        const mimeType = fileData.mimeType || 'image/jpeg';
        let extension = '.jpg';
        if (mimeType === 'video/mp4') extension = '.mp4';
        else if (mimeType === 'video/quicktime') extension = '.mov';
        else if (mimeType === 'image/png') extension = '.png';
        else if (mimeType === 'image/gif') extension = '.gif';
        else if (mimeType === 'image/heic') extension = '.heic';

        let safeName = fileData.filename;
        if (!safeName) {
            safeName = `google-media-${Date.now()}${extension}`;
        } else {
            if (!safeName.includes('.')) safeName += extension;
        }
        safeName = safeName.replace(/[^a-zA-Z0-9._-]/g, '_');

        const downloadUrl = `${fileData.baseUrl}=d`;

        const response = await fetch(this.PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: downloadUrl, uid })
        });

        if (!response.ok) throw new Error("Download Failed");

        const contentLength = response.headers.get('Content-Length');
        if (contentLength) {
            const size = parseInt(contentLength, 10);
            if (size > this.MAX_FILE_SIZE_BYTES) {
                throw new Error(`File too large for browser import (${(size / 1024 / 1024).toFixed(0)}MB). Limit is 500MB.`);
            }
        }

        const blob = await response.blob();
        if (blob.size === 0) throw new Error("Zero-byte file received.");

        // [ZEN IMPLEMENTATION] ROBUST METADATA RECOVERY
        // We capture everything Google gives us for future use
        let creationTime: number | null = null;
        let rawTimeString: string | undefined = undefined;

        // DEBUG LOGGING
        console.log(`🕵️ [GooglePhotos] Analyzing Metadata for: ${safeName}`, {
            mediaMetadata: item.mediaMetadata,
            createTime: item.createTime,
            mediaFileMeta: item.mediaFile.mediaFileMetadata
        });

        // Priority 1: Top-level standard metadata (API v1 standard)
        if (item.mediaMetadata && item.mediaMetadata.creationTime) {
            rawTimeString = item.mediaMetadata.creationTime;
        } 
        // Priority 2: Root property (Found in some API responses)
        else if (item.createTime) {
            rawTimeString = item.createTime;
        } 
        // Priority 3: Nested file metadata (Legacy/Fallback)
        else if (item.mediaFile.mediaFileMetadata && item.mediaFile.mediaFileMetadata.creationTime) {
            rawTimeString = item.mediaFile.mediaFileMetadata.creationTime;
        }

        if (rawTimeString) {
            const parsed = new Date(rawTimeString).getTime();
            if (!isNaN(parsed)) {
                creationTime = parsed;
                console.log(`   ✅ Valid Creation Time: ${rawTimeString}`);
            }
        } else {
            console.warn(`   ⚠️ NO TIMESTAMP FOUND for ${safeName}. defaulting to Now.`);
        }

        // Create file with the recovered date as LastModified
        const file = new File([blob], safeName, {
            type: mimeType,
            lastModified: creationTime || Date.now()
        });

        // --- ATTACH METADATA PAYLOAD TO FILE OBJECT ---
        // This ensures the data travels with the Blob to the Staging Area
        
        if (creationTime) {
            Object.defineProperty(file, 'gigi_creationTime', { value: creationTime, writable: true, enumerable: true });
            // Explicit flag for the DateSanitizer to verify this file is "Trusted"
            Object.defineProperty(file, 'gigi_trustedDate', { value: true, writable: true, enumerable: true });
        }

        // Store the FULL Google Metadata object for future use
        if (item.mediaMetadata) {
             Object.defineProperty(file, 'gigi_googleMetadata', { 
                 value: item.mediaMetadata, 
                 writable: true, 
                 enumerable: true 
             });
        }

        // Extract Dimensions for immediate use
        const width = item.mediaMetadata?.width || item.mediaFile.mediaFileMetadata?.width;
        const height = item.mediaMetadata?.height || item.mediaFile.mediaFileMetadata?.height;

        if (width && height) {
            const w = parseInt(width, 10);
            const h = parseInt(height, 10);
            if (!isNaN(w) && !isNaN(h)) {
                Object.defineProperty(file, 'width', { value: w, writable: true, enumerable: true });
                Object.defineProperty(file, 'height', { value: h, writable: true, enumerable: true });
            }
        }

        Object.defineProperty(file, 'source', { value: 'google-photos-picker', writable: true, enumerable: true });
        Object.defineProperty(file, 'preview', { value: URL.createObjectURL(file), writable: true, enumerable: true });
        Object.defineProperty(file, 'path', { value: safeName, writable: true, enumerable: true });

        return file;
    }
}

export const googlePhotosService = new GooglePhotosService();