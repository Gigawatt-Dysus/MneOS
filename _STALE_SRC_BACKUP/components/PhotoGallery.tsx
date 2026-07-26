import React, { useState, useEffect, useRef } from 'react';
import type { Media, Tag, Reaction, User } from '@/types';
import { base64ToBlob } from '../utils/fileUtils';
import { Squares2X2Icon, ViewColumnsIcon, TrashIcon, CheckCircleIcon, UploadIcon } from './icons';
// [ZEN FIX] Updated path to Media folder
import MatrixSelector from './media/MatrixSelector';

const EMOJI_LIST = ['❤️', '😂', '🤔', '😢', '👍', '💡', '✨'];

interface TheMatrixProps {
  media: Media[];
  tags: Tag[];
  onSaveMedia: (media: Media) => void;
  onDeleteMedia?: (mediaId: string) => void;
  user: User;
}

const MediaItem: React.FC<{ mediaItem: Media, onClick: (mediaItem: Media) => void, isSelected: boolean, toggleSelection: (id: string) => void, selectionMode: boolean, onDelete?: () => void }> = ({ mediaItem, onClick, isSelected, toggleSelection, selectionMode, onDelete }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const ref = objectUrlRef;
        return () => {
            if (ref.current) {
                URL.revokeObjectURL(ref.current);
                ref.current = null;
            }
        };
    }, []);

    useEffect(() => {
        setIsLoading(true);
        const placeholder = 'https://dummyimage.com/300x300/e9d5ff/4c1d95.png&text=?';
        let isMounted = true;
        
        const generateUrl = async () => {
            if (mediaItem.base64Data && mediaItem.fileType) {
                try {
                    const blob = base64ToBlob(mediaItem.base64Data, mediaItem.fileType);
                    const newUrl = URL.createObjectURL(blob);
                    if(isMounted) {
                        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                        objectUrlRef.current = newUrl;
                        setImageUrl(newUrl);
                    }
                } catch (e) {
                    console.error("Failed to create blob", e);
                    if(isMounted) setImageUrl(placeholder);
                }
            } else {
                 if(isMounted) setImageUrl(mediaItem.thumbnailUrl || mediaItem.url || placeholder);
            }
             if(isMounted) setIsLoading(false);
        };
        
        generateUrl();

        return () => { isMounted = false; };
    }, [mediaItem]);
    
    const handleClick = () => {
        if (selectionMode) {
            toggleSelection(mediaItem.id);
        } else {
            onClick(mediaItem);
        }
    };

    if (isLoading) {
        return <div className="w-full aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />;
    }

    return (
        <div onClick={handleClick} className="group relative aspect-square cursor-pointer">
            <img src={imageUrl!} alt={mediaItem.caption} className="w-full h-full object-cover rounded-lg shadow-md transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 rounded-lg">
                <p className="text-white text-xs line-clamp-2">{mediaItem.caption}</p>
            </div>
            {selectionMode && (
                <div className="absolute top-2 right-2 z-20">
                    {isSelected ? (
                        <CheckCircleIcon className="w-8 h-8 text-violet-500 bg-white rounded-full" />
                    ) : (
                        <div className="w-8 h-8 border-2 border-white bg-black/30 rounded-full group-hover:bg-black/50" />
                    )}
                </div>
            )}
            {onDelete && !selectionMode && (
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                     <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }} 
                        className="p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full backdrop-blur-sm transition-colors shadow-sm"
                        title="Delete Asset"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

const MediaListItem: React.FC<{ mediaItem: Media, tags: Tag[], onClick: () => void, onDelete?: () => void }> = ({ mediaItem, tags, onClick, onDelete }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const ref = objectUrlRef;
        return () => {
            if (ref.current) {
                URL.revokeObjectURL(ref.current);
                ref.current = null;
            }
        };
    }, []);

    useEffect(() => {
        setIsLoading(true);
        const placeholder = 'https://dummyimage.com/300x300/e9d5ff/4c1d95.png&text=?';
        let isMounted = true;
        
        const generateUrl = async () => {
            if (mediaItem.base64Data && mediaItem.fileType) {
                try {
                    const blob = base64ToBlob(mediaItem.base64Data, mediaItem.fileType);
                    const newUrl = URL.createObjectURL(blob);
                    if(isMounted) {
                        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                        objectUrlRef.current = newUrl;
                        setImageUrl(newUrl);
                    }
                } catch (e) {
                    console.error("Failed to create blob for list item", e);
                    if(isMounted) setImageUrl(placeholder);
                }
            } else {
                 if(isMounted) setImageUrl(mediaItem.thumbnailUrl || mediaItem.url || placeholder);
            }
             if(isMounted) setIsLoading(false);
        };
        
        generateUrl();

        return () => { isMounted = false; };
    }, [mediaItem]);

    const itemTags = tags.filter(t => mediaItem.tagIds.includes(t.id));

    return (
        <div onClick={onClick} className="flex gap-4 p-2 bg-white/5 dark:bg-gray-800/20 rounded-lg shadow-md hover:shadow-lg hover:bg-white/10 dark:hover:bg-gray-800/40 transition-all cursor-pointer w-full items-center group">
            <div className="w-24 h-24 flex-shrink-0">
                {isLoading ? <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" /> :
                    <img src={imageUrl!} alt={mediaItem.caption} className="w-full h-full object-cover rounded-md" />
                }
            </div>
            <div className="flex-grow self-start py-2">
                <p className="font-semibold text-gray-800 dark:text-gray-200 line-clamp-1">{mediaItem.fileName || "Media File"}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{mediaItem.caption}</p>
                {itemTags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">
                    {itemTags.slice(0, 4).map(tag => (
                        <span key={tag.id} className="text-xs bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300 px-2 py-0.5 rounded-full">{tag.name}</span>
                    ))}
                    {itemTags.length > 4 && <span className="text-xs bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded-full">+{itemTags.length - 4} more</span>}
                </div>}
            </div>
            <div className="text-right text-xs text-gray-400 dark:text-gray-500 self-start py-2 pr-2 flex flex-col items-end gap-2">
                <div>
                    <p>{new Date(mediaItem.uploadDate).toLocaleDateString()}</p>
                    <p className="truncate">{mediaItem.fileType}</p>
                </div>
                {onDelete && (
                    <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }} 
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete"
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
};


