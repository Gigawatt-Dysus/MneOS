import React, { useState, useRef } from 'react';
import type { User, AiCompanion, GigiPersona, AiParams } from '@/types';
import { ImageCropper } from '../../ImageCropper';
import MatrixSelector from '../../media/MatrixSelector';
import { GlassAvatar } from '../../GlassAvatar';
import { GlassButton } from '../../GlassButton';
import { GlassToggle, GlassSlider } from '../../GlassInputs';
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '../../../services/ai/config';
import { Save, X, Upload, Settings, Crop, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { uploadFile, dataURLToBlob } from '../../../services/storageService';
import { appDataService } from '../../../services/serviceManager';

interface CompanionFormProps {
    companion: AiCompanion;
    onSave: (companion: AiCompanion) => void;
    onCancel: () => void;
    user: User;
}

export const CompanionForm: React.FC<CompanionFormProps> = ({ companion, onSave, onCancel, user }) => {
    const [formData, setFormData] = useState<AiCompanion>({
        ...companion,
        // Default AI Params if missing
        aiConfig: companion.aiConfig || {
            temperature: 0.7,
            topP: 1,
            topK: 40,
            frequencyPenalty: 0,
            presencePenalty: 0
        }
    });

    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [isMatrixOpen, setIsMatrixOpen] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeletingHistory, setIsDeletingHistory] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [customModelInput, setCustomModelInput] = useState('');

    // Refs
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const handleCropComplete = (croppedImageUrl: string) => {
        setFormData(prev => ({ ...prev, avatarUrl: croppedImageUrl }));
        setImageToCrop(null);
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        let finalAvatarUrl = formData.avatarUrl;

        // Upload to Firebase if it's a local base64/blob
        if (formData.avatarUrl && formData.avatarUrl.startsWith('data:')) {
            try {
                const blob = await dataURLToBlob(formData.avatarUrl);
                const { url } = await uploadFile(blob, user.id, `companion-${formData.id}-${Date.now()}.jpg`);
                if (url) finalAvatarUrl = url;
            } catch (err) {
                console.error("[CompanionForm] Avatar upload failed", err);
            }
        }

        onSave({ ...formData, avatarUrl: finalAvatarUrl });
        setIsSaving(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (re) => {
                if (re.target?.result) {
                    setImageToCrop(re.target.result as string);
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
        e.target.value = ''; // Reset
    };

    const handleReposition = () => {
        if (formData.avatarUrl) {
            setImageToCrop(formData.avatarUrl);
        }
    };

    const handleParamChange = (key: keyof AiParams, value: number) => {
        setFormData(prev => ({
            ...prev,
            aiConfig: { ...prev.aiConfig!, [key]: value }
        }));
    };

    const handleModelSelect = (modelId: string) => {
        setFormData(prev => ({ ...prev, preferredModel: modelId }));
        setCustomModelInput(''); // Clear custom input when selecting from dropdown
    };

    const handleCustomModelApply = () => {
        if (customModelInput.trim()) {
            setFormData(prev => ({ ...prev, preferredModel: customModelInput.trim() }));
        }
    };

    const handleDeleteHistory = async () => {
        setIsDeletingHistory(true);
        try {
            // 1. BACKUP: Fetch all segments from Firestore directly
            console.log("[Incinerator] Securing JSON Backup...");
            const history = await appDataService.getChatHistory(user.id);

            if (history.length > 0) {
                const dataStr = JSON.stringify(history, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `gigi-chat-backup-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                console.log("[Incinerator] Backup Saved.");
            }

            // 2. ANIMATION: Trigger the Thanos snap Custom Event
            window.dispatchEvent(new CustomEvent('incinerate-chat'));

            // 3. DELAY: Wait for visual disintegration (4s)
            await new Promise(resolve => setTimeout(resolve, 4000));

            // 4. PURGE: Delete from Firestore + Typesense
            await appDataService.deleteChatHistory(user.id);

            setShowDeleteConfirm(false);
            alert("Incineration Complete. All messages secured to JSON and purged from system.");
        } catch (err) {
            console.error("[Incinerator] Sequence Failed", err);
            alert("Reset Failed. Check console.");
        } finally {
            setIsDeletingHistory(false);
        }
    };

    const spiceLabels: { [key: number]: string } = {
        1: "G (Tame)", 2: "PG", 3: "R (Mature)", 4: "NC-17 (Explicit)", 5: "X (Feral)",
    };

    // Group models by provider for the dropdown
    const xaiModels = AVAILABLE_MODELS.filter(m => m.provider === 'xai');
    const googleModels = AVAILABLE_MODELS.filter(m => m.provider === 'google');
    const fireworksModels = AVAILABLE_MODELS.filter(m => m.provider === 'fireworks');

    // Check if current model is in the list or custom
    const isCustomModel = formData.preferredModel &&
        !AVAILABLE_MODELS.some(m => m.id === formData.preferredModel);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            {imageToCrop && <ImageCropper imageSrc={imageToCrop} onCropComplete={handleCropComplete} onCancel={() => setImageToCrop(null)} />}
            {isMatrixOpen && <MatrixSelector onClose={() => setIsMatrixOpen(false)} userId={user.id} allowedType="image" title="Select Avatar Artifact" onSelect={(media) => { setFormData(prev => ({ ...prev, avatarUrl: media.url || media.thumbnailUrl })); setIsMatrixOpen(false); }} />}

            <div className="bg-[#0f1219] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/20">
                    <h2 className="text-xl font-bold text-white">
                        {companion.id.startsWith('new-') ? 'Initialize Construct' : `Edit ${companion.name}`}
                    </h2>
                    <GlassButton onClick={onCancel} variant="ghost" className="h-8 w-8 p-0 flex items-center justify-center rounded-full"><X size={18} /></GlassButton>
                </div>

                <div className="flex-grow p-6 space-y-8 overflow-y-auto custom-scrollbar bg-[#0f1219]">

                    {/* Top Section: Avatar & Core Identity */}
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex flex-col items-center space-y-4">
                            <div
                                className="relative group cursor-pointer overflow-hidden rounded-full"
                                onClick={() => avatarInputRef.current?.click()}
                            >
                                <GlassAvatar
                                    imageUrl={formData.avatarUrl}
                                    altText="Avatar"
                                    fallbackChar={formData.name.charAt(0)}
                                    size="w-32 h-32 md:w-40 md:h-40"
                                    className="border-4 border-white/5 transition-all group-hover:border-violet-500/50 group-hover:scale-105"
                                />

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Upload size={24} className="text-white mb-1" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest px-2 text-center">Change Avatar</span>
                                </div>

                                {formData.avatarUrl && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleReposition();
                                        }}
                                        className="absolute bottom-2 right-2 p-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-white hover:bg-violet-600 transition-colors shadow-lg z-10"
                                        title="Reposition"
                                    >
                                        <Crop size={16} />
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-2 w-full">
                                <GlassButton onClick={() => avatarInputRef.current?.click()} variant="primary" className="flex-1 text-[10px] uppercase tracking-tighter py-2 shadow-lg shadow-violet-900/20">
                                    <Upload size={12} className="mr-1" /> Local File
                                </GlassButton>
                                <GlassButton onClick={() => setIsMatrixOpen(true)} variant="secondary" className="flex-1 text-[10px] uppercase tracking-tighter py-2">
                                    <Settings size={12} className="mr-1" /> Matrix
                                </GlassButton>
                            </div>

                            <input
                                type="file"
                                ref={avatarInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                                accept="image/*"
                            />
                        </div>

                        <div className="flex-1 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Display Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">Neural Backend (Model)</label>
                                <div className="flex gap-2">
                                    <select
                                        value={isCustomModel ? '__custom__' : (formData.preferredModel || DEFAULT_MODEL_ID)}
                                        onChange={e => {
                                            if (e.target.value !== '__custom__') {
                                                handleModelSelect(e.target.value);
                                            }
                                        }}
                                        className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-300 font-mono focus:border-violet-500 outline-none"
                                    >
                                        {/* xAI / Grok - Primary */}
                                        <optgroup label="⚡ xAI Grok (Recommended)">
                                            {xaiModels.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </optgroup>

                                        {/* Google Gemini - Fallback */}
                                        <optgroup label="🔷 Google Gemini">
                                            {googleModels.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </optgroup>

                                        {/* Fireworks - Experimental */}
                                        <optgroup label="🔥 Fireworks AI (Experimental)">
                                            {fireworksModels.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </optgroup>

                                        {/* Custom option */}
                                        {isCustomModel && (
                                            <optgroup label="📝 Custom">
                                                <option value="__custom__">Custom: {formData.preferredModel}</option>
                                            </optgroup>
                                        )}
                                    </select>
                                </div>

                                {/* Custom Model Input */}
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Or paste custom model ID (e.g., accounts/fireworks/models/...)"
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

                                {/* Current Model Display */}
                                <div className="mt-2 text-[10px] text-slate-500 font-mono">
                                    Active: <span className="text-cyan-500">{formData.preferredModel || DEFAULT_MODEL_ID}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Personality Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Archetype</label>
                            <select
                                value={formData.persona}
                                onChange={e => setFormData(p => ({ ...p, persona: e.target.value as GigiPersona }))}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500 outline-none"
                            >
                                <option value="buddy">Buddy</option>
                                <option value="sister">Sister</option>
                                <option value="aunt">Aunt</option>
                                <option value="grandmother">Grandmother</option>
                                <option value="custom">Custom (Advanced)</option>
                            </select>
                        </div>
                        <div>
                            <GlassSlider
                                label="Personality Spice"
                                description={spiceLabels[formData.spiceLevel || 1]}
                                value={formData.spiceLevel || 1}
                                min={1} max={5}
                                onChange={v => setFormData(p => ({ ...p, spiceLevel: v }))}
                            />
                        </div>
                    </div>

                    {/* ADVANCED PARAMETERS (THE FERAL SLIDERS) */}
                    <div className="border border-white/10 rounded-2xl overflow-hidden">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full p-4 bg-white/5 flex items-center justify-between hover:bg-white/10 transition-colors"
                        >
                            <span className="text-xs font-bold text-violet-400 uppercase tracking-widest flex items-center gap-2">
                                <Settings size={14} /> Neural Core Parameters
                            </span>
                            <span className="text-xs text-slate-500">{showAdvanced ? "Hide" : "Show"}</span>
                        </button>

                        {showAdvanced && (
                            <div className="p-6 bg-black/30 space-y-6 animate-in slide-in-from-top-2">
                                <GlassSlider
                                    label="Temperature (Creativity)"
                                    description="Lower is factual/rigid. Higher is creative/chaotic."
                                    value={formData.aiConfig?.temperature ?? 0.7}
                                    min={0} max={1.5} step={0.1}
                                    onChange={(v) => handleParamChange('temperature', v)}
                                    formatValue={(v) => v.toFixed(1)}
                                />
                                <GlassSlider
                                    label="Top P (Diversity)"
                                    description="Nucleus sampling. Lower cuts off unlikely words."
                                    value={formData.aiConfig?.topP ?? 1}
                                    min={0} max={1} step={0.05}
                                    onChange={(v) => handleParamChange('topP', v)}
                                    formatValue={(v) => v.toFixed(2)}
                                />
                                <GlassSlider
                                    label="Frequency Penalty (Repetition)"
                                    description="Higher values prevent repeating same words."
                                    value={formData.aiConfig?.frequencyPenalty ?? 0}
                                    min={-2} max={2} step={0.1}
                                    onChange={(v) => handleParamChange('frequencyPenalty', v)}
                                    formatValue={(v) => v.toFixed(1)}
                                />
                                <GlassSlider
                                    label="Presence Penalty (Topics)"
                                    description="Higher values encourage new topics."
                                    value={formData.aiConfig?.presencePenalty ?? 0}
                                    min={-2} max={2} step={0.1}
                                    onChange={(v) => handleParamChange('presencePenalty', v)}
                                    formatValue={(v) => v.toFixed(1)}
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Core Instructions (System Prompt)</label>
                        <textarea
                            rows={6}
                            value={formData.customPersonaDescription}
                            onChange={(e) => setFormData(p => ({ ...p, customPersonaDescription: e.target.value }))}
                            placeholder="Define the AI's behavior, tone, and hidden constraints..."
                            className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-slate-300 font-mono focus:border-violet-500 outline-none custom-scrollbar"
                        />
                    </div>

                    <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5">
                        <div>
                            <span className="block text-sm font-bold text-white">Primary Companion</span>
                            <span className="text-xs text-slate-500">This AI will handle main dashboard interactions.</span>
                        </div>
                        <GlassToggle checked={formData.isPrimary || false} onChange={v => setFormData(p => ({ ...p, isPrimary: v }))} />
                    </div>

                    {/* DANGER ZONE - [ZEN FIX] Improved visibility logic */}
                    {companion.id && !companion.id.toString().includes('new-') && (
                        <div className="mt-8 mb-12 p-6 border border-red-500/20 bg-red-800/5 rounded-2xl space-y-4 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                            <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                                <AlertTriangle size={16} /> Neural Memory Purge
                            </h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Irreversibly incinerate all chat segments and search tokens associated with this construct.
                                <span className="text-red-900/60 ml-1">Warning: Backup will be triggered automatically.</span>
                            </p>

                            {!showDeleteConfirm ? (
                                <GlassButton
                                    onClick={() => setShowDeleteConfirm(true)}
                                    variant="ghost"
                                    className="border-red-500/20 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 w-full transition-all group"
                                >
                                    <Trash2 size={14} className="mr-2 group-hover:scale-110" /> Reset Memory (Thanos Snap)
                                </GlassButton>
                            ) : (
                                <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
                                    <div className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] animate-pulse">Confirm System Incineration?</div>
                                    <div className="flex gap-2 w-full">
                                        <GlassButton
                                            onClick={handleDeleteHistory}
                                            variant="primary"
                                            className="flex-1 bg-red-600 hover:bg-red-500 border-none shadow-lg shadow-red-900/40 text-[10px] uppercase tracking-widest py-3"
                                            disabled={isDeletingHistory}
                                        >
                                            {isDeletingHistory ? <Loader2 size={14} className="animate-spin mr-2" /> : <Trash2 size={14} className="mr-2" />}
                                            Yes, Snap Fingers
                                        </GlassButton>
                                        <GlassButton
                                            onClick={() => setShowDeleteConfirm(false)}
                                            variant="ghost"
                                            className="px-6 text-[10px] uppercase tracking-widest"
                                            disabled={isDeletingHistory}
                                        >
                                            Abort
                                        </GlassButton>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bottom Buffer for Scrollable Area */}
                    <div className="h-20" />
                </div>

                <div className="p-5 border-t border-white/10 flex justify-end gap-3 bg-black/40 backdrop-blur-md">
                    <GlassButton onClick={onCancel} variant="ghost" disabled={isSaving}>Cancel</GlassButton>
                    <GlassButton onClick={handleSaveChanges} variant="primary" className="shadow-lg shadow-violet-900/20" disabled={isSaving || isDeletingHistory}>
                        {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                        {isSaving ? 'Uploading...' : 'Save Construct'}
                    </GlassButton>
                </div>
            </div>
        </div>
    );
};