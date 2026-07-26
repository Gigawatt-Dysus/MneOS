import React, { useState, useEffect, useMemo } from 'react';
import type { LifeEvent, Media, Tag, User, View } from '../types';
import { SortAsc, SortDesc, Plus, Search, MapPin, Image as ImageIcon, Calendar, Loader2 } from 'lucide-react';
import { parseNaturalDateString } from '../utils/ageCalculator';
import { parseRobustDate } from '../utils/dateSanitizer';
import { EventCard } from './timeline/EventCard';
import EventViewerModal from './timeline/EventViewerModalFixed';
import { TagDetailModal } from './TagDetailModal';
import { useAIIdentity } from '../hooks/useAIIdentity';
import { SubHeader } from './SubHeader';

interface TimeVortexProps {
    events: LifeEvent[];
    tags: Tag[];
    media: Media[];
    user: User;
    onEditEvent: (event: LifeEvent) => void;
    onCreateEvent: () => void;
    onEditTag: (tag: Tag) => void;
    onAddComment: (eventId: string, commentText: string) => void;
    onUpdateEvent: (event: LifeEvent) => void;
    onDeepDive?: (event: LifeEvent) => void;
    onNavigate?: (view: View, data?: any) => void;
    onDeleteEvent?: (id: string) => void;
    onCreateTag?: (name: string, type: Tag['type'], metadata?: any) => Promise<Tag | null>;
}