const Lightbox: React.FC<{ mediaItem: Media; displayUrl: string; onClose: () => void; onSave: (media: Media) => void; onDelete?: (id: string) => void; user: User; onReplaceRequest: () => void; }> = ({ mediaItem, displayUrl, onClose, onSave, onDelete, user, onReplaceRequest }) => {
    const [description, setDescription] = useState(mediaItem.caption);
    const [reactions, setReactions] = useState(mediaItem.reactions || []);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);
    
    useEffect(() => {
        setDescription(mediaItem.caption);
        setReactions(mediaItem.reactions || []);
    }, [mediaItem]);

    const handleSaveDescription = () => {
        if (description !== mediaItem.caption) {
            onSave({ ...mediaItem, caption: description });
        }
    };

    const handleReaction = (emoji: string) => {
        let newReactions: Reaction[];
        const existing = reactions.find(r => r.reactorId === user.id);
        if (existing) {
            newReactions = existing.emoji === emoji ? reactions.filter(r => r.reactorId !== user.id) : reactions.map(r => r.reactorId === user.id ? {...r, emoji} : r);
        } else {
            newReactions = [...reactions, { reactorId: user.id, reactorName: user.displayName, emoji, reactorAvatarUrl: user.profilePictureUrl }];
        }
        setReactions(newReactions);
        onSave({ ...mediaItem, reactions: newReactions });
    };

    const handleDelete = () => {
        if (onDelete && window.confirm("Are you sure you want to permanently delete this image?")) {
            onDelete(mediaItem.id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white text-4xl leading-none font-bold hover:text-gray-300 z-10">&times;</button>
            <div className="bg-gray-900/80 rounded-xl max-w-6xl max-h-[95vh] w-full h-full flex flex-col md:flex-row gap-4 p-4" onClick={e => e.stopPropagation()}>
                <div className="flex-grow flex items-center justify-center h-2/3 md:h-full relative group">
                    {!displayUrl ? <div className="w-full h-full bg-gray-700 animate-pulse rounded-lg"/> : 
                        <img src={displayUrl} alt={mediaItem.caption} className="max-w-full max-h-full object-contain" />
                    }
                    <div className="absolute bottom-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onReplaceRequest();
                            }}
                            className="bg-black/60 hover:bg-cyan-900/80 text-white px-6 py-3 rounded-lg flex items-center gap-2 text-sm backdrop-blur-md border border-white/30 transition-all hover:border-cyan-400 hover:text-cyan-400 hover:shadow-[0_0_15px_#06b6d4] font-bold tracking-wider uppercase"
                        >
                            <UploadIcon className="w-5 h-5" /> REPLACE ASSET
                        </button>
                    </div>
                </div>
                <div className="w-full md:w-80 flex-shrink-0 flex flex-col bg-gray-800/50 rounded-lg p-4 h-1/3 md:h-full">
                     <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-24 bg-gray-700/50 text-white p-2 rounded-md mb-2" />
                     <button onClick={handleSaveDescription} className="px-4 py-2 bg-violet-600 text-white rounded-md mb-4 hover:bg-violet-700">Save Description</button>
                    <div className="flex items-center gap-2 flex-wrap">
                        {EMOJI_LIST.map(emoji => <button key={emoji} onClick={() => handleReaction(emoji)} className="text-2xl p-1 rounded-full hover:bg-gray-700">{emoji}</button>)}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {reactions.map(r => <div key={r.reactorId} className="flex items-center gap-1 bg-violet-500/20 px-2 py-0.5 rounded-full text-sm"><span>{r.emoji}</span><span className="text-violet-300">{r.reactorName.split(' ')[0]}</span></div>)}
                    </div>
                    {onDelete && (
                        <div className="mt-auto pt-4 border-t border-gray-700">
                            <button 
                                onClick={handleDelete}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-900/30 text-red-300 hover:bg-red-900/50 rounded-md transition-colors text-sm font-semibold"
                            >
                                <TrashIcon className="w-4 h-4" /> Delete Media
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const TheMatrix: React.FC<TheMatrixProps> = ({ media, tags, onSaveMedia, onDeleteMedia, user }) => {
  const [lightboxData, setLightboxData] = useState<{ mediaItem: Media; displayUrl: string } | null>(null);
  const [view, setView] = useState<'details' | 'sm' | 'md' | 'lg'>('md');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Matrix Selector Integration
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [targetReplaceId, setTargetReplaceId] = useState<string | null>(null);

  const activeBlobUrl = useRef<string | null>(null);
    
  const handleCloseLightbox = () => {
    if (activeBlobUrl.current) {
      URL.revokeObjectURL(activeBlobUrl.current);
      activeBlobUrl.current = null;
    }
    setLightboxData(null);
  };

  const handleMediaItemClick = async (mediaItem: Media) => {
    if (activeBlobUrl.current) {
        URL.revokeObjectURL(activeBlobUrl.current);
        activeBlobUrl.current = null;
    }

    let displayUrl = '';
    const placeholder = 'https://dummyimage.com/800x600/e9d5ff/4c1d95.png&text=Loading...';
    
    setLightboxData({ mediaItem, displayUrl: '' });

    if (mediaItem.base64Data && mediaItem.fileType) {
        try {
            const blob = base64ToBlob(mediaItem.base64Data, mediaItem.fileType);
            const newUrl = URL.createObjectURL(blob);
            activeBlobUrl.current = newUrl;
            displayUrl = newUrl;
        } catch (e) {
            console.error("Failed to create blob for Lightbox", e);
            displayUrl = placeholder;
        }
    } else {
        displayUrl = mediaItem.url || mediaItem.thumbnailUrl || placeholder;
    }

    setLightboxData({ mediaItem, displayUrl });
  };
    
  const gridClasses = {
      sm: 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
      md: 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
      lg: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
      details: '' 
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        return newSet;
    });
  };

  const handleDeleteSelected = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) {
        if (onDeleteMedia) {
            selectedIds.forEach(id => onDeleteMedia(id));
        }
        setSelectionMode(false);
        setSelectedIds(new Set());
    }
  }

  const handleReplaceRequest = () => {
      console.log("Triggering Matrix Selector for Replacement");
      if (lightboxData) {
          setTargetReplaceId(lightboxData.mediaItem.id);
          setIsMatrixOpen(true);
      }
  };

  const handleDeleteOne = (id: string) => {
      if (window.confirm("Are you sure you want to permanently delete this asset?")) {
          onDeleteMedia && onDeleteMedia(id);
      }
  };

  const handleMatrixSelect = (newMedia: Media) => {
      if (targetReplaceId) {
          const original = media.find(m => m.id === targetReplaceId);
          if (original) {
              const updatedMedia = {
                  ...original,
                  url: newMedia.url,
                  thumbnailUrl: newMedia.thumbnailUrl,
                  base64Data: newMedia.base64Data,
                  fileType: newMedia.fileType,
                  fileName: newMedia.fileName,
                  size: newMedia.size
              };
              
              onSaveMedia(updatedMedia);
              
              // Update lightbox view if it's the one open
              if (lightboxData && lightboxData.mediaItem.id === targetReplaceId) {
                  setLightboxData({ 
                      ...lightboxData, 
                      mediaItem: updatedMedia, 
                      displayUrl: newMedia.url || newMedia.thumbnailUrl // Optimistic update
                  });
              }
          }
      }
      setIsMatrixOpen(false);
      setTargetReplaceId(null);
  };

  return (
    <div>
      {lightboxData && (
          <Lightbox 
            mediaItem={lightboxData.mediaItem} 
            displayUrl={lightboxData.displayUrl} 
            onClose={handleCloseLightbox} 
            onSave={onSaveMedia} 
            onDelete={onDeleteMedia} 
            user={user} 
            onReplaceRequest={handleReplaceRequest}
          />
      )}
      
      {isMatrixOpen && (
          <MatrixSelector 
            onClose={() => setIsMatrixOpen(false)}
            // [ZEN FIX] Removed 'allMedia' and 'onSaveMedia' which are not on the MatrixSelector interface 
            // The selector fetches its own data now
            userId={user.id}
            onSelect={handleMatrixSelect}
          />
      )}

      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 text-glow">The Matrix</h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">Your collection of photos, videos, and documents.</p>
      </div>
       <div className="sticky top-20 z-10 flex justify-between items-center my-4 bg-gray-100/80 dark:bg-gray-800/80 p-2 rounded-lg backdrop-blur-md">
                <div className="flex items-center gap-1">
                    <button onClick={() => { setView('details'); setSelectionMode(false); }} className={`p-2 rounded-md ${view === 'details' ? 'bg-violet-200 dark:bg-violet-700' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}><ViewColumnsIcon className="w-5 h-5"/></button>
                    <button onClick={() => setView('sm')} className={`p-2 rounded-md ${view === 'sm' ? 'bg-violet-200 dark:bg-violet-700' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}><Squares2X2Icon className="w-5 h-5"/></button>
                     <button onClick={() => setView('md')} className={`p-2 rounded-md ${view === 'md' ? 'bg-violet-200 dark:bg-violet-700' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>MD</button>
                    <button onClick={() => setView('lg')} className={`p-2 rounded-md ${view === 'lg' ? 'bg-violet-200 dark:bg-violet-700' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>LG</button>
                </div>
                {selectionMode ? (
                     <div className="flex items-center gap-2">
                         <span className="text-sm">{selectedIds.size} selected</span>
                         {onDeleteMedia && <button onClick={handleDeleteSelected} className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-md flex items-center gap-1"><TrashIcon className="w-4 h-4"/> Delete</button>}
                         <button onClick={() => setSelectionMode(false)} className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded-md">Cancel</button>
                     </div>
                ) : (
                    <button onClick={() => setSelectionMode(true)} disabled={view === 'details'} className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed">Select</button>
                )}
            </div>
      {media.length > 0 ? (
        view === 'details' ? (
            <div className="space-y-3">
                {media.map(item => (
                    <MediaListItem
                        key={item.id}
                        mediaItem={item}
                        tags={tags}
                        onClick={() => handleMediaItemClick(item)}
                        onDelete={onDeleteMedia ? () => handleDeleteOne(item.id) : undefined}
                    />
                ))}
            </div>
        ) : (
            <div className={`grid ${gridClasses[view]} gap-4`}>
                {media.map((item) => (
                    <MediaItem 
                        key={item.id} 
                        mediaItem={item} 
                        onClick={handleMediaItemClick} 
                        isSelected={selectedIds.has(item.id)}
                        toggleSelection={toggleSelection}
                        selectionMode={selectionMode}
                        onDelete={onDeleteMedia ? () => handleDeleteOne(item.id) : undefined}
                    />
                ))}
            </div>
        )
      ) : (
        <div className="text-center text-gray-500 dark:text-gray-400 py-10 cursor-pointer hover:text-cyan-500" onClick={() => setIsMatrixOpen(true)}>
            <p>The Matrix is empty.</p>
            <p className="text-sm mt-2 font-mono text-cyan-600">CLICK TO INITIALIZE UPLOAD PROTOCOL</p>
        </div>
      )}
    </div>
  );
};

export default TheMatrix;