import React, { createContext, useContext, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TagDetailModal } from '../TagDetailModal';
import { appDataService } from '../../services/serviceManager';
import type { Tag, Media, View } from '../../types';

interface WikiNavigationContextProps {
    // Opens the TagDetailModal overlay for wiki-browsing within the provider
    openTag: (tagId: string) => void;
    activeTagId: string | null;
    closeTag: () => void;
    tagHistory: string[];
    navigateBack: () => void;
    tagsCache: Tag[];
    refreshTagsCache: () => Promise<void>;
    // Navigates to the Tag Editor full-screen view, preserving the caller's
    // current view + viewData as a return breadcrumb so Close can restore it.
    navigateToTagEditor: (tagId: string) => void;
}

const WikiNavigationContext = createContext<WikiNavigationContextProps | undefined>(undefined);

export const useWikiNavigation = () => {
    const context = useContext(WikiNavigationContext);
    if (!context) {
        throw new Error('useWikiNavigation must be used within a WikiNavigationProvider');
    }
    return context;
};

export const useOptionalWikiNavigation = () => {
    return useContext(WikiNavigationContext);
};

interface WikiNavigationProviderProps {
    children: React.ReactNode;
    userId: string;
    allMedia?: Media[];
    // Called to perform top-level application navigation (e.g. switch views)
    onNavigate?: (view: any, data?: any) => void;
    // Snapshot of the current top-level view — used to build the return breadcrumb
    // before navigating away to the Tag Editor.
    currentView?: View;
    currentViewData?: any;
}

export const WikiNavigationProvider: React.FC<WikiNavigationProviderProps> = ({
    children,
    userId,
    allMedia = [],
    onNavigate,
    currentView,
    currentViewData,
}) => {
    const [activeTagId, setActiveTagId] = useState<string | null>(null);
    const [tagHistory, setTagHistory] = useState<string[]>([]);
    const [tagsCache, setTagsCache] = useState<Tag[]>([]);
    const [mediaCache, setMediaCache] = useState<Media[]>(allMedia);
    const [activeTagDetails, setActiveTagDetails] = useState<Tag | null>(null);

    // Dynamic Tags cache sync
    const fetchTags = async () => {
        if (!userId) return;
        try {
            const tags = await appDataService.getAllTags(userId);
            setTagsCache(tags);
        } catch (e) {
            console.error("[WikiNavigationProvider] Error loading tags:", e);
        }
    };

    const fetchMedia = async () => {
        if (!userId) return;
        try {
            const media = await appDataService.getAllMedia(userId);
            setMediaCache(media);
        } catch (e) {
            console.error("[WikiNavigationProvider] Error loading media:", e);
        }
    };

    useEffect(() => {
        fetchTags();
        if (allMedia.length === 0) {
            fetchMedia();
        }
    }, [userId]);

    // Keep mediaCache in sync with prop if it changes
    useEffect(() => {
        if (allMedia && allMedia.length > 0) {
            setMediaCache(allMedia);
        }
    }, [allMedia]);

    // Fetch active tag details whenever tag ID or history updates
    useEffect(() => {
        const loadTagDetails = async () => {
            if (!activeTagId || !userId) {
                setActiveTagDetails(null);
                return;
            }
            // Check cache first
            const cached = tagsCache.find(t => t.id === activeTagId);
            if (cached) {
                setActiveTagDetails(cached);
            } else {
                try {
                    const fresh = await appDataService.getTag(userId, activeTagId);
                    if (fresh) {
                        setActiveTagDetails(fresh);
                        setTagsCache(prev => [...prev, fresh]);
                    }
                } catch (e) {
                    console.error("[WikiNavigationProvider] Error loading tag details:", e);
                }
            }
        };
        loadTagDetails();
    }, [activeTagId, tagsCache, userId]);

    const openTag = (tagId: string) => {
        if (!tagId) return;
        if (activeTagId) {
            // Push current tag onto backstack for nested browsing
            setTagHistory(prev => [...prev, activeTagId]);
        }
        setActiveTagId(tagId);
    };

    const navigateBack = () => {
        if (tagHistory.length === 0) {
            closeTag();
            return;
        }
        const prev = [...tagHistory];
        const last = prev.pop() || null;
        setTagHistory(prev);
        setActiveTagId(last);
    };

    const closeTag = () => {
        setActiveTagId(null);
        setTagHistory([]);
        setActiveTagDetails(null);
    };

    /**
     * Navigates to the Tag Editor full-screen view, embedding the caller's
     * current view + viewData as a return breadcrumb inside the viewData payload.
     * App.tsx reads `viewData.returnView` and `viewData.returnViewData` in the
     * tagEditor's onCancel handler to restore the originating context.
     */
    const navigateToTagEditor = (tagId: string) => {
        if (!tagId || !onNavigate) {
            console.warn("[WikiNavigationProvider] navigateToTagEditor: missing tagId or onNavigate handler");
            return;
        }

        console.log(
            `[WikiNavigationProvider] 🗂 Opening Tag Editor for ${tagId}, ` +
            `return breadcrumb: view="${currentView}" data=`, currentViewData
        );

        onNavigate('tagEditor', {
            tagId,
            // Preserve where the user was so onCancel can navigate back
            returnView: currentView || null,
            returnViewData: currentViewData || null,
        });
    };

    return (
        <WikiNavigationContext.Provider value={{
            openTag,
            activeTagId,
            closeTag,
            tagHistory,
            navigateBack,
            tagsCache,
            refreshTagsCache: fetchTags,
            navigateToTagEditor,
        }}>
            {children}
            {activeTagId && activeTagDetails && createPortal(
                <div className="wiki-overlay-portal" style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none' }}>
                    <TagDetailModal
                        tag={activeTagDetails}
                        media={mediaCache}
                        onClose={closeTag}
                        onEdit={(tag) => {
                            console.log("[WikiNavigationProvider] Edit tag triggered:", tag);
                            if (onNavigate) {
                                onNavigate('tagEditor', { tagId: tag.id, draftTag: tag });
                                closeTag();
                            }
                        }}
                        onDiscuss={(tag) => {
                            console.log("[WikiNavigationProvider] Discuss tag triggered:", tag);
                            if (onNavigate) {
                                onNavigate('interviews', { initialMessage: `Let's talk about ${tag.name}` });
                                closeTag();
                            }
                        }}
                        onMediaClick={(m) => {
                            console.log("[WikiNavigationProvider] Linked memory clicked:", m);
                            if (onNavigate) {
                                onNavigate('theMatrix', { mediaId: m.id });
                                closeTag();
                            }
                        }}
                        allTags={tagsCache}
                        currentUser={{ id: userId } as any}
                    />
                    {tagHistory.length > 0 && (
                        <button
                            onClick={navigateBack}
                            className="fixed top-12 left-6 z-[110] px-4 py-2 bg-black/60 hover:bg-black/80 border border-white/10 rounded-full text-xs font-black uppercase tracking-widest text-cyan-400 backdrop-blur-md shadow-2xl flex items-center gap-1.5 transition-all"
                        >
                            ⬅ Back to {tagsCache.find(t => t.id === tagHistory[tagHistory.length - 1])?.name || 'Previous'}
                        </button>
                    )}
                </div>,
                document.body
            )}
        </WikiNavigationContext.Provider>
    );
};
