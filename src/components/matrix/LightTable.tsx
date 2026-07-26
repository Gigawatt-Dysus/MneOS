import React, { useMemo, useState } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getAuth } from 'firebase/auth';
import type { Media } from '../../types';
import { getMediaType } from './MatrixShared';
import BorderGlow from '../shared/BorderGlow';

interface SortablePhotoProps {
    item: Media & { id: string };
}

const SortablePhoto: React.FC<SortablePhotoProps> = ({ item }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 1,
        opacity: isDragging ? 0.8 : 1,
    };

    const type = getMediaType(item);

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`relative aspect-square w-full cursor-grab active:cursor-grabbing rounded-lg overflow-hidden border-2 ${isDragging ? 'border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.6)] scale-105' : 'border-white/10 hover:border-white/30'}`}
        >
            {type === 'image' || !type ? (
                <img
                    src={(item as any).compressedUrl || item.url}
                    alt={item.title || 'Artifact'}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                />
            ) : type === 'video' ? (
                <video
                    src={(item as any).compressedUrl || item.url}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                <div className="absolute inset-0 w-full h-full bg-slate-800 flex items-center justify-center text-xs font-mono text-slate-400">
                    DOCUMENT
                </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-1 text-[9px] text-white font-mono truncate">
                {item.logicalDate ? new Date(item.logicalDate).toLocaleDateString() : ''}
            </div>
        </div>
    );
};

interface LightTableProps {
    vortexItems: any[];
    userId?: string;
    setMedia?: (updater: (prev: Media[]) => Media[]) => void;
    updateAsset?: (asset: Media) => void;
}

export const LightTable: React.FC<LightTableProps> = ({ vortexItems, userId, setMedia, updateAsset }) => {
    // Keep local state for fluid drag operations without waiting for DB
    const [items, setItems] = useState(() => vortexItems.map(item => ({ ...item, id: item.id })));

    // Re-sync if vortexItems changes from outside (e.g., search, filter)
    React.useEffect(() => {
        setItems(vortexItems.map(item => ({ ...item, id: item.id })));
    }, [vortexItems]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // 5px drag before activation
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                
                const newItems = arrayMove(items, oldIndex, newIndex);
                
                // --- Timestamp Micro-Shifting Logic ---
                // We dragged `active` to `newIndex`.
                // We need to calculate a new `logicalDate` for it.
                // In descending sort, newItems[0] is newest.
                
                let newDateValue: number;
                const beforeItem = newIndex > 0 ? newItems[newIndex - 1] : null;
                const afterItem = newIndex < newItems.length - 1 ? newItems[newIndex + 1] : null;

                const parseDate = (d: string) => new Date(d).getTime();

                if (beforeItem && afterItem) {
                    const t1 = parseDate(beforeItem.logicalDate);
                    const t2 = parseDate(afterItem.logicalDate);
                    newDateValue = (t1 + t2) / 2;
                } else if (beforeItem) {
                    // It's at the very end (oldest)
                    newDateValue = parseDate(beforeItem.logicalDate) - 1000;
                } else if (afterItem) {
                    // It's at the very beginning (newest)
                    newDateValue = parseDate(afterItem.logicalDate) + 1000;
                } else {
                    newDateValue = Date.now();
                }

                const updatedLogicalDate = new Date(newDateValue).toISOString();
                const updatedAsset = { 
                    ...newItems[newIndex], 
                    logicalDate: updatedLogicalDate,
                    provenance: {
                        ...(newItems[newIndex].provenance || {}),
                        temporalShift: "Manual DND Override",
                        originalLogicalDate: newItems[newIndex].logicalDate,
                        newLogicalDate: updatedLogicalDate
                    }
                };

                newItems[newIndex] = updatedAsset;

                // Optimistically update parent state if possible
                if (updateAsset) {
                    updateAsset(updatedAsset);
                } else if (setMedia) {
                    setMedia(prev => prev.map(m => m.id === updatedAsset.id ? updatedAsset : m));
                }

                // Background save
                const currentUserId = userId || getAuth().currentUser?.uid;
                if (currentUserId) {
                    import('../../services/serviceManager').then(({ appDataService }) => {
                        appDataService.saveMedia(currentUserId, updatedAsset)
                            .then(() => console.log(`[LightTable] Sovereign micro-shift saved for ${updatedAsset.id}`))
                            .catch(err => console.error("[LightTable] Failed to save shift:", err));
                    });
                }

                return newItems;
            });
        }
    };

    return (
        <div className="w-full h-full p-4 overflow-y-auto">
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3 rounded-xl flex items-center justify-between shadow-[0_0_20px_rgba(245,158,11,0.1)] backdrop-blur-sm">
                <div>
                    <h3 className="font-bold tracking-widest uppercase text-[11px] mb-0.5">Light Table Active</h3>
                    <p className="text-[10px] text-amber-500/80 font-mono">Drag and drop artifacts to seamlessly micro-shift their chronological timestamp.</p>
                </div>
            </div>
            <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 2xl:grid-cols-10 gap-2">
                    <SortableContext 
                        items={items.map(i => i.id)}
                        strategy={rectSortingStrategy}
                    >
                        {items.map(item => (
                            <SortablePhoto key={item.id} item={item} />
                        ))}
                    </SortableContext>
                </div>
            </DndContext>
        </div>
    );
};
