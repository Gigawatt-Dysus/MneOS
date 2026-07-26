import React from 'react';
import { UploadIcon } from '../icons'; 
import type { Media } from '@/types';
import { GalleryImage } from './ProfileComponents';
import { GlassButton } from '../GlassButton';

interface GalleryTabProps {
    userMedia: Media[];
    setViewingMedia: (media: Media) => void;
    triggerMatrixSelector: () => void;
}

export const GalleryTab: React.FC<GalleryTabProps> = ({ userMedia, setViewingMedia, triggerMatrixSelector }) => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest">My Gallery</h3>
                <GlassButton 
                    onClick={triggerMatrixSelector} 
                    variant="primary"
                    className="text-xs"
                >
                    <UploadIcon className="w-4 h-4 mr-2" /> Add from Matrix
                </GlassButton>
            </div>

            {userMedia.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-slate-500 bg-white/[0.02]">
                    <UploadIcon className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm font-mono">No artifacts linked.</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {userMedia.map(media => (
                        <GalleryImage key={media.id} media={media} onClick={() => setViewingMedia(media)} />
                    ))}
                </div>
            )}
        </div>
    );
};