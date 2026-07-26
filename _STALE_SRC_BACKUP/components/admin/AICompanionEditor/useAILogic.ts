import { useState } from 'react';
import type { User, AiCompanion } from '@/types';
import { GIGI_AVATAR_URL } from '../../../mockData'; // [ZEN FIX] Point to root mockData
import { DEFAULT_MODEL_ID } from '../../../services/ai/config';

interface UseAILogicProps {
    user: User;
    onUserUpdate: (user: User) => void;
}

export const useAILogic = ({ user, onUserUpdate }: UseAILogicProps) => {
    const [editingCompanion, setEditingCompanion] = useState<AiCompanion | null>(null);
    const [activeTab, setActiveTab] = useState<'companions' | 'logs'>('companions');

    const handleCreateNew = () => {
        setEditingCompanion({
            id: `new-${Date.now()}`,
            name: 'New Companion',
            avatarUrl: GIGI_AVATAR_URL,
            bio: '',
            persona: 'buddy',
            isPrimary: false,
            spiceLevel: 1, 
            // [ZEN FIX] Default to Grok 3 instead of Gemini
            preferredModel: DEFAULT_MODEL_ID
        });
    };

    const handleSave = (companionToSave: AiCompanion) => {
        const existingIndex = user.aiCompanions.findIndex(c => c.id === companionToSave.id);
        let updatedCompanions;

        if (existingIndex > -1) {
            updatedCompanions = user.aiCompanions.map(c => c.id === companionToSave.id ? companionToSave : c);
        } else {
            updatedCompanions = [...user.aiCompanions, companionToSave];
        }

        // Ensure only one primary if the saved one claims it
        if (companionToSave.isPrimary) {
            updatedCompanions = updatedCompanions.map(c => ({
                ...c,
                isPrimary: c.id === companionToSave.id
            }));
        }

        onUserUpdate({ ...user, aiCompanions: updatedCompanions });
        setEditingCompanion(null);
    };

    const handleDelete = (companionId: string) => {
        if (window.confirm("Are you sure you want to delete this AI companion? This action cannot be undone.")) {
            const updatedCompanions = user.aiCompanions.filter(c => c.id !== companionId);
            onUserUpdate({ ...user, aiCompanions: updatedCompanions });
        }
    };

    return {
        editingCompanion, setEditingCompanion,
        activeTab, setActiveTab,
        handleCreateNew,
        handleSave,
        handleDelete
    };
};