const RealityLoader = () => {
    const [text, setText] = useState("Syncing Timelines...");
    const messages = ["Syncing Timelines...", "Loading Fixed Events...", "Rendering Reality..."];

    useEffect(() => {
        let i = 0;
        const interval = setInterval(() => {
            i = (i + 1) % messages.length;
            setText(messages[i]);
        }, 800);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center py-32 text-cyan-500 animate-in fade-in duration-700">
            <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse"></div>
                <Loader2 className="w-12 h-12 mb-6 animate-spin relative z-10" />
            </div>
            <p className="text-sm font-mono tracking-widest uppercase animate-pulse">{text}</p>
        </div>
    );
};

const TimeVortex: React.FC<TimeVortexProps> = ({ events, tags, media, user, onEditEvent, onCreateEvent, onEditTag, onAddComment, onUpdateEvent, onDeepDive, onNavigate, onDeleteEvent, onCreateTag }) => {
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
        return (localStorage.getItem('timelineSortOrder') as 'asc' | 'desc') || 'desc';
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [filteredEvents, setFilteredEvents] = useState<LifeEvent[]>([]);
    const [visibleCount, setVisibleCount] = useState(20);
    const [isForcedLoading, setIsForcedLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const [selectedEvent, setSelectedEvent] = useState<LifeEvent | null>(null);
    const [viewingTag, setViewingTag] = useState<Tag | null>(null);

    useAIIdentity();

    const parsedEvents = useMemo(() => {
        return events.map(e => ({
            ...e,
            date: parseRobustDate(e.date, [e.title, e.details, e.description || ''], user)
        }));
    }, [events, user]);

    useEffect(() => {
        setIsForcedLoading(true);
        const timer = setTimeout(() => {
            setIsForcedLoading(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        localStorage.setItem('timelineSortOrder', sortOrder);
    }, [sortOrder]);

    const handleTagClick = (tag: Tag) => {
        setViewingTag(tag);
    };

    const handleEditTag = (tag: Tag) => {
        setViewingTag(null);
        if (selectedEvent) setSelectedEvent(null);
        onEditTag(tag);
    };

    useEffect(() => {
        let sorted: LifeEvent[] = [];
        try {
            sorted = [...parsedEvents].sort((a, b) => {
                const aTime = a?.date?.getTime();
                const bTime = b?.date?.getTime();
                if (isNaN(aTime) || isNaN(bTime)) return 0;
                return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
            });
        } catch (error) {
            console.error('[TimeVortex] CRITICAL: Failed to sort events.', error);
            sorted = parsedEvents;
        }

        if (!debouncedSearchQuery.trim()) {
            setFilteredEvents(sorted);
            return;
        }

        const date = parseNaturalDateString(debouncedSearchQuery);
        const lowerCaseQuery = debouncedSearchQuery.toLowerCase().trim();

        const includeTerms: string[] = [];
        const excludeTerms: string[] = [];

        let remainingQuery = lowerCaseQuery;

        // 1. Extract exact quoted phrases ("my black cat")
        const exactPhraseRegex = /"([^"]+)"/g;
        let match;
        while ((match = exactPhraseRegex.exec(remainingQuery)) !== null) {
            if (match[1].trim()) {
                includeTerms.push(match[1].trim());
            }
        }

        // Remove the quoted phrases from the remaining string to avoid double-processing
        remainingQuery = remainingQuery.replace(exactPhraseRegex, '').trim();

        // 2. Process remaining loose terms
        const looseTerms = remainingQuery.split(/\s+/).filter(Boolean);
        looseTerms.forEach(term => {
            const cleanTerm = term.replace(/["']/g, ''); // Strip stray quotes
            if (cleanTerm.startsWith('-') && cleanTerm.length > 1) {
                excludeTerms.push(cleanTerm.substring(1));
            } else if (cleanTerm) {
                includeTerms.push(cleanTerm);
            }
        });

        const results = sorted.filter(event => {
            if (date) {
                const diff = Math.abs(event.date.getTime() - date.getTime());
                if (diff < 86400000) return true;
            }

            const eventTags = tags.filter(t => event.tagIds?.includes(t.id));
            const tagNames = eventTags.map(t => t.name).join(' ').toLowerCase();

            const eventMedia = media.filter(m => event.mediaIds.includes(m.id));
            const mediaCaptions = eventMedia.map(m => m.caption || m.triage?.summary || '').join(' ');

            const searchableContent = [
                event.title,
                event.details,
                tagNames,
                mediaCaptions,
                event.metadata?.importSource === 'blogspot' ? 'blogspot blogger archive' : (event.metadata?.importSource || ''),
                event.importSource === 'blogspot' ? 'blogspot blogger archive' : (event.importSource || '')
            ].join(' ').toLowerCase();

            // Compile regex for robust prefix matching
            const matchPattern = (term: string) => {
                try {
                    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`(^|[^a-z0-9])${escapedTerm}`, 'i');
                    return regex.test(searchableContent);
                } catch {
                    return searchableContent.includes(term);
                }
            };

            // Must contain all includeTerms
            const matchesIncludes = includeTerms.length === 0 || includeTerms.every(term => matchPattern(term));
            if (!matchesIncludes) return false;

            // Must NOT contain any excludeTerms
            const matchesExcludes = excludeTerms.length > 0 && excludeTerms.some(term => matchPattern(term));
            if (matchesExcludes) return false;

            return true;
        });
        setFilteredEvents(results);
        setVisibleCount(20);

    }, [parsedEvents, tags, sortOrder, debouncedSearchQuery]);

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 20);
    };

    return (
        <div className="flex flex-col h-full bg-black/20 backdrop-blur-md overflow-hidden">

            {selectedEvent && (
                <EventViewerModal
                    event={selectedEvent}
                    media={media}
                    tags={tags}
                    user={user}
                    onClose={() => setSelectedEvent(null)}
                    onEdit={() => onEditEvent(selectedEvent)}
                    onTagClick={handleTagClick}
                    onMediaClick={(m) => onNavigate ? onNavigate('theMatrix', { mediaId: m.id, mediaObject: m }) : console.warn("No nav")}
                    onAddComment={(text) => onAddComment(selectedEvent.id, text)}
                    onUpdateEvent={onUpdateEvent}
                    onDeepDive={onDeepDive}
                    onDelete={onDeleteEvent ? () => {
                        if (window.confirm("Delete this event?")) {
                            onDeleteEvent(selectedEvent.id);
                            setSelectedEvent(null);
                        }
                    } : undefined}
                />
            )}

            {viewingTag && (
                <TagDetailModal
                    tag={viewingTag}
                    media={media}
                    onClose={() => setViewingTag(null)}
                    onEdit={onEditTag}
                    onDiscuss={(tag) => { console.log("Discussing", tag.name); }}
                    allTags={tags}
                    currentUser={user}
                />
            )}

            <SubHeader
                left={
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button
                            onClick={onCreateEvent}
                            className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-xl flex items-center gap-2 font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                            title="Create a new chronological timeline event"
                        >
                            <Plus size={16} strokeWidth={3} /> NEW EVENT
                        </button>
                        <div className="hidden md:block h-6 w-px bg-white/10 mx-2"></div>
                    </div>
                }
                center={
                    <div className="flex-1 max-w-2xl relative group w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search memories, dates, or keywords..."
                            className="w-full bg-black/50 border border-white/10 rounded-2xl py-2.5 pl-12 pr-4 text-xs text-white focus:outline-none focus:border-cyan-500/50 transition-all shadow-inner"
                            title="Filter timeline events by text, tags, captions, or specific dates"
                        />
                    </div>
                }
                right={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                                setSortOrder(newOrder);
                                localStorage.setItem('timelineSortOrder', newOrder);
                            }}
                            className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/5 transition-all"
                            title={sortOrder === 'asc' ? 'Sorted Oldest to Newest' : 'Sorted Newest to Oldest'}
                        >
                            {sortOrder === 'asc' ? <SortAsc size={18} /> : <SortDesc size={18} />}
                        </button>
                    </div>
                }
            />

            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-24">
                <div className="max-w-5xl mx-auto space-y-6">
                    {isForcedLoading ? (
                        <RealityLoader />
                    ) : filteredEvents.length > 0 ? (
                        <>
                            {filteredEvents.slice(0, visibleCount).map((event) => (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    media={media}
                                    tags={tags}
                                    user={user}
                                    onEdit={() => onEditEvent(event)}
                                    onView={() => setSelectedEvent(event)}
                                    onTagClick={handleTagClick}
                                    onMediaClick={(m) => onNavigate ? onNavigate('theMatrix', { mediaId: m.id, mediaObject: m }) : console.warn("No nav")}
                                    onAddComment={(text) => onAddComment(event.id, text)}
                                    onUpdateEvent={onUpdateEvent}
                                    viewMode="list"
                                    onDeleteEvent={onDeleteEvent}
                                    onNavigate={onNavigate}
                                    onCreateTag={onCreateTag}
                                />
                            ))}

                            {visibleCount < filteredEvents.length && (
                                <div className="flex justify-center pt-8">
                                    <button
                                        onClick={handleLoadMore}
                                        className="px-8 py-3 bg-black/60 border border-white/10 rounded-full text-slate-400 hover:text-white hover:border-cyan-500/50 transition-all text-sm font-bold uppercase tracking-widest shadow-lg"
                                        title="Reveal older chronological events in the timeline"
                                    >
                                        Load More Memories ({filteredEvents.length - visibleCount} Remaining)
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-20 text-slate-500">
                            <p className="text-lg font-light mb-2">No events found in this sector.</p>
                            <p className="text-sm opacity-50">Try adjusting your chronometer search.</p>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

export default TimeVortex;