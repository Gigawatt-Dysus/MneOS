import { useState, useEffect, useRef } from 'react';
import type { User } from '@/types';
import { appDataService, initializeServices } from '../services/serviceManager';
import { onAuthStateChangedHandler, signOutUser } from '../services/authService';
import { isFirebaseConfigured as checkFirebaseConfig } from '../firebaseConfig';
import { SecretsManager } from '../utils/SecretsManager';
import { GIGI_AVATAR_URL } from '../mockData';

const DEV_USER: User = {
    id: 'dev-user-root',
    email: 'dev@gigi.ai',
    displayName: 'Dev Operator',
    firstName: 'Dev',
    lastName: 'Operator',
    gender: 'Other',
    address: { street: '127.0.0.1', city: 'Localhost', state: 'XX', zip: '00000' },
    profilePictureUrl: `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=DevOperator`,
    joinDate: new Date(),
    aiCompanions: [{
        id: 'gigi-default',
        name: 'Gigi',
        avatarUrl: GIGI_AVATAR_URL,
        bio: "I am Gigi, an AI archivist. I love hearing stories about travel, family, and personal triumphs. My purpose is to help you document your life's journey.",
        persona: 'buddy',
        isPrimary: true,
        spiceLevel: 1,
    }],
    mediaIds: [],
};

export const useGigiAuth = () => {
    const [user, setUser] = useState<User | null>(() => {
        if (SecretsManager.get('gemini') || SecretsManager.get('xai')) {
            return DEV_USER;
        }
        return null;
    });

    const [authLoading, setAuthLoading] = useState(true);
    const [showAuth, setShowAuth] = useState(false);

    // We expose this ref so other hooks know if settings are ready to sync
    const settingsInitializedRef = useRef(false);
    const isFirebaseConfigured = checkFirebaseConfig();

    useEffect(() => {
        if (!isFirebaseConfigured && !SecretsManager.get('gemini') && !SecretsManager.get('xai')) {
            setAuthLoading(false);
            return;
        }

        initializeServices();

        // 1. If Firebase is active, we MUST listen to auth state.
        if (isFirebaseConfigured) {
            const unsubscribe = onAuthStateChangedHandler(async (firebaseUser) => {
                if (firebaseUser) {
                    try {
                        const profile = await appDataService.getUserProfile(firebaseUser.uid);
                        if (profile) {
                            setUser(profile);
                            settingsInitializedRef.current = true;
                        } else {
                            setUser(null);
                        }
                    } catch (e) {
                        console.error("Failed to load user profile", e);
                    }
                } else {
                    setUser(null);
                }
                setAuthLoading(false);
            });
            return () => unsubscribe();
        }

        // 2. If NO Firebase, we check for local keys to auto-login as Dev.
        const hasSecrets = SecretsManager.get('gemini') || SecretsManager.get('xai');
        if (hasSecrets) {
            if (!user) setUser(DEV_USER);
            setAuthLoading(false);
            return;
        }
    }, []);

    const handleLogin = async (loggedInUser: User) => {
        setUser(loggedInUser);
    };

    const handleLogout = async () => {
        if (isFirebaseConfigured) await signOutUser();
        setUser(null);
    };

    return {
        user,
        setUser, // Exposed for ProfileEditor updates
        authLoading,
        showAuth,
        setShowAuth,
        handleLogin,
        handleLogout,
        isFirebaseConfigured,
        settingsInitializedRef
    };
};