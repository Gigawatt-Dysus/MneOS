import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { isFirebaseConfigured } from "../firebaseConfig";
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
      const storage = getStorage();
      const timestamp = Date.now();
      const safeFileName = name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storageRef = ref(storage, `users/${userId}/uploads/${timestamp}-${safeFileName}`);
      
      console.log(`[Storage] Starting Cloud upload to: .../${timestamp}-${safeFileName}`);
      
      // Race the upload against a timeout
      const uploadTask = uploadBytes(storageRef, file);
      const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Upload timed out (Network/CORS)")), UPLOAD_TIMEOUT_MS)
      );

      const snapshot: any = await Promise.race([uploadTask, timeoutPromise]);
      const url = await getDownloadURL(snapshot.ref);
      
      console.log(`[Storage] Cloud Upload SUCCESS. Download URL: ${url}`);
      
      // Reset failures on success
      consecutiveFailures = 0;
      
      return { url };
  } catch (error: any) {
      console.error("[Storage] Cloud Upload FAILED.", error.message);
      consecutiveFailures++;
      
      const msg = error.message || '';
      // Check for common permanent errors
      if (msg.includes('network') || msg.includes('CORS') || msg.includes('timed out') || error.code === 'storage/retry-limit-exceeded' || error.code === 'storage/unauthorized' || consecutiveFailures >= MAX_FAILURES) {
           if (!isCloudUploadBroken) {
               console.warn(`[Storage] ⚠️ Cloud upload failing consistently. enabling circuit breaker.`);
               isCloudUploadBroken = true;
           }
      }

      console.warn("[Storage] Falling back to local Base64 storage.");
      return { url: '', base64 };
  }
};