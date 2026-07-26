import React, { useState, useRef, useEffect } from 'react';
import { SettingsIcon, GoogleIcon } from './icons';
import type { User } from '../types';
import { appDataService } from '../services/serviceManager';
import { signIn, signUp, signInWithGoogle } from '../services/authService';
import { GIGI_AVATAR_URL } from '../mockData';
import { getConfigDiagnostics } from '../firebaseConfig';
import LoginHeader from './LoginHeader';

interface LoginPageProps {
    isFirebaseConfigured: boolean;
    onLogin: (user: User) => void;
    onDataImported: () => void;
    appResetToken: number;
    onOpenSettings: () => void;
    externalAuthError?: string | null;
    setExternalAuthError?: (err: string | null) => void;
}

type AuthMode = 'signIn' | 'signUp' | 'selectProfile';

const TIMEOUT_MS = 8000;

const LoginPage: React.FC<LoginPageProps> = ({ isFirebaseConfigured, onLogin, onDataImported, appResetToken, onOpenSettings, externalAuthError, setExternalAuthError }) => {
    const [authMode, setAuthMode] = useState<AuthMode>('signUp');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Sync external errors (like background quota limit locks) on mount/update
    useEffect(() => {
        if (externalAuthError) {
            setError(externalAuthError);
        }
    }, [externalAuthError]);

    // Track mount status for safe state updates
    const isMounted = useRef(true);
    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    // For local mode
    const [localProfiles, setLocalProfiles] = useState<User[]>([]);
    const [isLocalProfileLoading, setIsLocalProfileLoading] = useState(!isFirebaseConfigured);

    // Force refresh profiles when appResetToken changes
    useEffect(() => {
        const loadLocalProfiles = async () => {
            if (!isFirebaseConfigured) {
                setIsLocalProfileLoading(true);
                try {
                    const profiles = await appDataService.getAllUserProfiles();
                    if (isMounted.current) {
                        setLocalProfiles(profiles);
                        if (profiles.length > 0) {
                            setAuthMode('selectProfile');
                        } else {
                            setAuthMode('signUp');
                        }
                    }
                } catch (e) {
                    console.error("Failed to load local profiles", e);
                } finally {
                    if (isMounted.current) setIsLocalProfileLoading(false);
                }
            } else {
                setAuthMode('signIn');
            }
        };
        loadLocalProfiles();
    }, [isFirebaseConfigured, appResetToken]);

    const handleRevertToLocal = () => {
        if (window.confirm("This will disable Cloud Sync and return to local storage. You can re-enable it later in Settings. Continue?")) {
            // Set a flag to force local mode, bypassing the hardcoded config in firebaseConfig.ts
            localStorage.setItem('gigi_force_local_mode', 'true');
            // Also clear any custom config
            localStorage.removeItem('gigi_firebase_config');
            window.location.reload();
        }
    };

    const handleCancel = () => {
        setIsLoading(false);
        setError('Operation cancelled.');
    };

    const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        try {
            if (!isFirebaseConfigured) {
                // --- LOCAL MODE AUTHENTICATION ---
                if (authMode === 'signUp') {
                    const firstName = formData.get('firstName') as string;
                    const lastName = formData.get('lastName') as string;
                    if (!firstName || !lastName) {
                        throw new Error("First and last name are required.");
                    }

                    const newId = `user-${Date.now()}`;
                    const newUser: User = {
                        id: newId,
                        email: email,
                        displayName: `${firstName} ${lastName}`,
                        firstName,
                        lastName,
                        gender: 'Prefer not to say',
                        address: { street: '', city: '', state: '', zip: '' },
                        profilePictureUrl: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=random`,
                        joinDate: new Date(),
                        aiCompanions: [{
                            id: 'gigi-default',
                            name: 'System AI',
                            avatarUrl: GIGI_AVATAR_URL,
                            bio: "I am your AI archivist. I love hearing stories about travel, family, and personal triumphs. My purpose is to help you document your life's journey.",
                            persona: 'buddy',
                            isPrimary: true,
                            spiceLevel: 1,
                        }],
                        mediaIds: [],
                    };

                    await appDataService.updateUserProfile(newId, newUser);
                    onLogin(newUser);
                } else {
                    // Local Sign In - Check against local profiles
                    const profiles = await appDataService.getAllUserProfiles();
                    const user = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());

                    if (user) {
                        onLogin(user);
                    } else {
                        // Hint to the user if they are confused about mode
                        let errorMsg = "Local profile not found for this email.";
                        if (profiles.length > 0) {
                            errorMsg += ` Did you mean: ${profiles[0].email}?`;
                        } else {
                            // Explicit instruction for users confused about why they are in local mode
                            errorMsg += " (Local database is empty).";
                        }
                        throw new Error(errorMsg);
                    }
                }
                if (isMounted.current) setIsLoading(false);
                return;
            }

            // --- FIREBASE AUTHENTICATION ---
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Network timeout. The server took too long to respond.")), TIMEOUT_MS)
            );

            if (authMode === 'signUp') {
                const firstName = formData.get('firstName') as string;
                const lastName = formData.get('lastName') as string;
                if (!firstName || !lastName) {
                    throw new Error("First and last name are required for sign up.");
                }
                await Promise.race([
                    signUp(email, password, firstName, lastName),
                    timeoutPromise
                ]);
            } else {
                await Promise.race([
                    signIn(email, password),
                    timeoutPromise
                ]);
            }

            setTimeout(() => {
                if (isMounted.current) {
                    setIsLoading(false);
                    setError("Login successful, but loading your profile timed out. Please check your connection or try refreshing.");
                }
            }, 6000);

        } catch (authError: any) {
            console.error("Authentication Error:", authError);
            let msg = authError.message || 'An unknown error occurred.';
            const code = authError.code || '';

            // Handle specific Local Mode confusion
            if (msg.includes("Local profile not found")) {
                if (isMounted.current) {
                    if (msg.includes("Local database is empty")) {
                        setError("No local profiles found. Switched to Sign Up mode.");
                        setAuthMode('signUp');
                    } else {
                        setError(msg);
                    }
                    setIsLoading(false);
                }
                return;
            }

            if (code === 'auth/configuration-not-found' || msg.includes('configuration-not-found')) {
                msg = "Configuration Error: 'authDomain' is missing or invalid. Please check Settings.";
            } else if (code === 'auth/operation-not-allowed' || msg.includes('operation-not-allowed')) {
                msg = "Firebase Setup Error: Email/Password sign-in is not enabled in your Firebase Console.";
            } else if (code === 'auth/invalid-api-key' || msg.includes('invalid-api-key') || code === 'auth/api-key-not-valid' || msg.includes('api-key-not-valid')) {
                msg = "Authentication Failed: Invalid API Key. Please check Settings.";
            } else if (code === 'auth/invalid-credential' || msg.includes('invalid-credential')) {
                msg = "Authentication Failed: The configured Cloud Project rejected your credentials.\n\nThis usually means the API Key is restricted or the project does not exist. Please switch to Local Mode.";
            } else if (code === 'auth/user-not-found' || msg.includes('user-not-found') || code === 'auth/wrong-password' || msg.includes('wrong-password') || code === 'auth/invalid-email') {
                msg = "Invalid email or password.";
            } else if (code === 'auth/network-request-failed') {
                msg = "Network Error: Could not reach Firebase. Check your internet connection.";
            }

            if (isMounted.current) {
                setError(msg);
                setIsLoading(false);
            }
        }
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError('');
        try {
            await signInWithGoogle();
        } catch (authError: any) {
            console.error("Google Auth Error:", authError);
            setError(authError.message || 'Google Auth failed.');
            setIsLoading(false);
        }
    };

    const inputClasses = "mt-1 block w-full bg-gray-700/50 border-gray-500/30 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 sm:text-sm";

    // We keep fetching diagnostics but do NOT render the blocking UI
    const diagnostics = getConfigDiagnostics();

    return (
        <div className="h-full overflow-y-auto flex flex-col text-center p-4 custom-scrollbar relative">
            <div className="absolute top-4 right-4 z-[150]">
                <button
                    onClick={onOpenSettings}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors shadow-lg"
                    title="Application Settings & Cloud Config"
                >
                    <SettingsIcon className="w-6 h-6" />
                </button>
            </div>

            <main className="flex-grow flex flex-col items-center justify-center py-8 z-10 min-h-min">
                <div className="w-full max-w-md bg-gray-900/70 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-white/10 button-glow mb-8">
                    <LoginHeader />
                    <p className="text-center text-gray-300 -mt-2 mb-4 text-sm max-w-xs mx-auto text-glow">
                        An AI-powered personal archive to preserve, organize, explore and reimagine your life's most precious memories.
                    </p>

                    {!isFirebaseConfigured && isLocalProfileLoading ? (
                        <p className="mt-4 text-gray-300 animate-pulse">Loading local profiles...</p>
                    ) : !isFirebaseConfigured && authMode === 'selectProfile' ? (
                        <div className="mt-6 space-y-3">
                            <h2 className="text-lg text-gray-300">Choose a local profile.</h2>
                            {localProfiles.map(profile => (
                                <button key={profile.id} onClick={() => onLogin(profile)} className="w-full flex items-center gap-4 p-3 text-left bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                                    <img src={profile.profilePictureUrl} alt={profile.displayName} className="w-10 h-10 rounded-full object-cover" />
                                    <div>
                                        <p className="font-semibold text-white">{profile.displayName}</p>
                                        <p className="text-sm text-gray-300">{profile.email}</p>
                                    </div>
                                </button>
                            ))}
                            <button onClick={() => setAuthMode('signUp')} className="w-full text-sm text-violet-400 hover:underline mt-2">Create new local profile</button>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-center text-lg text-gray-300 text-glow">
                                {authMode === 'signUp' ? 'Create Your Archive' : 'Let Me Be Your Gateway...'}
                            </h2>
                            <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4 text-left">
                                {authMode === 'signUp' && (
                                    <>
                                        <div>
                                            <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 text-glow">First Name</label>
                                            <input type="text" name="firstName" id="firstName" required className={inputClasses} />
                                        </div>
                                        <div>
                                            <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 text-glow">Last Name</label>
                                            <input type="text" name="lastName" id="lastName" required className={inputClasses} />
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 text-glow">Email Address</label>
                                    <input type="email" name="email" id="email" required className={inputClasses} />
                                </div>
                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-300 text-glow">Password</label>
                                    <input type="password" name="password" id="password" required className={inputClasses} />
                                </div>
                                {error && (
                                    <div className="p-3 bg-red-900/50 border border-red-500 rounded-md animate-toastIn">
                                        <p className="text-sm text-red-200 text-center font-semibold mb-2 whitespace-pre-wrap">{error}</p>
                                        {error.includes("Configuration Error") && (
                                            <button
                                                type="button"
                                                onClick={onOpenSettings}
                                                className="block w-full px-4 py-2 bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors"
                                            >
                                                Configure Cloud Sync
                                            </button>
                                        )}
                                        {isFirebaseConfigured && (
                                            <button
                                                type="button"
                                                onClick={handleRevertToLocal}
                                                className="block w-full px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors mt-2"
                                            >
                                                Switch to Local Mode
                                            </button>
                                        )}
                                    </div>
                                )}
                                <div className="pt-2 flex flex-col gap-2">
                                    <button type="submit" disabled={isLoading} className="w-full px-6 py-3 bg-violet-950 border border-violet-500/50 text-white font-semibold rounded-lg shadow-md hover:bg-violet-900 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-violet-500 disabled:bg-gray-800 button-glow text-glow">
                                        {isLoading ? 'Processing...' : (authMode === 'signUp' ? 'Sign Up' : 'Sign In')}
                                    </button>
                                    {isLoading && (
                                        <button type="button" onClick={handleCancel} className="w-full py-1 text-xs text-red-400 hover:text-white hover:bg-red-900/50 rounded transition-colors border border-transparent hover:border-red-800">
                                            Cancel / Reset
                                        </button>
                                    )}
                                </div>
                            </form>

                            <p className="text-center text-sm text-gray-300 mt-6">
                                {authMode === 'signIn' ? "Don't have an account? " : "Already have an account? "}
                                <button type="button" onClick={() => { setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn'); setError(''); if (setExternalAuthError) setExternalAuthError(null); }} className="font-semibold text-violet-400 hover:underline text-glow">
                                    {authMode === 'signIn' ? "Sign Up" : "Sign In"}
                                </button>
                            </p>

                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-white/20"></div></div>
                                <div className="relative flex justify-center"><span className="bg-gray-900/70 px-2 text-sm text-gray-400">Or</span></div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleGoogleSignIn}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg shadow-md hover:bg-gray-100 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                >
                                    <GoogleIcon className="w-5 h-5" />
                                    Continue with Google
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </main>
            <footer className="flex-shrink-0 p-4 text-center text-gray-400 text-sm z-10">
                &copy; 2026 MneOS v.8 | Solving for I
            </footer>
        </div>
    );
};

export default LoginPage;
