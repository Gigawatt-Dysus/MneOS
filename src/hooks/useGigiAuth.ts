import { useState, useEffect, useRef } from 'react';
import type { User } from '../types';
import { appDataService, initializeServices } from '../services/serviceManager';
import { isFirebaseConfigured as checkFirebaseConfig } from '../firebaseConfig';
import { SecretsManager } from '../utils/SecretsManager';
import { GIGI_AVATAR_URL } from '../mockData';
import { OnboardingService } from '../services/onboardingService';
import { useUser, useAuth } from '@clerk/clerk-react';

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
    const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
    const { signOut } = useAuth();

    // Do NOT default to DEV_USER if Firebase is configured.
    const [user, setUser] = useState<User | null>(null);

    const [authLoading, setAuthLoading] = useState(true);
    const [showAuth, setShowAuth] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const settingsInitializedRef = useRef(false);
    const isFirebaseConfigured = checkFirebaseConfig();

    useEffect(() => {
        // [ZEN FIX] Initialize DB services
        initializeServices();

        // 1. Wait for Clerk to fully initialize
        if (!isClerkLoaded) {
            return;
        }

        // 2. If Clerk is active and user is signed in
        if (isFirebaseConfigured) {
            if (clerkUser) {
                const loadProfile = async () => {
                    try {
                        setAuthError(null);
                        
                        // Extract legacy UID from publicMetadata, fallback to clerk ID
                        const legacyUid = (clerkUser.publicMetadata?.legacy_uid as string) || clerkUser.id;
                        const email = clerkUser.primaryEmailAddress?.emailAddress || '';

                        // [ZEN FIX] Sync Cloud Secrets on Login using legacy UID
                        await SecretsManager.sync(legacyUid);

                        // Trigger Onboarding / Key Propagation
                        const profile = await OnboardingService.provisionUser(legacyUid, email, false);

                        if (profile) {
                            setUser(profile);
                            settingsInitializedRef.current = true;
                        } else {
                            setUser(null);
                        }
                    } catch (e: any) {
                        console.error("Failed to load user profile", e);
                        setUser(null);
                        setAuthError(e.message || "Failed to load user profile");
                    } finally {
                        setAuthLoading(false);
                    }
                };

                loadProfile();
            } else {
                // Not signed into Clerk
                setUser(null);
                setAuthLoading(false);
            }
            return;
        }

        // 3. If NO Firebase (Local Mode), check for local keys to auto-login as Dev.
        const hasSecrets = SecretsManager.get('xai') || SecretsManager.get('fireworks');
        if (hasSecrets) {
            if (!user) setUser(DEV_USER);
            setAuthLoading(false);
            return;
        }

        // 4. Neither Firebase nor Keys
        setAuthLoading(false);

    }, [isFirebaseConfigured, isClerkLoaded, clerkUser]);

    const handleLogin = async (loggedInUser: User) => {
        setUser(loggedInUser);
    };

    const handleLogout = async () => {
        if (isFirebaseConfigured) {
            await signOut();
        }
        setUser(null);
    };

    return {
        user,
        setUser,
        authLoading,
        showAuth,
        setShowAuth,
        handleLogin,
        handleLogout,
        isFirebaseConfigured,
        settingsInitializedRef,
        authError,
        setAuthError
    };
};