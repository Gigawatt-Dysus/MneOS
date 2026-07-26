import React from 'react';
// [ZEN FIX] Correct paths: We are in components/matrix/MediaInspector
// So we need to go up 3 levels (../../../) to reach root src
import type { Media, Tag, User as UserType } from '../../../types';

// Sibling imports (in same folder)
import { InspectorHeader } from './InspectorHeader';
import { MetaPanel } from './MetaPanel';
import { EntityPanel } from './EntityPanel';
import { GeoPanel } from './GeoPanel';

interface MediaInspectorProps {
    mode: 'meta' | 'tags';
    media: Media; 
    allTags: Tag[];
    user: UserType;
    onClose: () => void;
    onUpdateLocal: (updated: Media) => void;
    onNavigateToTag?: (tagId: string) => void;
    onTagCreated?: (tag: Tag) => void;
}

export const MediaInspector: React.FC<MediaInspectorProps> = ({ 
    mode, media, allTags, user, onClose, onUpdateLocal,
    onNavigateToTag, onTagCreated
}) => {
    return (
        <div className="h-full flex flex-col bg-[#0f1219] text-slate-200 font-sans border-l border-white/10">
            <InspectorHeader mode={mode} onClose={onClose} />

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 flex flex-col">
                
                {mode === 'meta' && (
                    <MetaPanel 
                        media={media} 
                        user={user} 
                        onUpdateLocal={onUpdateLocal} 
                    />
                )}

                {mode === 'tags' && (
                    <div className="flex flex-col h-full">
                        <EntityPanel 
                            media={media}
                            allTags={allTags}
                            user={user}
                            onUpdateLocal={onUpdateLocal}
                            onNavigateToTag={onNavigateToTag}
                            onTagCreated={onTagCreated}
                        />

                        <div className="flex-1" />

                        <GeoPanel 
                            media={media}
                            user={user}
                            onUpdateLocal={onUpdateLocal} 
                        />
                    </div>
                )}
            </div>
        </div>
    );
};