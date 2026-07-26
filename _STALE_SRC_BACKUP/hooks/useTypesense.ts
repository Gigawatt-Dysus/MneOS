import { useState, useEffect } from 'react';
import Typesense from 'typesense';

const client = new Typesense.Client({
    nodes: [{
        host: 'u3sc4eka1lib0qnhp-1.a1.typesense.net',
        port: 443,
        protocol: 'https'
    }],
    apiKey: 'zzf3rXHDJRJli2Lg5YqjBr9R0fxZKciX', // SEARCH KEY
    connectionTimeoutSeconds: 2
});

export const useTypesense = (query: string) => {
    const [matchingIds, setMatchingIds] = useState<Set<string> | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        // If query is empty, return NULL (Signal to show "All")
        if (!query.trim()) {
            setMatchingIds(null);
            setIsSearching(false);
            return;
        }

        const search = async () => {
            setIsSearching(true);
            console.time(`Typesense Search: "${query}"`); // START TIMER
            
            try {
                const response = await client.collections('media_v1').documents().search({
                    q: query,
                    query_by: 'title,originalName,description,tags',
                    per_page: 250, 
                    prefix: true,  
                    num_typos: 2   
                });

                console.timeEnd(`Typesense Search: "${query}"`); // END TIMER (Expect < 100ms)

                // Cast document to 'any' to fix TS error
                const ids = new Set(response.hits?.map(h => (h.document as any).id));
                setMatchingIds(ids);
            } catch (e) {
                console.error("Typesense Cloud Error:", e);
                setMatchingIds(new Set()); 
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(search, 300); 
        return () => clearTimeout(timer);
    }, [query]);

    return { matchingIds, isSearching };
};