import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Move, Check, X } from 'lucide-react';

interface AvatarCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel: () => void;
  cropShape?: 'circle' | 'rect';
  aspectRatio?: number; // width / height
}

const OUTPUT_DIMENSION = 1200; // Final resolution (Increased for Photos)
const CANVAS_MAX_SIZE = 500; // UI Display size

export const AvatarCropper: React.FC<AvatarCropperProps> = ({ 
    imageSrc, onCropComplete, onCancel, 
    cropShape = 'circle', 
    aspectRatio = 1 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [canvasDim, setCanvasDim] = useState({ w: 300, h: 300 });
  
  // Transform State
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [minZoom, setMinZoom] = useState(1);
  
  // Drag State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 1. Load Image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; 
    // [ZEN] Cache-busting to prevent poisoned CORS cache (Remote only)
    const isRemote = imageSrc.startsWith('http');
    const cacheBuster = imageSrc.includes('?') ? '&' : '?';
    img.src = isRemote ? `${imageSrc}${cacheBuster}t=${Date.now()}` : imageSrc;
    img.onload = () => {
        // [ZEN FIX] Prevent 0-width collapse if aspectRatio is 0 or missing
        const effectiveAspectRatio = aspectRatio || (img.naturalWidth / img.naturalHeight);
        
        let targetW = CANVAS_MAX_SIZE;
        let targetH = CANVAS_MAX_SIZE / effectiveAspectRatio;
        
        if (targetH > CANVAS_MAX_SIZE) {
            targetH = CANVAS_MAX_SIZE;
            targetW = CANVAS_MAX_SIZE * effectiveAspectRatio;
        }
        
        setCanvasDim({ w: targetW, h: targetH });

        // Calculate the absolute minimum zoom to fill the canvas
        const minZ = Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight);
        setMinZoom(minZ);
        setZoom(minZ); // Start at perfect fit
        
        // Center initially
        setOffset({
            x: (targetW - img.naturalWidth * minZ) / 2,
            y: (targetH - img.naturalHeight * minZ) / 2
        });
        
        console.log(`[AvatarCropper] 🖼️ Image Loaded: ${img.naturalWidth}x${img.naturalHeight} | target: ${targetW}x${targetH} | minZoom: ${minZ.toFixed(4)}`);
        
        setImage(img);
    };

    img.onerror = (err) => {
        console.error("[AvatarCropper] ❌ Failed to load image.", { src: img.src, err });
        alert("CRITICAL: Image access denied by storage provider (CORS) or Broken URL. Please check the console.");
        onCancel();
    };
  }, [imageSrc, aspectRatio]);

  // 2. Constraint Engine
  const clampOffset = (x: number, y: number, currentZoom: number) => {
      if (!image) return { x, y };
      
      const scaledW = image.naturalWidth * currentZoom;
      const scaledH = image.naturalHeight * currentZoom;

      const max_x = 0;
      const min_x = canvasDim.w - scaledW;
      
      const max_y = 0;
      const min_y = canvasDim.h - scaledH;

      return {
          x: Math.min(Math.max(x, min_x), max_x),
          y: Math.min(Math.max(y, min_y), max_y)
      };
  };

  // 3. Draw Loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background (Dark Pasteboard)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Image
    const scaledW = image.naturalWidth * zoom;
    const scaledH = image.naturalHeight * zoom;
    ctx.drawImage(image, offset.x, offset.y, scaledW, scaledH);

    // [ZEN] The parent div already handles the circular mask via CSS 'rounded-full'.
    // No manual overlay needed as it only dims the focus area.

    // Overlay: Mask Border
    ctx.beginPath();
    if (cropShape === 'circle') {
        ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 2, 0, 2 * Math.PI);
    } else {
        ctx.rect(2, 2, canvas.width - 4, canvas.height - 4);
    }
    ctx.strokeStyle = '#06b6d4'; // Cyan border for Zen visibility
    ctx.lineWidth = 3;
    ctx.stroke();

    // Crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 20, canvas.height / 2);
    ctx.lineTo(canvas.width / 2 + 20, canvas.height / 2);
    ctx.moveTo(canvas.width / 2, canvas.height / 2 - 20);
    ctx.lineTo(canvas.width / 2, canvas.height / 2 + 20);
    ctx.stroke();

  }, [image, zoom, offset, canvasDim, cropShape]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 4. Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && image) {
        const rawX = e.clientX - dragStart.x;
        const rawY = e.clientY - dragStart.y;
        
        // Apply Constraints immediately while dragging
        const clamped = clampOffset(rawX, rawY, zoom);
        setOffset(clamped);
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleZoom = (newZoom: number) => {
      if (!image) return;
      // Clamp Zoom
      const maxZ = Math.max(minZoom * 5, 5);
      const safeZoom = Math.min(Math.max(newZoom, minZoom), maxZ);
      setZoom(safeZoom);
      
      // Re-clamp offset (zooming out might expose edges)
      setOffset(prev => clampOffset(prev.x, prev.y, safeZoom));
  };

  const handleCrop = () => {
      const canvas = canvasRef.current;
      if (!canvas || !image) return;

      // High-Res Output Canvas
      const outputW = OUTPUT_DIMENSION;
      const outputH = OUTPUT_DIMENSION / aspectRatio;
      
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = outputW;
      outputCanvas.height = outputH;
      const ctx = outputCanvas.getContext('2d');
      if (!ctx) return;

      if (cropShape === 'circle') {
          ctx.beginPath();
          ctx.arc(outputW / 2, outputH / 2, outputW / 2, 0, Math.PI * 2);
          ctx.clip();
      }

      // Calculate relative crop coordinates
      const ratio = outputW / canvasDim.w;
      const outputZoom = zoom * ratio;
      const outputX = offset.x * ratio;
      const outputY = offset.y * ratio;
      
      ctx.drawImage(image, outputX, outputY, image.naturalWidth * outputZoom, image.naturalHeight * outputZoom);

      let quality = 0.9;
      let dataUrl = outputCanvas.toDataURL('image/jpeg', quality);

      // [ZEN FIX] Hardening Payload Size for Firestore (Limit: ~1MB / 900,000 chars)
      // Step 1: Drop quality to compress
      while (dataUrl.length > 850000 && quality > 0.5) {
          quality -= 0.1;
          dataUrl = outputCanvas.toDataURL('image/jpeg', quality);
      }

      // Step 2: If it's STILL too large, halve the resolution
      if (dataUrl.length > 850000) {
          console.warn(`[AvatarCropper] Image payload too large (${dataUrl.length} chars). Downscaling resolution.`);
          const downscaledCanvas = document.createElement('canvas');
          downscaledCanvas.width = outputW / 2;
          downscaledCanvas.height = outputH / 2;
          const downscaledCtx = downscaledCanvas.getContext('2d');
          if (downscaledCtx) {
             downscaledCtx.drawImage(outputCanvas, 0, 0, downscaledCanvas.width, downscaledCanvas.height);
             dataUrl = downscaledCanvas.toDataURL('image/jpeg', 0.8);
          }
      }

      onCropComplete(dataUrl);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[10000] animate-in fade-in">
      <div className="bg-[#0B1120] p-8 rounded-3xl shadow-[0_0_80px_rgba(6,182,212,0.15)] border border-cyan-500/30 w-full max-w-2xl flex flex-col items-center">
        <h3 className="text-xl font-black text-white mb-6 uppercase tracking-[0.2em] flex items-center gap-3">
            <Move size={20} className="text-cyan-400"/> Adjust Artifact
        </h3>
        
        <div 
            className={`relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border-4 border-slate-900 cursor-move ${cropShape === 'circle' ? 'rounded-full' : 'rounded-2xl'}`}
            style={{ width: canvasDim.w, height: canvasDim.h }}
        >
            <canvas
                ref={canvasRef}
                width={canvasDim.w}
                height={canvasDim.h}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="block"
            />
        </div>

        <div className="w-full mt-8 px-8 space-y-4">
            <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <span>Precision Zoom</span>
                <span className="text-cyan-400">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => handleZoom(zoom - 0.1)}
                    className="text-slate-500 hover:text-cyan-400 transition-all p-1.5 active:scale-90"
                    title="Zoom Out"
                >
                    <ZoomOut size={20} />
                </button>
                <input
                    type="range"
                    min={minZoom}
                    max={Math.max(minZoom * 5, 5)}
                    step={0.001}
                    value={zoom}
                    onChange={(e) => handleZoom(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <button 
                    onClick={() => handleZoom(zoom + 0.1)}
                    className="text-slate-500 hover:text-cyan-400 transition-all p-1.5 active:scale-90"
                    title="Zoom In"
                >
                    <ZoomIn size={20} />
                </button>
            </div>
        </div>

        <div className="flex gap-4 mt-10 w-full">
            <button onClick={onCancel} className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                <X size={18} /> Discard
            </button>
            <button onClick={handleCrop} className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 active:scale-95">
                <Check size={18} /> Apply Adjustment
            </button>
        </div>
      </div>
    </div>
  );
};
