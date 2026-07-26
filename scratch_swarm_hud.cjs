const { MongoClient } = require('mongodb');

async function run() {
    const c = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    try {
        await c.connect();
        const db = c.db('LifeOS');
        const pCol = db.collection('pending_accessions');
        const mCol = db.collection('media');
        
        const [pHealed, pPending, pLocked] = await Promise.all([
            pCol.countDocuments({ thumbnail_metadata_healed: true }),
            pCol.countDocuments({ fileType: { $regex: '^image/', $options: 'i' }, thumbnail_metadata_healed: { $ne: true } }),
            pCol.countDocuments({ processing_lock: { $nin: [null, ''] } })
        ]);

        const [mHealed, mPending, mLocked] = await Promise.all([
            mCol.countDocuments({ thumbnail_metadata_healed: true }),
            mCol.countDocuments({ fileType: { $regex: '^image/', $options: 'i' }, thumbnail_metadata_healed: { $ne: true } }),
            mCol.countDocuments({ processing_lock: { $nin: [null, ''] } })
        ]);

        console.log(`\n=== SWARM HUD (Combined) ===`);
        console.log(`HEALED : ${pHealed + mHealed} (Pending: ${pHealed} | Media: ${mHealed})`);
        console.log(`PENDING: ${pPending + mPending} (Pending: ${pPending} | Media: ${mPending})`);
        console.log(`LOCKED : ${pLocked + mLocked} (Pending: ${pLocked} | Media: ${mLocked})`);

        const getLocks = async (col) => col.aggregate([
            { $match: { processing_lock: { $nin: [null, ''] } } },
            { $group: { _id: "$processing_lock", count: { $sum: 1 } } }
        ]).toArray();

        const [pLocks, mLocks] = await Promise.all([getLocks(pCol), getLocks(mCol)]);
        
        console.log(`\nActive Locks:`);
        pLocks.forEach(g => console.log(` [Pending] ${g._id}: ${g.count}`));
        mLocks.forEach(g => console.log(` [Media]   ${g._id}: ${g.count}`));

    } finally {
        await c.close();
    }
}
run();
