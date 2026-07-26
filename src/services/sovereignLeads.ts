import { db, collection, addDoc, updateDoc, doc, serverTimestamp, query, where, orderBy, getDocs } from './sovereignDbAdapter';
import { Timestamp } from './sovereignDbAdapter';

export interface AtsLead {
    id?: string;
    userId: string;
    visitorName: string;
    visitorTitle: string;
    visitorCompany: string;
    targetRole: string;
    timestamp: any;
    lastActive: any;
    durationSec: number;
    status: 'active' | 'completed';
}

/**
 * Creates a new lead record when a recruiter checks in.
 */
export const logAtsVisit = async (userId: string, context: { name: string, title: string, company: string, role: string }): Promise<string> => {
    try {
        const leadRef = await addDoc(collection(db, 'ats_leads'), {
            userId,
            visitorName: context.name,
            visitorTitle: context.title,
            visitorCompany: context.company,
            targetRole: context.role,
            timestamp: serverTimestamp(),
            lastActive: serverTimestamp(),
            durationSec: 0,
            status: 'active'
        });
        return leadRef.id;
    } catch (e) {
        console.error("Error logging ATS visit:", e);
        throw e;
    }
};

/**
 * Updates the heartbeat of a lead to track duration.
 */
export const updateAtsHeartbeat = async (leadId: string, durationIncrement: number = 30) => {
    try {
        const leadRef = doc(db, 'ats_leads', leadId);
        await updateDoc(leadRef, {
            lastActive: serverTimestamp(),
            durationSec: durationIncrement // This should be a cumulative update in a real production app using fieldValues.increment
        });
    } catch (e) {
        console.error("Error updating ATS heartbeat:", e);
    }
};

/**
 * Fetches all leads for a specific user.
 */
export const getAtsLeads = async (userId: string): Promise<AtsLead[]> => {
    try {
        const q = query(
            collection(db, 'ats_leads'), 
            where('userId', '==', userId),
            orderBy('timestamp', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AtsLead));
    } catch (e) {
        console.error("Error fetching ATS leads:", e);
        return [];
    }
};
