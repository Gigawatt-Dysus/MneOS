import { useState, useEffect, useCallback } from 'react';
import { NeuralTag } from '../types';

export const useNeuralPalette = (userInput: string, setUserInput: (v: string) => void, textAreaRef: React.RefObject<HTMLTextAreaElement>) => {
    const [vocalTags, setVocalTags] = useState<NeuralTag[]>([]);
    const [tagSuggestions, setTagSuggestions] = useState<NeuralTag[]>([]);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [tagSearchQuery, setTagSearchQuery] = useState('');

    useEffect(() => {
        const fetchTags = async () => {
            try {
                const response = await fetch('/assets/AudioTagLibrary.txt');
                if (!response.ok) throw new Error("Failed to load Neural Tag Library");
                const data = await response.json();
                if (data.tts_tags) {
                    const mapped: NeuralTag[] = data.tts_tags.map((t: any) => ({
                        name: (t.tag || '').replace(/[\[\]]/g, ''),
                        category: t.category,
                        description: t.description,
                        example: t.example
                    }));
                    setVocalTags(mapped);
                }
            } catch (err) { console.error("[NeuralPalette] ❌ Tag Sync Failed:", err); }
        };
        fetchTags();
    }, []);

    const updateSuggestions = useCallback((val: string, cursor: number) => {
        const textBefore = val.slice(0, cursor);
        const bracketIdx = textBefore.lastIndexOf('[');

        if (bracketIdx !== -1 && !textBefore.slice(bracketIdx).includes(']')) {
            const query = textBefore.slice(bracketIdx + 1).toLowerCase();
            const filtered = vocalTags.filter(t => t.name.toLowerCase().startsWith(query)).slice(0, 15);
            setTagSuggestions(filtered);
            setSuggestionIndex(0);
        } else {
            setTagSuggestions([]);
        }
    }, [vocalTags]);

    const applyTag = useCallback((tagName: string) => {
        const cursor = textAreaRef.current?.selectionStart || 0;
        const textBefore = userInput.slice(0, cursor);
        const bracketIdx = textBefore.lastIndexOf('[');
        const textAfter = userInput.slice(cursor);

        const newValue = userInput.slice(0, bracketIdx) + `[${tagName}] ` + textAfter;
        setUserInput(newValue);
        setTagSuggestions([]);
        
        setTimeout(() => {
            if (textAreaRef.current) {
                const newPos = bracketIdx + tagName.length + 3;
                textAreaRef.current.focus();
                textAreaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 10);
    }, [userInput, setUserInput, textAreaRef]);

    return {
        vocalTags,
        tagSuggestions,
        setTagSuggestions,
        suggestionIndex,
        setSuggestionIndex,
        tagSearchQuery,
        setTagSearchQuery,
        updateSuggestions,
        applyTag
    };
};
