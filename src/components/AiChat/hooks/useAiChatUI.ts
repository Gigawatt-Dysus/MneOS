import { useState, useEffect, useRef } from 'react';

export const useAiChatUI = () => {
    const [isArchPinned, setIsArchPinned] = useState(() => {
        return localStorage.getItem('gigi_arch_pinned') === 'true';
    });
    const [isArchOpen, setIsArchOpen] = useState(false);
    const archTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [showDirectiveTray, setShowDirectiveTray] = useState(false);
    const [showVocalHelp, setShowVocalHelp] = useState(false);
    const [showMigrationWorkbench, setShowMigrationWorkbench] = useState(false);
    const [showFidelityPopover, setShowFidelityPopover] = useState(false);

    
    // Cognitive Override State
    const [overridePointId, setOverridePointId] = useState<string | null>(null);
    const [overrideDirective, setOverrideDirective] = useState('');
    const [rubricSelections, setRubricSelections] = useState<Set<string>>(new Set());
    const [isAnalyzingBreach, setIsAnalyzingBreach] = useState(false);
    const [originalDraftAxiom, setOriginalDraftAxiom] = useState<string | null>(null);

    useEffect(() => {
        localStorage.setItem('gigi_arch_pinned', isArchPinned.toString());
    }, [isArchPinned]);

    const handleArchHover = (open: boolean) => {
        if (open) {
            if (archTimeoutRef.current) clearTimeout(archTimeoutRef.current);
            setIsArchOpen(true);
        } else {
            archTimeoutRef.current = setTimeout(() => setIsArchOpen(false), 500);
        }
    };

    return {
        isArchPinned, setIsArchPinned,
        isArchOpen, handleArchHover,
        showDirectiveTray, setShowDirectiveTray,
        showVocalHelp, setShowVocalHelp,
        showMigrationWorkbench, setShowMigrationWorkbench,
        showFidelityPopover, setShowFidelityPopover,
        overridePointId, setOverridePointId,
        overrideDirective, setOverrideDirective,
        rubricSelections, setRubricSelections,
        isAnalyzingBreach, setIsAnalyzingBreach,
        originalDraftAxiom, setOriginalDraftAxiom
    };
};
