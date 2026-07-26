import { db } from '../firebaseConfig';
import { collection, doc, getDoc, getDocs, query, where, setDoc, deleteDoc, updateDoc } from './sovereignDbAdapter';

// [ZEN V34] THE SOVEREIGN CODEX (Project MUSE)
// This service manages the "Bibles" and "Rules of Reality" for creative projects.
// It allows Brita (The GM) and the User (The Architect) to define persistent canon.

export interface CodexEntry {
    id: string;
    subject: string;
    category: 'Physics' | 'Lore' | 'Character' | 'History' | 'Ethics' | 'Mechanism';
    rule: string;
    provenance: string; // How was this rule established? (e.g., "User Decree", "AI Proposal")
    tags: string[];
    lastUpdated: number;
}

export interface CodexBible {
    id: string;
    title: string;
    description: string;
    ownerId: string;
    isActive: boolean;
    entries: CodexEntry[];
}

export const CodexService = {
    // 1. Get the Active Bible for a User/Session
    async getActiveBible(userId: string): Promise<CodexBible | null> {
        const q = query(collection(db, 'codex_bibles'), where('ownerId', '==', userId), where('isActive', '==', true));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as CodexBible;
    },

    // 2. Add/Update a Law in the Codex
    async commitToCanon(bibleId: string, entry: Omit<CodexEntry, 'id' | 'lastUpdated'>): Promise<string> {
        const entryId = entry.subject.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const entryRef = doc(db, 'codex_bibles', bibleId, 'entries', entryId);
        
        const fullEntry: CodexEntry = {
            ...entry,
            id: entryId,
            lastUpdated: Date.now()
        };

        await setDoc(entryRef, fullEntry);
        console.log(`%c[Codex] 📜 New Canon Established: ${entry.subject}`, 'color: #00ffff;');
        return entryId;
    },

    // 3. Search for Lore/Physics Rules
    async searchCanon(bibleId: string, queryText: string): Promise<CodexEntry[]> {
        // [ZEN] In V1, we fetch all and let the Librarian filter. 
        // Future: Full-text search via Typesense.
        const snapshot = await getDocs(collection(db, 'codex_bibles', bibleId, 'entries'));
        const entries = snapshot.docs.map(doc => doc.data() as CodexEntry);
        
        // Simple keyword filter for now
        const keywords = queryText.toLowerCase().split(' ');
        return entries.filter(e => 
            keywords.some(k => e.subject.toLowerCase().includes(k) || e.rule.toLowerCase().includes(k))
        );
    },

    // 4. Propose a New Rule (Brita's logic)
    generateProposal(subject: string, suggestedRule: string): string {
        return `[CODEX PROPOSAL]: Should we establish a hard rule for "${subject}"? Proposed Law: ${suggestedRule}`;
    }
};
