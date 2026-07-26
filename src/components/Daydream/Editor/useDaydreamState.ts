import { useState, useEffect } from 'react';
import { DaydreamStory, User } from '../../../types';
import { DirectorState, PaperSize, Orientation, Margins, GenieInsight, PAPER_DIMENSIONS, MARGIN_STYLES } from './types';

export const useDaydreamState = (user: User) => {
    const [story, setStory] = useState<DaydreamStory | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [zoom, setZoom] = useState(1);
    const [wordWrap, setWordWrap] = useState(true);
    const [bgColor, setBgColor] = useState<string>('transparent');
    const [showOOCChat, setShowOOCChat] = useState(false);
    const [showFormatting, setShowFormatting] = useState(false);
    const [savedTones, setSavedTones] = useState<string[]>([]);
    
    // Genie State
    const [critique, setCritique] = useState<GenieInsight[]>([]);
    const [genieThinking, setGenieThinking] = useState(false);
    const [showGenie, setShowGenie] = useState(false);
    const [activeRevision, setActiveRevision] = useState<number | null>(null);

    // Layout Engine
    const [paperSize, setPaperSize] = useState<PaperSize>('letter');
    const [orientation, setOrientation] = useState<Orientation>('portrait');
    const [margins, setMargins] = useState<Margins>('standard');

    // Director State
    const [director, setDirector] = useState<DirectorState>({
        temperature: 0.7,
        length: 'medium',
        tone: '',
        intensity: 'tame'
    });

    // Tone Persistence
    useEffect(() => {
        const saved = localStorage.getItem('daydream_saved_tones');
        if (saved) {
            try { setSavedTones(JSON.parse(saved)); } catch (e) {}
        }
    }, []);

    // View Persistence
    useEffect(() => {
        const saved = localStorage.getItem('daydream_view_prefs');
        if (saved) {
            try {
                const prefs = JSON.parse(saved);
                if (prefs.paperSize && PAPER_DIMENSIONS[prefs.paperSize as PaperSize]) setPaperSize(prefs.paperSize);
                if (prefs.orientation) setOrientation(prefs.orientation);
                if (prefs.margins && MARGIN_STYLES[prefs.margins as Margins]) setMargins(prefs.margins);
                if (prefs.zoom) setZoom(prefs.zoom);
                if (prefs.wordWrap !== undefined) setWordWrap(prefs.wordWrap);
                if (prefs.bgColor) setBgColor(prefs.bgColor);
            } catch (e) {}
        }
        const savedDirector = localStorage.getItem('daydream_director_prefs');
        if (savedDirector) {
            try {
                setDirector(prev => ({ ...prev, ...JSON.parse(savedDirector) }));
            } catch (e) {}
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('daydream_view_prefs', JSON.stringify({
            paperSize, orientation, margins, zoom, wordWrap, bgColor
        }));
    }, [paperSize, orientation, margins, zoom, wordWrap, bgColor]);

    useEffect(() => {
        localStorage.setItem('daydream_director_prefs', JSON.stringify(director));
    }, [director]);

    return {
        story, setStory,
        isSidebarOpen, setIsSidebarOpen,
        isSaving, setIsSaving,
        isThinking, setIsThinking,
        status, setStatus,
        zoom, setZoom,
        wordWrap, setWordWrap,
        bgColor, setBgColor,
        showOOCChat, setShowOOCChat,
        showFormatting, setShowFormatting,
        savedTones, setSavedTones,
        critique, setCritique,
        genieThinking, setGenieThinking,
        showGenie, setShowGenie,
        activeRevision, setActiveRevision,
        paperSize, setPaperSize,
        orientation, setOrientation,
        margins, setMargins,
        director, setDirector
    };
};
