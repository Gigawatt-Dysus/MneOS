import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { aiStateBridge } from '../../utils/aiStateBridge';
import { GlassButton } from '../GlassButton';
import { auth } from '../../firebaseConfig';
import { WikiTagEditor } from '../shared/WikiTagEditor';
import { RefreshCw } from 'lucide-react';

// Represents the schema injected by our analyzer and auto-proposer scripts
export interface AIProposalDoc {
    _id: string;
    b2Url?: string;
    url?: string;
    thumbnailUrls?: any;
    aiDescription?: string;         // The Moondream one (current baseline)
    proposedCaptionQwen?: string;   // The Local Qwen one
    proposedCaptionGrok?: string;   // The Grok one
    reviewStatus: string;
    caption?: string;
    triage?: any;
    rotation?: number;
    aiGenerator?: string;
}

interface AITriageModalProps {
    isOpen: boolean;
    onClose: () => void;
    document: AIProposalDoc | null;
    onAdopt: (docId: string, finalCaption: string, rotation?: number, sourceAI?: string) => Promise<void>;
}

export const AI_TriageModal: React.FC<AITriageModalProps> = ({ isOpen, onClose, document: triageDoc, onAdopt }) => {
    const generateForensicPrompt = (architectContext: string, previousDraft?: string) => {
    let prompt = `You are an expert digital archivist performing visual extraction for a vector-retrieval (RAG) database. Your goal is to provide a highly descriptive, information-rich caption that balances undeniable forensic facts with semantic nuance.

Analyze the image in two distinct layers, combining them into a single, cohesive paragraph:

1. THE FORENSIC BASE LAYER (Who, What, Where):
- Identify the core subjects (people, animals, objects).
- CRITICAL: Use strictly gender-neutral language (e.g., "person", "individual", "figure") for all adults to prevent misgendering. DO NOT guess subjective adult ages.
- Describe exact physical details. ONLY transcribe text on signs or screens if it is 100% legible. If it is blurry, DO NOT guess it. If it is a screenshot of text, transcribe the key participants and core subject matter objectively.

2. THE ARCHIVAL CONTEXT LAYER (Nuance, Relationship, Subtext):
- Note the spatial relationship between subjects.
- Describe the ambiance or lighting.
- Extract any semantic meaning that would be highly useful for future semantic search.`;

    if (architectContext && architectContext.trim() !== "") {
        prompt += `\n\n3. THE SOVEREIGN CONTEXT LAYER (Ground Truth & Steering):\n- The Architect has provided explicit ground truth context for this asset: "${architectContext.trim()}"\n- You MUST weave this personal context into the archival description as undeniable fact, superseding any visual ambiguity.\n- FOLLOW THE LEAD: If the Architect identifies specific subjects (e.g., people, pets, locations), you MUST use those exact identities/names exactly as they appear in the Sovereign Context. Do not shorten names. You must honor any relationship connectors, ages, or gender pronouns implied by the Architect's context, overriding the default gender-neutral constraints for those specific individuals.`;
    }

    if (previousDraft && previousDraft.trim() !== "") {
        prompt += `\n\n4. REFINE & RE-ROLL DIRECTIVE:\n- The Architect has manually edited your previous draft to correct it. Here is their edited version: "${previousDraft.trim()}"\n- Your task is to use this edited draft as the definitive baseline. Smooth it out, incorporate any new visual details you see that align with it, and ensure the final tone matches the clinical but observant style required. Do not lose the Architect's corrections!`;
    }

    prompt += `\n\nCRITICAL INSTRUCTIONS:\n- Jump straight into the description. DO NOT start with "The image shows..."\n- DO NOT hallucinate text, names, locations, or backstories that are not explicitly visible (unless provided in the Sovereign Context Layer).\n- Keep the tone clinical but observant. Do NOT attribute facts to "The Architect" or "the user" - simply state them as objective archival truths.`;

    return prompt;
};

const SYSTEM_INSTRUCTION = `You are a forensic archivist. You MUST use strictly gender-neutral language (they/them/person/individual). NEVER use 'man', 'woman', 'he', or 'she' under any circumstances unless explicitly told to in the prompt. This is a strict safety constraint.

EXAMPLES OF PERFECT CAPTIONS (ADOPT THIS EXACT TONE AND STRUCTURE):

Example 1 (Document):
A completed official claimant's statement form issued by the Virginia Employment Commission details an employment period from December 8, 2014 to April 24, 2015 with Lawyers Staffing Inc. The document lists the claimant's responses to questions about prior warnings, efforts to improve performance, and policy violations, includes a handwritten signature by Ann Cornett dated May 21, 2015, and bears the form identifier VEC-BA-60 RD (7/2012) at the bottom.

Example 2 (Shadowed Vehicle):
A dark-colored SUV is parked on a paved driveway surrounded by tall deciduous trees. The scene is viewed from an elevated angle. The tree canopy filters bright sunlight, casting heavy, high-contrast shadows across the leaf-strewn ground and a low concrete curb in the foreground. Additional tree trunks occupy the midground, partially screening a distant light-colored building. There is no visible human activity.

Example 3 (Vintage Portrait):
Two individuals are seated side-by-side outdoors against a red brick wall. The person on the left has short light brown hair and wears a light striped button-down shirt with a dark tie, with their right arm resting behind the person on the right. The person on the right has dark hair and wears a navy blue top, a double-strand pearl necklace, and bright red lipstick, with their mouth open in a smile showing teeth. A white architectural column is partially visible on the far right edge of the frame.

Example 4 (Indoor Subject):
A person with shoulder-length reddish-brown hair stands centered in a residential interior, wearing a black short-sleeved t-shirt bearing the text "GENUINE HARLEY-DAVIDSON MOTOR CYCLES" and gray pants, while holding a round blue plate at waist height with both hands; the plate contains a partially sliced loaf of pale bread with scattered crumbs across its surface. The individual faces forward, with a wooden dresser and television visible in the mid-ground.`;


    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingGemini, setIsGeneratingGemini] = useState(false);
    const [isGeneratingGrok, setIsGeneratingGrok] = useState(false);
    const [localGeminiCaption, setLocalGeminiCaption] = useState<string | null>(null);
    const [localGrokCaption, setLocalGrokCaption] = useState<string | null>(null);
    const [architectContext, setArchitectContext] = useState<string>('');
    const [localRotation, setLocalRotation] = useState(triageDoc?.rotation || 0);

    // Fix state leak when switching to a new image
    useEffect(() => {
        setLocalGeminiCaption(null);
        setLocalGrokCaption(null);
        setLocalRotation(triageDoc?.rotation || 0);
    }, [triageDoc?._id, triageDoc?.rotation]);

    if (!isOpen || !triageDoc) return null;

    const handleAdopt = async (caption: string, sourceAI: string = 'Manual Edit') => {
        setIsSaving(true);
        aiStateBridge.setThinking(true, "Adopting AI Proposal...");
        try {
            await onAdopt(triageDoc._id, caption, localRotation, sourceAI);
        } finally {
            setIsSaving(false);
            aiStateBridge.setThinking(false);
            onClose();
        }
    };

    // Resolve the best available image URL (prioritizing high-res for the left pane)
    const imageUrl = triageDoc.b2Url || triageDoc.url || triageDoc.thumbnailUrls?.large || '';

    // Downscale images locally before sending to AI to prevent VRAM explosion (Ollama Error 0xc0000409)
    const fetchAndResizeImage = async (url: string, prefixDataUri: boolean = false): Promise<string> => {
        const imgRes = await fetch(url);
        const blob = await imgRes.blob();
        const objectUrl = URL.createObjectURL(blob);
        
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
                
                URL.revokeObjectURL(objectUrl);
                const dataUri = canvas.toDataURL('image/jpeg', 0.85);
                resolve(prefixDataUri ? dataUri : dataUri.split(',')[1]);
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Image load failed"));
            };
            img.src = objectUrl;
        });
    };

    // Helper function to re-weave tags into the generated text
    const reweaveTags = (generatedText: string, context: string, previousDraft?: string): string => {
        const fullContext = (context || '') + '\n' + (previousDraft || '');
        if (!fullContext.trim() || !generatedText) return generatedText;
        
        // Extract all tags from the combined context: [Name](tag://type:id)
        const tagRegex = /\[([^\]]+)\]\((tag:\/\/[^)]+)\)/g;
        let match;
        let finalOutput = generatedText;
        
        // Create a map of names to their full markdown tag to safely handle duplicates
        const tagsToRestore = new Map<string, string>();
        
        while ((match = tagRegex.exec(fullContext)) !== null) {
            const name = match[1];
            const fullTag = match[0];
            if (!tagsToRestore.has(name)) {
                tagsToRestore.set(name, fullTag);
            }
        }
        
        // Replace plain text occurrences with the full markdown tag
        tagsToRestore.forEach((fullTag, name) => {
            const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // 1. Fix cases where the AI wrote [Name] or [Name](wrong-url)
            const malformedRegex = new RegExp(`\\[${escapedName}\\](?:\\([^)]*\\))?`, 'gi');
            finalOutput = finalOutput.replace(malformedRegex, fullTag);
            
            // 2. Safely replace naked text occurrences
            // Negative lookbehind (?<!\[) ensures we don't double-tag something already inside brackets
            // We use (?<!\w) and (?!\w) instead of \b to safely handle names with punctuation at the edges.
            const replaceRegex = new RegExp(`(?<!\\[)(?<!\\w)${escapedName}(?!\\w)(?!\\])`, 'gi');
            finalOutput = finalOutput.replace(replaceRegex, fullTag);

            // 3. Fallback for dirty tag names (e.g., if the user saved "🐈 Grace " or " Grace")
            // We strip emojis and trim the name. If it's valid and different, we try replacing it too.
            const cleanName = name.replace(/[\p{Emoji}\uFE0F]/gu, '').trim();
            if (cleanName && cleanName !== name && cleanName.length > 2) {
                const escapedClean = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const cleanRegex = new RegExp(`(?<!\\[)(?<!\\w)${escapedClean}(?!\\w)(?!\\])`, 'gi');
                finalOutput = finalOutput.replace(cleanRegex, fullTag);
            }
        });
        
        return finalOutput;
    };

    const handleGenerateGemini = async (previousDraft?: string) => {
        setIsGeneratingGemini(true);
        aiStateBridge.setThinking(true, "Spinning up Gemini 3.1 Pro...");
        try {
            // Fetch image, resize to max 1024x1024, and convert to base64
            const base64data = await fetchAndResizeImage(imageUrl, false);

            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
            if (!apiKey) {
                alert("VITE_GEMINI_API_KEY is missing! Cannot connect to Google Gemini API.");
                return;
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

            const payload = {
                system_instruction: {
                    parts: [{ text: SYSTEM_INSTRUCTION }]
                },
                contents: [{
                    parts: [
                        { text: generateForensicPrompt(architectContext, previousDraft) },
                        { inline_data: { mime_type: "image/jpeg", data: base64data } }
                    ]
                }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 8192
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            };

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                let caption = data.candidates[0].content.parts[0].text.trim();
                const finishReason = data.candidates[0].finishReason;
                if (finishReason && finishReason !== 'STOP') {
                    caption += `\n\n[⚠️ SYSTEM WARNING: GENERATION TRUNCATED. Reason: ${finishReason}]`;
                }
                setLocalGeminiCaption(reweaveTags(caption, architectContext, previousDraft));
            } else {
                console.error("Gemini Error Payload:", data);
                setLocalGeminiCaption(`❌ Gemini Error: ${data.error?.message || data.candidates?.[0]?.finishReason || "Unknown Error"}`);
            }
        } catch (err) {
            console.error("Fetch Error:", err);
            alert("Error connecting to Gemini API.");
        } finally {
            setIsGeneratingGemini(false);
            aiStateBridge.setThinking(false);
        }
    };

    const handleGenerateGrok = async (previousDraft?: string) => {
        setIsGeneratingGrok(true);
        aiStateBridge.setThinking(true, "Spinning up Grok 4.3 Vision...");
        try {
            const url = "https://api.x.ai/v1/chat/completions";
            const apiKey = import.meta.env.VITE_XAI_API_KEY || "";
            if (!apiKey) {
                alert("VITE_XAI_API_KEY is missing!");
                return;
            }

            // Fetch image, resize to max 1024x1024 to save bandwidth, and convert to base64
            const base64data = await fetchAndResizeImage(imageUrl, true);

            const payload = {
                model: "grok-4.3",
                messages: [
                    {
                        role: "system",
                        content: SYSTEM_INSTRUCTION
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: generateForensicPrompt(architectContext, previousDraft) },
                            { type: "image_url", image_url: { url: base64data } }
                        ]
                    }
                ],
                max_tokens: 800,
                temperature: 0.85,
                top_p: 0.95
            };

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.choices?.[0]?.message?.content) {
                setLocalGrokCaption(reweaveTags(data.choices[0].message.content, architectContext, previousDraft));
            } else {
                console.error("Grok Error Payload:", data);
                setLocalGrokCaption(`❌ Grok Error: ${data.error?.message || "Unknown Error"}`);
            }
        } catch (err) {
            console.error("Fetch Error:", err);
            alert("Error connecting to Grok.");
        } finally {
            setIsGeneratingGrok(false);
            aiStateBridge.setThinking(false);
        }
    };

    const modalContent = (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8"
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Backdrop Blur */}
            <div 
                className="absolute inset-0 bg-[#050A15]/80 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Modal Body */}
            <div className="relative w-full max-w-6xl h-[85vh] bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-purple-900/20 overflow-hidden flex flex-col md:flex-row transform transition-all">
                
                {/* LEFT: Docked Image Focus */}
                <div className="w-full md:w-1/2 h-64 md:h-full bg-black/50 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-700/50 relative">
                     <div className="absolute top-4 left-4 z-10 flex gap-2">
                         <span className="px-3 py-1 text-xs font-semibold tracking-wider text-amber-200 bg-amber-900/40 border border-amber-700/50 rounded-full uppercase shadow-sm pointer-events-none">
                             AI Caption Editor
                         </span>
                     </div>
                     <PanZoomImage 
                         src={imageUrl} 
                         alt="Triage Subject" 
                         rotation={localRotation} 
                         onRotate={() => setLocalRotation((localRotation + 90) % 360)}
                     />
                </div>

                {/* RIGHT: Stacked Rows of Proposals */}
                <div className="w-full md:w-1/2 h-full flex flex-col p-6 gap-5 overflow-y-auto custom-scrollbar bg-gradient-to-b from-transparent to-slate-900/50">
                    
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-bold text-slate-100 font-sans tracking-wide">
                            Adopt AI Proposal
                        </h2>
                        <GlassButton 
                            onClick={onClose}
                            variant="ghost"
                            className="p-2 rounded-full"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </GlassButton>
                    </div>

                    {/* SOVEREIGN CONTEXT LAYER */}
                    <div className="shrink-0 flex flex-col gap-2 relative group">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 cursor-help">
                            Sovereign Context Layer (Ground Truth)
                            <div className="hidden group-hover:block absolute left-0 top-full mt-2 w-[80%] bg-slate-800 text-slate-200 text-xs p-3 rounded-xl shadow-xl border border-slate-600 z-50">
                                Enter the undeniable facts about this asset here. If you mention specific people, pets, or events, the AI will weave them into the description as absolute truth, overriding its default safety constraints (like gender neutrality). Use @ to tag entities!
                            </div>
                        </label>
                        <WikiTagEditor
                            value={architectContext}
                            onChange={(val) => setArchitectContext(val)}
                            userId={auth.currentUser?.uid || ''}
                            placeholder="Provide personal context, background story, or truth about this image to guide the AI generation. Use @ to tag..."
                            className="bg-slate-900/50 border-slate-700/50 focus-within:border-purple-500/50"
                            rows={3}
                        />
                    </div>

                    {/* BASELINE (Current DB Value) */}
                    <ProposalCard 
                        title={`Baseline (${triageDoc.aiGenerator || 'Moondream'})`}
                        colorClass="border-rose-800/50 bg-rose-900/10 hover:bg-rose-900/20 hover:border-rose-600/50"
                        titleColor="text-rose-400"
                        caption={triageDoc.caption || triageDoc.triage?.summary || triageDoc.aiDescription || 'N/A'}
                        onAdopt={(val: string) => handleAdopt(val, triageDoc.aiGenerator || 'Moondream')}
                        disabled={isSaving || !(triageDoc.caption || triageDoc.triage?.summary || triageDoc.aiDescription)}
                        allowReRoll={false}
                    />

                    {/* GEMINI (Cloud One-Off) */}
                    <ProposalCard 
                        title="Gemini 3.1 Pro (Cloud)"
                        colorClass="border-blue-800/50 bg-blue-900/10 hover:bg-blue-900/20 hover:border-blue-600/50"
                        titleColor="text-blue-400"
                        caption={localGeminiCaption || 'Pending generation...'}
                        onAdopt={(val: string) => handleAdopt(val, 'Gemini 3.1 Pro')}
                        disabled={isSaving || !localGeminiCaption}
                        showGenerate={!localGeminiCaption}
                        isGenerating={isGeneratingGemini}
                        onGenerate={(draft?: string) => handleGenerateGemini(draft)}
                        allowReRoll={true}
                    />

                    {/* GROK (Premium) */}
                    <ProposalCard 
                        title="Grok 4.3 Vision"
                        colorClass="border-emerald-800/50 bg-emerald-900/10 hover:bg-emerald-900/20 hover:border-emerald-600/50"
                        titleColor="text-emerald-400"
                        caption={localGrokCaption || triageDoc.proposedCaptionGrok || 'Pending generation...'}
                        onAdopt={(val: string) => handleAdopt(val, 'Grok 4.3 Vision')}
                        disabled={isSaving || !(localGrokCaption || triageDoc.proposedCaptionGrok)}
                        showGenerate={!(localGrokCaption || triageDoc.proposedCaptionGrok)}
                        isGenerating={isGeneratingGrok}
                        onGenerate={(draft?: string) => handleGenerateGrok(draft)}
                        badge="Premium Hit"
                        allowReRoll={true}
                    />

                </div>
            </div>
        </div>
    );

    // Render safely into document body via portal to evade parent Z-Index clipping
    return createPortal(modalContent, document.body);
};

