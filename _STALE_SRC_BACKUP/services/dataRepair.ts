import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import type { User, LifeEvent, AiCompanion } from '@/types';
import { generateAgentResponse } from './ai/generators';

const LIBRARIAN_AGENT: AiCompanion = {
    id: 'sys_librarian',
    name: 'Librarian',
    persona: 'Archivist',
    bio: 'You organize data. You create safe, 1-sentence summaries.',
    avatarUrl: '',
    isPrimary: false
};

export const backfillEventDescriptions = async (user: User, events: LifeEvent[]) => {
    console.log(`[Backfill] 🛠️ Starting Description Repair for ${events.length} events...`);
    let updatedCount = 0;

    // const sortedEvents = [...events].sort((a, b) => b.date.getTime() - a.date.getTime());
    // Proposed (Oldest First)
    const sortedEvents = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const event of sortedEvents) {
        // [ZEN LOGIC] We skip if the NEW field 'description' exists
        if (event.description && event.description.length > 5) {
            console.log(`[Backfill] Skipping "${event.title}" (Description exists)`);
            continue;
        }

        console.log(`[Backfill] ✏️ Generating description for: "${event.title}"...`);

        try {
            const prompt = `
            I have a Life Event record. 
            Title: "${event.title}"
            Private Notes: "${event.privateDetails || 'None'}"
            Details: "${event.details || ''}"
            
            TASK: Write a 3 to 5 sentence PUBLIC description (summary) for this event. 
            It must be safe to display in a timeline. Do not reveal sensitive secrets, just summarize the "What".
            If the title is descriptive enough, just restate it much more elegantly.
            `;

            const res = await generateAgentResponse(
                LIBRARIAN_AGENT,
                [{ role: 'user', parts: [{ text: prompt }] }],
                ['Librarian'],
                "",
                [],
                user
            );

            const description = res.text?.trim() || "Event archived.";

            // [ZEN FIX] Collection name corrected to 'events'
            const eventRef = doc(db, 'users', user.id, 'events', event.id);
            await updateDoc(eventRef, { description });
            
            console.log(`[Backfill] ✅ Updated: "${event.title}" -> "${description}"`);
            updatedCount++;

            // Rate limit to be kind to the AI API
            await new Promise(r => setTimeout(r, 800));

        } catch (e) {
            console.error(`[Backfill] ❌ Failed on "${event.title}"`, e);
        }
    }

    console.log(`[Backfill] 🎉 Complete! Updated ${updatedCount} events.`);
    alert(`Backfill Complete! ${updatedCount} descriptions added. Check Console for details.`);
};