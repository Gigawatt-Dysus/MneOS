import { DaydreamStory, User } from '../../../types';

export interface DaydreamEditorProps {
    user: User;
    storyId?: string;
    onClose: () => void;
}

export interface DirectorState {
    temperature: number; // 0.1 - 1.5
    length: 'short' | 'medium' | 'long';
    tone: string; // "Casual", "Formal", "Dark", etc.
    intensity: 'tame' | 'feral' | 'unhinged';
}

export interface GenieInsight {
    type: 'grammar' | 'pacing' | 'style' | 'voice' | 'sensory';
    level: 'critical' | 'suggestion' | 'praise';
    critique: string;
    suggestion: string;
    quote?: string;
    correction?: string;
}

export type PaperSize = 'letter' | 'legal' | 'tabloid' | 'a4' | 'a5';
export type Orientation = 'portrait' | 'landscape';
export type Margins = 'narrow' | 'standard' | 'wide';

export const PAPER_DIMENSIONS: Record<PaperSize, { w: string, h: string, label: string }> = {
    letter: { w: '8.5in', h: '11in', label: 'Letter (US)' },
    legal: { w: '8.5in', h: '14in', label: 'Legal (US)' },
    tabloid: { w: '11in', h: '17in', label: 'Tabloid (US)' },
    a4: { w: '210mm', h: '297mm', label: 'A4 (ISO)' },
    a5: { w: '148mm', h: '210mm', label: 'A5 (ISO)' },
};

export const MARGIN_STYLES: Record<Margins, string> = {
    narrow: 'px-12 pt-12 pb-12',
    standard: 'px-20 pt-24 pb-24',
    wide: 'px-32 pt-24 pb-24',
};

export const GOOGLE_FONTS = [
    "Inter", "Roboto", "Lato", "Merriweather", "Playfair Display", "Lora",
    "Source Code Pro", "Nunito", "Raleway", "Quicksand", "Crimson Text",
    "Libre Baskerville", "Space Mono", "Courier Prime", "Cinzel"
];
