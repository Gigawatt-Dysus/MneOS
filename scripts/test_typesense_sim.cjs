const { MongoClient } = require('mongodb');

async function run() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    await client.connect();
    const db = client.db('LifeOS');
    
    const cursor = db.collection('pending_accessions').find({});
    
    const term = "car";
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escapedTerm}([^a-z0-9]|$)`, 'i');
    
    let matchedIds = [];
    
    for await (const item of cursor) {
        const tagIds = item.tags ? item.tags.map(t => t.id) : [];
        const searchableContent = [
            (item.title || ''),
            (item.originalName || ''),
            (item.description || ''),
            (item.caption || ''),
            (item.triage?.summary || ''),
            (item.year || '').toString(),
            ...tagIds
        ].join(' ').toLowerCase();
        
        let matches = false;
        try {
            matches = regex.test(searchableContent);
        } catch {
            matches = searchableContent.includes(term);
        }
        
        if (matches) {
            matchedIds.push(item);
        }
    }
    
    console.log(`Found ${matchedIds.length} matches for "car"`);
    
    // Check if any matched item has "cat" in it
    const catImages = matchedIds.filter(item => 
        (item.caption || '').toLowerCase().includes('cat') || 
        (item.triage?.summary || '').toLowerCase().includes('cat') ||
        (item.originalName || '').toLowerCase().includes('cat') ||
        (item.description || '').toLowerCase().includes('cat')
    );
    
    console.log(`Of those, ${catImages.length} images mention "cat"`);
    if (catImages.length > 0) {
        console.log("Example of a cat image that matched 'car':");
        console.log(catImages[0].originalName);
        console.log("Caption:", catImages[0].caption);
        console.log("Tags:", catImages[0].tags);
    }

    await client.close();
}

run().catch(console.error);
