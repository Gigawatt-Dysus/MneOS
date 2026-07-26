import React from 'react';
import type { Tag, PersonTag, Media } from '../../../types';
import { useTreeData } from './useTreeData';
import { useTreeRenderer } from './useTreeRenderer';

interface InteractiveFamilyTreeProps {
    centerTag: PersonTag;
    allTags: Tag[];
    allMedia: Media[];
    onNodeClick: (tag: Tag) => void;
    highlightId?: string;
    userPersonTagId?: string;
}

export const InteractiveFamilyTree: React.FC<InteractiveFamilyTreeProps> = ({ centerTag, allTags, allMedia, onNodeClick, highlightId, userPersonTagId }) => {
    // 1. Prepare Data
    const { descData, ancData } = useTreeData(centerTag, allTags, allMedia, userPersonTagId);

    // 2. Render Tree
    const containerRef = useTreeRenderer(descData, ancData, allTags, onNodeClick);

    return (
        <div
            ref={containerRef}
            className="w-full h-full bg-transparent relative overflow-auto rounded-xl border border-white/5 custom-scrollbar"
        >
            {!descData && (
                <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Weaving Tree...</span>
                    </div>
                </div>
            )}
        </div>
    );
};
