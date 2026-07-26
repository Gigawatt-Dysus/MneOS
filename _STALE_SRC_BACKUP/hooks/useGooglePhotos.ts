import { useState, useRef, useCallback } from 'react';
import { googlePhotosService } from '../services/googlePhotosService';

export type ImportStep = 'init' | 'ready' | 'polling' | 'downloading' | 'error';

export const useGooglePhotos = (
    onStageFiles: (files: File[]) => void, 
    onNavigate: (view: any) => void
) => {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<ImportStep>('init');
    const [pickerUrl, setPickerUrl] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    
    // [ZEN] Store popup reference to force-close it
    const popupRef = useRef<Window | null>(null);

    // [ZEN] Pre-Flight Integrity Check
    const verifyFiles = async (files: File[]): Promise<boolean> => {
        console.log(`🔍 [UseGooglePhotos] Integrity Check: Scanning ${files.length} files...`);
        try {
            await Promise.all(files.map(file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(true);
                reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
                reader.readAsArrayBuffer(file.slice(0, 1)); 
            })));
            console.log("✅ [UseGooglePhotos] Integrity Check: PASSED. Files are readable.");
            return true;
        } catch (e) {
            console.error("❌ [UseGooglePhotos] Integrity Check: FAILED.", e);
            return false;
        }
    };

    const closePopup = useCallback(() => {
        if (popupRef.current && !popupRef.current.closed) {
            console.log("🔒 [UseGooglePhotos] Force Closing Picker Window");
            popupRef.current.close();
            popupRef.current = null;
        }
    }, []);

    const getPopupFeatures = () => {
        const width = 1000;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        return `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
    };

    // [ZEN UX] Inject a dark-mode loader so the user doesn't see a white flash
    const injectLoader = (targetWindow: Window) => {
        const html = `
            <!DOCTYPE html>
            <html style="background: #020617; color: white; font-family: sans-serif; height: 100%;">
            <head><title>Secure Link</title></head>
            <body style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; margin: 0;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                <h2 style="margin-top: 20px; font-weight: 300; letter-spacing: 1px; color: #94a3b8;">ESTABLISHING SECURE UPLINK...</h2>
                <style>@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>
            </body>
            </html>
        `;
        targetWindow.document.open();
        targetWindow.document.write(html);
        targetWindow.document.close();
    };

    // [ZEN FIX] Unified Polling Logic
    const startPolling = useCallback((sid: string) => {
        setStep('polling');
        
        (async () => {
            try {
                const success = await googlePhotosService.waitForUserSelection(sid);
                
                if (success) {
                    closePopup(); // Kill window immediately
                    setStep('downloading');
                    
                    const files = await googlePhotosService.finishImport(sid);
                    
                    const isHealthy = await verifyFiles(files);

                    setIsOpen(false);
                    
                    if (files.length > 0 && isHealthy) {
                        console.group("🚀 [UseGooglePhotos] STAGING HANDOFF");
                        console.log(`Passing ${files.length} verified files to Staging`);
                        console.groupEnd();

                        onStageFiles(files);
                        onNavigate('staging');
                    } else if (!isHealthy) {
                        throw new Error("File integrity check failed (corrupt download).");
                    }
                }
            } catch (e: any) {
                console.error("Import Flow Failed", e);
                closePopup();
                setStep('error');
                setErrorMsg(e.message || "Failed to download selected photos.");
            }
        })();
    }, [closePopup, onStageFiles, onNavigate]);

    const startImport = useCallback(async () => {
        setIsOpen(true);
        setStep('init'); 
        setErrorMsg("");
        
        // 1. Open "Ghost" Window (Synchronous)
        try {
            popupRef.current = window.open('', 'googlePicker', getPopupFeatures());
            
            // [ZEN UX] Immediately paint it black
            if (popupRef.current) {
                injectLoader(popupRef.current);
            }
        } catch (e) {
            console.warn("Auto-popup blocked. Will fall back to manual trigger.");
            popupRef.current = null;
        }

        try {
            // 2. Fetch the Session URL
            const session = await googlePhotosService.startPickerSession();
            setPickerUrl(session.pickerUri);
            setSessionId(session.id);

            if (popupRef.current && !popupRef.current.closed) {
                console.log("🚀 [UseGooglePhotos] Redirecting pre-opened window...");
                popupRef.current.location.href = session.pickerUri;
                startPolling(session.id);
            } else {
                console.log("⚠️ [UseGooglePhotos] Popup was blocked/closed. Requesting manual launch.");
                setStep('ready');
            }

        } catch (e: any) {
            console.error("Init Failed", e);
            setStep('error');
            setErrorMsg(e.message || "Failed to initialize import.");
            if (popupRef.current) popupRef.current.close();
        }
    }, [startPolling]);

    const launchPicker = useCallback(() => {
        if (!pickerUrl || !sessionId) return;
        
        popupRef.current = window.open(pickerUrl, 'googlePicker', getPopupFeatures());
        
        if (!popupRef.current) {
            setStep('error');
            setErrorMsg("Popup blocked. Please allow popups for this site.");
            return;
        }

        startPolling(sessionId);
    }, [pickerUrl, sessionId, startPolling]);

    const cancelImport = useCallback(() => {
        closePopup();
        setIsOpen(false);
    }, [closePopup]);

    return {
        isOpen,
        step,
        errorMsg,
        startImport,
        launchPicker,
        cancelImport
    };
};