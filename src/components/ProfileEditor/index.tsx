import React from 'react';
import type { User, View, Toast, Settings, Media } from '../../types';
import { AvatarCropper } from '../AvatarCropper';
import SettingsModal from '../SettingsModal';
import MatrixSelector from '../media/MatrixSelector';
import { GlassButton } from '../GlassButton';
import { GlassAvatar } from '../GlassAvatar';
import { Image as ImageIcon, Crop, Trash2, Wand2, X, Check, Upload, ExternalLink, Briefcase } from 'lucide-react';
import { SubHeader } from '../SubHeader';

// Hooks & Logic
import { useProfileLogic } from './useProfileLogic';

// Sub-Components
import { ProfileInfoTab } from './ProfileInfoTab';
import { GalleryTab } from './GalleryTab';
import { ControlsTab } from './ControlsTab';
import { CareerTab } from './CareerTab'; // [ZEN NEW]
import { IntelligenceTab } from './IntelligenceTab'; // [ZEN NEW]
import { Lightbox } from './ProfileComponents';
import { PurificationModal } from '../dashboard/admin/PurificationModal';

interface ProfileEditorProps {
    user: User;
    onUserUpdate: (user: User) => void;
    onNavigate: (view: View) => void;
    addToast: (message: string, type: Toast['type']) => void;
    settings: Settings;
    onSettingsChange: (settings: Settings) => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    allMedia: Media[];
    onSaveMedia: (media: Media) => void;
    onExportAllData: () => void;
    onTriggerRestore: () => void;
    onCreateUserPersonTag: () => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = (props) => {
    const {
        // State
        formData,
        profilePicPreview, setProfilePicPreview,
        imageToCrop, setImageToCrop,
        isSaving,
        legacyImportStatus, setLegacyImportStatus, // [ZEN FIX] Restored missing destructuring
        isResetting,
        isSettingsModalOpen, setIsSettingsModalOpen,
        viewingMedia, setViewingMedia,
        activeTab, setActiveTab,
        isMatrixOpen, setIsMatrixOpen,
        migrationStatus,
        localRescueCount,
        isRescuing,
        legacyImportFileRef,
        userMedia,
        avatarInputRef,

        // Handlers
        handleInputChange,
        handleAddressChange,
        handleAvatarFileSelect,
        handleRemoveAvatar,
        handleRepositionAvatar,
        handleAutoGenTheme,
        handleCropComplete,
        handleSaveChanges,
        handleLegacyFileSelected,
        handleStartLegacyImport,
        handleResetAndSeed,
        handleRescueLocalData,
        handleMigrateToCloud,
        handleDeleteMedia,
        handlePersonalIncinerate,
        handleConnectGooglePhotos,
        isGoogleLinked,
        isIncinerating
    } = useProfileLogic(props);

    const [isPurificationModalOpen, setIsPurificationModalOpen] = React.useState<boolean>(false);

    return (
        <div className="fixed inset-0 z-40 flex justify-center items-start pt-28 md:pt-40 px-2 md:px-4 pb-4 md:pb-8 bg-black/90 backdrop-blur-md overflow-y-auto md:overflow-hidden no-scrollbar animate-in fade-in zoom-in-95 duration-200">

            <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                settings={props.settings}
                onSettingsChange={props.onSettingsChange}
                theme={props.theme}
                toggleTheme={props.toggleTheme}
            />

            {imageToCrop && (
                <AvatarCropper
                    imageSrc={imageToCrop}
                    onCropComplete={handleCropComplete}
                    onCancel={() => setImageToCrop(null)}
                />
            )}

            {viewingMedia && (
                <Lightbox
                    mediaItem={viewingMedia}
                    onClose={() => setViewingMedia(null)}
                    onDelete={handleDeleteMedia}
                />
            )}

            {isMatrixOpen && (
                <MatrixSelector
                    onClose={() => setIsMatrixOpen(false)}
                    userId={props.user.id}
                    onSelect={(media) => {
                        if (activeTab === 'identity') {
                            const selected = Array.isArray(media) ? media[0] : media;
                            if (selected) {
                                setProfilePicPreview(selected.url || selected.thumbnailUrl);
                            }
                        }
                        setIsMatrixOpen(false);
                    }}
                />
            )}

            {/* --- MAIN EDITOR CARD --- */}
            <div className="w-full max-w-6xl h-fit md:h-[calc(100vh-160px)] bg-[#0f1219] border border-white/10 rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-visible md:overflow-hidden relative ring-1 ring-white/5">

                {/* LEFT SIDEBAR */}
                <div className="w-full md:w-72 bg-black/40 border-b md:border-b-0 md:border-r border-white/5 p-6 flex flex-col items-center shrink-0 overflow-y-visible md:overflow-y-auto custom-scrollbar">

                    <div className="relative group mb-6">
                        <GlassAvatar
                            imageUrl={profilePicPreview}
                            altText={formData.displayName}
                            fallbackChar={formData.firstName.charAt(0)}
                            size="w-32 h-32 md:w-48 md:h-48"
                            className="shadow-2xl border-4 border-white/5 group-hover:border-white/20 transition-colors"
                        />
                        <input
                            type="file"
                            ref={avatarInputRef}
                            onChange={handleAvatarFileSelect}
                            className="hidden"
                            accept="image/*"
                        />
                    </div>

                    <div className="w-full space-y-3 grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-0">
                        <GlassButton onClick={() => avatarInputRef.current?.click()} variant="secondary" className="w-full justify-center bg-white/5 hover:bg-white/10 border-white/10 col-span-2 md:col-span-1">
                            <Upload size={16} className="mr-2" /> Change Avatar
                        </GlassButton>

                        <GlassButton onClick={() => setIsMatrixOpen(true)} variant="secondary" className="w-full justify-center bg-white/5 hover:bg-white/10 border-white/10">
                            <ImageIcon size={16} className="mr-2" /> Select from Matrix
                        </GlassButton>

                        <GlassButton onClick={handleRepositionAvatar} disabled={!profilePicPreview} variant="secondary" className="w-full justify-center bg-white/5 hover:bg-white/10 border-white/10">
                            <Crop size={16} className="mr-2" /> Reposition
                        </GlassButton>

                        <GlassButton onClick={handleRemoveAvatar} disabled={!profilePicPreview} variant="danger" className="w-full justify-center bg-red-950/30 border-red-900/30 text-red-400 hover:bg-red-900/40">
                            <Trash2 size={16} className="mr-2" /> Remove
                        </GlassButton>

                        <GlassButton onClick={handleAutoGenTheme} variant="secondary" className="w-full justify-center bg-purple-950/20 text-purple-300 border-purple-500/20 hover:bg-purple-500/10">
                            <Wand2 size={16} className="mr-2" /> Auto-Gen Theme
                        </GlassButton>

                        <div className="space-y-3 mt-4">
                            <GlassButton
                                onClick={() => {
                                    const activeSlug = formData.publicSlug || props.user.publicSlug || props.user.id;
                                    window.open(`/ats/${activeSlug}`, '_blank');
                                }}
                                variant="secondary"
                                className="w-full justify-center bg-emerald-950/20 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/10"
                            >
                                <Briefcase size={16} className="mr-2" /> Recruiter Briefing
                            </GlassButton>

                            <GlassButton
                                onClick={() => {
                                    const activeSlug = formData.publicSlug || props.user.publicSlug || props.user.id;
                                    if (formData.publicSlug && formData.publicSlug !== props.user.publicSlug) {
                                        props.addToast("Note: Be sure to click 'Done' to save your Vanity URL to the global registry so the link becomes active.", "info");
                                    }
                                    window.open(`/u/${activeSlug}`, '_blank');
                                }}
                                variant="secondary"
                                className="w-full justify-center bg-cyan-950/20 text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/10"
                            >
                                <ExternalLink size={16} className="mr-2" /> Neural Uplink
                            </GlassButton>
                        </div>
                    </div>

                    <div className="mt-6 md:mt-auto pt-4 md:pt-8 w-full hidden md:block">
                        <div className="p-4 bg-black/20 rounded-xl border border-white/5 text-center">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Profile Status</p>
                            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                                Active
                            </span>
                        </div>
                    </div>
                </div>

                {/* RIGHT CONTENT AREA */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#161e2a]">

                    {/* Header / Tabs */}
                    <SubHeader
                        sticky={false}
                        className="!h-16 !pt-0 !pb-0 !px-4 md:!px-8 bg-black/20 border-white/5 relative z-50 pointer-events-auto"
                        left={
                            <div className="flex gap-4 md:gap-8 h-full overflow-x-auto no-scrollbar mask-gradient-right">
                                {(['identity', 'career', 'gallery', 'intelligence', 'controls'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`h-full px-1 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === tab
                                            ? 'text-white border-violet-500'
                                            : 'text-slate-500 border-transparent hover:text-slate-300'
                                            }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        }
                        right={
                            <button
                                onClick={() => props.onNavigate('dashboard')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        }
                    />

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-visible md:overflow-y-auto custom-scrollbar p-4 md:p-8 bg-[#161e2a]">
                        <div className="max-w-3xl mx-auto pb-10 md:pb-20">
                            {activeTab === 'identity' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h2 className="text-xl md:text-2xl font-bold text-white mb-6 md:mb-8 tracking-tight">Identity</h2>
                                    <ProfileInfoTab
                                        formData={formData}
                                        handleInputChange={handleInputChange}
                                        handleAddressChange={handleAddressChange}
                                        settings={props.settings}
                                        profilePicPreview={profilePicPreview}
                                        triggerMatrixSelector={() => { }}
                                    />
                                </div>
                            )}

                            {activeTab === 'career' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h2 className="text-xl md:text-2xl font-bold text-emerald-400 mb-6 md:mb-8 tracking-tight">Career Architecture</h2>
                                    <CareerTab
                                        user={formData}
                                        handleInputChange={handleInputChange}
                                    />
                                </div>
                            )}

                            {activeTab === 'gallery' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h2 className="text-xl md:text-2xl font-bold text-white mb-6 md:mb-8 tracking-tight">Personal Gallery</h2>
                                    <GalleryTab
                                        userMedia={userMedia}
                                        setViewingMedia={setViewingMedia}
                                        triggerMatrixSelector={() => setIsMatrixOpen(true)}
                                    />
                                </div>
                            )}

                            {activeTab === 'intelligence' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h2 className="text-xl md:text-2xl font-bold text-emerald-400 mb-6 md:mb-8 tracking-tight">Recruiter Intelligence</h2>
                                    <IntelligenceTab user={formData} />
                                </div>
                            )}

                            {activeTab === 'controls' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h2 className="text-xl md:text-2xl font-bold text-white mb-6 md:mb-8 tracking-tight">System Controls</h2>
                                    <ControlsTab
                                        user={props.user}
                                        setIsSettingsModalOpen={setIsSettingsModalOpen}
                                        onCreateUserPersonTag={props.onCreateUserPersonTag}
                                        onNavigate={props.onNavigate}
                                        migrationStatus={migrationStatus}
                                        handleMigrateToCloud={handleMigrateToCloud}
                                        localRescueCount={localRescueCount}
                                        handleRescueLocalData={handleRescueLocalData}
                                        isRescuing={isRescuing}
                                        onExportAllData={props.onExportAllData}
                                        onTriggerRestore={props.onTriggerRestore}
                                        legacyImportFileRef={legacyImportFileRef}
                                        handleLegacyFileSelected={handleLegacyFileSelected}
                                        legacyImportStatus={legacyImportStatus}
                                        handleStartLegacyImport={handleStartLegacyImport}
                                        setLegacyImportStatus={setLegacyImportStatus}
                                        handleResetAndSeed={handleResetAndSeed}
                                        isResetting={isResetting}
                                        handleConnectGooglePhotos={handleConnectGooglePhotos}
                                        isGoogleLinked={isGoogleLinked}
                                        handlePersonalIncinerate={handlePersonalIncinerate}
                                        isIncinerating={isIncinerating}
                                        setIsPurificationModalOpen={setIsPurificationModalOpen}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="sticky bottom-0 z-50 h-20 border-t border-white/5 flex items-center justify-end px-4 md:px-8 gap-4 bg-[#161e2a] shrink-0 mt-auto shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                        <GlassButton
                            onClick={() => props.onNavigate('dashboard')}
                            variant="ghost"
                            className="px-6 text-slate-400 hover:text-white"
                        >
                            Cancel
                        </GlassButton>
                        <GlassButton
                            onClick={() => handleSaveChanges()}
                            disabled={isSaving}
                            variant="success"
                            className="px-8 font-bold shadow-lg shadow-emerald-900/20"
                        >
                            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Check size={18} className="mr-2" />}
                            {isSaving ? 'Saving...' : 'Done'}
                        </GlassButton>
                    </div>

                </div>
            </div>

            <PurificationModal
                isOpen={isPurificationModalOpen}
                onClose={() => setIsPurificationModalOpen(false)}
                userId={props.user.id}
            />
        </div>
    );
};

const Loader2 = ({ className }: { className?: string }) => (
    <svg className={`w-4 h-4 ${className}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
);

export default ProfileEditor;