const ProposalCard = ({ title, caption, colorClass, titleColor, onAdopt, disabled, badge, showGenerate, onGenerate, isGenerating, allowReRoll }: any) => {
    const [editedCaption, setEditedCaption] = useState(caption);
    const userId = auth.currentUser?.uid || '';

    useEffect(() => {
        if (!isGenerating) {
            setEditedCaption(caption);
        }
    }, [caption, isGenerating]);

    return (
        <div 
            className={`shrink-0 p-5 rounded-xl border ${colorClass} flex flex-col gap-3 group transition-all duration-300 relative`}
        >
            {/* Subtle glow effect on hover */}
            <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 ease-in-out pointer-events-none" />
            </div>
            
            <div className="flex justify-between items-start sm:items-center relative z-10 gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <h3 className={`text-sm font-semibold uppercase tracking-wider ${titleColor}`}>
                        {title}
                    </h3>
                    {badge && (
                        <span className="whitespace-nowrap flex-shrink-0 px-3 py-1 text-[10px] font-black tracking-widest text-emerald-400 bg-emerald-900/40 rounded uppercase shadow-sm border border-emerald-500/30">
                            {badge}
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    {showGenerate && (
                        <GlassButton
                            onClick={() => onGenerate?.()}
                            disabled={isGenerating}
                            variant="secondary"
                            className="px-4 py-1.5 text-sm"
                        >
                            {isGenerating ? "Generating..." : "Generate"}
                        </GlassButton>
                    )}
                    {allowReRoll && !showGenerate && (
                        <GlassButton
                            onClick={() => onGenerate?.(editedCaption)}
                            disabled={isGenerating}
                            variant="secondary"
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-2 flex items-center justify-center border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10 text-amber-400 rounded-full transition-all"
                            title="Refine & Re-Roll this description using the current text as context"
                        >
                            <RefreshCw size={18} className={isGenerating ? "animate-spin" : ""} />
                        </GlassButton>
                    )}
                    <GlassButton
                        onClick={() => onAdopt(editedCaption)}
                        disabled={disabled}
                        variant="primary"
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 px-4 py-1.5 text-sm flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Adopt
                    </GlassButton>
                </div>
            </div>
            <div className="relative z-10 mt-2 rounded bg-black/20 p-2 border border-black/40">
                <WikiTagEditor
                    value={editedCaption}
                    onChange={(val) => setEditedCaption(val)}
                    userId={userId}
                    placeholder="Caption..."
                    className="border-none bg-transparent shadow-none"
                    textSizeClass="text-lg leading-relaxed font-serif italic text-slate-300"
                    rows={4}
                />
            </div>
        </div>
    );
};

const PanZoomImage = ({ src, alt, rotation, onRotate }: { src: string; alt: string; rotation?: number; onRotate?: () => void }) => {
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleWheel = (e: React.WheelEvent) => {
        // Only zoom if they are scrolling within this container
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

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const isSideways = rotation === 90 || rotation === 270;

    return (
        <div 
            className="w-full h-full overflow-hidden relative flex items-center justify-center rounded-lg @container"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-1 bg-slate-900/80 p-1.5 rounded-lg border border-slate-700/50 backdrop-blur-md shadow-xl">
                {onRotate && (
                    <button 
                        onClick={onRotate} 
                        className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                        title="Rotate 90°"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                )}
                <button 
                    onClick={() => setScale(s => Math.min(s + 0.5, 5))} 
                    className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                    title="Zoom In"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
                <button 
                    onClick={() => { setScale(1); setPos({x:0,y:0}); }} 
                    className="w-8 h-8 flex items-center justify-center text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                    title="Reset Zoom"
                >
                    1X
                </button>
                <button 
                    onClick={() => setScale(s => Math.max(s - 0.5, 1))} 
                    className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                    title="Zoom Out"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
            </div>
            
            <img 
                src={src} 
                alt={alt} 
                style={{ 
                    transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale}) rotate(${rotation || 0}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
                className={`object-contain shadow-2xl shadow-black/80 pointer-events-none ${isSideways ? 'max-w-[100cqh] max-h-[100cqw]' : 'max-w-full max-h-full'}`}
            />
        </div>
    );
};
