import { User, SettingsTab } from '../../types';
import { AiChatBridgeProps } from './useAiChatBridge';

export interface NeuralTag {
    name: string;
    category: string;
    description?: string;
    example?: string;
}

export interface AiChatProps extends AiChatBridgeProps {
    onOpenSettings?: (tab?: SettingsTab) => void;
    addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    isFrozen?: boolean;
}

export interface RubricItem {
    id: string;
    label: string;
    penalty: number;
}

export const RUBRIC_ITEMS: RubricItem[] = [
    { id: 'identity', label: 'Identity Drift (Robot/3rd Person)', penalty: 10 },
    { id: 'structure', label: 'Structural Failure (Missing Tags)', penalty: 10 },
    { id: 'narrative', label: 'Narrative Flatness (No Grit)', penalty: 5 },
    { id: 'leak', label: 'Information Leak (Hallucination)', penalty: 15 },
    { id: 'pacing', label: 'Pacing Issue (Too Short/Long)', penalty: 5 }
];
