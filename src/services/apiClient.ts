// src/services/apiClient.ts
// Client-side adapter to transparently invoke Vercel serverless API routes instead of Firebase functions.

declare global {
  interface Window {
    Clerk?: any;
  }
}

// Global mutex to prevent token refresh storms when multiple requests fail concurrently
let tokenRefreshPromise: Promise<string | null> | null = null;

export const httpsCallable = (functionsInstance: any, name: string) => {
  return async (data: any) => {
    try {
      if (localStorage.getItem('DEBUG_API') === 'true') {
          console.log(`[apiClient] 🛰️ Routing transaction to Vercel Serverless Route: /api/${name}`);
      }

      const fetchWithToken = async (forceRefresh = false) => {
        let token = null;
        if (window.Clerk && window.Clerk.session) {
          try {
            const timeoutPromise = new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error("Clerk getToken timeout")), 5000)
            );
            
            if (forceRefresh) {
              // Deduplicate token refresh network requests
              if (!tokenRefreshPromise) {
                tokenRefreshPromise = window.Clerk.session.getToken({ skipCache: true }).finally(() => {
                  // Clear the promise after it resolves or rejects
                  setTimeout(() => { tokenRefreshPromise = null; }, 1000); 
                });
              }
              token = await Promise.race([tokenRefreshPromise, timeoutPromise]);
            } else {
              token = await Promise.race([window.Clerk.session.getToken(), timeoutPromise]);
            }
          } catch (e) {
            console.warn("[apiClient] ⚠️ Clerk getToken timed out or failed (likely network drop). Proceeding without token or failing.");
            throw e; // Bubble up the error so React Query can handle the failure and retry instead of hanging
          }
        }

        return fetch(`/api/${name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
          },
          body: JSON.stringify(data)
        });
      };

      let response = await fetchWithToken();

      // Automatically retry once if we hit an unexpected 401 (e.g., expired JWT due to clock skew)
      if (response.status === 401) {
        console.warn(`[apiClient] ⚠️ 401 Unauthorized caught for ${name}. Forcing Clerk JWT refresh and retrying...`);
        response = await fetchWithToken(true);
      }

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `HTTP ${response.status}: Serverless API Error`;
        try {
          const parsed = JSON.parse(errText);
          errMsg = parsed.error || errMsg;
        } catch (e) {}
        throw new Error(errMsg);
      }

      const result = await response.json();
      // preserver the standard Firebase envelope schema: { data: ... }
      return result;
    } catch (error: any) {
      console.error(`[apiClient] ❌ Vercel Serverless transaction failed for ${name}:`, error.message);
      throw error;
    }
  };
};
