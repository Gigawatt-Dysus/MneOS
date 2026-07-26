import React, { useState, useRef, useEffect } from 'react';
import { TrashIcon } from '../icons'; 
import type { Media } from '../../types';
import { base64ToBlob } from '../../utils/fileUtils';

export const InputField: React.FC<{
  label: string;
  id: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  pattern?: string;
  placeholder?: string;
}> = ({ label, id, name, value, onChange, type = 'text', autoComplete, required = false, pattern, placeholder }) => (
    <div>
        <label htmlFor={id} className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{label}</label>
        <input
            type={type}
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            autoComplete={autoComplete}
            required={required}
            pattern={pattern}
            placeholder={placeholder}
            // [ZEN MATCH] Exact hex #0f172a for input background
            className="w-full bg-[#0f172a] border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all placeholder-slate-600 shadow-inner"
        />
    </div>
);

export const GalleryImage: React.FC<{ media: Media, onClick: () => void }> = ({ media, onClick }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const placeholder = `https://dummyimage.com/150x150/1e293b/475569.png&text=?`;
        let isMounted = true;

        const generateUrl = async () => {
            if (media.base64Data && media.fileType) {
                try {
                    const blob = base64ToBlob(media.base64Data, media.fileType);
                    const newUrl = URL.createObjectURL(blob);
                    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                    objectUrlRef.current = newUrl;
                    if (isMounted) setImageUrl(newUrl);
                } catch (e) {
                    if (isMounted) setImageUrl(placeholder);
                }
            } else {
                if (isMounted) setImageUrl(media.thumbnailUrl || media.url || placeholder);
            }
        };

        generateUrl();

        return () => {
            isMounted = false;
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [media]);

    if (!imageUrl) {
        return <div className="aspect-square bg-white/5 rounded-xl animate-pulse border border-white/5" />;
    }

    return (
        <button onClick={onClick} className="aspect-square bg-black/40 rounded-xl overflow-hidden group relative focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-white/5 transition-all hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-900/20">
            <img src={imageUrl} alt={media.caption} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        </button>
    );
};

export const Lightbox: React.FC<{ mediaItem: Media; onClose: () => void; onDelete?: (id: string) => void }> = ({ mediaItem, onClose, onDelete }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        const placeholder = 'https://dummyimage.com/800x600/1e293b/475569.png&text=Loading...';
        setImageUrl(placeholder);

        const generateUrl = () => {
            if (mediaItem.base64Data && mediaItem.fileType) {
                try {
                    const blob = base64ToBlob(mediaItem.base64Data, mediaItem.fileType);
                    const newUrl = URL.createObjectURL(blob);
                    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                    objectUrlRef.current = newUrl;
                    setImageUrl(newUrl);
                } catch (e) { console.error("Error creating lightbox blob", e); }
            } else {
                setImageUrl(mediaItem.url || mediaItem.thumbnailUrl || placeholder);
            }
        };
        generateUrl();

        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [mediaItem]);

    const handleDelete = () => {
        if (onDelete && window.confirm("Permanently delete this image?")) {
            onDelete(mediaItem.id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors z-50">
                <TrashIcon className="w-8 h-8 rotate-45" /> 
            </button>
            <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                {imageUrl ? (
                    <img src={imageUrl} alt={mediaItem.caption} className="max-w-full max-h-[85vh] object-contain mx-auto mb-6 rounded-lg shadow-2xl border border-white/10" />
                ) : (
                    <div className="w-full h-96 bg-white/5 animate-pulse rounded-lg"/>
                )}
                 {mediaItem.caption && <div className="bg-black/60 backdrop-blur-md px-6 py-3 text-center text-slate-200 text-sm rounded-full border border-white/10 mb-6">{mediaItem.caption}</div>}
                 
                 <div className="flex gap-4">
                     {onDelete && (
                         <button onClick={handleDelete} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-2">
                             <TrashIcon className="w-4 h-4" /> Delete Image
                         </button>
                     )}
                 </div>
            </div>
        </div>
    );
};