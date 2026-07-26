import React from 'react';
import {
    ArrowLeft,
    Reply,
    Trash2,
    Edit2,
    Save,
    AlertCircle,
    PenTool,
    User as UserIcon,
    Bot
} from 'lucide-react';
import { GlassButton } from '../GlassButton';
import GigiLogo from '../GigiLogo';
import { VertService, type VertexRequest } from '../../services/vertService';
import { UserPlus, UserMinus, Check, Share2 } from 'lucide-react';
import type { User, CommsMessage, GigiJournalEntry } from '../../types';

interface CommsReaderProps {
    selectedItem: CommsMessage | GigiJournalEntry | VertexRequest | null;
    systemMode: 'signals' | 'logs';
    user: User;
    isEditing: boolean;
    editTitle: string;
    editContent: string;
    editAuthor: 'user' | 'ai';
    onSetEditAuthor: (author: 'user' | 'ai') => void;
    onSetEditTitle: (s: string) => void;
    onSetEditContent: (s: string) => void;
    onSave: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onBack: () => void;
    onRefreshRequests?: () => void;
}

export const CommsReader: React.FC<CommsReaderProps> = ({
    selectedItem,
    systemMode,
    user,
    isEditing,
    editTitle,
    editContent,
    editAuthor,
    onSetEditAuthor,
    onSetEditTitle,
    onSetEditContent,
    onSave,
    onEdit,
    onDelete,
    onBack,
    onRefreshRequests
}) => {
    const [isProcessingRequest, setIsProcessingRequest] = React.useState(false);

    // 1. GIG-LEVEL SAFETY CHECK: Handle the "Zero State"
    if (!selectedItem) {
        return (
            /* [ZEN FIX] Resolved CSS Conflict: Changed 'hidden' to 'hidden md:flex' 
               to ensure they don't fight for the same display property. */
            <div className="hidden md:flex col-span-12 md:col-span-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl flex-col items-center justify-center text-slate-500 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                    <GigiLogo size={400} />
                </div>
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                        <AlertCircle size={32} className="text-slate-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-300 mb-2">Awaiting Selection</h3>
                    <p className="text-xs font-mono max-w-xs text-center leading-relaxed">
                        Select an item from the log to decode its contents.
                        <br /><br />
                        <span className="text-white/20">SECURE CHANNEL // ENCRYPTION ACTIVE</span>
                    </p>
                </div>
            </div>
        );
    }

    // 2. DYNAMIC BRANDING: Fetch the primary AI name instead of hard-coding
    const primaryAiName = user.aiCompanions.find(c => c.isPrimary)?.name || 'AI';

    // 3. AUTHOR HEURISTIC: Handle legacy data vs new explicit authors
    const getEffectiveAuthor = (item: any) => {
        if ('fromId' in item) return 'request';
        if ('from' in item) return 'contact';
        if (item.author) return item.author;
        return 'ai'; // Legacy data (prior to 2025-12-04) is AI-generated
    };

    const displayAuthor = isEditing ? editAuthor : getEffectiveAuthor(selectedItem);
    const isAiAuthor = displayAuthor === 'ai';

    const isRequest = displayAuthor === 'request';
    const requestItem = isRequest ? selectedItem as VertexRequest : null;

    // 4. DATA MAPPING
    const title = isRequest
        ? `Establish Vertex: ${requestItem?.fromName}`
        : (systemMode === 'signals'
            ? (selectedItem as CommsMessage).subject
            : (selectedItem as GigiJournalEntry).title);

    const fromLabel = isRequest
        ? requestItem?.fromName
        : (systemMode === 'signals'
            ? (selectedItem as CommsMessage).from
            : (isAiAuthor ? `${primaryAiName} Insight` : 'Personal Journal'));

    const timestamp = isRequest
        ? requestItem?.timestamp
        : (systemMode === 'signals'
            ? (selectedItem as CommsMessage).timestamp
            : (selectedItem as GigiJournalEntry).creationDate);

    const body = isRequest
        ? `An Archivist named ${requestItem?.fromName} is requesting a neural link (Vertex) with your vault. Accepting this link will allow you to share identities and communicate directly.`
        : (systemMode === 'signals'
            ? (selectedItem as CommsMessage).body
            : (selectedItem as GigiJournalEntry).content);

    const avatarContent = isRequest
        ? requestItem?.fromName.charAt(0)
        : (systemMode === 'signals'
            ? (selectedItem as CommsMessage).from.charAt(0)
            : (isAiAuthor ? <GigiLogo size={20} /> : user.displayName?.charAt(0)));

    // 5. VISUAL THEMING
    const avatarBg = isRequest
        ? 'bg-gradient-to-br from-amber-500 to-orange-600'
        : (systemMode === 'signals'
            ? 'bg-gradient-to-br from-cyan-500 to-blue-600'
            : (isAiAuthor
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
                : 'bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/20'));

    const nameColor = isRequest
        ? 'text-amber-400'
        : (systemMode === 'signals'
            ? 'text-cyan-300'
            : (isAiAuthor ? 'text-emerald-300' : 'text-violet-300'));

    const handleAccept = async () => {
        if (!requestItem) return;
        setIsProcessingRequest(true);
        try {
            await VertService.acceptVertRequest(requestItem.requestId, user);
            onRefreshRequests?.();
            onBack();
        } catch (error) {
            console.error("Accept failed:", error);
            alert("Failed to establish Vertex link.");
        } finally {
            setIsProcessingRequest(false);
        }
    };

    return (
        <div className="col-span-12 md:col-span-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col overflow-hidden relative">

            {/* --- HEADER SECTION --- */}
            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-black/40 to-transparent relative">

                {/* FLOATING ACTION PILL: Top Right Placement */}
                <div className="absolute top-6 right-6 z-50 flex items-center gap-2 bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-2xl">
                    {isRequest ? (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-amber-500 animate-pulse uppercase tracking-widest mr-2">Awaiting Decryption</span>
                        </div>
                    ) : systemMode === 'signals' ? (
                        <>
                            <GlassButton
                                title="Reply"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                            >
                                <Reply size={14} />
                            </GlassButton>
                            <GlassButton
                                title="Delete"
                                onClick={onDelete}
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/20"
                            >
                                <Trash2 size={14} />
                            </GlassButton>
                        </>
                    ) : (
                        <>
                            {isEditing ? (
                                <GlassButton
                                    title="Save Changes"
                                    onClick={onSave}
                                    variant="success"
                                    className="h-8 w-8 p-0 flex items-center justify-center text-green-400"
                                >
                                    <Save size={14} />
                                </GlassButton>
                            ) : (
                                <GlassButton
                                    title="Edit Entry"
                                    onClick={onEdit}
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-cyan-400"
                                >
                                    <Edit2 size={14} />
                                </GlassButton>
                            )}
                            <GlassButton
                                title="Delete Item"
                                onClick={onDelete}
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/20"
                            >
                                <Trash2 size={14} />
                            </GlassButton>
                        </>
                    )}
                </div>

                {/* Mobile Back Control */}
                <div className="md:hidden mb-4">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider hover:text-white p-2 -ml-2 rounded-lg active:bg-white/10"
                    >
                        <ArrowLeft size={16} /> Back to List
                    </button>
                </div>

                {/* Title Section (with right-padding to clear the Action Pill) */}
                <div className="flex flex-col gap-2 mb-6 pr-24">
                    <div className="min-w-0">
                        {isEditing ? (
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => onSetEditTitle(e.target.value)}
                                className="bg-transparent text-xl font-bold text-white border-b border-white/20 w-full focus:outline-none focus:border-cyan-500 py-1"
                                placeholder="Entry Title..."
                            />
                        ) : (
                            <h1 className="text-xl font-bold text-white leading-tight break-words">
                                {title}
                            </h1>
                        )}
                    </div>
                </div>

                {/* Meta Cluster: Avatar, Author, Switcher */}
                <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg ${avatarBg}`}>
                            {avatarContent}
                        </div>
                        <div>
                            <span className={`text-sm font-bold ${nameColor}`}>
                                {fromLabel}
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {new Date(timestamp || Date.now()).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* AUTHOR REASSIGNMENT CONTROL */}
                    {isEditing && systemMode === 'logs' && (
                        <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                            <button
                                onClick={() => onSetEditAuthor('user')}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all ${editAuthor === 'user'
                                    ? 'bg-violet-600 text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <UserIcon size={12} /> Me
                            </button>
                            <button
                                onClick={() => onSetEditAuthor('ai')}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all ${editAuthor === 'ai'
                                    ? 'bg-emerald-600 text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <Bot size={12} /> {primaryAiName}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="flex-1 overflow-hidden relative bg-black/20">
                {isEditing ? (
                    <textarea
                        className="w-full h-full bg-transparent p-8 text-slate-200 font-mono text-sm resize-none focus:outline-none custom-scrollbar font-light leading-relaxed"
                        value={editContent}
                        onChange={(e) => onSetEditContent(e.target.value)}
                        placeholder="Start typing your journal entry..."
                    />
                ) : (
                    <div className="h-full p-8 overflow-y-auto custom-scrollbar font-mono text-sm leading-relaxed text-slate-300">
                        <p className="whitespace-pre-wrap">
                            {body}
                        </p>
                    </div>
                )}
            </div>

            {/* --- FOOTER CONTROLS --- */}
            <div className="p-4 border-t border-white/10 bg-black/20 flex gap-2">
                {isRequest ? (
                    <>
                        <GlassButton
                            onClick={handleAccept}
                            disabled={isProcessingRequest}
                            variant="primary"
                            className="flex-1 text-xs border-amber-500/30 text-amber-300"
                        >
                            {isProcessingRequest ? <Check className="animate-ping" size={14} /> : <UserPlus size={14} className="mr-2" />}
                            Establish Link
                        </GlassButton>
                        <GlassButton
                            onClick={onDelete}
                            variant="secondary"
                            className="flex-1 text-xs text-red-400"
                        >
                            <UserMinus size={14} className="mr-2" /> Decline
                        </GlassButton>
                    </>
                ) : systemMode === 'logs' && (
                    isEditing ? (
                        <GlassButton
                            title="Save"
                            onClick={onSave}
                            variant="success"
                            className="flex-1 text-xs"
                        >
                            <Save size={14} className="mr-2" /> Save Entry
                        </GlassButton>
                    ) : (
                        <GlassButton
                            title="Edit"
                            onClick={onEdit}
                            variant="secondary"
                            className="flex-1 text-xs"
                        >
                            <PenTool size={14} className="mr-2" /> Edit Entry
                        </GlassButton>
                    )
                )}
            </div>
        </div>
    );
};