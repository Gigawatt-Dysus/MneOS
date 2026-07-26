import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { aiStateBridge } from '../../utils/aiStateBridge';
import { GlassButton } from '../GlassButton';
import { RefreshCw, Upload, DownloadCloud, Image as ImageIcon, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import JSZip from 'jszip';

interface BakeryPrepModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SYSTEM_INSTRUCTION = `You are an expert AI dataset annotator preparing high-fidelity training data for a Z-Image / Stable Diffusion LoRA.
Your goal is to provide a highly descriptive, structurally precise caption sidecar for the image.

CRITICAL RULES:
1. ALWAYS start the prompt with the trigger token: "ruthiev4".
2. NO WIKITAGS. Do not use @ links, markdown formatting, or brackets. Plain text only.
3. If she is wearing glasses, describe them precisely as "wire frame oval glasses" (or whatever the user explicitly dictates). DO NOT assume thick frames.
4. If she is NOT wearing glasses, NEVER use the phrase "bare face". Instead, explicitly state: "without glasses, no eyewear, eyes fully visible, clear orbital area".
5. Keep the tone objective, listing physical traits (hair style, skin, freckles, eye color, expression) and clothing. Use a mix of natural language and comma-separated tags typical of Booru/Danbooru styles blended with Midjourney natural language.`;

export const BakeryPrepModal: React.FC<BakeryPrepModalProps> = ({ isOpen, onClose }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [sidecars, setSidecars] = useState<Record<string, string>>({});
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPackaging, setIsPackaging] = useState(false);
    
    // User context for the specific image (e.g. "This is a nude profile, she has no glasses here")
    const [userContext, setUserContext] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset when modal closes/opens
    useEffect(() => {
        if (isOpen && files.length === 0) {
            setSidecars({});
            setCurrentIndex(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const currentFile = files[currentIndex];
    const objectUrl = currentFile ? URL.createObjectURL(currentFile) : '';

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
            setFiles(prev => [...prev, ...selectedFiles]);
        }
    };

    const handleRemoveCurrent = () => {
        const newFiles = [...files];
        newFiles.splice(currentIndex, 1);
        setFiles(newFiles);
        if (currentIndex >= newFiles.length) {
            setCurrentIndex(Math.max(0, newFiles.length - 1));
        }
    };

    // Standard Z-Image resizing (1024 max dimension)
    const getResizedImageData = async (file: File, returnDataUrl: boolean = false): Promise<string> => {
        const blobUrl = URL.createObjectURL(file);
        return new Promise<string>((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                const maxDim = 1024;
                
                if (width > maxDim || height > maxDim) {
                    const ratio = Math.min(maxDim / width, maxDim / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.drawImage(img, 0, 0, width, height);
                
                URL.revokeObjectURL(blobUrl);
                const dataUri = canvas.toDataURL('image/jpeg', 0.90);
                resolve(returnDataUrl ? dataUri : dataUri.split(',')[1]);
            };
            img.onerror = () => {
                URL.revokeObjectURL(blobUrl);
                reject(new Error("Image load failed"));
            };
            img.src = blobUrl;
        });
    };

    const handleGenerate = async (model: 'gemini' | 'grok') => {
        if (!currentFile) return;
        
        setIsGenerating(true);
        aiStateBridge.setThinking(true, `Auto-Captioning with ${model}...`);
        
        try {
            const base64data = await getResizedImageData(currentFile, model === 'grok');
            const promptContext = `Please provide the LoRA training caption for this image.\n\nArchitect Context/Override: "${userContext}"\n\nRemember: No wikitags. Use comma-separated descriptive traits.`;

            let captionText = '';

            if (model === 'gemini') {
                const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
                if (!apiKey) throw new Error("VITE_GEMINI_API_KEY is missing");
                
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                const payload = {
                    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                    contents: [{
                        parts: [
                            { text: promptContext },
                            { inline_data: { mime_type: "image/jpeg", data: base64data } }
                        ]
                    }],
                    generationConfig: { temperature: 0.3 }
                };

                const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data = await res.json();
                captionText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            } else {
                const apiKey = import.meta.env.VITE_XAI_API_KEY || "";
                if (!apiKey) throw new Error("VITE_XAI_API_KEY is missing");
                
                const url = "https://api.x.ai/v1/chat/completions";
                const payload = {
                    model: "grok-4.3",
                    messages: [
                        { role: "system", content: SYSTEM_INSTRUCTION },
                        { role: "user", content: [
                            { type: "text", text: promptContext },
                            { type: "image_url", image_url: { url: base64data } }
                        ]}
                    ],
                    max_tokens: 800,
                    temperature: 0.8
                };

                const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(payload) });
                const data = await res.json();
                captionText = data.choices?.[0]?.message?.content || '';
            }

            if (captionText) {
                setSidecars(prev => ({ ...prev, [currentFile.name]: captionText.trim() }));
            }
        } catch (err) {
            console.error(err);
            alert(`Error generating caption with ${model}`);
        } finally {
            setIsGenerating(false);
            aiStateBridge.setThinking(false);
        }
    };

    const handlePackageAndUpload = async () => {
        if (files.length === 0) return;
        setIsPackaging(true);
        aiStateBridge.setThinking(true, "Packaging LoRA Dataset (Zipping 1024px constraints)...");

        try {
            const zip = new JSZip();

            for (const file of files) {
                // 1. Get standardized 1024px image
                const base64String = await getResizedImageData(file, false);
                const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                
                // Add Image to Zip
                zip.file(`${baseName}.jpg`, base64String, { base64: true });
                
                // Add Text Sidecar to Zip
                const caption = sidecars[file.name] || 'ruthiev4, photograph';
                zip.file(`${baseName}.txt`, caption);
            }

            const content = await zip.generateAsync({ type: 'blob' });
            
            // For now, download to local system so the user can easily B2 it.
            // Ideally this pushes directly to our Next/Express backend to upload to B2.
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Ruthie_Stealth_Bake.zip';
            a.click();
            URL.revokeObjectURL(url);
            
            alert("Dataset packaged and downloaded! You can now send this to the Forge for Baking.");
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to package zip.");
        } finally {
            setIsPackaging(false);
            aiStateBridge.setThinking(false);
        }
    };

    const currentCaption = currentFile ? sidecars[currentFile.name] || '' : '';

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8" onKeyDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-[#050A15]/90 backdrop-blur-md" onClick={onClose} />
            
            <div className="relative w-full max-w-7xl h-[90vh] bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-black/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-600/20 rounded border border-purple-500/30 text-purple-400">
                            <ImageIcon size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-100 font-sans tracking-wide">Bakery Prep (LoRA Orchestration)</h2>
                            <p className="text-xs text-slate-400">Curate, Auto-Caption, and Package datasets for the Forge.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <GlassButton onClick={() => fileInputRef.current?.click()} variant="secondary" className="text-sm px-4">
                            <Upload size={16} className="mr-2" /> Add Images
                        </GlassButton>
                        <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                        
                        <GlassButton onClick={handlePackageAndUpload} disabled={files.length === 0 || isPackaging} variant="primary" className="text-sm px-4 bg-emerald-600/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-600/40">
                            <DownloadCloud size={16} className="mr-2" /> Package & Export Zip
                        </GlassButton>
                        <GlassButton onClick={onClose} variant="ghost" className="p-2 rounded-full text-slate-400 hover:text-white">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </GlassButton>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Gallery List */}
                    <div className="w-64 border-r border-slate-700/50 bg-black/30 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-2">
                        {files.map((f, i) => (
                            <div 
                                key={f.name + i}
                                onClick={() => setCurrentIndex(i)}
                                className={`p-2 rounded cursor-pointer border transition-all flex items-center gap-2 ${i === currentIndex ? 'bg-purple-900/40 border-purple-500/50' : 'bg-slate-800/30 border-transparent hover:bg-slate-800/70'}`}
                            >
                                <div className="w-10 h-10 shrink-0 bg-slate-900 rounded overflow-hidden">
                                    <img src={URL.createObjectURL(f)} alt="thumb" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 truncate text-xs text-slate-300">{f.name}</div>
                                {sidecars[f.name] && <CheckCircle size={14} className="text-emerald-400 shrink-0" />}
                            </div>
                        ))}
                        {files.length === 0 && (
                            <div className="text-center text-slate-500 text-sm mt-10 px-4">
                                No images loaded. Click "Add Images" to begin.
                            </div>
                        )}
                    </div>

                    {/* Right: Active Editor */}
                    {currentFile ? (
                        <div className="flex-1 flex flex-col bg-slate-900/20">
                            {/* Viewport */}
                            <div className="flex-1 border-b border-slate-700/50 p-4 flex justify-center items-center relative overflow-hidden bg-[url('/grid-pattern.svg')]">
                                <PanZoomImage src={objectUrl} alt="Active Subject" />
                                
                                {/* Nav Buttons */}
                                <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/80 rounded-full text-white disabled:opacity-20 transition-all">
                                    <ChevronLeft size={24} />
                                </button>
                                <button onClick={() => setCurrentIndex(Math.min(files.length - 1, currentIndex + 1))} disabled={currentIndex === files.length - 1} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/80 rounded-full text-white disabled:opacity-20 transition-all">
                                    <ChevronRight size={24} />
                                </button>
                                <button onClick={handleRemoveCurrent} className="absolute top-4 right-4 px-3 py-1 bg-red-900/40 text-red-400 hover:bg-red-900/80 rounded text-xs border border-red-500/30 transition-colors">
                                    Remove Image
                                </button>
                            </div>

                            {/* Caption Editor */}
                            <div className="h-72 p-6 flex flex-col gap-4 bg-black/40 shrink-0">
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-1 mb-1 block">Context Override (Optional)</label>
                                        <input 
                                            type="text"
                                            value={userContext}
                                            onChange={(e) => setUserContext(e.target.value)}
                                            placeholder="e.g. 'Nude profile, no glasses'"
                                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-purple-500 focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex items-end gap-2 shrink-0">
                                        <GlassButton onClick={() => handleGenerate('gemini')} disabled={isGenerating} variant="secondary" className="px-4 py-2 text-sm border-blue-500/30 hover:border-blue-500/60 text-blue-300">
                                            {isGenerating ? <RefreshCw className="animate-spin w-4 h-4" /> : 'Caption (Gemini Flash)'}
                                        </GlassButton>
                                        <GlassButton onClick={() => handleGenerate('grok')} disabled={isGenerating} variant="secondary" className="px-4 py-2 text-sm border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300">
                                            {isGenerating ? <RefreshCw className="animate-spin w-4 h-4" /> : 'Caption (Grok Vision)'}
                                        </GlassButton>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-1 mb-1 block">Final Sidecar (.txt)</label>
                                    <textarea 
                                        value={currentCaption}
                                        onChange={(e) => setSidecars(prev => ({ ...prev, [currentFile.name]: e.target.value }))}
                                        placeholder="ruthiev4, photorealistic..."
                                        className="w-full flex-1 bg-slate-900 border border-slate-700 rounded p-3 text-sm font-mono text-amber-200 focus:border-purple-500 focus:outline-none custom-scrollbar"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-600 bg-black/20">
                            Select or Add an image to begin.
                        </div>
                    )}
                </div>
            </div>
        </div>
    , document.body);
};

