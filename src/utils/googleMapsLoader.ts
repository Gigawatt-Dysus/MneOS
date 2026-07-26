let googleMapsPromise: Promise<void> | null = null;

// Helper to wait for a condition to be true (Polling)
const waitForMapGlobals = (timeoutMs = 5000): Promise<void> => {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        
        const check = () => {
            // Success Condition
            if (window.google?.maps?.importLibrary) {
                resolve();
                return;
            }

            // Timeout Condition
            if (Date.now() - start > timeoutMs) {
                reject(new Error("Google Maps timed out waiting for importLibrary."));
                return;
            }

            // Retry in 50ms
            setTimeout(check, 50);
        };
        
        check();
    });
};

export const loadGoogleMaps = (apiKey: string): Promise<void> => {
    // 1. FAST PATH: If already loaded and ready, return immediately.
    if (window.google?.maps?.importLibrary) {
        return Promise.resolve();
    }

    // 2. PROMISE SINGLETON: If a load is already in progress, return that promise.
    if (googleMapsPromise) {
        return googleMapsPromise;
    }

    googleMapsPromise = new Promise(async (resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error("Google Maps cannot load in SSR environment"));
            return;
        }

        try {
            // 3. CLEANUP: Detect & Purge conflicting legacy scripts
            if (window.google?.maps && !window.google.maps.importLibrary) {
                console.warn("[GIGI MAPS] Legacy script detected. Purging...");
                // @ts-ignore
                delete window.google.maps;
                
                const scripts = document.querySelectorAll('script[src*="maps.googleapis.com/maps/api/js"]') as NodeListOf<HTMLScriptElement>;
                scripts.forEach(s => s.remove());
            }

            // 4. CHECK DOM: Don't inject if the correct script is already there (but maybe not finished loading)
            let script = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"][src*="loading=async"]`) as HTMLScriptElement;

            if (!script) {
                script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&v=weekly&libraries=places,marker`;
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }

            // 5. WAIT: Use the polling helper to wait for hydration
            await waitForMapGlobals();
            
            console.log("[GIGI MAPS] API Ready & Hydrated.");
            resolve();

        } catch (err) {
            console.error("[GIGI MAPS] Load Failed:", err);
            // Reset the promise so we can try again later
            googleMapsPromise = null; 
            reject(err);
        }
    });

    return googleMapsPromise;
};

// Helper for static maps (unchanged)
export const getStaticMapUrl = (lat: number, lng: number, zoom: number, apiKey: string): string => {
    if (!apiKey) return '';
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=600x400&maptype=roadmap&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
};