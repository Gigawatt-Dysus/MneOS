import { v4 as uuidv4 } from 'uuid';
import exifr from 'exifr';
import * as mammoth from 'mammoth';
import { extractDateFromFilename } from './dateSanitizer';
import { TEMPORAL_SHOEBOX_DATE } from '../types/constants';

const generateId = () => {
    return typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export interface ProcessedAsset {
  id: string;
  file: File;
  preview: string;       
  logicalDate: Date;     
  metadata: {
    width: number;
    height: number;
    aspectRatio: number;
  };
  thumbnails: {
    small: Blob;
    medium: Blob;
    large: Blob;
  };
  status: 'clean' | 'provisional';
  type?: 'media' | 'document';
  extractedText?: string;
  ragEnabled?: boolean;
  extractedVertices?: string[];
}

export const processIncomingFile = async (file: File): Promise<ProcessedAsset | null> => {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  
  const isDoc = 
      file.type === 'application/pdf' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type.startsWith('text/') ||
      file.name.endsWith('.pdf') ||
      file.name.endsWith('.docx') ||
      file.name.endsWith('.doc') ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md');

  // [ZEN FIX] Allow Image, Video and Documents
  if (!isImage && !isVideo && !isDoc) {
      console.warn(`[ImageProcessor] Skipping unsupported file type: ${file.type}`);
      return null;
  }

  // --- LOGICAL DATE EXTRACTION ---
  // Default to the Shoebox (Year 5000) for undated media
  let logicalDate = new Date(TEMPORAL_SHOEBOX_DATE);
  
  try {
      // Priority 1: EXIF Metadata (Most Accurate)
      if (isImage) {
          const exifData = await exifr.parse(file);
          if (exifData && exifData.DateTimeOriginal) {
              logicalDate = new Date(exifData.DateTimeOriginal);
              console.log(`[ImageProcessor] Resolved EXIF Date: ${logicalDate.toISOString()}`);
          } else {
              // Priority 2: Filename Pattern (Next best)
              const filenameDate = extractDateFromFilename(file.name);
              if (filenameDate) {
                  logicalDate = new Date(filenameDate);
                  console.log(`[ImageProcessor] Resolved Filename Date: ${logicalDate.toISOString()}`);
              } else {
                  // Priority 3: System Metadata
                  const lastMod = (file as any).lastModifiedDate || file.lastModified;
                  if (lastMod) logicalDate = new Date(lastMod);
              }
          }
      } else {
          // Video: Filename or System Metadata
          const filenameDate = extractDateFromFilename(file.name);
          if (filenameDate) {
              logicalDate = new Date(filenameDate);
          } else {
              const lastMod = (file as any).lastModifiedDate || file.lastModified;
              if (lastMod) logicalDate = new Date(lastMod);
          }
      }
  } catch (e: any) {
      // [ZEN] Silence common "Unknown file format" noise for WebP/Web assets
      const isWebP = file.name.toLowerCase().endsWith('.webp');
      if (!(isWebP && e?.message?.includes('Unknown file format'))) {
          console.warn(`[ImageProcessor] Date extraction error for ${file.name}:`, e);
      }
      const lastMod = (file as any).lastModifiedDate || file.lastModified;
      if (lastMod) logicalDate = new Date(lastMod);
  }
  
  // @ts-ignore
  if (file.gigi_creationTime) {
      // @ts-ignore
      logicalDate = new Date(file.gigi_creationTime);
  }

  // --- DOCUMENT PROCESSOR ---
  if (isDoc) {
      let extractedText = '';
      if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          try {
              extractedText = await file.text();
          } catch (e) {
              console.warn(`[ImageProcessor] Plain text extraction failed for ${file.name}:`, e);
          }
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
          try {
              const arrayBuffer = await file.arrayBuffer();
              const result = await mammoth.extractRawText({ arrayBuffer });
              extractedText = result.value || '';
          } catch (e) {
              console.warn(`[ImageProcessor] Mammoth docx extraction failed for ${file.name}:`, e);
              extractedText = `[Word Document extraction failed]`;
          }
      } else {
          // PDF / XLSX / etc
          extractedText = `[Smart Ingest] Document: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      }

      return {
          id: generateId(),
          file,
          preview: '', // Styled in React HUD
          logicalDate,
          metadata: { width: 0, height: 0, aspectRatio: 1 },
          thumbnails: {
              small: new Blob([]),
              medium: new Blob([]),
              large: new Blob([])
          },
          status: 'clean',
          type: 'document',
          extractedText,
          ragEnabled: true,
          extractedVertices: []
      };
  }

  // --- VIDEO PROCESSOR ---
  if (isVideo) {
      return new Promise((resolve) => {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.muted = true;
          video.playsInline = true;
          const objectUrl = URL.createObjectURL(file);
          video.src = objectUrl;

          // Timeout to prevent hanging
          const timeout = setTimeout(() => {
              console.warn(`[ImageProcessor] Video timeout: ${file.name}`);
              resolve(null);
          }, 5000);

          video.onloadeddata = async () => {
              clearTimeout(timeout);
              // Seek to 1s or 25% to avoid black frames
              video.currentTime = Math.min(1.0, video.duration * 0.25);
          };

          video.onseeked = async () => {
              // Capture Frame
              const width = video.videoWidth;
              const height = video.videoHeight;
              const aspectRatio = height > 0 ? width / height : 1;

              const createVideoThumbnail = (targetWidth: number): Promise<Blob> => {
                  return new Promise((resBlob) => {
                      const scale = targetWidth / width;
                      const canvas = document.createElement('canvas');
                      canvas.width = targetWidth;
                      canvas.height = height * scale;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                          // Overlay Play Icon (Baked into thumbnail for fallback compatibility)
                          ctx.fillStyle = 'rgba(0,0,0,0.5)';
                          ctx.beginPath();
                          ctx.arc(canvas.width/2, canvas.height/2, canvas.width * 0.15, 0, Math.PI*2);
                          ctx.fill();
                          ctx.fillStyle = '#ffffff';
                          ctx.beginPath();
                          const size = canvas.width * 0.1;
                          const cx = canvas.width/2 + (size * 0.1); 
                          const cy = canvas.height/2;
                          ctx.moveTo(cx - size/2, cy - size/2);
                          ctx.lineTo(cx + size/2, cy);
                          ctx.lineTo(cx - size/2, cy + size/2);
                          ctx.fill();

                          canvas.toBlob((b) => resBlob(b!), 'image/jpeg', 0.8);
                      } else {
                          // Fallback empty blob if canvas fails
                          resBlob(new Blob([])); 
                      }
                  });
              };

              try {
                  const [small, medium, large] = await Promise.all([
                      createVideoThumbnail(200),
                      createVideoThumbnail(800),
                      createVideoThumbnail(1600)
                  ]);

                  // Clean up
                  URL.revokeObjectURL(objectUrl);
                  video.remove();

                  resolve({
                      id: generateId(),
                      file,
                      preview: URL.createObjectURL(medium), // Use the thumbnail as the preview
                      logicalDate,
                      metadata: { width, height, aspectRatio },
                      thumbnails: { small, medium, large },
                      status: 'clean'
                  });
              } catch (e) {
                  console.error("Video thumbnail failed", e);
                  resolve(null);
              }
          };

          video.onerror = () => {
              clearTimeout(timeout);
              console.warn("Video load error", file.name);
              resolve(null);
          };
      });
  }

  // --- IMAGE PROCESSOR (Standard) ---
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const aspectRatio = height > 0 ? width / height : 1;

      const createThumbnail = (targetWidth: number): Promise<Blob> => {
        return new Promise((resBlob) => {
          if (width === 0 || height === 0) { resBlob(file); return; }
          const scale = targetWidth / width;
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = height * scale;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((b) => {
                if (b) resBlob(b);
                else resBlob(file); 
            }, 'image/jpeg', 0.85);
          } else {
             resBlob(file);
          }
        });
      };

      try {
          const [small, medium, large] = await Promise.all([
            createThumbnail(200),
            createThumbnail(800),
            createThumbnail(1600)
          ]);

          const previewUrl = URL.createObjectURL(medium);
          URL.revokeObjectURL(objectUrl); // Clean up original file blob to prevent memory leaks

          resolve({
            id: generateId(),
            file,
            preview: previewUrl,
            logicalDate,
            metadata: { width, height, aspectRatio },
            thumbnails: { small, medium, large },
            status: 'clean', 
          });
      } catch (err) {
          console.error("Thumbnail generation error", err);
          resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    img.src = objectUrl;
  });
};