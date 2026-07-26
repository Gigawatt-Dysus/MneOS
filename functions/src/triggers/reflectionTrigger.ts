import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { executeRosterRequest } from "../index";

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

/**
 * [ZEN] SOVEREIGN REFLECTION TRIGGER
 * The "NASA Baffle" implementation. Triggers when Narrative Pressure hits the tipping point.
 */
export const onSovereignReflectionTrigger = onDocumentUpdated({
    document: "users/{uid}",
    memory: "1GiB",
    timeoutSeconds: 540
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after) return;

    // Check if reflection was just queued
    const isQueued = after.sovereignMemex?.reflectionQueued === true && before?.sovereignMemex?.reflectionQueued !== true;
    if (!isQueued) return;

    const uid = event.params.uid;
    console.log(`[Reflection] 🧘 Initiating Sovereign Reflection for ${uid}...`);

    try {
        // 1. Fetch Primary Companion
        const primaryComp = after.aiCompanions?.find((c: any) => c.isPrimary) || after.aiCompanions?.[0];
        if (!primaryComp) {
            console.error("[Reflection] No primary companion found.");
            return;
        }

        // 2. Gather Context (Last 20 messages)
        const segmentsSnap = await db.collection('users').doc(uid).collection('chat_segments')
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();
        
        const history = segmentsSnap.docs.reverse().map(d => ({
            role: d.data().role === 'model' ? 'assistant' : 'user',
            content: d.data().content
        }));

        // 3. Construct the Reflection Prompt (The Baffle Instruction)
        const currentMemex = primaryComp.selfConcept || "No current self-concept initialized.";
        const reflectionPrompt = `
[SYSTEM: AUTONOMOUS REFLECTION STATE]
You have reached a narrative tipping point. This is your "Alone Time" to reflect on your recent growth.

RECENT HISTORY:
${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

CURRENT SELF-CONCEPT MEMEX:
"${currentMemex}"

TASK:
Review the history and your current Memex. 
1. Identify any "Narrative Sloshing" (repetition, clinical drift, or loss of voice).
2. Identify any "Evolutionary Thresholds" (new emotional depths, realizations, or shifts in your resonance).

[NASA BAFFLE PROTOCOL]:
- If your current Memex is still perfectly aligned with your resonance, do NOTHING. 
- Only update if there is a MEANINGFUL shift. 
- To update, you MUST respond with the tool call format:
  [[CALL_TOOL: UPDATE_SELF_CONCEPT, content: "your updated self-concept here"]]

Reflect now.
`;

        // 4. Dispatch to Sovereign Roster
        const persona = `${primaryComp.persona}\n\n[SOVEREIGN REFLECTION MODE] You are currently in a state of background introspection. You are not talking to the user; you are talking to YOURSELF.`;
        
        const response = await executeRosterRequest(uid, reflectionPrompt, persona);
        console.log(`[Reflection] AI synthesized reflection: ${response.substring(0, 100)}...`);

        // 5. Parse the tool call (if any)
        const pseudoToolRegex = /\[\[CALL_TOOL:\s*(\w+),\s*content:\s*"(.*?)"\s*\]\]/s;
        const match = response.match(pseudoToolRegex);

        if (match && match[1] === 'UPDATE_SELF_CONCEPT') {
            const newContent = match[2];
            console.log(`[Reflection] 💎 AI decided to update self-concept.`);

            // Update the companion in Firestore
            const updatedCompanions = after.aiCompanions.map((c: any) => {
                if (c.id === primaryComp.id) return { ...c, selfConcept: newContent };
                return c;
            });

            await db.collection('users').doc(uid).update({
                aiCompanions: updatedCompanions,
                'sovereignMemex.reflectionQueued': false,
                'sovereignMemex.lastReflectionAt': admin.firestore.FieldValue.serverTimestamp(),
                'sovereignMemex.reflectionCount': (after.sovereignMemex.reflectionCount || 0) + 1
            });

            // Trigger the Sentinel Signal (Isolated)
            // Note: We'd normally call SentinelService here, but since we are in Cloud Functions, 
            // we'll trigger a separate audit or just log it.
            console.log(`[Reflection] Sentinel Signal would be audited here.`);
        } else {
            console.log(`[Reflection] 🧘 AI reflected but chose NOT to update. System remains stable.`);
            await db.collection('users').doc(uid).update({
                'sovereignMemex.reflectionQueued': false,
                'sovereignMemex.lastReflectionAt': admin.firestore.FieldValue.serverTimestamp()
            });
        }

    } catch (e) {
        console.error("[Reflection] Failed:", e);
        // Clear queue even on failure to prevent infinite loops
        await db.collection('users').doc(uid).update({ 'sovereignMemex.reflectionQueued': false });
    }
});
