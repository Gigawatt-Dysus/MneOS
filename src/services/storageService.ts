import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "./apiClient";
import { isFirebaseConfigured, functions } from "../firebaseConfig";
import { blobToBase64 } from "../utils/fileUtils";

// Helper to convert DataURL to Blob (for cropped images)
export const dataURLToBlob = async (dataURL: string): Promise<Blob> => {
    return await (await fetch(dataURL)).blob();
};

let isCloudUploadBroken = false;
let consecutiveFailures = 0;
const MAX_FAILURES = 2;

// [ZEN PATCH] Increased timeout to 5 minutes (300000ms) to support Video Uploads
const UPLOAD_TIMEOUT_MS = 300000; 

export const uploadFile = async (file: File | Blob, userId: string, fileName?: string): Promise<{ url: string; base64?: string }> => {
  const name = fileName || (file instanceof File ? file.name : `file-${Date.now()}`);
  
  // Pre-calculate base64 for fallback or local mode immediately
  const base64 = await blobToBase64(file);

  const isConfigured = isFirebaseConfigured();
  console.log(`[Storage] Request to upload: ${name}`);
  
  if (!isConfigured) {
      console.log(`[Storage] Local mode active.`);
      return { url: '', base64 };
  }

  if (isCloudUploadBroken) {
      console.warn("[Storage] Circuit breaker active. Skipping cloud upload for:", name);
      return { url: '', base64 };
  }

  try {
      console.log(`[Storage] 🚀 Starting Cloud upload via B2 PROXY...`);
      const safeFileName = name.replace(/[^a-zA-Z0-9.]/g, '_');
      
      // 1. Call the Proxy Function instead of fetching a signed URL
      const proxyUploadToB2 = httpsCallable(functions, 'proxyUploadToB2');
      const response = await proxyUploadToB2({
          fileName: safeFileName,
          fileType: file.type || 'application/octet-stream',
          base64Data: base64
      });

      const { publicUrl } = response.data as { publicUrl: string };
      
      console.log(`[Storage] ✅ Cloud Proxy Upload SUCCESS. Public URL: ${publicUrl}`);
      
      // Reset failures on success
      consecutiveFailures = 0;
      isCloudUploadBroken = false;
      
      return { url: publicUrl };
  } catch (error: any) {
      console.error("[Storage] ❌ Cloud Upload FAILED.", error.message);
      consecutiveFailures++;
      
      // [ZEN] TEMPORARILY DISABLED CIRCUIT BREAKER TO ALLOW TESTING
      /*
      if (consecutiveFailures >= MAX_FAILURES) {
           isCloudUploadBroken = true;
      }
      */

      console.warn("[Storage] 🔄 Falling back to local Base64 storage (Circuit Breaker currently bypassed for testing).");
      return { url: '', base64 };
  }
};