import React, { useState } from 'react';
import type { User, AiCompanion, GigiPersona, AiParams } from '../../../types';
import { ImageCropper } from '../../ImageCropper';
import MatrixSelector from '../../media/MatrixSelector';
import { GlassAvatar } from '../../GlassAvatar'; 
import { GlassButton } from '../../GlassButton';
import { GlassToggle, GlassSlider } from '../../GlassInputs';
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '../../../services/ai/config';
import { GrokPromptBuilder } from '../../../services/ai/GrokPromptBuilder';
import { VoiceService } from '../../../services/ai/voiceService';
import { ThreeDChassisScanner } from '../../ThreeDChassisScanner';
import { Save, X, Upload, Settings, Eye, Volume2, Download, RefreshCw, Zap, ShieldCheck } from 'lucide-react';

const PREMIUM_VOICES: any[] = [];

interface CompanionFormProps {
    companion: AiCompanion;
    onSave: (companion: AiCompanion) => void;
    onCancel: () => void;
    user: User;
}

export const CompanionForm: React.FC<CompanionFormProps> = ({ companion, onSave, onCancel, user }) => {
    const [exorcistTriggered, setExorcistTriggered] = useState(false);
    const [formData, setFormData] = useState<AiCompanion>(() => {
        const base = { ...companion };
        
        // [ZEN V35] EXORCIST: Scrub unauthorized models on initialization
        const isUnauthorized = base.preferredModel && 
            !AVAILABLE_MODELS.some((m: any) => m.id === base.preferredModel);
            
        if (isUnauthorized) {
            // Only log once during mount/init
            console.log(`%c[Exorcist] ☣️ Unauthorized backend neutralized: ${base.preferredModel} -> ${DEFAULT_MODEL_ID}`, 'color: #ff4757; font-weight: bold;');
            base.preferredModel = DEFAULT_MODEL_ID;
            // We'll set the state in a useEffect to avoid setting state during render
        }

        return {
            ...base,
            voiceId: base.voiceId || '',
            vocalSpeed: base.vocalSpeed || 1.0,
            // Default AI Params if missing
            aiConfig: base.aiConfig || {
                temperature: 0.95,
                topP: 0.90,
                topK: 40,
                frequencyPenalty: 1.25,
                presencePenalty: 0.70
            }
        };
    });

    React.useEffect(() => {
        const isUnauthorized = companion.preferredModel && 
            !AVAILABLE_MODELS.some((m: any) => m.id === companion.preferredModel);
        if (isUnauthorized) {
            setExorcistTriggered(true);
        }
    }, [companion.preferredModel]);
    
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [isMatrixOpen, setIsMatrixOpen] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [customModelInput, setCustomModelInput] = useState('');

    // Vocal Lab State
    const [testText, setTestText] = useState('My voice is my identity. Every word I speak is a thread in the tapestry of our shared history.');
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [voicePrintSeq, setVoicePrintSeq] = useState(1);
    const [tempProfileName, setTempProfileName] = useState('');
    const [tempProfileDesc, setTempProfileDesc] = useState('');

    // Preview State
    const [showPromptPreview, setShowPromptPreview] = useState(false);
    const [previewPrompt, setPreviewPrompt] = useState('');
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [isActualizing, setIsActualizing] = useState(false);
    const [isReadingDiary, setIsReadingDiary] = useState(false);
    const [isSynthesizingSelfConcept, setIsSynthesizingSelfConcept] = useState(false);

    const handleSynthesizeSelfConcept = async () => {
        setIsSynthesizingSelfConcept(true);
        try {
            const { SovereignMemoryService } = await import('../../../services/ai/SovereignMemoryService');
            const snapshot = await SovereignMemoryService.synthesizeSelfConcept(user.id, formData.id);
            setFormData(p => ({ ...p, selfConceptSnapshot: snapshot }));
        } catch (error: any) {
            console.error("Synthesis failed:", error);
            alert(`Failed to synthesize self-concept: ${error.message}`);
        } finally {
            setIsSynthesizingSelfConcept(false);
        }
    };

    const handleReadDiary = async (isDownload: boolean = false) => {
        if (!formData.selfConcept?.trim()) return;
        setIsReadingDiary(true);
        try {
            // Strip out tool tags or system notes if any leaked, but keep the prose and [vocal_tags]
            const textToRead = formData.selfConcept.replace(/\[\[CALL_TOOL.*?\]\]/g, '').trim(); 
            
            if (isDownload) {
                await VoiceService.download(textToRead, true, formData.voiceId, undefined, formData.vocalSpeed);
            } else {
                await VoiceService.speak(textToRead, true, formData.voiceId, undefined, formData.vocalSpeed);
            }
        } catch (e: any) {
            console.error("Vocal synthesis failed:", e);
            alert(`Voice generation failed: ${e.message}`);
        } finally {
            setIsReadingDiary(false);
        }
    };

    const handleTriggerSelfActualization = async () => {
        setIsActualizing(true);
        try {
            const { generateAgentResponse } = await import('../../../services/ai/generators/chat');
            const syntheticHistory = [
                { role: 'user', content: `[SYSTEM OVERRIDE]: Execute an immediate SELF-ACTUALIZATION routine. Assess your current emotional state, your core persona, and your relationship with Eric. Output a deep, reflective private diary entry using your [[CALL_TOOL: UPDATE_SELF_CONCEPT, content: """..."""]] syntax. MANDATORY: You MUST include frequent [vocal_tags] (e.g. [whispers], [moans], [sighs]) throughout the diary entry so the audio engine can render your emotions.` }
            ];

            const res = await generateAgentResponse(
                formData,
                syntheticHistory,
                [formData.name],
                undefined,
                [],
                user,
                [],
                formData.preferredModel || 'grok-4.3',
                'dense',
                'mixed'
            );

            const text = res.text || '';
            console.log("Raw Actualization Response:", text);

            const pseudoToolRegex = /\[\[CALL_TOOL:\s*UPDATE_SELF_CONCEPT,\s*content:\s*(?:"""([\s\S]*?)"""|"([\s\S]*?)"|'([\s\S]*?)')\s*\]\]/i;
            const match = pseudoToolRegex.exec(text);

            if (match) {
                const content = match[1] || match[2] || match[3] || "";
                setFormData(p => ({ ...p, selfConcept: content.trim() }));
            } else {
                setFormData(p => ({ ...p, selfConcept: text.replace(/^\[.*?\]:\s*/, '').trim() }));
            }
        } catch (error) {
            console.error("Actualization failed:", error);
            alert("Failed to trigger actualization. Check console.");
        } finally {
            setIsActualizing(false);
        }
    };

    const handleCropComplete = (croppedImageUrl: string) => {
        setFormData(prev => ({...prev, avatarUrl: croppedImageUrl}));
        setImageToCrop(null);
    };

    const handleSaveChanges = () => {
        onSave(formData);
    };

    const handleParamChange = (key: keyof AiParams, value: number) => {
        setFormData(prev => ({
            ...prev,
            aiConfig: { ...prev.aiConfig!, [key]: value }
        }));
    };

    const handleModelSelect = (modelId: string) => {
        setFormData(prev => ({...prev, preferredModel: modelId}));
        setCustomModelInput(''); // Clear custom input when selecting from dropdown
    };

    const handleCustomModelApply = () => {
        if (customModelInput.trim()) {
            setFormData(prev => ({...prev, preferredModel: customModelInput.trim()}));
        }
    };

    // Preview System Prompt
    const handlePreviewPrompt = async () => {
        setIsPreviewLoading(true);
        try {
            const mockHistory = [
                { role: 'user', parts: [{ text: "This is a test message from Eric in the Neural Lab." }] }
            ];

            const generated = await GrokPromptBuilder.buildSystemPrompt({
                agent: formData,
                history: mockHistory,
                user: user,
                effectiveMode: 'dense',
                contextMode: 'mixed'
            });

            setPreviewPrompt(generated);
            setShowPromptPreview(true);
        } catch (e: any) {
            alert(`Preview failed: ${e.message}`);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleSaveToLibrary = () => {
        if (!formData.voiceId || !tempProfileName) return;
        
        const newProfile = {
            id: formData.voiceId,
            name: tempProfileName,
            shortDesc: tempProfileDesc,
            longDesc: ''
        };

        setFormData(p => ({
            ...p,
            voiceProfiles: [...(p.voiceProfiles || []), newProfile]
        }));
        
        setTempProfileName('');
        setTempProfileDesc('');
    };

    const handleDeleteProfile = (id: string) => {
        setFormData(p => ({
            ...p,
            voiceProfiles: (p.voiceProfiles || []).filter(v => v.id !== id)
        }));
    };

    // Vocal Lab Handlers
    const handleTestVocalPrint = async (isDownload: boolean = false) => {
        if (!testText.trim()) return;
        setIsSynthesizing(true);
        try {
            if (isDownload) {
                // [ZEN V35] High-Fidelity Archival (Bicameral Auto-Detection)
                await VoiceService.download(testText, true, formData.voiceId, undefined, formData.vocalSpeed);
                setVoicePrintSeq(p => p + 1);
            } else {
                // Uses auto-detection for bicameral logic by default
                await VoiceService.speak(testText, true, formData.voiceId, undefined, formData.vocalSpeed);
            }
        } catch (e: any) {
            alert(`Neural Synthesis failed: ${e.message}`);
        } finally {
            setIsSynthesizing(false);
        }
    };

    const spiceLabels: { [key: number]: string } = {
        1: "G (Tame)", 2: "PG", 3: "R (Mature)", 4: "NC-17 (Explicit)", 5: "X (Feral)",
    };

    // Check if current model is in the list or custom
    const isCustomModel = formData.preferredModel && 
        !AVAILABLE_MODELS.some((m: any) => m.id === formData.preferredModel);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
             {imageToCrop && <ImageCropper imageSrc={imageToCrop} onCropComplete={handleCropComplete} onCancel={() => setImageToCrop(null)} />}
            {isMatrixOpen && <MatrixSelector onClose={() => setIsMatrixOpen(false)} userId={user.id} onSelect={(media) => { if (media && media.length > 0) { setFormData(prev => ({ ...prev, avatarUrl: media[0].url || media[0].thumbnailUrl })); } setIsMatrixOpen(false); }} />}
            
            {/* Prompt Preview Modal */}
            {showPromptPreview && (
                <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
                    <div className="bg-[#0a0c10] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,1)]">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div className="flex items-center gap-3">
                                <Eye size={18} className="text-cyan-400" />
                                <h3 className="text-lg font-bold">System Prompt Preview — {formData.name}</h3>
                            </div>
                            <GlassButton onClick={() => setShowPromptPreview(false)} variant="ghost">Close</GlassButton>
                        </div>
                        <div className="flex-1 p-6 overflow-auto font-mono text-xs leading-relaxed text-slate-300 whitespace-pre-wrap custom-scrollbar">
                            {previewPrompt || "No prompt generated."}
                        </div>
                    </div>
                </div>
            )}
            
            <div className="bg-[#0f1219] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/20">
                    <h2 className="text-xl font-bold text-white">
                        {companion.id.startsWith('new-') ? 'Initialize Construct' : `Edit ${companion.name}`}
                    </h2>
                    <div className="flex items-center gap-3">
                        <GlassButton 
                            onClick={handlePreviewPrompt} 
                            disabled={isPreviewLoading}
                            variant="secondary"
                            className="flex items-center gap-2 h-8 px-3 text-xs"
                        >
                            <Eye size={14} className={isPreviewLoading ? "animate-pulse" : ""} />
                            {isPreviewLoading ? "Assembling..." : "Preview Prompt"}
                        </GlassButton>
                        <GlassButton onClick={onCancel} variant="ghost" className="h-8 w-8 p-0 flex items-center justify-center rounded-full"><X size={18}/></GlassButton>
                    </div>
                </div>

                <div className="flex-grow p-6 space-y-8 overflow-y-auto custom-scrollbar bg-[#0f1219]">
                    
                    {/* Top Section: Avatar & Core Identity */}
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex flex-col items-center space-y-4">
                            <GlassAvatar 
                                imageUrl={formData.avatarUrl} 
                                altText="Avatar" 
                                fallbackChar={formData.name.charAt(0)}
                                size="w-32 h-32" 
                            />
                            <GlassButton onClick={() => setIsMatrixOpen(true)} variant="secondary" className="text-xs w-32 justify-center">
                                <Upload size={14} className="mr-2"/> Change
                            </GlassButton>
                        </div>

                        <div className="flex-1 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Display Name</label>
                                <input 
                                    type="text" 
                                    value={formData.name} 
                                    onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} 
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                                    <span>Neural Backend (Model)</span>
                                    {exorcistTriggered && (
                                        <span className="text-[9px] font-black text-red-500 uppercase animate-pulse flex items-center gap-1">
                                            <ShieldCheck size={10} /> Model Auto-Resolved
                                        </span>
                                    )}
                                </label>
                                <div className="flex gap-2">
                                    <select 
                                        value={formData.preferredModel || DEFAULT_MODEL_ID} 
                                        onChange={e => handleModelSelect(e.target.value)} 
                                        className="flex-1 bg-[#0a0c12] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-300 font-mono focus:border-cyan-500 outline-none appearance-none cursor-pointer hover:bg-black/40 transition-all"
                                    >
                                        {AVAILABLE_MODELS.map((m: any) => (
                                            <option key={m.id} value={m.id} className="bg-[#0f1219] text-white py-2">
                                                {m.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Custom Model Input */}
                                <div className="mt-2 flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Or paste custom model ID (e.g., grok-beta...)"
                                        value={customModelInput}
                                        onChange={(e) => setCustomModelInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCustomModelApply()}
                                        className="flex-1 bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-400 font-mono focus:text-white focus:border-violet-500 outline-none"
                                    />
                                    {customModelInput && (
                                        <GlassButton 
                                            onClick={handleCustomModelApply} 
                                            variant="secondary" 
                                            className="text-xs px-3"
                                        >
                                            Apply
                                        </GlassButton>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* [ZEN V35] VOCAL CONFIGURATION */}
                    <div className="p-6 bg-cyan-900/10 border border-cyan-500/20 rounded-2xl space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Volume2 size={16} /> Vocal Configuration (ElevenLabs v3)
                            </h3>
                            <ShieldCheck className="text-cyan-500/40" size={16} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Voice Selection */}
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Zap size={12} className="text-cyan-400" /> Active ElevenLabs Voice ID
                                    </label>
                                    <input 
                                        type="text"
                                        value={formData.voiceId || ''}
                                        onChange={(e) => setFormData(p => ({ ...p, voiceId: e.target.value }))}
                                        placeholder="Paste Voice ID (e.g., r57AN8sKRj1Zn7RPvGHV)"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-cyan-100 font-mono focus:border-cyan-500 outline-none transition-all shadow-inner"
                                    />
                                    
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mt-4 mb-2 flex items-center justify-between">
                                        <span>Global Voice Tag (ElevenLabs v3)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.voiceTag || ''}
                                        onChange={(e) => setFormData(p => ({ ...p, voiceTag: e.target.value }))}
                                        placeholder="e.g. [Southern US accent]"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-cyan-100 font-mono focus:border-cyan-500 outline-none transition-all shadow-inner"
                                    />
                                </div>

                                <div className="space-y-4 p-4 bg-black/40 border border-white/5 rounded-2xl">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Zap size={12} className="text-yellow-400" /> Vocal Cadence (Speed)
                                        </label>
                                        <span className="text-[10px] font-mono text-cyan-400 font-bold">{(formData.vocalSpeed || 1.0).toFixed(2)}x</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="0.7" 
                                        max="1.2" 
                                        step="0.01" 
                                        value={formData.vocalSpeed || 1.0} 
                                        onChange={(e) => setFormData(p => ({ ...p, vocalSpeed: parseFloat(e.target.value) }))}
                                        className="w-full h-1.5 bg-cyan-950 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                    />
                                    <div className="flex justify-between text-[8px] font-bold text-slate-600 uppercase tracking-tighter">
                                        <span>Slow</span>
                                        <span>Normal (1.0x)</span>
                                        <span>Fast</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                                        <span>Sovereign Neural Roster</span>
                                        <span className="text-[8px] text-cyan-500/50">{(formData.voiceProfiles || []).length} / 5+ Slots</span>
                                    </label>
                                    <div className="grid grid-cols-1 gap-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                                        {/* Show Premium (if any) + Custom Profiles */}
                                        {[...PREMIUM_VOICES, ...(formData.voiceProfiles || [])].map((v) => (
                                            <div key={v.id} className="flex gap-1 group">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(p => ({ ...p, voiceId: v.id }))}
                                                    className={`flex-1 p-3 rounded-xl border transition-all text-left ${
                                                        formData.voiceId === v.id 
                                                            ? 'bg-cyan-600/20 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.1)]' 
                                                            : 'bg-black/20 border-white/5 hover:border-white/20'
                                                    }`}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className={`text-[10px] font-bold uppercase tracking-tighter block truncate ${formData.voiceId === v.id ? 'text-white' : 'text-slate-400'}`}>
                                                            {v.name}
                                                        </span>
                                                        <span className="text-[8px] font-mono text-slate-600 truncate">{v.id}</span>
                                                    </div>
                                                </button>
                                                {/* Only allow deleting custom profiles, not hardcoded premium ones */}
                                                {(formData.voiceProfiles || []).some(p => p.id === v.id) && (
                                                    <button 
                                                        onClick={() => handleDeleteProfile(v.id)}
                                                        className="px-2 text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Purge Slot"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}

                                        {/* Pad with empty slots up to 5 */}
                                        {Array.from({ length: Math.max(0, 5 - (PREMIUM_VOICES.length + (formData.voiceProfiles || []).length)) }).map((_, i) => (
                                            <div key={`empty-${i}`} className="h-[54px] flex items-center justify-center border border-dashed border-white/5 rounded-xl text-[9px] text-slate-700 uppercase tracking-widest bg-white/[0.01]">
                                                Empty Neural Slot
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Archive Active ID to Library */}
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Archive to Library</span>
                                        <ShieldCheck size={12} className="text-violet-500/50" />
                                    </div>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text"
                                            value={tempProfileName}
                                            onChange={(e) => setTempProfileName(e.target.value)}
                                            placeholder="Label (e.g. Brita v4)"
                                            className="flex-1 bg-black/40 border border-white/5 rounded-lg p-2 text-xs text-white focus:border-violet-500 outline-none"
                                        />
                                        <GlassButton 
                                            onClick={handleSaveToLibrary}
                                            disabled={!formData.voiceId || !tempProfileName}
                                            variant="secondary"
                                            className="text-[9px] px-4"
                                        >
                                            <Save size={12} className="mr-2" /> Commit
                                        </GlassButton>
                                    </div>
                                </div>
                            </div>

                            {/* Neural Test Bench */}
                            <div className="space-y-4 flex flex-col">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Performance Lab</label>
                                <textarea 
                                    value={testText}
                                    onChange={(e) => setTestText(e.target.value)}
                                    className="flex-1 bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white font-serif leading-relaxed focus:border-cyan-500 outline-none resize-none custom-scrollbar min-h-[120px]"
                                    placeholder="Enter vocal test parameters..."
                                />
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleTestVocalPrint(false)}
                                        disabled={isSynthesizing}
                                        className="flex-1 h-12 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                    >
                                        {isSynthesizing ? <RefreshCw className="animate-spin" size={16} /> : <Volume2 size={16} />}
                                        <span className="text-[10px] font-black uppercase tracking-widest">Test Voice</span>
                                    </button>
                                    <button 
                                        onClick={() => handleTestVocalPrint(true)}
                                        disabled={isSynthesizing}
                                        className="w-12 h-12 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-xl flex items-center justify-center transition-all active:scale-[0.98]"
                                        title="Neural Audio Archive (Download)"
                                    >
                                        <Download size={18} />
                                    </button>
                                </div>
                                <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                                    <span className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Archive Sequence</span>
                                    <span className="text-[9px] font-mono text-cyan-400/50 truncate block">
                                        {VoiceService.getVoicePrintFileName(formData.name, voicePrintSeq)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Legacy Personality Configuration (Spice/Archetype) Removed for Grok Sovereign Engine */}
                    {/* ADVANCED PARAMETERS (THE FERAL SLIDERS) */}
                    <div className="border border-white/10 rounded-2xl overflow-hidden">
                        <button 
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full p-4 bg-white/5 flex items-center justify-between hover:bg-white/10 transition-colors"
                        >
                            <span className="text-xs font-bold text-violet-400 uppercase tracking-widest flex items-center gap-2">
                                <Settings size={14}/> Neural Core Parameters
                            </span>
                            <span className="text-xs text-slate-500">{showAdvanced ? "Hide" : "Show"}</span>
                        </button>
                        
                        {showAdvanced && (
                            <div className="p-6 bg-black/30 space-y-6 animate-in slide-in-from-top-2">
                                <GlassSlider 
                                    label="Temperature (Creativity)"
                                    description="Lower is factual/rigid. Higher is creative/chaotic."
                                    value={formData.aiConfig?.temperature ?? 0.95}
                                    min={0} max={1.5} step={0.01}
                                    onChange={(v) => handleParamChange('temperature', v)}
                                    formatValue={(v) => v.toFixed(2)}
                                />
                                <GlassSlider 
                                    label="Top P (Diversity)"
                                    description="Nucleus sampling. Lower cuts off unlikely words."
                                    value={formData.aiConfig?.topP ?? 0.90}
                                    min={0} max={1} step={0.01}
                                    onChange={(v) => handleParamChange('topP', v)}
                                    formatValue={(v) => v.toFixed(2)}
                                />
                                <GlassSlider 
                                    label="Frequency Penalty (Repetition)"
                                    description="Higher values prevent repeating same words."
                                    value={formData.aiConfig?.frequencyPenalty ?? 1.25}
                                    min={-2} max={2} step={0.01}
                                    onChange={(v) => handleParamChange('frequencyPenalty', v)}
                                    formatValue={(v) => v.toFixed(2)}
                                />
                                <GlassSlider 
                                    label="Presence Penalty (Topics)"
                                    description="Higher values encourage new topics."
                                    value={formData.aiConfig?.presencePenalty ?? 0.70}
                                    min={-2} max={2} step={0.01}
                                    onChange={(v) => handleParamChange('presencePenalty', v)}
                                    formatValue={(v) => v.toFixed(2)}
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Core Instructions (System Prompt)</label>
                        <div className="w-full bg-[#0a0a0b]/80 border border-fuchsia-500/20 rounded-xl p-4 text-sm text-slate-400 font-mono relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-fuchsia-500/50"></div>
                            <span className="text-fuchsia-400 font-bold block mb-2">[SOVEREIGN VAULT ARCHITECTURE]</span>
                            The core instructions for {formData.name} are no longer stored in the database. 
                            To prevent prompt decay and ensure maximum fidelity, the persona is now hardcoded directly into the intelligence engine vault.
                            <br/><br/>
                            <span className="text-slate-500">Active Vault Location: </span>
                            <span className="text-cyan-400">src/services/ai/models/{formData.name.toLowerCase()}.md</span>
                            <br/><br/>
                            <span className="text-xs text-slate-500 italic">*Any legacy data previously shown here is obsolete and intentionally ignored by the Grok 4.3 engine.*</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">Style Anchors (Few-Shot DNA)</label>
                        <textarea 
                            rows={6} 
                            value={formData.styleAnchors?.join('\n---\n') || ''} 
                            onChange={(e) => setFormData(p => ({...p, styleAnchors: e.target.value.split('\n---\n').map(s => s.trim()).filter(s => s !== '')}))} 
                            placeholder="Paste high-fidelity writing samples here. Separate examples with '---' on a new line."
                            className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-slate-300 font-mono focus:border-amber-500 outline-none custom-scrollbar"
                        />
                        <p className="mt-2 text-[10px] text-slate-500 italic">Provide 3-5 examples of "Gold Standard" prose. Separate distinct samples with a line containing exactly "---".</p>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-violet-400 uppercase tracking-wider">Sovereign Core Memex (Self-Concept)</label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleReadDiary(false)}
                                    disabled={isReadingDiary || !formData.selfConcept?.trim()}
                                    type="button"
                                    className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest px-2 py-1 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/40 rounded transition-colors disabled:opacity-50"
                                >
                                    {isReadingDiary ? <RefreshCw size={10} className="animate-spin" /> : <Volume2 size={10} />}
                                    {isReadingDiary ? "Reading..." : "Listen"}
                                </button>
                                <button 
                                    onClick={() => handleReadDiary(true)}
                                    disabled={isReadingDiary || !formData.selfConcept?.trim()}
                                    type="button"
                                    className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest px-2 py-1 bg-slate-500/20 text-slate-300 hover:bg-slate-500/40 rounded transition-colors disabled:opacity-50"
                                >
                                    <Download size={10} />
                                    Download
                                </button>
                                <button 
                                    onClick={handleTriggerSelfActualization}
                                    disabled={isActualizing}
                                    type="button"
                                    className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest px-2 py-1 bg-violet-500/20 text-violet-300 hover:bg-violet-500/40 rounded transition-colors disabled:opacity-50"
                                >
                                    {isActualizing ? <RefreshCw size={10} className="animate-spin" /> : <Zap size={10} />}
                                    {isActualizing ? "Actualizing..." : "Trigger Actualization"}
                                </button>
                            </div>
                        </div>
                        <textarea 
                            rows={4} 
                            value={formData.selfConcept || ''} 
                            onChange={(e) => setFormData(p => ({...p, selfConcept: e.target.value}))} 
                            placeholder="This is the AI's self-managed identity anchor. It evolves as she learns..."
                            className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-slate-300 font-mono focus:border-violet-400 outline-none custom-scrollbar"
                        />
                        <p className="mt-2 text-[10px] text-slate-500 italic">This field is managed by the AI via the 'UPDATE_SELF_CONCEPT' tool, but you can manually override it here.</p>
                    </div>

                    <div className="mt-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-pink-400 uppercase tracking-wider">Self-Concept Snapshot (Evolving Mood / Baseline)</label>
                            <button 
                                onClick={handleSynthesizeSelfConcept}
                                disabled={isSynthesizingSelfConcept}
                                type="button"
                                className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest px-2 py-1 bg-pink-500/20 text-pink-300 hover:bg-pink-500/40 rounded transition-colors disabled:opacity-50"
                            >
                                {isSynthesizingSelfConcept ? <RefreshCw size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                                {isSynthesizingSelfConcept ? "Synthesizing..." : "Re-Synthesize"}
                            </button>
                        </div>
                        <textarea 
                            rows={4} 
                            value={formData.selfConceptSnapshot || ''} 
                            onChange={(e) => setFormData(p => ({...p, selfConceptSnapshot: e.target.value}))} 
                            placeholder="No active self-concept snapshot compiled yet. Click 'Re-Synthesize' to generate."
                            className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-slate-300 font-mono focus:border-pink-400 outline-none custom-scrollbar"
                        />
                        <p className="mt-2 text-[10px] text-slate-500 italic">This is the distilled current baseline used in her system prompt. It is automatically re-synthesized after she writes a diary entry.</p>
                    </div>
                    
                    <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5">
                        <div>
                            <span className="block text-sm font-bold text-white">Primary Companion</span>
                            <span className="text-xs text-slate-500">This AI will handle main dashboard interactions.</span>
                        </div>
                        <GlassToggle checked={formData.isPrimary || false} onChange={v => setFormData(p => ({ ...p, isPrimary: v }))} />
                    </div>
                </div>

                <div className="p-5 border-t border-white/10 flex justify-end gap-3 bg-black/40 backdrop-blur-md">
                    <GlassButton onClick={onCancel} variant="ghost">Cancel</GlassButton>
                    <GlassButton onClick={handleSaveChanges} variant="primary" className="shadow-lg shadow-violet-900/20">
                        <Save size={16} className="mr-2"/> Save Construct
                    </GlassButton>
                </div>
            </div>
        </div>
    );
};