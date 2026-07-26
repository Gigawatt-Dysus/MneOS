// services/globalTags.ts
import type { Tag } from '../types';

export const GLOBAL_CONTEXT_TAGS: string[] = [
    // Emotions & Vibe
    "Funny", "Happy", "Nostalgic", "Serious", "Silly", "Beautiful", "Cool", "Proud", "Love",
    // Events
    "Birthday", "Wedding", "Graduation", "Holiday", "Vacation", "Party", "Concert", "Festival", "Reunion",
    // Topics
    "Family", "Friends", "Work", "School", "Travel", "Road Trip", "Food", "Drink", "Music", "Art", "Sports", "Hobbies", "DIY", "Cars", "Nature", "Wildlife",
    // Settings
    "Home", "Garden", "Beach", "Mountains", "City", "Forest", "Park",
    // Formats
    "Selfie", "Portrait", "Group Photo", "Landscape", "Screenshot", "Document", "Receipt", "Meme", "Vintage"
];

export const getGlobalTagSuggestions = (query: string, existingUserTags: Tag[]): string[] => {
    const lowerQuery = query.toLowerCase();
    const userTagNames = new Set(existingUserTags.map(t => t.name.toLowerCase()));
    
    return GLOBAL_CONTEXT_TAGS.filter(tag => 
        tag.toLowerCase().includes(lowerQuery) && 
        !userTagNames.has(tag.toLowerCase()) // Only suggest if user doesn't already have it
    );
};