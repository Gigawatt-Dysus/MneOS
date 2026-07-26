import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Link2 } from 'lucide-react';

interface TagCapsuleDropdownProps {
    tagId: string;
    tagType: string;
    tagName: string;
    // The bounding rect of the clicked capsule element, used to position the menu
    anchorRect: DOMRect;
    // Called when user picks "Open Tag" — navigate to that tag's editor
    onOpenTag: () => void;
    // Called when user picks "Edit Link" — replace/re-link the capsule.
    // Pass null if in a read-only context where relinking is not possible.
    onEditLink: (() => void) | null;
    onClose: () => void;
}

// Type-specific accent colors matching the rest of the system palette
const TYPE_COLORS: Record<string, string> = {
    person:  'text-violet-400',
    pet:     'text-pink-400',
    place:   'text-emerald-400',
    thing:   'text-amber-400',
    event:   'text-sky-400',
    concept: 'text-indigo-400',
};

const TYPE_ICON_COLORS: Record<string, string> = {
    person:  'text-violet-500',
    pet:     'text-pink-500',
    place:   'text-emerald-500',
    thing:   'text-amber-500',
    event:   'text-sky-500',
    concept: 'text-indigo-500',
};

export const TagCapsuleDropdown: React.FC<TagCapsuleDropdownProps> = ({
    tagId,
    tagType,
    tagName,
    anchorRect,
    onOpenTag,
    onEditLink,
    onClose,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside or Escape key
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        // Use capture so this fires before other handlers
        document.addEventListener('mousedown', handleMouseDown, true);
        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown, true);
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [onClose]);

    // Position the menu below the anchor capsule, clamped to viewport edges
    const MENU_WIDTH = 200;
    const MENU_OFFSET_Y = 6; // px gap below the capsule

    let left = anchorRect.left;
    let top = anchorRect.bottom + MENU_OFFSET_Y;

    // Clamp to right edge of viewport
    if (left + MENU_WIDTH > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - MENU_WIDTH - 8);
    }

    const menuStyle: React.CSSProperties = {
        position: 'fixed',
        top,
        left,
        zIndex: 9999,
        width: MENU_WIDTH,
    };

    const accentColor = TYPE_COLORS[tagType] || 'text-slate-400';
    const iconColor = TYPE_ICON_COLORS[tagType] || 'text-slate-500';

    return createPortal(
        <div
            ref={menuRef}
            style={menuStyle}
            // Stop mousedown from propagating so the outside-click handler above
            // does not fire when clicking INSIDE the menu
            onMouseDown={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-left"
        >
            {/* ── Header: type badge + name ─────────────────────────────── */}
            <div className="px-3 py-2 bg-black/40 border-b border-slate-800 flex items-center gap-2">
                <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${accentColor}`}>
                    {tagType}
                </span>
                <span className="text-[10px] text-white/60 font-semibold truncate">
                    {tagName}
                </span>
            </div>

            {/* ── Actions ──────────────────────────────────────────────── */}
            <div className="py-1">

                {/* Edit Link */}
                {onEditLink !== null ? (
                    <button
                        onClick={() => { onEditLink(); onClose(); }}
                        className="w-full px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-colors group"
                    >
                        <Link2 size={13} className={`${iconColor} group-hover:text-white transition-colors`} />
                        <span>Edit Link</span>
                    </button>
                ) : (
                    // Disabled state in read-only renderers
                    <button
                        disabled
                        className="w-full px-3 py-2.5 text-left text-xs text-slate-700 flex items-center gap-2.5 cursor-not-allowed"
                    >
                        <Link2 size={13} className="text-slate-800" />
                        <span>Edit Link</span>
                        <span className="ml-auto text-[8px] font-bold uppercase tracking-wide text-slate-700">
                            Read-only
                        </span>
                    </button>
                )}

                {/* Open Tag */}
                <button
                    onClick={() => { onOpenTag(); onClose(); }}
                    className="w-full px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-violet-600/20 hover:text-white flex items-center gap-2.5 transition-colors group"
                >
                    <ExternalLink size={13} className={`${accentColor} group-hover:text-violet-300 transition-colors`} />
                    <span>Open Tag</span>
                </button>

            </div>
        </div>,
        document.body
    );
};

export default TagCapsuleDropdown;
