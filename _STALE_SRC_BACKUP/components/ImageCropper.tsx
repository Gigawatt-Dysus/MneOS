import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Move, Check, X } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel: () => void;
}

const OUTPUT_DIMENSION = 300; // Final resolution
const CANVAS_SIZE = 300; // UI Display size

export const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onCropComplete, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  
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
    img.crossOrigin = 'anonymous'; // [ZEN FIX] Allow re-cropping cloud images
    img.src = imageSrc;
    img.onload = () => {
        // Calculate the absolute minimum zoom to fill the canvas (No Pasteboard!)
        const minZ = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
        setMinZoom(minZ);
        setZoom(minZ); // Start at perfect fit
        
        // Center initially
        setOffset({
            x: (CANVAS_SIZE - img.naturalWidth * minZ) / 2,
            y: (CANVAS_SIZE - img.naturalHeight * minZ) / 2
        });
        
        setImage(img);
    };
  }, [imageSrc]);

  // 2. Constraint Engine
  const clampOffset = (x: number, y: number, currentZoom: number) => {
      if (!image) return { x, y };
      
      const scaledW = image.naturalWidth * currentZoom;
      const scaledH = image.naturalHeight * currentZoom;

      // The image must cover the canvas (0 to CANVAS_SIZE).
      // So offset must be <= 0 (left edge) and >= CANVAS_SIZE - scaledW (right edge)
      const max_x = 0;
      const min_x = CANVAS_SIZE - scaledW;
      
      const max_y = 0;
      const min_y = CANVAS_SIZE - scaledH;

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

    // Overlay: Darken outside the circle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, 2 * Math.PI, true);
    ctx.fill();

    // Overlay: The Cut Circle Border
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 2, 0, 2 * Math.PI);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Crosshair (Optional, subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 10, canvas.height / 2);
    ctx.lineTo(canvas.width / 2 + 10, canvas.height / 2);
    ctx.moveTo(canvas.width / 2, canvas.height / 2 - 10);
    ctx.lineTo(canvas.width / 2, canvas.height / 2 + 10);
    ctx.stroke();

  }, [image, zoom, offset]);

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
      const safeZoom = Math.max(newZoom, minZoom);
      setZoom(safeZoom);
      
      // Re-clamp offset (zooming out might expose edges)
      setOffset(prev => clampOffset(prev.x, prev.y, safeZoom));
  };

  const handleCrop = () => {
      const canvas = canvasRef.current;
      if (!canvas || !image) return;

      // High-Res Output Canvas
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = OUTPUT_DIMENSION;
      outputCanvas.height = OUTPUT_DIMENSION;
      const ctx = outputCanvas.getContext('2d');
      if (!ctx) return;

      // Calculate relative crop coordinates
      // We need to map the visible canvas area (300x300) to the output (300x300)
      // Since they match, we just replicate the draw, but centered and clean.
      
      // Draw circular mask on output
      ctx.beginPath();
      ctx.arc(OUTPUT_DIMENSION / 2, OUTPUT_DIMENSION / 2, OUTPUT_DIMENSION / 2, 0, Math.PI * 2);
      ctx.clip();

      // Draw Image
      // Note: offset and zoom are relative to the CANVAS_SIZE. 
      // If OUTPUT_DIMENSION differed, we'd need a ratio multiplier.
      const ratio = OUTPUT_DIMENSION / CANVAS_SIZE;
      const outputZoom = zoom * ratio;
      const outputX = offset.x * ratio;
      const outputY = offset.y * ratio;
      
      ctx.drawImage(image, outputX, outputY, image.naturalWidth * outputZoom, image.naturalHeight * outputZoom);

      onCropComplete(outputCanvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[10000] animate-in fade-in">
      <div className="bg-slate-900 p-6 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md flex flex-col items-center">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Move size={18} className="text-cyan-400"/> Adjust Avatar
        </h3>
        
        <div 
            className="relative rounded-full overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border-4 border-slate-800 cursor-move"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
        >
            <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="block"
            />
        </div>

        <div className="w-full mt-6 px-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-400 font-mono uppercase tracking-widest mb-1">
                <span>Zoom Level</span>
                <span>{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
                <ZoomOut size={16} className="text-slate-500" />
                <input
                    type="range"
                    min={minZoom}
                    max={Math.max(minZoom * 3, 3)} // Dynamic max
                    step={0.01}
                    value={zoom}
                    onChange={(e) => handleZoom(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <ZoomIn size={16} className="text-slate-500" />
            </div>
        </div>

        <div className="flex gap-3 mt-8 w-full">
            <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors flex items-center justify-center gap-2">
                <X size={18} /> Cancel
            </button>
            <button onClick={handleCrop} className="flex-1 py-3 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2">
                <Check size={18} /> Apply Crop
            </button>
        </div>
      </div>
    </div>
  );
};