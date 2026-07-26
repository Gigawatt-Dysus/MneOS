import React, { useState } from 'react';
import { User, Dog, MapPin, Package, Calendar, Tag as TagIcon } from 'lucide-react';
import { useOptionalWikiNavigation } from './WikiNavigationProvider';
import { TagCapsuleDropdown } from './TagCapsuleDropdown';

interface WikiTextProps {
    text: string;
    className?: string;
}

// Holds the state needed to position and populate the dropdown
interface DropdownState {
    tagId: string;
    tagType: string;
    tagName: string;
    anchorRect: DOMRect;
}

const getTagStyles = (type: string) => {
    switch (type) {
        case 'person':
            return {
                textClass: 'text-violet-400 hover:text-violet-300',
                borderClass: 'border-violet-500/30 hover:border-violet-400',
                bgClass: 'bg-violet-500/5 hover:bg-violet-500/10',
                icon: <User size={12} className="shrink-0" />
            };
        case 'pet':
            return {
                textClass: 'text-pink-400 hover:text-pink-300',
                borderClass: 'border-pink-500/30 hover:border-pink-400',
                bgClass: 'bg-pink-500/5 hover:bg-pink-500/10',
                icon: <Dog size={12} className="shrink-0" />
            };
        case 'place':
            return {
                textClass: 'text-emerald-400 hover:text-emerald-300',
                borderClass: 'border-emerald-500/30 hover:border-emerald-400',
                bgClass: 'bg-emerald-500/5 hover:bg-emerald-500/10',
                icon: <MapPin size={12} className="shrink-0" />
            };
        case 'thing':
            return {
                textClass: 'text-amber-400 hover:text-amber-300',
                borderClass: 'border-amber-500/30 hover:border-amber-400',
                bgClass: 'bg-amber-500/5 hover:bg-amber-500/10',
                icon: <Package size={12} className="shrink-0" />
            };
        case 'event':
            return {
                textClass: 'text-sky-400 hover:text-sky-300',
                borderClass: 'border-sky-500/30 hover:border-sky-400',
                bgClass: 'bg-sky-500/5 hover:bg-sky-500/10',
                icon: <Calendar size={12} className="shrink-0" />
            };
        default:
            return {
                textClass: 'text-slate-400 hover:text-slate-300',
                borderClass: 'border-slate-500/30 hover:border-slate-400',
                bgClass: 'bg-slate-500/5 hover:bg-slate-500/10',
                icon: <TagIcon size={12} className="shrink-0" />
            };
    }
};

export const WikiText: React.FC<WikiTextProps> = React.memo(({ text, className = '' }) => {
    const wikiContext = useOptionalWikiNavigation();

    // Tracks which tag badge was clicked so we can render the dropdown
    const [dropdownState, setDropdownState] = useState<DropdownState | null>(null);

    if (!text) return null;

    // Regular Expression matching: [Name](tag://type:id)
    const regex = /\[([^\]]+)\]\(tag:\/\/([a-zA-Z0-9_:-]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const matchIndex = match.index;
        // Add preceding plain text
        if (matchIndex > lastIndex) {
            parts.push(text.substring(lastIndex, matchIndex));
        }

        const displayName = match[1];
        const tagRef = match[2]; // e.g., "person:martha-carter-tag-id" or just "martha-carter-tag-id"

        let type = 'unknown';
        let id = tagRef;

        if (tagRef.includes(':')) {
            const colonIdx = tagRef.indexOf(':');
            type = tagRef.substring(0, colonIdx);
            id = tagRef.substring(colonIdx + 1);
        }

        // Capture these in a stable closure per-iteration
        const capturedId = id;
        const capturedType = type;
        const capturedName = displayName;

        const styles = getTagStyles(type);

        // Determine whether we have a navigation context at all.
        // If not, the badge is still rendered but clicking does nothing.
        const isClickable = !!wikiContext?.navigateToTagEditor;

        parts.push(
            <span
                key={`${id}-${matchIndex}`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!wikiContext?.navigateToTagEditor) return;

                    // Capture the bounding rect of the clicked element so the
                    // dropdown can position itself correctly below the badge.
                    const target = e.currentTarget as HTMLElement;
                    const rect = target.getBoundingClientRect();

                    setDropdownState({
                        tagId: capturedId,
                        tagType: capturedType,
                        tagName: capturedName,
                        anchorRect: rect,
                    });
                }}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${styles.bgClass} ${styles.borderClass} ${styles.textClass} font-bold ${isClickable ? 'cursor-pointer' : 'cursor-default'} transition-all duration-200 hover:scale-102 hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)] select-all mx-0.5 align-baseline`}
                title={`${type.toUpperCase()} • ${displayName}`}
            >
                {styles.icon}
                <span className="border-b border-dotted border-current leading-none">{displayName}</span>
            </span>
        );

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return (
        <>
            <span className={`whitespace-pre-wrap leading-relaxed ${className}`}>
                {parts}
            </span>

            {/* Contextual dropdown — rendered via portal inside TagCapsuleDropdown */}
            {dropdownState && wikiContext?.navigateToTagEditor && (
                <TagCapsuleDropdown
                    tagId={dropdownState.tagId}
                    tagType={dropdownState.tagType}
                    tagName={dropdownState.tagName}
                    anchorRect={dropdownState.anchorRect}
                    onOpenTag={() => {
                        // Navigate to Tag Editor with return-state breadcrumb preserved
                        wikiContext.navigateToTagEditor!(dropdownState.tagId);
                    }}
                    // "Edit Link" is disabled across all surfaces in this pass.
                    // Tiptap mention picker integration is a separate iteration.
                    onEditLink={null}
                    onClose={() => setDropdownState(null)}
                />
            )}
        </>
    );
});

export default WikiText;