// Simplified PanZoom without rotation for the Bakery
const PanZoomImage = ({ src, alt }: { src: string; alt: string; }) => {
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleWheel = (e: React.WheelEvent) => {
        const zoomSensitivity = 0.1;
        const delta = e.deltaY > 0 ? -1 : 1;
        setScale(prev => Math.min(Math.max(1, prev + delta * zoomSensitivity), 5));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPos({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    return (
        <div 
            className="w-full h-full overflow-hidden relative flex items-center justify-center"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
            <div className="absolute bottom-4 right-4 z-20 flex gap-2">
                <button onClick={() => setScale(s => Math.max(s - 0.5, 1))} className="px-3 py-1 bg-black/50 text-white rounded text-xs hover:bg-black/80">-</button>
                <button onClick={() => { setScale(1); setPos({x:0,y:0}); }} className="px-3 py-1 bg-black/50 text-white rounded text-xs hover:bg-black/80">Reset</button>
                <button onClick={() => setScale(s => Math.min(s + 0.5, 5))} className="px-3 py-1 bg-black/50 text-white rounded text-xs hover:bg-black/80">+</button>
            </div>
            
            <img 
                src={src} 
                alt={alt} 
                style={{ 
                    transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
                className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-2xl"
            />
        </div>
    );
};
