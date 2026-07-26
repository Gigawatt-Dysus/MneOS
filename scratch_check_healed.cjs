const { MongoClient } = require('mongodb');
async function check() {
    const c = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin');
    try {
        await c.connect();
        const db = c.db('LifeOS');
        const recent = await db.collection('media').find({}).sort({ updatedAt: -1 }).limit(3).toArray();
        console.log('Recent updates:', recent.map(r => ({ id: r._id, updatedAt: r.updatedAt, healed: r.thumbnail_rotation_healed })));
    } catch (e) {
        console.error(e);
    } finally {
        await c.close();
    }
}
check();
