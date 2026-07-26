import React, { useState, useRef, useEffect } from 'react';
import { RestoreIcon, SettingsIcon, DisplaySettingsIcon } from './icons';
import type { User } from '@/types';
import { appDataService } from '../services/serviceManager';
import { signIn, signUp } from '../services/authService';
import { GIGI_AVATAR_URL } from '../mockData';
import { getConfigDiagnostics } from '../firebaseConfig';
import LoginHeader from './LoginHeader';
import { readFileContent } from './BackupImportModal'; // Re-use robust file reader

interface LoginPageProps {
    isFirebaseConfigured: boolean;
    onLogin: (user: User) => void;
    onDataImported: () => void;
    appResetToken: number;
    onOpenSettings: () => void;
}

type AuthMode = 'signIn' | 'signUp' | 'selectProfile';

type ImportStatus = 
  | { type: 'idle' }
  | { type: 'confirming', file: File }
  | { type: 'loading', message: string }
  | { type: 'success', message: string }
  | { type: 'error', message: string };

interface ProgressState {
    current: number;
    total: number;
    header: string;
    detail: string;
}

const TIMEOUT_MS = 8000; 

const LoginPage: React.FC<LoginPageProps> = ({ isFirebaseConfigured, onLogin, onDataImported, appResetToken, onOpenSettings }) => {
    const [authMode, setAuthMode] = useState<AuthMode>('signUp');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [importStatus, setImportStatus] = useState<ImportStatus>({ type: 'idle' });
    const [importProgress, setImportProgress] = useState<ProgressState | null>(null);
    const backupImportFileRef = useRef<HTMLInputElement>(null);
    
    // Track mount status for safe state updates
    const isMounted = useRef(true);
    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);
    
    // For local mode
    const [localProfiles, setLocalProfiles] = useState<User[]>([]);
    const [isLocalProfileLoading, setIsLocalProfileLoading] = useState(!isFirebaseConfigured);

    // Force refresh profiles when appResetToken changes (after restore)
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

    // Reset internal state when a parent-driven reset occurs.
    useEffect(() => {
        if (appResetToken > 0) {
            if (importStatus.type !== 'success') {
                 setImportStatus({ type: 'idle' });
                 setImportProgress(null);
            }
        }
    }, [appResetToken]);

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
                            name: 'Gigi',
                            avatarUrl: GIGI_AVATAR_URL,
                            bio: "I am Gigi, an AI archivist. I love hearing stories about travel, family, and personal triumphs. My purpose is to help you document your life's journey.",
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

    const handleBackupFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImportStatus({ type: 'confirming', file });
        }
        e.target.value = '';
    };

    const handleStartBackupImport = async () => {
        if (importStatus.type !== 'confirming') return;
        
        const file = importStatus.file;
        
        try {
            setImportStatus({ type: 'loading', message: 'Reading backup file...' });
            setImportProgress({ current: 0, total: 100, header: 'PREPARING', detail: 'Reading File...' });
            setLocalError(null);

            const jsonString = await readFileContent(file);

            if (!jsonString || jsonString.length === 0) {
                throw new Error("File appears empty or unreadable.");
            }

            let data;
            try {
                data = JSON.parse(jsonString);
            } catch (parseError) {
                throw new Error(`Invalid JSON format. ${(parseError as Error).message}`);
            }
            
            let configRestored = false;
            if (data.firebaseConfig) {
                console.log("Found Firebase Config in backup. Restoring...");
                try {
                    localStorage.setItem('gigi_firebase_config', JSON.stringify(data.firebaseConfig));
                    configRestored = true;
                } catch (e) {
                    console.error("Failed to restore firebase config from backup", e);
                }
            }

            setImportStatus({ type: 'loading', message: isFirebaseConfigured ? 'Uploading data to Cloud...' : 'Restoring local data...' });
            setImportProgress({ current: 0, total: 100, header: 'INITIALIZING', detail: 'Starting Import...' });
            
            // Perform Import with progress reporting
            await appDataService.importBackupData(data, undefined, (header, detail, current, total) => {
                setImportProgress({ header, detail, current, total });
            });
            
            if (configRestored) {
                setImportStatus({ type: 'success', message: 'Config restored! Reloading...' });
                setTimeout(() => window.location.reload(), 1500); 
            } else {
                const successMessage = isFirebaseConfigured 
                    ? 'Restore complete! Please Log In with your backup credentials.' 
                    : 'Data restored! Checking profiles...';
                
                setImportStatus({ type: 'success', message: successMessage });
                
                setTimeout(() => {
                    if(isMounted.current) {
                        setImportStatus({ type: 'idle' });
                        setImportProgress(null);
                        onDataImported(); // This will trigger the useEffect to reload profiles
                    }
                }, 2000);
            }

        } catch (error) {
            console.error('Restore failed', error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            setImportStatus({ type: 'error', message: `Restore failed: ${errorMessage}` });
            setImportProgress(null);
        }
    };
    
    const inputClasses = "mt-1 block w-full bg-gray-700/50 border-gray-500/30 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 sm:text-sm";

    // We keep fetching diagnostics but do NOT render the blocking UI
    const diagnostics = getConfigDiagnostics();
    
    // Local state for error and progress (overriding the outer state passed in for cleaner UI management here)
    const [localProgress, setLocalProgress] = useState<ProgressState | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);

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
                    
                    {importStatus.type !== 'idle' ? (
                         <div className="flex flex-col items-center justify-center min-h-[400px]">
                            {importStatus.type === 'confirming' && (
                                <div className="w-full text-left p-4 bg-gray-800 rounded-lg border border-violet-700">
                                    <p className="text-sm font-medium text-gray-200">Ready to restore from: <span className="font-bold text-white">{importStatus.file.name}</span></p>
                                    <p className="text-sm text-yellow-400 mt-2 font-semibold">
                                        {isFirebaseConfigured 
                                            ? "Warning: This will overwrite data in your Cloud Database for the users in the backup file." 
                                            : "Warning: This will overwrite ALL current local data. This action cannot be undone."}
                                    </p>
                                    <div className="mt-4 flex gap-4 justify-end">
                                        <button onClick={() => setImportStatus({type: 'idle'})} className="px-4 py-1.5 text-sm font-semibold text-gray-200 hover:bg-white/10 rounded-lg">Cancel</button>
                                        <button onClick={handleStartBackupImport} className="px-4 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700">Confirm & Restore</button>
                                    </div>
                                </div>
                            )}
                            {(importStatus.type === 'loading' || importStatus.type === 'success' || importStatus.type === 'error') && (
                                <div className={`p-6 rounded-lg text-lg text-center w-full ${
                                    importStatus.type === 'success' ? 'bg-green-900/50 text-green-200 border border-green-500'
                                    : importStatus.type === 'error' ? 'bg-red-900/50 text-red-200 border border-red-500'
                                    : 'bg-blue-900/50 text-blue-200 border border-blue-500'
                                }`}>
                                    <p className="font-bold mb-2">{importStatus.message}</p>
                                    
                                    {importProgress && (
                                        <div className="mt-3">
                                            <p className="text-sm font-bold uppercase tracking-widest text-blue-300 mb-1">{importProgress.header}</p>
                                            <p className="text-lg font-semibold text-white mb-4 truncate h-8">{importProgress.detail}</p>
                                            <div className="w-full bg-black/30 rounded-full h-3 border border-white/20 overflow-hidden">
                                                <div 
                                                    className="bg-white h-full rounded-full transition-all duration-300" 
                                                    style={{ width: `${(importProgress.current / Math.max(importProgress.total, 1)) * 100}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-xs mt-1">{importProgress.current} / {importProgress.total}</p>
                                        </div>
                                    )}

                                    {importStatus.type === 'error' && (
                                        <button onClick={() => { setImportStatus({ type: 'idle' }); setImportProgress(null); }} className="mt-4 px-4 py-1 text-sm border border-red-400 rounded hover:bg-red-800">Try Again</button>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
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
                                        <button type="button" onClick={() => { setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn'); setError(''); }} className="font-semibold text-violet-400 hover:underline text-glow">
                                            {authMode === 'signIn' ? "Sign Up" : "Sign In"}
                                        </button>
                                    </p>
                                    
                                    <div className="relative my-6">
                                        <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-white/20"></div></div>
                                        <div className="relative flex justify-center"><span className="bg-gray-900/70 px-2 text-sm text-gray-400">Or</span></div>
                                    </div>
                                    
                                    <button onClick={() => backupImportFileRef.current?.click()} className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white/10 text-white font-semibold rounded-lg shadow-md hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-white button-glow">
                                        <RestoreIcon className="w-6 h-6" /> Restore from Backup
                                    </button>
                                    <input type="file" ref={backupImportFileRef} onChange={handleBackupFileSelected} className="hidden" accept=".json,.gz,application/json,application/gzip,application/x-gzip" />
                                </>
                            )}
                        </>
                    )}
                </div>
            </main>
            <footer className="flex-shrink-0 p-4 text-center text-gray-400 text-sm z-10">
                &copy; 2025 Project Gigi. Your memories, reimagined.
            </footer>
        </div>
    );
};

export default LoginPage;