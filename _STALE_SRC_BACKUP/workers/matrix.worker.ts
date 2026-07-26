import MiniSearch from 'minisearch';

// 1. Initialize the Engine
const miniSearch = new MiniSearch({
    fields: ['title', 'originalName', 'description', 'caption', 'tags', 'year', 'fileType'], 
    storeFields: ['id'], // We ONLY store ID to keep memory low
    searchOptions: {
        boost: { title: 4, tags: 3, originalName: 2 }, 
        fuzzy: 0.25, // Allows "cotage" to match "cottage"
        prefix: true, // Allows "cot" to match "cottage"
        combineWith: 'AND' // "Beach Dog" means Beach AND Dog
    }
});

let isReady = false;

self.onmessage = (e: MessageEvent) => {
    const { type, payload, id } = e.data;

    try {
        switch (type) {
            case 'LOAD':
                console.time('Worker:Index');
                miniSearch.removeAll();
                miniSearch.addAll(payload);
                isReady = true;
                console.timeEnd('Worker:Index');
                self.postMessage({ type: 'LOAD_COMPLETE', id });
                break;

            case 'SEARCH':
                if (!isReady || !payload.trim()) {
                    self.postMessage({ type: 'SEARCH_RESULTS', payload: [], id });
                    return;
                }

                // EXECUTE SEARCH
                const results = miniSearch.search(payload.trim());
                
                // Extract just the IDs
                const ids = results.map(r => r.id);
                
                self.postMessage({ type: 'SEARCH_RESULTS', payload: ids, id });
                break;
        }
    } catch (err) {
        console.error("Worker Error:", err);
    }
};