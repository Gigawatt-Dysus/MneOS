import React, { useState } from 'react';
import { User, X, Check } from 'lucide-react';
import { doc, updateDoc, arrayUnion } from '../../services/sovereignDbAdapter';
import { db } from '../../firebaseConfig';
import { Media } from '../../types';
import { PersonPicker } from './PersonPicker';

interface FaceOverlayProps {
    asset: Media;
    userId: string;
}

interface FaceTag {
    personId: string;
    personName: string;
    box: { top: number; left: number; width: number; height: number };
}

export const FaceOverlay: React.FC<FaceOverlayProps> = ({ asset, userId }) => {
    const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    // Cast asset to access Azure data
    const azureFaces = (asset as any).azureData?.faces || [];
    const knownTags = (asset as any).face_tags as FaceTag[] || [];

    if (!azureFaces.length) return null;

    // Helper to check if a face is already tagged
    const getTagForFace = (faceIndex: number) => {
        const face = azureFaces[faceIndex];
        return knownTags.find(t =>
            Math.abs(t.box.left - face.faceRectangle.left) < 10 &&
            Math.abs(t.box.top - face.faceRectangle.top) < 10
        );
    };

    const handlePersonSelect = async (person: { id: string; name: string }) => {
        if (selectedFaceIndex === null || !asset.width || !asset.height) return;

        const face = azureFaces[selectedFaceIndex];
        const newTag: any = {
            personId: person.id,
            personName: person.name,
            box: face.faceRectangle,
            status: 'staged' // [ZEN EWO 009] Staging Protocol
        };

        setSaving(true);
        try {
            const docRef = doc(db, 'users', userId, 'media', asset.id);
            await updateDoc(docRef, {
                face_tags: arrayUnion(newTag)
            });
            console.log(`[FaceOverlay] Tagged ${person.name}`);
            setSelectedFaceIndex(null);
        } catch (e) {
            console.error('[FaceOverlay] Failed to tag face:', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 z-50 pointer-events-none">
            {azureFaces.map((face: any, index: number) => {
                const tag = getTagForFace(index);
                const isSelected = selectedFaceIndex === index;

                const style = asset.width && asset.height ? {
                    top: `${(face.faceRectangle.top / asset.height) * 100}%`,
                    left: `${(face.faceRectangle.left / asset.width) * 100}%`,
                    width: `${(face.faceRectangle.width / asset.width) * 100}%`,
                    height: `${(face.faceRectangle.height / asset.height) * 100}%`,
                } : {};

                if (!asset.width || !asset.height) return null;

                return (
                    <div
                        key={index}
                        style={style}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!tag) setSelectedFaceIndex(isSelected ? null : index);
                        }}
                        className={`absolute border-2 transition-all cursor-pointer pointer-events-auto
                            ${tag
                                ? 'border-emerald-500/50 hover:border-emerald-400 bg-emerald-500/10'
                                : isSelected
                                    ? 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_15px_rgba(34,211,238,0.5)]'
                                    : 'border-cyan-500/30 hover:border-cyan-400/80 hover:bg-cyan-400/5'
                            }
                            rounded-md
                            group
                        `}
                    >
                        {tag && (
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                {tag.personName}
                            </div>
                        )}

                        {isSelected && !tag && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 pointer-events-auto">
                                <PersonPicker
                                    onSelect={handlePersonSelect}
                                    onClose={() => setSelectedFaceIndex(null)}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
