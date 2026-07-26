import { getAuth } from 'firebase/auth';
import type { User } from '@/types';

export const ROOT_IDENTIFIERS = ['eric', 'artin', 'dysus', 'dysys'];
export const MASTER_EMAILS = ['dysus2024@gmail.com'];

/**
 * The Nuclear Root Check.
 * Verified against Firestore profile, Firebase Auth, and known master signatures.
 */
export const isRootUser = (user?: User | null): boolean => {
    // 1. SESSION-LEVEL HARDENING (DYSUS IDENTITY BYPASS)
    const auth = getAuth();
    const firebaseUser = auth.currentUser;
    const authEmail = (firebaseUser?.email || '').toLowerCase();
    const authUid = (firebaseUser?.uid || '').toLowerCase();

    const isMasterAuth = authEmail === 'dysus2024@gmail.com' ||
        authEmail.includes('dysus') ||
        authUid.includes('dysus') ||
        authUid === 'dev-user-root';

    if (isMasterAuth) return true;

    // 2. PROFILE-LEVEL HARDENING
    if (!user) return false; // If no session match and no user object, fail.

    if (user.role === 'root' || user.role === 'admin') return true;
    if (user.id === 'dev-user-root') return true;

    const email = (user.email || '').toLowerCase();
    const id = (user.id || '').toLowerCase();

    return email === 'dysus2024@gmail.com' ||
        MASTER_EMAILS.some(m => email === m.toLowerCase()) ||
        ROOT_IDENTIFIERS.some(rid => email.includes(rid) || id.includes(rid));
};
