import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ChatSession } from '../types/models';
import { getChatSessions, saveChatSession, deleteChatSession } from '../services/sovereignChat';
import { User } from '../types';

interface ChatSessionContextType {
    sessions: ChatSession[];
    currentSessionId: string | null;
    isLoadingSessions: boolean;
    setCurrentSessionId: (id: string | null) => void;
    createNewSession: (title?: string) => Promise<string>;
    loadSessions: () => Promise<void>;
    handleDeleteSession: (id: string) => Promise<void>;
    updateSessionPreview: (id: string, preview: string) => Promise<void>;
    updateSessionTitle: (id: string, title: string) => Promise<void>;
    isSessionsDrawerOpen: boolean;
    setIsSessionsDrawerOpen: (isOpen: boolean) => void;
}

const ChatSessionContext = createContext<ChatSessionContextType | undefined>(undefined);

export const ChatSessionProvider: React.FC<{ user: User | null, children: ReactNode }> = ({ user, children }) => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => localStorage.getItem('lifeos_current_session_id'));
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [isSessionsDrawerOpen, setIsSessionsDrawerOpen] = useState(false);

    useEffect(() => {
        if (currentSessionId) {
            localStorage.setItem('lifeos_current_session_id', currentSessionId);
        } else {
            localStorage.removeItem('lifeos_current_session_id');
        }
    }, [currentSessionId]);

    const loadSessions = useCallback(async () => {
        if (!user) return;
        setIsLoadingSessions(true);
        try {
            const fetched = await getChatSessions(user.id);
            setSessions(fetched);
        } catch (error) {
            console.error('[ChatSessionProvider] Error loading sessions:', error);
        } finally {
            setIsLoadingSessions(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            loadSessions();
        } else {
            setSessions([]);
            setCurrentSessionId(null);
        }
    }, [user, loadSessions]);

    const createNewSession = async (title: string = 'New Conversation'): Promise<string> => {
        if (!user) throw new Error('Cannot create session: No user active.');
        const newId = `session-${Date.now()}`;
        const session: ChatSession = {
            id: newId,
            title,
            createdAt: Date.now(),
            lastUpdatedAt: Date.now()
        };
        await saveChatSession(user.id, session);
        setSessions(prev => [session, ...prev]);
        setCurrentSessionId(newId);
        return newId;
    };

    const handleDeleteSession = async (id: string) => {
        if (!user) return;
        await deleteChatSession(user.id, id);
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSessionId === id) {
            setCurrentSessionId(null);
        }
    };

    const updateSessionPreview = async (id: string, preview: string) => {
        if (!user) return;
        const session = sessions.find(s => s.id === id);
        if (session) {
            const updated = { ...session, preview, lastUpdatedAt: Date.now() };
            await saveChatSession(user.id, updated);
            setSessions(prev => prev.map(s => s.id === id ? updated : s));
        }
    };

    const updateSessionTitle = async (id: string, title: string) => {
        if (!user) return;
        const session = sessions.find(s => s.id === id);
        if (session) {
            const updated = { ...session, title, lastUpdatedAt: Date.now() };
            await saveChatSession(user.id, updated);
            setSessions(prev => prev.map(s => s.id === id ? updated : s));
        }
    };

    return (
        <ChatSessionContext.Provider value={{
            sessions,
            currentSessionId,
            isLoadingSessions,
            setCurrentSessionId,
            createNewSession,
            loadSessions,
            handleDeleteSession,
            updateSessionPreview,
            updateSessionTitle,
            isSessionsDrawerOpen,
            setIsSessionsDrawerOpen
        }}>
            {children}
        </ChatSessionContext.Provider>
    );
};

export const useChatSessions = () => {
    const context = useContext(ChatSessionContext);
    if (context === undefined) {
        throw new Error('useChatSessions must be used within a ChatSessionProvider');
    }
    return context;
};
