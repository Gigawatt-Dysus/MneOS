// @ts-ignore
import { initializeApp, FirebaseApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, Auth, User as FirebaseUser, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { firebaseConfig } from '../firebaseConfig';
import { appDataService } from './serviceManager';
import type { User } from '../types';
import { GIGI_AVATAR_URL } from '../mockData'; // [ZEN FIX] Point to root mockData

let app: FirebaseApp;
export let auth: Auth;

export const initializeAuth = () => {
    console.log("%c[System] ATTEMPTING FIREBASE AUTHENTICATION...", "color: #00e7ff");
    // Prevent double initialization
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
    auth = getAuth(app);
};

export const signUp = async (email: string, password: string, firstName: string, lastName: string): Promise<void> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // After creating the user in Firebase Auth, create their profile document in Firestore
    const newUserProfile: User = {
        id: firebaseUser.uid,
        email: email,
        displayName: `${firstName} ${lastName}`,
        firstName,
        lastName,
        gender: 'Prefer not to say',
        address: { street: '', city: '', state: '', zip: '' },
        profilePictureUrl: `https://i.pravatar.cc/150?u=${firebaseUser.uid}`,
        joinDate: new Date(),
        aiCompanions: [{
            id: 'gigi-default',
            name: 'Gigi',
            avatarUrl: GIGI_AVATAR_URL,
            bio: "I am Gigi, an AI archivist. I love hearing stories about travel, family, and personal triumphs. My purpose is to help you document your life's journey.",
            persona: 'buddy',
            isPrimary: true,
        }],
        mediaIds: [],
    };

    await appDataService.updateUserProfile(firebaseUser.uid, newUserProfile);
};

export const signInWithGoogle = async (): Promise<void> => {
    const provider = new GoogleAuthProvider();
    // Force account selection
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
};

export const signIn = async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
};

export const signOutUser = async (): Promise<void> => {
    await signOut(auth);
};

export const onAuthStateChangedHandler = (callback: (user: FirebaseUser | null) => void) => {
    return onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("%c[System] FIREBASE AUTH ESTABLISHED", "color: #10b981; font-weight: bold;");
        }
        callback(user);
    });
};