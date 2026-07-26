import React, { useState, useEffect } from 'react';
import { Search, User, Loader2 } from 'lucide-react';
import { SmartTagInput } from '../tagging/SmartTagInput';
import { Tag } from '../../types';
import { collection, query, where, getDocs, orderBy } from '../../services/sovereignDbAdapter';
import { db } from '../../firebaseConfig';
import { auth } from '../../firebaseConfig'; // Need auth for userId if not passed, but props will pass it likely

interface PersonPickerProps {
    onSelect: (person: { id: string; name: string }) => void;
    onClose: () => void;
}

interface PersonTag {
    id: string;
    name: string;
    avatarUrl?: string; // Optional
    type: Tag['type']; // Added for SmartTagInput compatibility
}

export const PersonPicker: React.FC<PersonPickerProps> = ({ onSelect, onClose }) => {
    const [queryText, setQueryText] = useState('');
    const [people, setPeople] = useState<PersonTag[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPeople = async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                // Fetch tags categorized as 'person' or 'people'
                // This assumes a 'tags' collection or similar. 
                // Adjust per Project GIGI schema. 
                // EWO 008 Assumption: There is a 'tags' subcollection.
                const tagsRef = collection(db, 'users', user.uid, 'tags');
                // [ZEN FIX] Schema uses 'type' not 'category'. Querying with correct field name.
                const q = query(tagsRef, where('type', '==', 'person'));

                const snapshot = await getDocs(q);
                // Fallback: If query fails (index issue), try fetching all and filtering?
                // Or just assume 'person' category exists.

                // If empty result, maybe try just getting all tags and filtering by name heuristically?
                // Let's stick to the query. If it fails, we handle error.

                const fetchedPeople: PersonTag[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    fetchedPeople.push({
                        id: doc.id,
                        name: data.name,
                        avatarUrl: data.avatarUrl || data.iconUrl,
                        type: data.type || 'person'
                    });
                });

                // Sort by name
                fetchedPeople.sort((a, b) => a.name.localeCompare(b.name));
                setPeople(fetchedPeople);
            } catch (e) {
                console.error('[PersonPicker] Failed to fetch people:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchPeople();
    }, []);

    const filteredPeople = people.filter(p =>
        p.name.toLowerCase().includes(queryText.toLowerCase())
    );

    return (
        <div className="bg-slate-900 border border-white/20 rounded-lg shadow-2xl flex flex-col w-48 max-h-64 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* [ZEN EWO 009] Smart Input Integration */}
            <div className="p-2 border-b border-white/10">
                <SmartTagInput
                    availableTags={people as any} // Cast to Tag[] (PersonTag subset)
                    onSelectTag={(tag) => onSelect({ id: tag.id, name: tag.name })}
                    onCreateTag={(name, type) => onSelect({ id: `NEW-${name}`, name })} // Pass new name, overlay handles creation logic via staging
                    placeholder="Search or add person..."
                    autoFocus={true}
                />
            </div>

            {/* Hide backup list since SmartTagInput handles suggestions, but we can keep recent/all list below if desired. 
                For now, let's keep the list but filtered only if SmartInput is empty? 
                Actually SmartInput handles its own dropdown. We can remove this list or use it as specific "Recent People".
                Let's hide it to avoid double-dropdown confusion.
            */}
            {/* <div className="flex-1 overflow-y-auto custom-scrollbar p-1">...</div> */}

            <div className="p-1 border-t border-white/10 bg-black/20">
                <button
                    onClick={onClose}
                    className="w-full text-[9px] text-slate-500 hover:text-slate-300 py-1"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};
