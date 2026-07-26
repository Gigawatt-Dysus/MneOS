import React, { useState, useEffect, } from 'react';
import type { LifeEvent, Media, Tag, User, View } from '@/types';
import { SortAsc, SortDesc, Plus, Search, MapPin, Image as ImageIcon, Calendar, Loader2 } from 'lucide-react'; 
import { parseNaturalDateString } from '../utils/ageCalculator';
import { EventCard } from './timeline/EventCard';
import EventViewerModal from './timeline/EventViewerModalFixed'; 
// [ZEN FIX] Named Import to match TagDetailModal.tsx
import { TagDetailModal } from './TagDetailModal';
import { useAIIdentity } from '../hooks/useAIIdentity';

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

const TimeVortex: React.FC<TimeVortexProps> = ({ events, tags, media, user, onEditEvent, onCreateEvent, onEditTag, onAddComment, onUpdateEvent, onDeepDive, onNavigate, onDeleteEvent }) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    return (localStorage.getItem('timelineSortOrder') as 'asc' | 'desc') || 'desc';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEvents, setFilteredEvents] = useState<LifeEvent[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [isForcedLoading, setIsForcedLoading] = useState(true);
  
  const [selectedEvent, setSelectedEvent] = useState<LifeEvent | null>(null);
  const [viewingTag, setViewingTag] = useState<Tag | null>(null);

  useAIIdentity();

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
      sorted = [...events].sort((a, b) => {
            const aTime = a?.date?.getTime();
            const bTime = b?.date?.getTime();
            if (isNaN(aTime) || isNaN(bTime)) return 0;
            return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
        });
    } catch (error) {
        console.error('[TimeVortex] CRITICAL: Failed to sort events.', error);
        sorted = events;
    }

    if (!searchQuery.trim()) {
      setFilteredEvents(sorted);
      return;
    }
    
    const date = parseNaturalDateString(searchQuery);
    const lowerCaseQuery = searchQuery.toLowerCase().trim();

    const results = sorted.filter(event => {
       if (date) {
            const diff = Math.abs(event.date.getTime() - date.getTime());
            if (diff < 86400000) return true;
        }

        const eventTags = tags.filter(t => event.tagIds?.includes(t.id));
        const tagNames = eventTags.map(t => t.name).join(' ').toLowerCase();
        
        const searchableContent = [
            event.title,
            event.details,
            tagNames
        ].join(' ').toLowerCase();

        return searchableContent.includes(lowerCaseQuery);
    });
    setFilteredEvents(results);
    setVisibleCount(20);

  }, [events, tags, sortOrder, searchQuery]);

  const handleLoadMore = () => {
      setVisibleCount(prev => prev + 20);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 min-h-screen pb-20">
      
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
                if(window.confirm("Delete this event?")) {
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
            onEdit={handleEditTag}
            onDiscuss={(tag) => { console.log("Discussing", tag.name); }}
          />
      )}

      <div className="mb-8 flex flex-col md:flex-row gap-6 items-center bg-[#0f1219] p-4 rounded-3xl border border-white/5 shadow-2xl">
          <button 
            onClick={onCreateEvent}
            className="flex-1 w-full bg-gradient-to-r from-[#1a1d26] to-[#0f1219] hover:from-[#1f232e] hover:to-[#13161f] border border-white/10 rounded-2xl p-4 flex items-center justify-between group transition-all"
          >
              <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-cyan-900/50 group-hover:scale-110 transition-transform">
                     <Plus size={20} strokeWidth={3} />
                  </div>
                  <div className="text-left">
                      <span className="block text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">Log New Event</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">What did you experience?</span>
                  </div>
              </div>
              <div className="flex gap-3 text-slate-600 group-hover:text-slate-400 transition-colors">
                  <ImageIcon size={18} />
                  <MapPin size={18} />
                  <Calendar size={18} />
              </div>
          </button>

          <div className="flex-1 w-full relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories, dates (Sep 28 1967), or keywords..." 
                className="w-full bg-[#020617] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all shadow-inner"
              />
          </div>

          <button 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="p-4 bg-[#020617] border border-white/10 rounded-2xl text-slate-400 hover:text-white hover:border-white/20 transition-all flex items-center gap-2 min-w-[140px] justify-center"
          >
              {sortOrder === 'desc' ? <SortDesc size={20} /> : <SortAsc size={20} />}
              <span className="text-xs font-bold uppercase tracking-wider">{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
          </button>
      </div>

      <div className="space-y-6">
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
                        />
                    ))}
                    
                    {visibleCount < filteredEvents.length && (
                        <div className="flex justify-center pt-8">
                            <button 
                                onClick={handleLoadMore}
                                className="px-8 py-3 bg-[#0a0c10] border border-white/10 rounded-full text-slate-400 hover:text-white hover:border-cyan-500/50 transition-all text-sm font-bold uppercase tracking-widest shadow-lg"
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
  );
};

export default TimeVortex;