import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Move, Check, X } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel: () => void;
  cropShape?: 'circle' | 'rect';
  aspectRatio?: number; // width / height
  polishFilter?: string; // CSS Filter string to apply to the canvas context
}

const OUTPUT_DIMENSION = 1200; // Final resolution (Increased for Photos)
const CANVAS_MAX_SIZE = 500; // UI Display size

type CropAction = 'none' | 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | 'resize-t' | 'resize-r' | 'resize-b' | 'resize-l';

export const ImageCropper: React.FC<ImageCropperProps> = ({ 
    imageSrc, onCropComplete, onCancel, 
    cropShape = 'circle', 
    aspectRatio,
    polishFilter
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [canvasDim, setCanvasDim] = useState({ w: 300, h: 300 });
  const [currentAspectRatio, setCurrentAspectRatio] = useState<number>(aspectRatio || 0);
  
  // Crop Box state relative to canvas bounds
  const [cropBox, setCropBox] = useState({ x: 50, y: 50, w: 200, h: 150 });
  
  // Drag State
  const [activeAction, setActiveAction] = useState<CropAction>('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, boxX: 0, boxY: 0, boxW: 0, boxH: 0 });

  // 1. Load Image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; 
    // [ZEN] Cache-busting to prevent poisoned CORS cache (Remote only)
    const isRemote = imageSrc.startsWith('http');
    const cacheBuster = imageSrc.includes('?') ? '&' : '?';
    img.src = isRemote ? `${imageSrc}${cacheBuster}t=${Date.now()}` : imageSrc;
    img.onload = () => {
        setImage(img);
        // Default to natural aspect ratio if none passed, or custom (0)
        if (aspectRatio === undefined) {
            setCurrentAspectRatio(cropShape === 'circle' ? 1 : 0);
        }
    };

    img.onerror = (err) => {
        console.error("[ImageCropper] ❌ Failed to load image.", { src: img.src, err });
        alert("CRITICAL: Image access denied by storage provider (CORS) or Broken URL. Please check the console.");
        onCancel();
    };
  }, [imageSrc, aspectRatio, cropShape]);

  // 2. Constraint Engine (Recalculate layout whenever image is loaded)
  useEffect(() => {
    if (!image) return;
    
    // Fit canvas to image aspect ratio perfectly so that the image fills the entire canvas area
    let targetW = CANVAS_MAX_SIZE;
    let targetH = CANVAS_MAX_SIZE / (image.naturalWidth / image.naturalHeight);
    
    if (targetH > CANVAS_MAX_SIZE) {
        targetH = CANVAS_MAX_SIZE;
        targetW = CANVAS_MAX_SIZE * (image.naturalWidth / image.naturalHeight);
    }
    
    setCanvasDim({ w: targetW, h: targetH });

    // Initialize Crop Box centered, occupying 80% of canvas
    let initialW = targetW * 0.8;
    let initialH = targetH * 0.8;

    if (currentAspectRatio) {
        if (initialW / initialH > currentAspectRatio) {
            initialW = initialH * currentAspectRatio;
        } else {
            initialH = initialW / currentAspectRatio;
        }
    }

    setCropBox({
        x: (targetW - initialW) / 2,
        y: (targetH - initialH) / 2,
        w: initialW,
        h: initialH
    });
  }, [image]);

  // Handle Aspect Ratio changes dynamically
  useEffect(() => {
    if (!image || !currentAspectRatio) return;

    let newW = cropBox.w;
    let newH = newW / currentAspectRatio;
    
    if (newH > canvasDim.h) {
        newH = canvasDim.h * 0.8;
        newW = newH * currentAspectRatio;
    }
    if (newW > canvasDim.w) {
        newW = canvasDim.w * 0.8;
        newH = newW / currentAspectRatio;
    }

    setCropBox({
        x: (canvasDim.w - newW) / 2,
        y: (canvasDim.h - newH) / 2,
        w: newW,
        h: newH
    });
  }, [currentAspectRatio]);

  const getActionAt = (mouseX: number, mouseY: number) => {
    const handleSize = 24; // Expanded detection radius for forgiving clicks
    const { x, y, w, h } = cropBox;

    const near = (px: number, py: number, hx: number, hy: number) => {
        return Math.abs(px - hx) < handleSize && Math.abs(py - hy) < handleSize;
    };

    if (near(mouseX, mouseY, x, y)) return 'resize-tl';
    if (near(mouseX, mouseY, x + w, y)) return 'resize-tr';
    if (near(mouseX, mouseY, x, y + h)) return 'resize-bl';
    if (near(mouseX, mouseY, x + w, y + h)) return 'resize-br';

    // Edges
    const onSegment = (val: number, start: number, end: number) => val >= start && val <= end;
    if (Math.abs(mouseY - y) < handleSize && onSegment(mouseX, x, x + w)) return 'resize-t';
    if (Math.abs(mouseX - (x + w)) < handleSize && onSegment(mouseY, y, y + h)) return 'resize-r';
    if (Math.abs(mouseY - (y + h)) < handleSize && onSegment(mouseX, x, x + w)) return 'resize-b';
    if (Math.abs(mouseX - x) < handleSize && onSegment(mouseY, y, y + h)) return 'resize-l';

    if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h) {
        return 'move';
    }

    return 'none';
  };

  // 3. Draw Loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply editor polish filter to context before rendering the image
    ctx.filter = polishFilter || 'none';

    // Draw full image fitting canvas bounds
    ctx.drawImage(image, 0, 0, canvasDim.w, canvasDim.h);

    // Reset filter to draw overlay and handles sharply
    ctx.filter = 'none';

    if (cropShape !== 'circle') {
        // Dim overlay outside the crop box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.beginPath();
        ctx.rect(0, 0, canvasDim.w, canvasDim.h); // Outer
        ctx.rect(cropBox.x, cropBox.y, cropBox.w, cropBox.h); // Inner
        ctx.fill('evenodd');

        // Rule of Thirds Grid inside crop box
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Vertical lines
        ctx.moveTo(cropBox.x + cropBox.w / 3, cropBox.y);
        ctx.lineTo(cropBox.x + cropBox.w / 3, cropBox.y + cropBox.h);
        ctx.moveTo(cropBox.x + (cropBox.w * 2) / 3, cropBox.y);
        ctx.lineTo(cropBox.x + (cropBox.w * 2) / 3, cropBox.y + cropBox.h);
        // Horizontal lines
        ctx.moveTo(cropBox.x, cropBox.y + cropBox.h / 3);
        ctx.lineTo(cropBox.x + cropBox.w, cropBox.y + cropBox.h / 3);
        ctx.moveTo(cropBox.x, cropBox.y + (cropBox.h * 2) / 3);
        ctx.lineTo(cropBox.x + cropBox.w, cropBox.y + (cropBox.h * 2) / 3);
        ctx.stroke();

        // Crop box cyan borders
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);

        // 8 resize/move handles (Cyan rectangles)
        ctx.fillStyle = '#06b6d4';
        const size = 12; // Slightly larger for better visibility
        const half = size / 2;
        
        // Corners
        ctx.fillRect(cropBox.x - half, cropBox.y - half, size, size); // TL
        ctx.fillRect(cropBox.x + cropBox.w - half, cropBox.y - half, size, size); // TR
        ctx.fillRect(cropBox.x - half, cropBox.y + cropBox.h - half, size, size); // BL
        ctx.fillRect(cropBox.x + cropBox.w - half, cropBox.y + cropBox.h - half, size, size); // BR

        // Edges
        ctx.fillRect(cropBox.x + cropBox.w / 2 - half, cropBox.y - half, size, size); // T
        ctx.fillRect(cropBox.x + cropBox.w - half, cropBox.y + cropBox.h / 2 - half, size, size); // R
        ctx.fillRect(cropBox.x + cropBox.w / 2 - half, cropBox.y + cropBox.h - half, size, size); // B
        ctx.fillRect(cropBox.x - half, cropBox.y + cropBox.h / 2 - half, size, size); // L
    } else {
        // Circle mode: Just draw the corner resize handles, the HTML div handles the glassmorphic lens mask!
        ctx.fillStyle = '#06b6d4';
        const size = 12;
        const half = size / 2;
        ctx.fillRect(cropBox.x - half, cropBox.y - half, size, size); // TL
        ctx.fillRect(cropBox.x + cropBox.w - half, cropBox.y - half, size, size); // TR
        ctx.fillRect(cropBox.x - half, cropBox.y + cropBox.h - half, size, size); // BL
        ctx.fillRect(cropBox.x + cropBox.w - half, cropBox.y + cropBox.h - half, size, size); // BR
    }

  }, [image, cropBox, canvasDim, polishFilter, cropShape]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 4. Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const action = getActionAt(mouseX, mouseY);
    console.log(`[ImageCropper] MouseDown action: "${action}" at mouse: (${mouseX.toFixed(1)}, ${mouseY.toFixed(1)}) cropBox:`, cropBox);
    if (action !== 'none') {
        setActiveAction(action);
        setDragStart({
            x: e.clientX,
            y: e.clientY,
            boxX: cropBox.x,
            boxY: cropBox.y,
            boxW: cropBox.w,
            boxH: cropBox.h
        });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (activeAction === 'none') {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const action = getActionAt(mouseX, mouseY);
        
        if (action === 'resize-tl' || action === 'resize-br') {
            canvas.style.cursor = 'nwse-resize';
        } else if (action === 'resize-tr' || action === 'resize-bl') {
            canvas.style.cursor = 'nesw-resize';
        } else if (action === 'resize-t' || action === 'resize-b') {
            canvas.style.cursor = 'ns-resize';
        } else if (action === 'resize-l' || action === 'resize-r') {
            canvas.style.cursor = 'ew-resize';
        } else if (action === 'move') {
            canvas.style.cursor = 'move';
        } else {
            canvas.style.cursor = 'default';
        }
        return;
    }

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    let { boxX: x, boxY: y, boxW: w, boxH: h } = dragStart;

    if (activeAction === 'move') {
        let newX = x + dx;
        let newY = y + dy;
        newX = Math.max(0, Math.min(newX, canvasDim.w - w));
        newY = Math.max(0, Math.min(newY, canvasDim.h - h));
        setCropBox(p => ({ ...p, x: newX, y: newY }));
    } else {
        // Resizing engine with perfect pixel boundary clamping and aspect ratio locks
        let newX = x;
        let newY = y;
        let newW = w;
        let newH = h;

        // 1. Determine active resize directions explicitly
        const isLeft = activeAction === 'resize-l' || activeAction === 'resize-tl' || activeAction === 'resize-bl';
        const isRight = activeAction === 'resize-r' || activeAction === 'resize-tr' || activeAction === 'resize-br';
        const isTop = activeAction === 'resize-t' || activeAction === 'resize-tl' || activeAction === 'resize-tr';
        const isBottom = activeAction === 'resize-b' || activeAction === 'resize-bl' || activeAction === 'resize-br';

        // 2. Initial unconstrained resizing values
        if (isLeft) {
            newX = x + dx;
            newW = w - dx;
        }
        if (isRight) {
            newW = w + dx;
        }
        if (isTop) {
            newY = y + dy;
            newH = h - dy;
        }
        if (isBottom) {
            newH = h + dy;
        }

        const minSize = 40;
        const W = canvasDim.w;
        const H = canvasDim.h;

        if (currentAspectRatio) {
            const r = currentAspectRatio;
            // 2a. Fixed Aspect Ratio Resizing (mathematically constrained to boundaries)
            if (activeAction === 'resize-r' || activeAction === 'resize-b' || activeAction === 'resize-br') {
                const maxW = Math.min(W - x, (H - y) * r);
                const minW = Math.max(minSize, minSize * r);
                newW = Math.max(minW, Math.min(newW, maxW));
                newH = newW / r;
                newX = x;
                newY = y;
            } else if (activeAction === 'resize-tl') {
                const right = x + w;
                const bottom = y + h;
                const maxW = Math.min(right, bottom * r);
                const minW = Math.max(minSize, minSize * r);
                newW = Math.max(minW, Math.min(newW, maxW));
                newH = newW / r;
                newX = right - newW;
                newY = bottom - newH;
            } else if (activeAction === 'resize-l' || activeAction === 'resize-bl') {
                const right = x + w;
                const maxW = Math.min(right, (H - y) * r);
                const minW = Math.max(minSize, minSize * r);
                newW = Math.max(minW, Math.min(newW, maxW));
                newH = newW / r;
                newX = right - newW;
                newY = y;
            } else if (activeAction === 'resize-t' || activeAction === 'resize-tr') {
                const bottom = y + h;
                const maxW = Math.min(W - x, bottom * r);
                const minW = Math.max(minSize, minSize * r);
                newW = Math.max(minW, Math.min(newW, maxW));
                newH = newW / r;
                newX = x;
                newY = bottom - newH;
            }
        } else {
            // 2b. Custom Aspect Ratio Resizing (independent boundary clamping)
            if (newX < 0) {
                newW += newX;
                newX = 0;
            }
            if (newY < 0) {
                newH += newY;
                newY = 0;
            }
            if (newX + newW > W) {
                newW = W - newX;
            }
            if (newY + newH > H) {
                newH = H - newY;
            }

            // Correct coordinates if size reaches min threshold
            if (newW < minSize) {
                if (isLeft) {
                    newX = x + w - minSize;
                }
                newW = minSize;
            }
            if (newH < minSize) {
                if (isTop) {
                    newY = y + h - minSize;
                }
                newH = minSize;
            }
        }

        setCropBox({ x: newX, y: newY, w: newW, h: newH });
    }
  };

  const handleMouseUp = () => {
    setActiveAction('none');
  };

  const handleCrop = () => {
      const canvas = canvasRef.current;
      if (!canvas || !image) return;

      // Calculate relative crop coordinates on the high-res image
      const sourceX = (cropBox.x / canvasDim.w) * image.naturalWidth;
      const sourceY = (cropBox.y / canvasDim.h) * image.naturalHeight;
      const sourceW = (cropBox.w / canvasDim.w) * image.naturalWidth;
      const sourceH = (cropBox.h / canvasDim.h) * image.naturalHeight;

      // High-Res Output Canvas
      const outputW = OUTPUT_DIMENSION;
      const outputH = OUTPUT_DIMENSION / (cropBox.w / cropBox.h);
      
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

      // Do not bake visual adjustments into the physical crop pixels to prevent double-filtering
      ctx.filter = 'none';

      // Draw high-resolution cropped area on the output canvas
      ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, outputW, outputH);

      onCropComplete(outputCanvas.toDataURL('image/jpeg', 0.95));
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[10000] animate-in fade-in">
      <div className="bg-[#0B1120] p-8 rounded-3xl shadow-[0_0_80px_rgba(6,182,212,0.15)] border border-cyan-500/30 w-full max-w-2xl flex flex-col items-center">
        <h3 className="text-xl font-black text-white mb-6 uppercase tracking-[0.2em] flex items-center gap-3">
            <Move size={20} className="text-cyan-400"/> Adjust Artifact
        </h3>
        
        {/* Aspect Ratio Selector Row */}
        {cropShape === 'rect' && image && (
            <div className="flex gap-3 mb-6 w-full justify-center">
                {[
                    { label: 'Custom', value: 0 },
                    { label: 'Original', value: image.naturalWidth / image.naturalHeight },
                    { label: '1:1', value: 1 },
                    { label: '4:3', value: 4/3 },
                    { label: '16:9', value: 16/9 }
                ].map((opt) => {
                    const isActive = opt.value === 0 
                        ? !currentAspectRatio 
                        : currentAspectRatio && Math.abs(currentAspectRatio - opt.value) < 0.01;
                    return (
                        <button
                            key={opt.label}
                            type="button"
                            onClick={() => setCurrentAspectRatio(opt.value)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                                isActive 
                                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)]' 
                                    : 'bg-slate-950/40 text-slate-400 border-white/5 hover:border-white/10 hover:text-white'
                            }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        )}

        <div 
            className="relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border-4 border-slate-900 transition-all duration-300 rounded-2xl"
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
            {/* The Sovereign Lens: Pure CSS Glassmorphism for Avatar Editing */}
            {cropShape === 'circle' && (
                <div 
                    className="absolute rounded-full pointer-events-none transition-all duration-75 ring-1 ring-white/20"
                    style={{
                        left: cropBox.x,
                        top: cropBox.y,
                        width: cropBox.w,
                        height: cropBox.h,
                        boxShadow: 'inset 0 4px 20px rgba(255,255,255,0.4), inset 0 -4px 20px rgba(0,0,0,0.6), 0 0 0 9999px rgba(15,23,42,0.85)'
                    }}
                >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/5 to-white/10 backdrop-blur-[2px]" />
                </div>
            )}
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