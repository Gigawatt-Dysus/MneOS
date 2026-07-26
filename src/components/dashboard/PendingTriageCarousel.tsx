import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, Image as ImageIcon, Sparkles, DatabaseZap, Clock, Play, Pause, ChevronRight, AlertCircle } from 'lucide-react';
import { httpsCallable } from '../../services/apiClient';
import type { Media, View } from '../../types';
import { getPolishFilter } from '../../utils/mediaUtils';
import { AI_TriageModal } from '../TakeoutAirlock/AI_TriageModal';
import { ShimmerWindow } from '../shared/ShimmerWindow';

interface PendingTriageCarouselProps {
  userId: string;
  pendingCount: number;
  onNavigate: (view: View, data?: any) => void;
}

export const PendingTriageCarousel: React.FC<PendingTriageCarouselProps> = ({ userId, pendingCount, onNavigate }) => {
  const [triageItems, setTriageItems] = useState<Media[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [triageFile, setTriageFile] = useState<any>(null);

  // Fetch a batch of pending accessions
  useEffect(() => {
    let isMounted = true;
    const fetchTriageBatch = async () => {
      try {
        setIsLoading(true);
        const sovereignQuery = httpsCallable(null, 'sovereignDbQuery');
        const res = await sovereignQuery({ 
          collectionName: 'pending_accessions', 
          userId, 
          options: { limit: 50 }, // Fetch a larger batch so we can safely filter out JSONs
          where: {
            fileName: { $not: { $regex: "\\.json$", $options: "i" } }
          }
        });

        if (isMounted && res.data && Array.isArray(res.data)) {
          // Process dates and ensure they are valid, strictly filter non-media, and limit to 10
          const processed = res.data
            .filter((doc: any) => {
              const name = (doc.fileName || doc.caption || '').toLowerCase();
              return !name.endsWith('.json') && !name.endsWith('.txt');
            })
            .slice(0, 10)
            .map((doc: any) => ({
              ...doc,
              id: doc.id || doc._id?.toString(),
              uploadDate: doc.uploadDate ? new Date(doc.uploadDate) : new Date(),
              date: doc.date ? new Date(doc.date) : new Date(),
            })) as Media[];
          setTriageItems(processed);
        }
      } catch (err) {
        console.error('[PendingTriageCarousel] Failed to fetch triage batch:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTriageBatch();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Auto-rotate effect
  useEffect(() => {
    if (isPaused || triageItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % triageItems.length);
    }, 6000); // Rotate every 6 seconds

    return () => clearInterval(interval);
  }, [triageItems.length, isPaused]);

  if (isLoading) {
    return (
      <div className="flex-1 bg-[#040b16]/90 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-5 flex flex-col items-center justify-center relative overflow-hidden group shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] min-h-[460px]">
        <DatabaseZap className="w-8 h-8 text-cyan-500/30 animate-pulse mb-3" />
        <span className="text-[10px] font-black text-cyan-400/60 uppercase tracking-widest font-mono">
          SCANNING TRIAGE QUEUE...
        </span>
      </div>
    );
  }

  if (triageItems.length === 0) {
    return (
      <div className="flex-1 bg-[#040b16]/90 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-5 flex flex-col items-center justify-center relative overflow-hidden group shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] min-h-[460px]">
        <Inbox className="w-8 h-8 text-cyan-500/30 mb-3" />
        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest font-mono mb-2">
          QUEUE CLEAR
        </span>
        <p className="text-[10px] text-slate-500 text-center max-w-[200px]">
          No pending accessions found in the Genesis Swarm.
        </p>
      </div>
    );
  }

  // Ensure currentIndex is safe if triageItems shrinks due to adoption
  const safeIndex = currentIndex < triageItems.length ? currentIndex : Math.max(0, triageItems.length - 1);
  const currentItem = triageItems[safeIndex];

  const handleOpenTriage = (item: Media) => {
    setIsPaused(true);
    setTriageFile({
        _id: item.id,
        url: item.url,
        thumbnailUrls: item.thumbnailUrls,
        b2Url: item.url,
        caption: item.caption || item.fileName || 'Pending Media',
        rotation: item.rotation || 0,
        reviewStatus: 'pending',
        originalItem: item
    });
  };

  const handleAdoptTriage = async (docId: string, finalCaption: string, rotation?: number, sourceAI?: string) => {
    try {
        const sovereignWrite = httpsCallable(null, 'sovereignDbWrite');
        const originalItem = triageFile?.originalItem;

        if (!originalItem) throw new Error("Original item context lost");

        // 1. Move to the main media collection to maintain referential integrity
        const finalizedMedia = {
            ...originalItem,
            caption: finalCaption,
            rotation: rotation || 0,
            aiGenerator: sourceAI,
            status: 'clean',
            updatedAt: new Date().toISOString()
        };
        
        await sovereignWrite({
            operation: 'set',
            collectionName: 'media',
            userId,
            docId,
            data: finalizedMedia
        });

        // 2. Remove from pending_accessions
        await sovereignWrite({
            operation: 'delete',
            collectionName: 'pending_accessions',
            userId,
            docId
        });

        // 3. Purge from local state without page reload
        setTriageItems(prev => prev.filter(item => item.id !== docId));
        setTriageFile(null);
        setIsPaused(false);
    } catch (err) {
        console.error('[PendingTriageCarousel] Failed to adopt triage item:', err);
        alert('Failed to resolve triage item. Please check console.');
    }
  };

  return (
    <ShimmerWindow containerClassName="flex-1 min-h-[460px] shadow-2xl" className="h-full w-full">
      <div 
        className="h-full bg-gradient-to-br from-[#040b16]/90 to-black backdrop-blur-xl border border-cyan-500/20 rounded-[21px] flex flex-col relative overflow-hidden group shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
      {/* Tech Bracket Accents */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500/30 rounded-tl-3xl pointer-events-none z-20 transition-all"></div>
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/30 rounded-tr-3xl pointer-events-none z-20 transition-all"></div>
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/30 rounded-bl-3xl pointer-events-none z-20 transition-all"></div>
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500/30 rounded-br-3xl pointer-events-none z-20 transition-all"></div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 to-transparent shrink-0 relative z-10">
        <div className="flex items-center gap-2">
          <AlertCircle size={14} className="text-rose-500 animate-pulse" />
          <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.25em] font-mono drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">PENDING TRIAGE</span>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/30 text-[9px] font-black text-rose-400 tracking-widest font-mono animate-pulse">
              {pendingCount.toLocaleString()} PENDING
            </span>
          )}
        </div>
      </div>

      {/* Main Carousel Area */}
      <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden bg-black/60 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center p-6"
          >
            {/* The Image/Media */}
            <div className="relative w-full h-full max-w-sm rounded-xl overflow-hidden border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.15)] group-hover:border-cyan-400/50 transition-colors">
              <img 
                src={currentItem.thumbnailUrl || currentItem.url} 
                alt={currentItem.caption || 'Pending Item'} 
                className="w-full h-full object-contain bg-black/80"
                style={{ filter: getPolishFilter(currentItem) }}
              />
              
              {/* Overlay Gradient for Text Readability */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
              
              {/* Meta Overlay */}
              <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-1">
                <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest font-mono drop-shadow-md">
                  NEEDS ANCHORING
                </span>
                <h4 className="text-xs font-bold text-white truncate max-w-full drop-shadow-lg">
                  {currentItem.caption || currentItem.fileName || 'Untitled Memory'}
                </h4>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[9px] font-mono text-cyan-300/80 bg-black/60 px-1.5 py-0.5 rounded border border-cyan-500/20">
                    {currentItem.year || 'UNKNOWN ERA'}
                  </span>
                  
                  {/* Process Action Button */}
                  <button 
                    onClick={() => handleOpenTriage(currentItem)}
                    title="Launch the AI Triage Modal to extract metadata, fix rotations, and adopt this asset into the primary Sovereign database."
                    className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] pointer-events-auto active:scale-95"
                  >
                    RESOLVE <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Controls & Progress */}
      <div className="border-t border-cyan-500/20 bg-gradient-to-r from-transparent via-cyan-950/20 to-transparent shrink-0 p-3 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? "Resume automated queue rotation" : "Pause automated queue rotation to review current asset"}
            className="w-6 h-6 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 transition-colors cursor-pointer"
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </button>
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
            {currentIndex + 1} / {triageItems.length}
          </span>
        </div>

        {/* Mini pagination dots */}
        <div className="flex gap-1.5">
          {triageItems.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? 'w-4 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'w-1.5 bg-cyan-900/50 hover:bg-cyan-700'}`}
            />
          ))}
        </div>
      </div>

      <AI_TriageModal 
        isOpen={!!triageFile}
        onClose={() => { setTriageFile(null); setIsPaused(false); }}
        document={triageFile}
        onAdopt={handleAdoptTriage}
      />
      </div>
    </ShimmerWindow>
  );
};
