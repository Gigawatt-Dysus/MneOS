import React, { useState, useEffect } from 'react';
import { Tag as TagIcon } from 'lucide-react';

interface GlassAvatarProps {
    imageUrl?: string | null;
    src?: string | null; // [ZEN SHIM] Added for compatibility with new code
    altText?: string;
    alt?: string;        // [ZEN SHIM] Added for compatibility
    fallbackChar?: string;
    hideFallback?: boolean;
    size?: string; // e.g. "w-48 h-48"
    className?: string;
    onClick?: () => void;
    children?: React.ReactNode;
}

export const GlassAvatar: React.FC<GlassAvatarProps> = ({ 
    imageUrl, 
    src,
    altText, 
    alt,
    fallbackChar, 
    hideFallback = false,
    size = "w-48 h-48", 
    className = "", 
    onClick,
    children 
}) => {
    const [imgError, setImgError] = useState(false);
    const finalImage = imageUrl || src;
    const finalAlt = altText || alt || "Avatar";

    // Reset error state if image source changes
    useEffect(() => {
        setImgError(false);
    }, [finalImage]);

    return (
        <div 
            onClick={onClick}
            className={`${size} shrink-0 relative group gigi-glass-avatar rounded-full overflow-hidden flex items-center justify-center ${className} ${onClick ? 'cursor-pointer' : ''}`}
        >
            {finalImage && !imgError ? (
                <img 
                    src={finalImage} 
                    alt={finalAlt} 
                    loading="lazy"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover rounded-full" 
                />
            ) : !hideFallback ? (
                <span className="initials font-bold text-cyan-300">
                    {fallbackChar ? fallbackChar.charAt(0).toUpperCase() : <TagIcon size="50%" />}
                </span>
            ) : null}
            {children}
        </div>
    );
};