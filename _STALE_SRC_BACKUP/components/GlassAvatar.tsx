import React from 'react';
import { Tag as TagIcon } from 'lucide-react';

interface GlassAvatarProps {
    imageUrl?: string | null;
    src?: string | null; // [ZEN SHIM] Added for compatibility with new code
    altText?: string;
    alt?: string;        // [ZEN SHIM] Added for compatibility
    fallbackChar?: string;
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
    size = "w-48 h-48", 
    className = "", 
    onClick,
    children 
}) => {
    // Resolve props to support both your original API and the standard HTML props I used
    const finalImage = imageUrl || src;
    const finalAlt = altText || alt || "Avatar";

    return (
        <div 
            onClick={onClick}
            className={`${size} shrink-0 relative group gigi-glass-avatar flex items-center justify-center ${className} ${onClick ? 'cursor-pointer' : ''}`}
        >
            {finalImage ? (
                <img 
                    src={finalImage} 
                    alt={finalAlt} 
                    className="w-full h-full object-cover" 
                />
            ) : (
                <span className="initials">
                    {fallbackChar ? fallbackChar.charAt(0).toUpperCase() : <TagIcon size="50%" />}
                </span>
            )}
            {children}
        </div>
    );
};